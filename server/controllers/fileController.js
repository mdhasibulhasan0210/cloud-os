const Joi = require('joi');
const db = require('../config/db');
const logger = require('../utils/logger');
const { generateThumbnail, deleteFromCloudinary } = require('../utils/thumbnailGenerator');
const { cloudinary } = require('../middleware/upload');

// @desc    Upload file
// @route   POST /api/files/upload
// @access  Private
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { subjectId, chapterId, category, description, isPersonal } = req.body;

    // Validate category
    const validCategories = ['book', 'note', 'sheet', 'pdf', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    // Cloudinary gives us req.file.path (the secure URL) and req.file.filename (public_id)
    const fileUrl = req.file.path;
    const thumbnailUrl = generateThumbnail(fileUrl, req.file.mimetype);

    const status = req.user.role === 'admin' ? 'approved' : 'pending';

    const fileDoc = {
      filename: req.file.filename,           // Cloudinary public_id
      originalname: req.file.originalname,
      path: fileUrl,                          // Full Cloudinary URL
      mimetype: req.file.mimetype,
      size: req.file.size,
      category: category || 'other',
      description: description || '',
      uploadedBy: req.user.id,
      owner: req.user.id,
      status,
      downloadAllowed: true,
      sharedWith: [],
      thumbnailPath: thumbnailUrl,
      createdAt: new Date()
    };

    if (req.user.role === 'admin' && !isPersonal) {
      if (subjectId) fileDoc.subjectId = subjectId;
      if (chapterId) fileDoc.chapterId = chapterId;
    }

    const file = await db.files.insert(fileDoc);

    logger.info(`File uploaded to Cloudinary: ${req.file.originalname} by ${req.user.email}`);

    // Notify admin if uploaded by a regular user
    if (req.user.role !== 'admin') {
      const admin = await db.users.findOne({ role: 'admin' });
      if (admin) {
        await db.notifications.insert({
          userId: admin._id.toString(),
          message: `New file upload pending approval: ${req.file.originalname}`,
          type: 'approval',
          read: false,
          fileId: file._id.toString(),
          createdAt: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      message: status === 'approved' ? 'File uploaded successfully' : 'File uploaded, pending approval',
      file: {
        id: file._id.toString(),
        filename: file.originalname,
        path: file.path,
        thumbnailPath: file.thumbnailPath,
        status: file.status
      }
    });

  } catch (error) {
    logger.error('Upload file error:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
};

// @desc    Get files
// @route   GET /api/files
// @access  Private
exports.getFiles = async (req, res) => {
  try {
    const { subjectId, chapterId, personal, shared } = req.query;

    let query = { status: 'approved' };

    if (req.user.role === 'admin') {
      if (subjectId) query.subjectId = subjectId;
      if (chapterId) query.chapterId = chapterId;
      if (personal === 'true') {
        query.owner = { $exists: true };
        query.subjectId = { $exists: false };
      }
    } else {
      if (shared === 'true') {
        query.sharedWith = req.user.id;
      } else if (personal === 'true') {
        query.owner = req.user.id;
        query.subjectId = { $exists: false };
      } else {
        if (subjectId) query.subjectId = subjectId;
        if (chapterId) query.chapterId = chapterId;
      }
    }

    const files = await db.files.find(query).sort({ createdAt: -1 });

    const filesWithDetails = await Promise.all(
      files.map(async (file) => {
        const uploader = await db.users.findOne({ _id: file.uploadedBy });
        return {
          id: file._id.toString(),
          filename: file.originalname,
          path: file.path,
          thumbnailPath: file.thumbnailPath,
          category: file.category,
          description: file.description,
          size: file.size,
          mimetype: file.mimetype,
          downloadAllowed: file.downloadAllowed,
          uploadedBy: uploader ? uploader.username : 'Unknown',
          uploaderId: file.uploadedBy ? file.uploadedBy.toString() : null,
          subjectId: file.subjectId ? file.subjectId.toString() : null,
          chapterId: file.chapterId ? file.chapterId.toString() : null,
          createdAt: file.createdAt
        };
      })
    );

    res.json({ success: true, files: filesWithDetails });

  } catch (error) {
    logger.error('Get files error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single file
// @route   GET /api/files/:id
// @access  Private
exports.getFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.files.findOne({ _id: id });

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const canView =
      req.user.role === 'admin' ||
      file.owner?.toString() === req.user.id ||
      (file.sharedWith || []).map(id => id.toString()).includes(req.user.id) ||
      (file.status === 'approved' && file.subjectId);

    if (!canView) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const uploader = await db.users.findOne({ _id: file.uploadedBy });

    res.json({
      success: true,
      file: {
        id: file._id.toString(),
        filename: file.originalname,
        path: file.path,
        thumbnailPath: file.thumbnailPath,
        category: file.category,
        description: file.description,
        size: file.size,
        mimetype: file.mimetype,
        downloadAllowed: file.downloadAllowed,
        uploadedBy: uploader ? uploader.username : 'Unknown',
        createdAt: file.createdAt
      }
    });

  } catch (error) {
    logger.error('Get file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update file
// @route   PUT /api/files/:id
// @access  Private
exports.updateFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, category, downloadAllowed, chapterId } = req.body;

    const file = await db.files.findOne({ _id: id });
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    if (req.user.role !== 'admin' && file.owner?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updates = {};
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (downloadAllowed !== undefined) updates.downloadAllowed = downloadAllowed;
    if (chapterId !== undefined) updates.chapterId = chapterId;

    await db.files.update({ _id: id }, { $set: updates });

    res.json({ success: true, message: 'File updated successfully' });

  } catch (error) {
    logger.error('Update file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete file
// @route   DELETE /api/files/:id
// @access  Private
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.files.findOne({ _id: id });

    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    if (req.user.role !== 'admin' && file.owner?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Delete from Cloudinary
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
    await deleteFromCloudinary(file.path, resourceType);

    // Delete from database
    await db.files.remove({ _id: id });

    logger.info(`File deleted: ${id}`);
    res.json({ success: true, message: 'File deleted successfully' });

  } catch (error) {
    logger.error('Delete file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Stream/preview file
// @route   GET /api/files/preview/:id
// @access  Private
exports.previewFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.files.findOne({ _id: id });

    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    const canView =
      req.user.role === 'admin' ||
      file.owner?.toString() === req.user.id ||
      (file.sharedWith || []).map(id => id.toString()).includes(req.user.id) ||
      (file.status === 'approved' && file.subjectId);

    if (!canView) return res.status(403).json({ success: false, message: 'Access denied' });

    // Return the Cloudinary URL as JSON so the frontend can use it directly
    // This avoids iframe cross-origin issues with PDF rendering
    res.json({
      success: true,
      url: file.path,
      mimetype: file.mimetype,
      filename: file.originalname,
      downloadAllowed: file.downloadAllowed
    });

  } catch (error) {
    logger.error('Preview file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Share file with users
// @route   POST /api/files/share
// @access  Private
exports.shareFile = async (req, res) => {
  try {
    const { fileId, userIds } = req.body;

    if (!fileId || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'File ID and user IDs required' });
    }

    const file = await db.files.findOne({ _id: fileId });
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    if (req.user.role !== 'admin' && file.owner?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const currentShared = (file.sharedWith || []).map(id => id.toString());
    const newShared = [...new Set([...currentShared, ...userIds])];

    await db.files.update({ _id: fileId }, { $set: { sharedWith: newShared } });

    for (const userId of userIds) {
      if (!currentShared.includes(userId)) {
        await db.notifications.insert({
          userId,
          message: `${req.user.username} shared a file with you: ${file.originalname}`,
          type: 'share',
          read: false,
          fileId: file._id.toString(),
          createdAt: new Date()
        });
      }
    }

    res.json({ success: true, message: 'File shared successfully', sharedWith: newShared });

  } catch (error) {
    logger.error('Share file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get pending files (admin only)
// @route   GET /api/files/pending
// @access  Private/Admin
exports.getPendingFiles = async (req, res) => {
  try {
    const files = await db.files.find({ status: 'pending' }).sort({ createdAt: -1 });

    const filesWithDetails = await Promise.all(
      files.map(async (file) => {
        const uploader = await db.users.findOne({ _id: file.uploadedBy });
        return {
          id: file._id.toString(),
          filename: file.originalname,
          path: file.path,
          thumbnailPath: file.thumbnailPath,
          category: file.category,
          size: file.size,
          uploadedBy: uploader ? uploader.username : 'Unknown',
          uploaderId: file.uploadedBy ? file.uploadedBy.toString() : null,
          createdAt: file.createdAt
        };
      })
    );

    res.json({ success: true, files: filesWithDetails });

  } catch (error) {
    logger.error('Get pending files error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Approve file
// @route   PUT /api/files/approve/:id
// @access  Private/Admin
exports.approveFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.files.findOne({ _id: id });

    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    await db.files.update({ _id: id }, { $set: { status: 'approved' } });

    await db.notifications.insert({
      userId: file.uploadedBy.toString(),
      message: `Your file "${file.originalname}" has been approved`,
      type: 'approval',
      read: false,
      fileId: file._id.toString(),
      createdAt: new Date()
    });

    res.json({ success: true, message: 'File approved successfully' });

  } catch (error) {
    logger.error('Approve file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reject file
// @route   PUT /api/files/reject/:id
// @access  Private/Admin
exports.rejectFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.files.findOne({ _id: id });

    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    // Delete from Cloudinary
    const resourceType = file.mimetype && file.mimetype.startsWith('image/') ? 'image' : 'raw';
    await deleteFromCloudinary(file.path, resourceType);

    await db.files.remove({ _id: id });

    await db.notifications.insert({
      userId: file.uploadedBy.toString(),
      message: `Your file "${file.originalname}" was not approved`,
      type: 'approval',
      read: false,
      createdAt: new Date()
    });

    res.json({ success: true, message: 'File rejected and deleted' });

  } catch (error) {
    logger.error('Reject file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get thumbnail
// @route   GET /api/files/thumbnail/:id
// @access  Private
exports.getThumbnail = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.files.findOne({ _id: id });

    if (!file || !file.thumbnailPath) {
      return res.status(404).json({ success: false, message: 'Thumbnail not found' });
    }

    // If it's a Cloudinary URL, redirect to it
    if (file.thumbnailPath.startsWith('http')) {
      return res.redirect(file.thumbnailPath);
    }

    // Fallback for local paths (legacy)
    const path = require('path');
    const thumbnailPath = path.join(__dirname, '../../client/public', file.thumbnailPath);
    res.sendFile(thumbnailPath);

  } catch (error) {
    logger.error('Get thumbnail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
