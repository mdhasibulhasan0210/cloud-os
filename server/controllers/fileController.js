const mongoose = require('mongoose');
const User         = require('../models/User');
const File         = require('../models/File');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { uploadToB2, getSignedFileUrl, deleteFromB2 } = require('../utils/b2Storage');

function toOid(id) {
  try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
}

// @desc    Upload file to Backblaze B2
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, chapterId, subFolderId, category, description, isPersonal } = req.body;
    const validCategories = ['book', 'note', 'sheet', 'pdf', 'other'];
    if (category && !validCategories.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category' });

    // Upload buffer to B2
    const { key, url, fileId: b2FileId } = await uploadToB2(req.file.buffer, req.file.originalname, req.file.mimetype);

    const isAdminOrOwner = ['admin', 'owner', 'moderator'].includes(req.user.role);
    const status = isAdminOrOwner ? 'approved' : 'pending';

    const fileDoc = {
      filename: key,
      originalname: req.file.originalname,
      path: url,
      mimetype: req.file.mimetype,
      size: req.file.size,
      category: category || 'other',
      description: description || '',
      uploadedBy: toOid(req.user.id),
      owner: toOid(req.user.id),
      status,
      downloadAllowed: true,
      sharedWith: [],
      thumbnailPath: '/assets/images/default-pdf-thumb.jpg',
      storageType: 'b2',
      b2FileId
    };

    // Admin, owner, and moderator can assign files to subjects/chapters
    if (isAdminOrOwner && !isPersonal) {
      if (subjectId) fileDoc.subjectId = toOid(subjectId);
      if (chapterId) fileDoc.chapterId = toOid(chapterId);
      if (subFolderId) fileDoc.subFolderId = toOid(subFolderId);
    }

    const file = await File.create(fileDoc);
    logger.info(`File uploaded to B2: ${req.file.originalname} by ${req.user.email}`);

    if (!isAdminOrOwner) {
      const admin = await User.findOne({ role: { $in: ['admin', 'owner'] } });
      if (admin) {
        await Notification.create({ userId: admin._id, message: `New file upload pending approval: ${req.file.originalname}`, type: 'approval', read: false, fileId: file._id });
      }
    }

    res.status(201).json({
      success: true,
      message: status === 'approved' ? 'File uploaded successfully' : 'File uploaded, pending approval',
      file: { id: file._id.toString(), filename: file.originalname, path: file.path, thumbnailPath: file.thumbnailPath, status: file.status }
    });
  } catch (error) {
    logger.error('Upload file error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during upload' });
  }
};

