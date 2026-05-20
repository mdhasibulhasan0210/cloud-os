const express = require('express');
const router = express.Router();
const {
  getAllSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter
} = require('../controllers/subjectController');
const { protect, adminOnly, adminOrModerator } = require('../middleware/auth');

// Subject routes
router.get('/', protect, getAllSubjects);
router.post('/', protect, adminOrModerator, createSubject);
router.put('/:id', protect, adminOrModerator, updateSubject);
router.delete('/:id', protect, adminOrModerator, deleteSubject);

// Chapter routes
router.get('/:subjectId/chapters', protect, getChapters);
router.post('/:subjectId/chapters', protect, adminOrModerator, createChapter);

module.exports = router;
