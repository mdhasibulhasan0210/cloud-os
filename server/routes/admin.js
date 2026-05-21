const express = require('express');
const router = express.Router();
const {
  getStats, getSettings, updateSettings,
  uploadResult, getResults, deleteResult,
  getRecentActivity, downloadBackup
} = require('../controllers/adminController');
const { protect, adminOnly, adminOrModerator, ownerOnly } = require('../middleware/auth');
const { uploadFile } = require('../middleware/upload');

router.get('/stats',     protect, adminOrModerator, getStats);
router.get('/settings',  protect, adminOnly, getSettings);
router.put('/settings',  protect, adminOnly, updateSettings);
router.post('/results',  protect, adminOnly, uploadFile.single('file'), uploadResult);
router.get('/results',   protect, adminOrModerator, getResults);
router.delete('/results/:id', protect, adminOnly, deleteResult);
router.get('/activity',  protect, adminOrModerator, getRecentActivity);
router.get('/backup',    protect, ownerOnly, downloadBackup);

module.exports = router;
