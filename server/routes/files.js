const express = require('express');
const router = express.Router();
const {
  uploadFile,
  getFiles,
  getFile,
  updateFile,
  deleteFile,
  previewFile,
  shareFile,
  getPendingFiles,
  approveFile,
  rejectFile,
  getThumbnail
} = require('../controllers/fileController');
const { protect, adminOnly, adminOrModerator, approvedOnly } = require('../middleware/auth');
const { uploadFile: uploadMiddleware } = require('../middleware/upload');

router.post('/upload', protect, approvedOnly, uploadMiddleware.single('file'), uploadFile);
router.get('/pending', protect, adminOrModerator, getPendingFiles);
router.put('/approve/:id', protect, adminOrModerator, approveFile);
router.put('/reject/:id', protect, adminOrModerator, rejectFile);
router.post('/share', protect, approvedOnly, shareFile);
router.get('/preview/:id', protect, previewFile);
router.get('/thumbnail/:id', protect, getThumbnail);
router.get('/:id', protect, getFile);
router.put('/:id', protect, updateFile);
router.delete('/:id', protect, deleteFile);
router.get('/', protect, getFiles);

module.exports = router;
