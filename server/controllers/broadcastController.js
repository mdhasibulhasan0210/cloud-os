const Joi = require('joi');
const User         = require('../models/User');
const Broadcast    = require('../models/Broadcast');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

const broadcastSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  pinned:  Joi.boolean().optional()
});

// @desc    Create broadcast
exports.createBroadcast = async (req, res) => {
  try {
    const { error, value } = broadcastSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { message, pinned } = value;

    const broadcast = await Broadcast.create({
      message,
      attachment: req.file ? req.file.path : null,
      pinned: pinned || false,
      createdBy: req.user.id
    });

    // Batch create notifications for all approved users
    const approvedUsers = await User.find({ status: 'approved', role: 'user' });
    if (approvedUsers.length > 0) {
      await Notification.insertMany(approvedUsers.map(user => ({
        userId: user._id,
        message: `New broadcast: ${message.substring(0, 50)}...`,
        type: 'broadcast',
        read: false,
        broadcastId: broadcast._id
      })));
    }

    logger.info(`Broadcast created by ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: 'Broadcast created successfully',
      broadcast: { id: broadcast._id.toString(), message: broadcast.message, pinned: broadcast.pinned, createdAt: broadcast.createdAt }
    });
  } catch (error) {
    logger.error('Create broadcast error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all broadcasts
exports.getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({}).sort({ pinned: -1, createdAt: -1 });

    const broadcastsWithStatus = await Promise.all(
      broadcasts.map(async (broadcast) => {
        const notification = await Notification.findOne({
          userId: req.user.id,
          broadcastId: broadcast._id
        });
        return {
          id: broadcast._id.toString(),
          message: broadcast.message,
          attachment: broadcast.attachment,
          pinned: broadcast.pinned,
          read: notification ? notification.read : false,
          createdAt: broadcast.createdAt
        };
      })
    );

    res.json({ success: true, broadcasts: broadcastsWithStatus });
  } catch (error) {
    logger.error('Get broadcasts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark broadcast as read
exports.markBroadcastAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await Broadcast.findById(id);
    if (!broadcast) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    await Notification.findOneAndUpdate(
      { userId: req.user.id, broadcastId: id },
      { $set: { read: true } }
    );
    res.json({ success: true, message: 'Broadcast marked as read' });
  } catch (error) {
    logger.error('Mark broadcast as read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update broadcast
exports.updateBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, pinned } = req.body;
    const broadcast = await Broadcast.findById(id);
    if (!broadcast) return res.status(404).json({ success: false, message: 'Broadcast not found' });
    const updates = {};
    if (message !== undefined) updates.message = message;
    if (pinned !== undefined) updates.pinned = pinned;
    await Broadcast.findByIdAndUpdate(id, updates);
    logger.info(`Broadcast updated: ${id}`);
    res.json({ success: true, message: 'Broadcast updated successfully' });
  } catch (error) {
    logger.error('Update broadcast error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete broadcast
exports.deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    await Broadcast.findByIdAndDelete(id);
    await Notification.deleteMany({ broadcastId: id });
    logger.info(`Broadcast deleted: ${id}`);
    res.json({ success: true, message: 'Broadcast deleted successfully' });
  } catch (error) {
    logger.error('Delete broadcast error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
