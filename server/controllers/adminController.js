const User         = require('../models/User');
const Subject      = require('../models/Subject');
const Chapter      = require('../models/Chapter');
const File         = require('../models/File');
const Result       = require('../models/Result');
const Broadcast    = require('../models/Broadcast');
const Message      = require('../models/Message');
const Setting      = require('../models/Setting');
const logger = require('../utils/logger');

// @desc    Get admin dashboard stats
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, pendingUsers, approvedUsers, totalFiles, pendingFiles,
           totalSubjects, totalChapters, totalMessages, totalBroadcasts, files] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ status: 'approved' }),
      File.countDocuments({ status: 'approved' }),
      File.countDocuments({ status: 'pending' }),
      Subject.countDocuments({}),
      Chapter.countDocuments({}),
      Message.countDocuments({}),
      Broadcast.countDocuments({}),
      File.find({}, 'size')
    ]);

    const storageUsed = files.reduce((total, f) => total + (f.size || 0), 0);

    res.json({
      success: true,
      stats: {
        users: { total: totalUsers, pending: pendingUsers, approved: approvedUsers },
        files: { total: totalFiles, pending: pendingFiles },
        subjects: totalSubjects,
        chapters: totalChapters,
        messages: totalMessages,
        broadcasts: totalBroadcasts,
        storage: { used: storageUsed, usedMB: (storageUsed / (1024 * 1024)).toFixed(2) }
      }
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get site settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne({ key: 'site' });
    res.json({ success: true, settings: settings || { bio: '', tagline: '', aboutText: '' } });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update site settings
exports.updateSettings = async (req, res) => {
  try {
    const { bio, tagline, aboutText } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (tagline !== undefined) updates.tagline = tagline;
    if (aboutText !== undefined) updates.aboutText = aboutText;

    await Setting.findOneAndUpdate(
      { key: 'site' },
      { $set: updates },
      { upsert: true, new: true }
    );

    logger.info('Site settings updated');
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Upload result
exports.uploadResult = async (req, res) => {
  try {
    const { title, gpa, description } = req.body;
    if (!title || !gpa) return res.status(400).json({ success: false, message: 'Title and GPA required' });

    const result = await Result.create({
      title,
      gpa: parseFloat(gpa),
      description: description || '',
      fileUrl: req.file ? req.file.path : null
    });

    logger.info(`Result uploaded: ${title}`);
    res.status(201).json({
      success: true,
      message: 'Result uploaded successfully',
      result: { id: result._id.toString(), title: result.title, gpa: result.gpa, createdAt: result.createdAt }
    });
  } catch (error) {
    logger.error('Upload result error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all results
exports.getResults = async (req, res) => {
  try {
    const results = await Result.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      results: results.map(r => ({
        id: r._id.toString(), title: r.title, gpa: r.gpa,
        description: r.description, fileUrl: r.fileUrl, createdAt: r.createdAt
      }))
    });
  } catch (error) {
    logger.error('Get results error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete result
exports.deleteResult = async (req, res) => {
  try {
    await Result.findByIdAndDelete(req.params.id);
    logger.info(`Result deleted: ${req.params.id}`);
    res.json({ success: true, message: 'Result deleted successfully' });
  } catch (error) {
    logger.error('Delete result error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    const [recentFiles, recentUsers, recentMessages] = await Promise.all([
      File.find({}).sort({ createdAt: -1 }).limit(10),
      User.find({}).sort({ createdAt: -1 }).limit(10),
      Message.find({}).sort({ createdAt: -1 }).limit(10)
    ]);

    const fileActivity = await Promise.all(recentFiles.map(async (f) => {
      const user = await User.findById(f.uploadedBy);
      return { type: 'file', description: `${user?.username || 'Unknown'} uploaded ${f.originalname}`, createdAt: f.createdAt };
    }));

    const userActivity = recentUsers.map(u => ({
      type: 'user', description: `${u.username} registered`, createdAt: u.createdAt
    }));

    const msgActivity = await Promise.all(recentMessages.map(async (m) => {
      const [from, to] = await Promise.all([User.findById(m.from), User.findById(m.to)]);
      return { type: 'message', description: `${from?.username || 'Unknown'} sent message to ${to?.username || 'Unknown'}`, createdAt: m.createdAt };
    }));

    const allActivity = [...fileActivity, ...userActivity, ...msgActivity]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    res.json({ success: true, activity: allActivity });
  } catch (error) {
    logger.error('Get activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
