const Joi = require('joi');
const mongoose = require('mongoose');
const Subject      = require('../models/Subject');
const Chapter      = require('../models/Chapter');
const File         = require('../models/File');
const logger = require('../utils/logger');

const subjectSchema = Joi.object({ name: Joi.string().min(1).max(100).required() });
const chapterSchema = Joi.object({ name: Joi.string().min(1).max(100).required() });

function toOid(id) {
  try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
}

// @desc    Get all subjects
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({}).sort({ createdAt: 1 }); // creation order (oldest first)
    const subjectsWithCounts = await Promise.all(subjects.map(async (s) => {
      const [chapterCount, fileCount] = await Promise.all([
        Chapter.countDocuments({ subjectId: s._id }),
        File.countDocuments({ subjectId: s._id, status: 'approved' })
      ]);
      return { id: s._id.toString(), name: s.name, chapterCount, fileCount, createdAt: s.createdAt };
    }));
    res.json({ success: true, subjects: subjectsWithCounts });
  } catch (error) {
    logger.error('Get subjects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create subject
exports.createSubject = async (req, res) => {
  try {
    const { error, value } = subjectSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const existing = await Subject.findOne({ name: value.name });
    if (existing) return res.status(400).json({ success: false, message: 'Subject already exists' });
    const subject = await Subject.create({ name: value.name });
    logger.info(`Subject created: ${value.name}`);
    res.status(201).json({ success: true, message: 'Subject created successfully', subject: { id: subject._id.toString(), name: subject.name, createdAt: subject.createdAt } });
  } catch (error) {
    logger.error('Create subject error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update subject
exports.updateSubject = async (req, res) => {
  try {
    const { error, value } = subjectSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const subject = await Subject.findByIdAndUpdate(req.params.id, { name: value.name }, { new: true });
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    logger.info(`Subject updated: ${value.name}`);
    res.json({ success: true, message: 'Subject updated successfully' });
  } catch (error) {
    logger.error('Update subject error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete subject
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const oid = toOid(id);
    // Cascade: delete subfolders, chapters, files
    const SubFolder = require('../models/SubFolder');
    const chapters = await Chapter.find({ subjectId: oid });
    for (const ch of chapters) {
      await SubFolder.deleteMany({ chapterId: ch._id });
    }
    await Chapter.deleteMany({ subjectId: oid });
    await File.deleteMany({ subjectId: oid });
    await Subject.findByIdAndDelete(id);
    logger.info(`Subject deleted: ${id}`);
    res.json({ success: true, message: 'Subject and related data deleted successfully' });
  } catch (error) {
    logger.error('Delete subject error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get chapters for a subject
exports.getChapters = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const oid = toOid(subjectId);
    const chapters = await Chapter.find({ subjectId: oid }).sort({ createdAt: 1 });
    const chaptersWithCounts = await Promise.all(chapters.map(async (c) => {
      const fileCount = await File.countDocuments({ chapterId: c._id, status: 'approved' });
      return { id: c._id.toString(), name: c.name, subjectId: c.subjectId.toString(), fileCount, createdAt: c.createdAt };
    }));
    res.json({ success: true, chapters: chaptersWithCounts });
  } catch (error) {
    logger.error('Get chapters error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create chapter
exports.createChapter = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { error, value } = chapterSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    const chapter = await Chapter.create({ name: value.name, subjectId: toOid(subjectId) });
    logger.info(`Chapter created: ${value.name}`);
    res.status(201).json({ success: true, message: 'Chapter created successfully', chapter: { id: chapter._id.toString(), name: chapter.name, subjectId: chapter.subjectId.toString(), createdAt: chapter.createdAt } });
  } catch (error) {
    logger.error('Create chapter error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update chapter
exports.updateChapter = async (req, res) => {
  try {
    const { error, value } = chapterSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const chapter = await Chapter.findByIdAndUpdate(req.params.id, { name: value.name }, { new: true });
    if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found' });
    logger.info(`Chapter updated: ${value.name}`);
    res.json({ success: true, message: 'Chapter updated successfully' });
  } catch (error) {
    logger.error('Update chapter error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete chapter
exports.deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const SubFolder = require('../models/SubFolder');
    await SubFolder.deleteMany({ chapterId: toOid(id) });
    await File.deleteMany({ chapterId: toOid(id) });
    await Chapter.findByIdAndDelete(id);
    logger.info(`Chapter deleted: ${id}`);
    res.json({ success: true, message: 'Chapter and related files deleted successfully' });
  } catch (error) {
    logger.error('Delete chapter error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
