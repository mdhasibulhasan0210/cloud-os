const User         = require('../models/User');
const Subject      = require('../models/Subject');
const Chapter      = require('../models/Chapter');
const File         = require('../models/File');
const Result       = require('../models/Result');
const Broadcast    = require('../models/Broadcast');
const Message      = require('../models/Message');
const Setting      = require('../models/Setting');
const logger = require('../utils/logger');
const archiver = require('archiver');

// @desc    Get admin dashboard stats
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, pendingUsers, approvedUsers, totalFiles, pendingFiles,
           totalSubjects, totalChapters, totalMessages, totalBroadcasts, files] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ status: 'approved' }),
      File.countDocuments({ status: 'approved' }),
      File.countDocuments({ status: 'pending' }),
      Subject.countDocuments({}),
      Chapter.countDocuments({}),
      Message.countDocuments({}),
      Broadcast.countDocuments({}),
      File.find({}, 'size')
    ]);

    const storageUsed = files.reduce((total, f) => total + (f.size || 0), 0);

    res.json({
      success: true,
      stats: {
        users: { total: totalUsers, pending: pendingUsers, approved: approvedUsers },
        files: { total: totalFiles, pending: pendingFiles },
        subjects: totalSubjects,
        chapters: totalChapters,
        messages: totalMessages,
        broadcasts: totalBroadcasts,
        storage: { used: storageUsed, usedMB: (storageUsed / (1024 * 1024)).toFixed(2) }
      }
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get site settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne({ key: 'site' });
    res.json({ success: true, settings: settings || { bio: '', tagline: '', aboutText: '' } });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update site settings
exports.updateSettings = async (req, res) => {
  try {
    const { bio, tagline, aboutText } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (tagline !== undefined) updates.tagline = tagline;
    if (aboutText !== undefined) updates.aboutText = aboutText;

    await Setting.findOneAndUpdate(
      { key: 'site' },
      { $set: updates },
      { upsert: true, new: true }
    );

    logger.info('Site settings updated');
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Upload result
exports.uploadResult = async (req, res) => {
  try {
    const { title, gpa, description } = req.body;
    if (!title || !gpa) return res.status(400).json({ success: false, message: 'Title and GPA required' });

    const result = await Result.create({
      title,
      gpa: parseFloat(gpa),
      description: description || '',
      fileUrl: req.file ? req.file.path : null
    });

    logger.info(`Result uploaded: ${title}`);
    res.status(201).json({
      success: true,
      message: 'Result uploaded successfully',
      result: { id: result._id.toString(), title: result.title, gpa: result.gpa, createdAt: result.createdAt }
    });
  } catch (error) {
    logger.error('Upload result error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all results
exports.getResults = async (req, res) => {
  try {
    const results = await Result.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      results: results.map(r => ({
        id: r._id.toString(), title: r.title, gpa: r.gpa,
        description: r.description, fileUrl: r.fileUrl, createdAt: r.createdAt
      }))
    });
  } catch (error) {
    logger.error('Get results error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete result
exports.deleteResult = async (req, res) => {
  try {
    await Result.findByIdAndDelete(req.params.id);
    logger.info(`Result deleted: ${req.params.id}`);
    res.json({ success: true, message: 'Result deleted successfully' });
  } catch (error) {
    logger.error('Delete result error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Download backup (owner only) — ZIP with batch scripts + HTML index
exports.downloadBackup = async (req, res) => {
  const { getSignedFileUrl } = require('../utils/b2Storage');

  try {
    const [subjects, chapters, files] = await Promise.all([
      Subject.find({}).sort({ createdAt: 1 }).lean(),
      Chapter.find({}).sort({ createdAt: 1 }).lean(),
      File.find({ status: 'approved' }).lean()
    ]);

    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s._id.toString()] = s.name.replace(/[/\\?%*:|"<>]/g, '-'); });
    const chapterMap = {};
    chapters.forEach(c => { chapterMap[c._id.toString()] = { name: c.name.replace(/[/\\?%*:|"<>]/g, '-'), subjectId: c.subjectId?.toString() }; });

    // Build structure: { "Subject/Chapter": [{name, url, size, category}] }
    const structure = {};
    for (const file of files) {
      let folderPath = 'Uncategorized';
      if (file.chapterId) {
        const ch = chapterMap[file.chapterId.toString()];
        if (ch) {
          const subjName = ch.subjectId ? (subjectMap[ch.subjectId] || 'Unknown') : 'Unknown';
          folderPath = `${subjName}/${ch.name}`;
        }
      } else if (file.subjectId) {
        folderPath = subjectMap[file.subjectId.toString()] || 'Unknown';
      }
      if (!structure[folderPath]) structure[folderPath] = [];

      let downloadUrl = file.path;
      if (file.storageType === 'b2' && file.filename) {
        try { downloadUrl = await getSignedFileUrl(file.filename, 7 * 24 * 3600); } catch(e) {}
      }
      structure[folderPath].push({ name: file.originalname.replace(/[/\\?%*:|"<>]/g, '-'), url: downloadUrl, size: file.size || 0, category: file.category || 'file' });
    }

    const archive = archiver('zip', { zlib: { level: 1 } });
    const filename = `cloudos-backup-${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    archive.pipe(res);

    // ── MASTER BATCH (Windows) ──
    let masterBat = `@echo off\r\necho CloudOS Backup Downloader\r\necho ========================\r\necho Downloading all files...\r\necho.\r\n`;
    let masterSh = `#!/bin/bash\necho "CloudOS Backup Downloader"\necho "========================"\necho "Downloading all files..."\n\n`;

    // ── HTML INDEX ──
    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>CloudOS Backup</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#0a0f0a;color:#e2e8f0;padding:2rem}
h1{color:#00ff88;margin-bottom:.5rem}h2{color:#00ff88;margin:1.5rem 0 .75rem;font-size:1rem;border-bottom:1px solid rgba(0,255,136,.2);padding-bottom:.4rem}
.stats{display:flex;gap:1rem;margin:1rem 0;flex-wrap:wrap}.stat{background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:8px;padding:.75rem 1.2rem;text-align:center}
.stat-n{font-size:1.4rem;font-weight:700;color:#00ff88}.stat-l{font-size:.75rem;color:#6b7280}
.folder{background:rgba(10,26,18,.8);border:1px solid rgba(0,255,136,.15);border-radius:10px;padding:1rem;margin-bottom:1rem}
.folder-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.folder-name{font-weight:700;font-size:.9rem;display:flex;align-items:center;gap:.5rem}
.file-row{display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:rgba(0,255,136,.04);border-radius:6px;margin-bottom:.35rem}
.file-name{font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
.file-meta{font-size:.7rem;color:#6b7280}.badge{background:rgba(0,255,136,.1);color:#00ff88;padding:.15rem .45rem;border-radius:4px;font-size:.68rem}
.btn{display:inline-flex;align-items:center;gap:.3rem;padding:.35rem .8rem;border-radius:5px;font-size:.75rem;font-weight:600;text-decoration:none;cursor:pointer;border:none}
.btn-g{background:rgba(0,255,136,.15);color:#00ff88;border:1px solid rgba(0,255,136,.3)}.btn-g:hover{background:rgba(0,255,136,.25)}
.btn-b{background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.3)}.btn-b:hover{background:rgba(59,130,246,.25)}
.note{font-size:.75rem;color:#6b7280;margin-top:1.5rem;padding:1rem;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.08)}
</style></head><body>
<h1>☁️ CloudOS Backup</h1>
<p style="color:#6b7280;font-size:.85rem">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total files: ${files.length}</p>
<div class="stats">
  <div class="stat"><div class="stat-n">${files.length}</div><div class="stat-l">Files</div></div>
  <div class="stat"><div class="stat-n">${subjects.length}</div><div class="stat-l">Subjects</div></div>
  <div class="stat"><div class="stat-n">${chapters.length}</div><div class="stat-l">Chapters</div></div>
  <div class="stat"><div class="stat-n">${(files.reduce((t,f)=>t+(f.size||0),0)/(1024*1024)).toFixed(1)} MB</div><div class="stat-l">Total Size</div></div>
</div>
<div class="note">
  💡 <strong>How to download all files at once:</strong><br>
  • <strong>Windows:</strong> Extract ZIP → double-click <code>download-all.bat</code><br>
  • <strong>Mac/Linux:</strong> Extract ZIP → run <code>bash download-all.sh</code><br>
  • <strong>Single folder:</strong> Open any folder → run <code>download-chapter.bat</code> inside it
</div>
<h2>📁 Files by Subject & Chapter</h2>`;

    for (const [folderPath, folderFiles] of Object.entries(structure)) {
      const safePath = folderPath.replace(/\//g, '/');
      const totalSize = folderFiles.reduce((t,f)=>t+f.size,0);
      const sizeMB = (totalSize/(1024*1024)).toFixed(1);

      // Per-folder batch (Windows)
      let folderBat = `@echo off\r\necho Downloading: ${folderPath}\r\necho Files: ${folderFiles.length}\r\necho.\r\n`;
      let folderSh = `#!/bin/bash\necho "Downloading: ${folderPath}"\nmkdir -p "${folderPath}"\ncd "${folderPath}"\n\n`;

      html += `<div class="folder"><div class="folder-hdr"><div class="folder-name">📁 ${folderPath} <span style="color:#6b7280;font-size:.75rem">(${folderFiles.length} files · ${sizeMB} MB)</span></div></div>`;

      for (const f of folderFiles) {
        const sizeFmt = f.size > 1048576 ? (f.size/1048576).toFixed(1)+' MB' : (f.size/1024).toFixed(0)+' KB';
        html += `<div class="file-row"><div><div class="file-name">📄 ${f.name}</div><div class="file-meta">${sizeFmt} <span class="badge">${f.category}</span></div></div><a href="${f.url}" download="${f.name}" class="btn btn-g">⬇ Download</a></div>`;

        // Add to batch scripts
        const escapedUrl = f.url.replace(/"/g, '\\"');
        folderBat += `echo Downloading: ${f.name}\r\ncurl -L -o "${f.name}" "${escapedUrl}"\r\n`;
        folderSh += `echo "Downloading: ${f.name}"\ncurl -L -o "${f.name}" "${escapedUrl}"\n`;
        masterBat += `if not exist "${folderPath}" mkdir "${folderPath}"\r\necho Downloading: ${f.name}\r\ncurl -L -o "${folderPath}\\${f.name}" "${escapedUrl}"\r\n`;
        masterSh += `mkdir -p "${folderPath}"\ncurl -L -o "${folderPath}/${f.name}" "${escapedUrl}"\n`;
      }

      folderBat += `\r\necho.\r\necho Done! ${folderFiles.length} files downloaded.\r\npause\r\n`;
      folderSh += `\necho "Done! ${folderFiles.length} files downloaded."\n`;
      html += `</div>`;

      archive.append(folderBat, { name: `${safePath}/download-chapter.bat` });
      archive.append(folderSh, { name: `${safePath}/download-chapter.sh` });
    }

    masterBat += `\r\necho.\r\necho ========================\r\necho All files downloaded!\r\npause\r\n`;
    masterSh += `\necho "========================"\necho "All files downloaded!"\n`;
    html += `</body></html>`;

    archive.append(masterBat, { name: 'download-all.bat' });
    archive.append(masterSh, { name: 'download-all.sh' });
    archive.append(html, { name: 'index.html' });
    archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), totalFiles: files.length, subjects: subjects.map(s=>s.name) }, null, 2), { name: '_manifest.json' });

    await archive.finalize();
    logger.info(`Backup ZIP (batch) by ${req.user.email} — ${files.length} files`);

  } catch (error) {
    logger.error('Backup error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Backup failed: ' + error.message });
  }
};

// @desc    Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    const [recentFiles, recentUsers, recentMessages] = await Promise.all([
      File.find({}).sort({ createdAt: -1 }).limit(10),
      User.find({}).sort({ createdAt: -1 }).limit(10),
      Message.find({}).sort({ createdAt: -1 }).limit(10)
    ]);

    const fileActivity = await Promise.all(recentFiles.map(async (f) => {
      const user = await User.findById(f.uploadedBy);
      return { type: 'file', description: `${user?.username || 'Unknown'} uploaded ${f.originalname}`, createdAt: f.createdAt };
    }));

    const userActivity = recentUsers.map(u => ({
      type: 'user', description: `${u.username} registered`, createdAt: u.createdAt
    }));

    const msgActivity = await Promise.all(recentMessages.map(async (m) => {
      const [from, to] = await Promise.all([User.findById(m.from), User.findById(m.to)]);
      return { type: 'message', description: `${from?.username || 'Unknown'} sent message to ${to?.username || 'Unknown'}`, createdAt: m.createdAt };
    }));

    const allActivity = [...fileActivity, ...userActivity, ...msgActivity]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    res.json({ success: true, activity: allActivity });
  } catch (error) {
    logger.error('Get activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
