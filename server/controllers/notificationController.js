const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// @desc    Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n._id.toString(),
        message: n.message,
        type: n.type,
        read: n.read,
        fileId: n.fileId ? n.fileId.toString() : null,
        messageId: n.messageId ? n.messageId.toString() : null,
        broadcastId: n.broadcastId ? n.broadcastId.toString() : null,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.userId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
    await Notification.findByIdAndUpdate(id, { read: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all as read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.userId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
    await Notification.findByIdAndDelete(id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
