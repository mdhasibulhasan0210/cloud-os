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

// @desc    Download backup (owner only) — ZIP with download links organized by Subject/Chapter
exports.downloadBackup = async (req, res) => {
  try {
    const { getSignedFileUrl } = require('../utils/b2Storage');

    const [subjects, chapters, files] = await Promise.all([
      Subject.find({}).sort({ createdAt: 1 }).lean(),
      Chapter.find({}).sort({ createdAt: 1 }).lean(),
      File.find({ status: 'approved' }).lean()
    ]);

    // Build lookup maps
    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s._id.toString()] = s.name; });
    const chapterMap = {};
    chapters.forEach(c => { chapterMap[c._id.toString()] = { name: c.name, subjectId: c.subjectId?.toString() }; });

    // Group files by subject/chapter
    const structure = {};
    for (const file of files) {
      let subjectName = 'Uncategorized';
      let chapterName = '';

      if (file.chapterId) {
        const ch = chapterMap[file.chapterId.toString()];
        if (ch) {
          subjectName = ch.subjectId ? (subjectMap[ch.subjectId] || 'Unknown Subject') : 'Unknown Subject';
          chapterName = ch.name;
        }
      } else if (file.subjectId) {
        subjectName = subjectMap[file.subjectId.toString()] || 'Unknown Subject';
      }

      const key = `${subjectName}${chapterName ? ' > ' + chapterName : ''}`;
      if (!structure[key]) structure[key] = [];

      // Generate signed URL for B2 files
      let downloadUrl = file.path;
      if (file.storageType === 'b2' && file.filename) {
        try {
          downloadUrl = await getSignedFileUrl(file.filename, 7 * 24 * 3600); // 7 days
        } catch(e) {
          downloadUrl = file.path;
        }
      }

      structure[key].push({ name: file.originalname, url: downloadUrl, size: file.size, category: file.category });
    }

    // Build ZIP with HTML index + text files per folder
    const archive = archiver('zip', { zlib: { level: 1 } });
    const filename = `cloudos-backup-${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    archive.pipe(res);

    // Create an HTML index file with clickable download links
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>CloudOS Backup - ${new Date().toLocaleDateString()}</title>
<style>body{font-family:Arial,sans-serif;max-width:900px;margin:2rem auto;padding:1rem;background:#f5f5f5}
h1{color:#064e3b}h2{color:#065f46;border-bottom:2px solid #10b981;padding-bottom:.5rem}
.file{background:white;padding:.75rem;margin:.4rem 0;border-radius:6px;border-left:4px solid #10b981;display:flex;justify-content:space-between;align-items:center}
a{color:#059669;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}
.meta{color:#6b7280;font-size:.8rem}.badge{background:#d1fae5;color:#065f46;padding:.2rem .5rem;border-radius:4px;font-size:.75rem}
</style></head><body>
<h1>☁️ CloudOS Backup</h1>
<p>Generated: ${new Date().toLocaleString()} | Total files: ${files.length}</p>`;

    for (const [folder, folderFiles] of Object.entries(structure)) {
      const safe = folder.replace(/[/\\?%*:|"<>]/g, '-');
      html += `<h2>📁 ${folder}</h2>`;
      let txt = `Folder: ${folder}\nGenerated: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;

      for (const f of folderFiles) {
        const sizeMB = f.size ? (f.size / (1024*1024)).toFixed(2) + ' MB' : 'unknown size';
        html += `<div class="file"><div><a href="${f.url}" target="_blank" download="${f.name}">📄 ${f.name}</a><div class="meta">${sizeMB} <span class="badge">${f.category}</span></div></div><a href="${f.url}" target="_blank" download="${f.name}" style="background:#10b981;color:white;padding:.4rem .8rem;border-radius:5px;font-size:.8rem">⬇ Download</a></div>`;
        txt += `File: ${f.name}\nSize: ${sizeMB}\nCategory: ${f.category}\nURL: ${f.url}\n\n`;
      }

      archive.append(txt, { name: `${safe}/download-links.txt` });
    }

    html += `</body></html>`;
    archive.append(html, { name: 'index.html' });

    // Also add a manifest
    const manifest = JSON.stringify({ exportedAt: new Date().toISOString(), totalFiles: files.length, subjects: subjects.map(s=>s.name), structure: Object.fromEntries(Object.entries(structure).map(([k,v])=>[k,v.map(f=>f.name)])) }, null, 2);
    archive.append(manifest, { name: '_manifest.json' });

    await archive.finalize();
    logger.info(`Backup downloaded by ${req.user.email} — ${files.length} files`);

  } catch (error) {
    logger.error('Backup error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Backup failed: ' + error.message });
    }
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
