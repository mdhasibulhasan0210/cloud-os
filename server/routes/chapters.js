const express = require('express');
const router = express.Router();
const {
  updateChapter,
  deleteChapter
} = require('../controllers/subjectController');
const { protect, adminOrModerator } = require('../middleware/auth');

router.put('/:id', protect, adminOrModerator, updateChapter);
router.delete('/:id', protect, adminOrModerator, deleteChapter);

module.exports = router;
