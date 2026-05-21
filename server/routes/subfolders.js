const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SubFolder = require('../models/SubFolder');
const File      = require('../models/File');
const User      = require('../models/User');
const { protect, adminOrModerator } = require('../middleware/auth');

function toOid(id) {
  try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
}

// GET /api/subfolders?chapterId=xxx
router.get('/', protect, async (req, res) => {
  try {
    const { chapterId } = req.query;
    if (!chapterId) return res.status(400).json({ success: false, message: 'chapterId required' });
    const folders = await SubFolder.find({ chapterId: toOid(chapterId) }).sort({ createdAt: 1 });
    const result = await Promise.all(folders.map(async (f) => {
      const fileCount = await File.countDocuments({ subFolderId: f._id, status: 'approved' });
      return { id: f._id.toString(), name: f.name, chapterId: f.chapterId.toString(), fileCount, createdAt: f.createdAt };
    }));
    res.json({ success: true, subfolders: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/subfolders
router.post('/', protect, adminOrModerator, async (req, res) => {
  try {
    const { name, chapterId, subjectId } = req.body;
    if (!name || !chapterId || !subjectId) return res.status(400).json({ success: false, message: 'name, chapterId, subjectId required' });
    const folder = await SubFolder.create({ name, chapterId: toOid(chapterId), subjectId: toOid(subjectId) });
    res.status(201).json({ success: true, subfolder: { id: folder._id.toString(), name: folder.name, chapterId: folder.chapterId.toString(), createdAt: folder.createdAt } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/subfolders/:id
router.delete('/:id', protect, adminOrModerator, async (req, res) => {
  try {
    await File.deleteMany({ subFolderId: toOid(req.params.id) });
    await SubFolder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Subfolder deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/subfolders/:id/files
router.get('/:id/files', protect, async (req, res) => {
  try {
    const files = await File.find({ subFolderId: toOid(req.params.id), status: 'approved' }).sort({ createdAt: -1 });
    const result = await Promise.all(files.map(async (file) => {
      const uploader = await User.findById(file.uploadedBy);
      return {
        id: file._id.toString(), filename: file.originalname, path: file.path,
        thumbnailPath: file.thumbnailPath, category: file.category, description: file.description,
        size: file.size, mimetype: file.mimetype, downloadAllowed: file.downloadAllowed,
        uploadedBy: uploader ? uploader.username : 'Unknown', createdAt: file.createdAt
      };
    }));
    res.json({ success: true, files: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
