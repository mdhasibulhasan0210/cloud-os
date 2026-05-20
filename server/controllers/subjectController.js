const Joi = require('joi');
const db = require('../config/db');
const logger = require('../utils/logger');

// Validation schemas
const subjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
});

const chapterSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
});

// @desc    Get all subjects
// @route   GET /api/subjects
// @access  Private
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await db.subjects.find({}).sort({ name: 1 }); // alphabetical order

    // Get chapter count for each subject
    const subjectsWithCounts = await Promise.all(
      subjects.map(async (subject) => {
        const chapterCount = await db.chapters.count({ subjectId: subject._id });
        const fileCount = await db.files.count({ 
          subjectId: subject._id,
          status: 'approved'
        });

        return {
          id: subject._id,
          name: subject.name,
          chapterCount,
          fileCount,
          createdAt: subject.createdAt
        };
      })
    );

    res.json({
      success: true,
      subjects: subjectsWithCounts
    });

  } catch (error) {
    logger.error('Get subjects error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Create subject
// @route   POST /api/subjects
// @access  Private/Admin
exports.createSubject = async (req, res) => {
  try {
    const { error, value } = subjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.details[0].message 
      });
    }

    const { name } = value;

    // Check if subject already exists
    const existing = await db.subjects.findOne({ name });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject already exists' 
      });
    }

    const subject = await db.subjects.insert({
      name,
      createdAt: new Date()
    });

    logger.info(`Subject created: ${name}`);

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      subject: {
        id: subject._id,
        name: subject.name,
        createdAt: subject.createdAt
      }
    });

  } catch (error) {
    logger.error('Create subject error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = subjectSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.details[0].message 
      });
    }

    const { name } = value;

    const subject = await db.subjects.findOne({ _id: id });
    if (!subject) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subject not found' 
      });
    }

    await db.subjects.update({ _id: id }, { $set: { name } });

    logger.info(`Subject updated: ${name}`);

    res.json({
      success: true,
      message: 'Subject updated successfully'
    });

  } catch (error) {
    logger.error('Update subject error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all chapters in this subject
    await db.chapters.remove({ subjectId: id }, { multi: true });

    // Delete all files in this subject
    await db.files.remove({ subjectId: id }, { multi: true });

    // Delete subject
    await db.subjects.remove({ _id: id });

    logger.info(`Subject deleted: ${id}`);

    res.json({
      success: true,
      message: 'Subject and related data deleted successfully'
    });

  } catch (error) {
    logger.error('Delete subject error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Get chapters for a subject
// @route   GET /api/subjects/:subjectId/chapters
// @access  Private
exports.getChapters = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const chapters = await db.chapters.find({ subjectId }).sort({ createdAt: 1 });

    // Get file count for each chapter
    const chaptersWithCounts = await Promise.all(
      chapters.map(async (chapter) => {
        const fileCount = await db.files.count({ 
          chapterId: chapter._id,
          status: 'approved'
        });

        return {
          id: chapter._id,
          name: chapter.name,
          subjectId: chapter.subjectId,
          fileCount,
          createdAt: chapter.createdAt
        };
      })
    );

    res.json({
      success: true,
      chapters: chaptersWithCounts
    });

  } catch (error) {
    logger.error('Get chapters error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Create chapter
// @route   POST /api/subjects/:subjectId/chapters
// @access  Private/Admin
exports.createChapter = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { error, value } = chapterSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.details[0].message 
      });
    }

    const { name } = value;

    // Verify subject exists
    const subject = await db.subjects.findOne({ _id: subjectId });
    if (!subject) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subject not found' 
      });
    }

    const chapter = await db.chapters.insert({
      name,
      subjectId,
      createdAt: new Date()
    });

    logger.info(`Chapter created: ${name} in subject ${subjectId}`);

    res.status(201).json({
      success: true,
      message: 'Chapter created successfully',
      chapter: {
        id: chapter._id,
        name: chapter.name,
        subjectId: chapter.subjectId,
        createdAt: chapter.createdAt
      }
    });

  } catch (error) {
    logger.error('Create chapter error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Update chapter
// @route   PUT /api/chapters/:id
// @access  Private/Admin
exports.updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = chapterSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: error.details[0].message 
      });
    }

    const { name } = value;

    const chapter = await db.chapters.findOne({ _id: id });
    if (!chapter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chapter not found' 
      });
    }

    await db.chapters.update({ _id: id }, { $set: { name } });

    logger.info(`Chapter updated: ${name}`);

    res.json({
      success: true,
      message: 'Chapter updated successfully'
    });

  } catch (error) {
    logger.error('Update chapter error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// @desc    Delete chapter
// @route   DELETE /api/chapters/:id
// @access  Private/Admin
exports.deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all files in this chapter
    await db.files.remove({ chapterId: id }, { multi: true });

    // Delete chapter
    await db.chapters.remove({ _id: id });

    logger.info(`Chapter deleted: ${id}`);

    res.json({
      success: true,
      message: 'Chapter and related files deleted successfully'
    });

  } catch (error) {
    logger.error('Delete chapter error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