// @desc    Get files
exports.getFiles = async (req, res) => {
  try {
    const { subjectId, chapterId, subFolderId, personal, shared } = req.query;
    const isAdminOrOwner = ['admin', 'owner', 'moderator'].includes(req.user.role);
    let query = { status: 'approved' };

    if (isAdminOrOwner) {
      if (subjectId) query.subjectId = toOid(subjectId);
      if (chapterId) query.chapterId = toOid(chapterId);
      if (subFolderId) query.subFolderId = toOid(subFolderId);
      if (personal === 'true') { query.owner = { $exists: true }; query.subjectId = { $exists: false }; }
    } else {
      if (shared === 'true') {
        query.sharedWith = toOid(req.user.id);
      } else if (personal === 'true') {
        query.owner = toOid(req.user.id);
        query.subjectId = { $exists: false };
      } else {
        // Regular users can see approved files in subjects/chapters/subfolders
        if (subjectId) query.subjectId = toOid(subjectId);
        if (chapterId) query.chapterId = toOid(chapterId);
        if (subFolderId) query.subFolderId = toOid(subFolderId);
      }
    }

    const files = await File.find(query).sort({ createdAt: -1 });
    const filesWithDetails = await Promise.all(files.map(async (file) => {
      const uploader = await User.findById(file.uploadedBy);
      return {
        id: file._id.toString(), filename: file.originalname, path: file.path,
        thumbnailPath: file.thumbnailPath, category: file.category, description: file.description,
        size: file.size, mimetype: file.mimetype, downloadAllowed: file.downloadAllowed,
        uploadedBy: uploader ? uploader.username : 'Unknown',
        uploaderId: file.uploadedBy ? file.uploadedBy.toString() : null,
        subjectId: file.subjectId ? file.subjectId.toString() : null,
        chapterId: file.chapterId ? file.chapterId.toString() : null,
        createdAt: file.createdAt
      };
    }));
    res.json({ success: true, files: filesWithDetails });
  } catch (error) {
    logger.error('Get files error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single file
exports.getFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    const canView = ['admin', 'owner', 'moderator'].includes(req.user.role) ||
      file.owner?.toString() === req.user.id ||
      (file.sharedWith || []).some(id => id.toString() === req.user.id) ||
      (file.status === 'approved' && file.subjectId);

    if (!canView) return res.status(403).json({ success: false, message: 'Access denied' });

    const uploader = await User.findById(file.uploadedBy);
    res.json({ success: true, file: {
      id: file._id.toString(), filename: file.originalname, path: file.path,
      thumbnailPath: file.thumbnailPath, category: file.category, description: file.description,
      size: file.size, mimetype: file.mimetype, downloadAllowed: file.downloadAllowed,
      uploadedBy: uploader ? uploader.username : 'Unknown', createdAt: file.createdAt
    }});
  } catch (error) {
    logger.error('Get file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Preview file — returns signed URL for B2 or direct URL for Cloudinary
exports.previewFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    const canView = ['admin', 'owner', 'moderator'].includes(req.user.role) ||
      file.owner?.toString() === req.user.id ||
      (file.sharedWith || []).some(id => id.toString() === req.user.id) ||
      (file.status === 'approved' && file.subjectId);

    if (!canView) return res.status(403).json({ success: false, message: 'Access denied' });

    let url = file.path;

    // For B2 private files, generate a signed URL (valid 1 hour)
    if (file.storageType === 'b2' && file.filename) {
      url = await getSignedFileUrl(file.filename, 3600);
    }

    res.json({ success: true, url, mimetype: file.mimetype, filename: file.originalname, downloadAllowed: file.downloadAllowed });
  } catch (error) {
    logger.error('Preview file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update file
exports.updateFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    if (!['admin', 'owner', 'moderator'].includes(req.user.role) && file.owner?.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });

    const { description, category, downloadAllowed, chapterId } = req.body;
    const updates = {};
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (downloadAllowed !== undefined) updates.downloadAllowed = downloadAllowed;
    if (chapterId !== undefined) updates.chapterId = toOid(chapterId);

    await File.findByIdAndUpdate(req.params.id, updates);
    res.json({ success: true, message: 'File updated successfully' });
  } catch (error) {
    logger.error('Update file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete file
exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    if (!['admin', 'owner', 'moderator'].includes(req.user.role) && file.owner?.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });

    // Delete from B2 or Cloudinary
    if (file.storageType === 'b2' && file.filename) {
      await deleteFromB2(file.filename, file.b2FileId);
    } else if (file.path && file.path.includes('cloudinary')) {
      const { deleteFromCloudinary } = require('../utils/thumbnailGenerator');
      const resourceType = file.mimetype && file.mimetype.startsWith('image/') ? 'image' : 'raw';
      await deleteFromCloudinary(file.path, resourceType);
    }

    await File.findByIdAndDelete(req.params.id);
    logger.info(`File deleted: ${req.params.id}`);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    logger.error('Delete file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Share file
exports.shareFile = async (req, res) => {
  try {
    const { fileId, userIds } = req.body;
    if (!fileId || !Array.isArray(userIds) || !userIds.length) return res.status(400).json({ success: false, message: 'File ID and user IDs required' });

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    if (!['admin', 'owner', 'moderator'].includes(req.user.role) && file.owner?.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });

    const currentShared = (file.sharedWith || []).map(id => id.toString());
    const newShared = [...new Set([...currentShared, ...userIds])].map(id => toOid(id));
    await File.findByIdAndUpdate(fileId, { sharedWith: newShared });

    for (const userId of userIds) {
      if (!currentShared.includes(userId)) {
        await Notification.create({ userId: toOid(userId), message: `${req.user.username} shared a file with you: ${file.originalname}`, type: 'share', read: false, fileId: file._id });
      }
    }
    res.json({ success: true, message: 'File shared successfully' });
  } catch (error) {
    logger.error('Share file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get pending files
exports.getPendingFiles = async (req, res) => {
  try {
    const files = await File.find({ status: 'pending' }).sort({ createdAt: -1 });
    const filesWithDetails = await Promise.all(files.map(async (file) => {
      const uploader = await User.findById(file.uploadedBy);
      return { id: file._id.toString(), filename: file.originalname, path: file.path, thumbnailPath: file.thumbnailPath, category: file.category, size: file.size, uploadedBy: uploader ? uploader.username : 'Unknown', uploaderId: file.uploadedBy?.toString(), createdAt: file.createdAt };
    }));
    res.json({ success: true, files: filesWithDetails });
  } catch (error) {
    logger.error('Get pending files error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Approve file
exports.approveFile = async (req, res) => {
  try {
    const file = await File.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    await Notification.create({ userId: file.uploadedBy, message: `Your file "${file.originalname}" has been approved`, type: 'approval', read: false, fileId: file._id });
    res.json({ success: true, message: 'File approved successfully' });
  } catch (error) {
    logger.error('Approve file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reject file
exports.rejectFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    if (file.storageType === 'b2' && file.filename) {
      await deleteFromB2(file.filename);
    }

    await File.findByIdAndDelete(req.params.id);
    await Notification.create({ userId: file.uploadedBy, message: `Your file "${file.originalname}" was not approved`, type: 'approval', read: false });
    res.json({ success: true, message: 'File rejected and deleted' });
  } catch (error) {
    logger.error('Reject file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get thumbnail
exports.getThumbnail = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file || !file.thumbnailPath) return res.status(404).json({ success: false, message: 'Thumbnail not found' });
    if (file.thumbnailPath.startsWith('http')) return res.redirect(file.thumbnailPath);
    const path = require('path');
    res.sendFile(path.join(__dirname, '../../client/public', file.thumbnailPath));
  } catch (error) {
    logger.error('Get thumbnail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
