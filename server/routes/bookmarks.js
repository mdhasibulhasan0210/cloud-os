const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');
const File     = require('../models/File');
const User     = require('../models/User');
const { protect } = require('../middleware/auth');

function toOid(id) {
  try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
}

// GET /api/bookmarks — get current user's bookmarks
router.get('/', protect, async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: toOid(req.user.id) }).sort({ createdAt: -1 });
    const result = await Promise.all(bookmarks.map(async (b) => {
      const file = await File.findById(b.fileId);
      if (!file) return null;
      return {
        bookmarkId: b._id.toString(),
        id: file._id.toString(),
        filename: file.originalname,
        path: file.path,
        thumbnailPath: file.thumbnailPath,
        mimetype: file.mimetype,
        size: file.size,
        category: file.category,
        downloadAllowed: file.downloadAllowed,
        createdAt: b.createdAt
      };
    }));
    res.json({ success: true, bookmarks: result.filter(Boolean) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/bookmarks — add bookmark
router.post('/', protect, async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ success: false, message: 'fileId required' });
    const existing = await Bookmark.findOne({ userId: toOid(req.user.id), fileId: toOid(fileId) });
    if (existing) return res.json({ success: true, message: 'Already bookmarked', bookmarkId: existing._id.toString() });
    const bm = await Bookmark.create({ userId: toOid(req.user.id), fileId: toOid(fileId) });
    res.status(201).json({ success: true, message: 'Bookmarked', bookmarkId: bm._id.toString() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/bookmarks/:fileId — remove bookmark by fileId
router.delete('/:fileId', protect, async (req, res) => {
  try {
    await Bookmark.findOneAndDelete({ userId: toOid(req.user.id), fileId: toOid(req.params.fileId) });
    res.json({ success: true, message: 'Bookmark removed' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/bookmarks/check/:fileId — check if bookmarked
router.get('/check/:fileId', protect, async (req, res) => {
  try {
    const bm = await Bookmark.findOne({ userId: toOid(req.user.id), fileId: toOid(req.params.fileId) });
    res.json({ success: true, bookmarked: !!bm });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
