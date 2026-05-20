const Joi = require('joi');
const User         = require('../models/User');
const Message      = require('../models/Message');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

const messageSchema = Joi.object({
  to:         Joi.string().required(),
  text:       Joi.string().min(1).max(5000).required(),
  attachment: Joi.string().optional()
});

// @desc    Send message
exports.sendMessage = async (req, res) => {
  try {
    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { to, text, attachment } = value;

    const recipient = await User.findById(to);
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found' });
    if (recipient.status !== 'approved' && recipient.role !== 'admin')
      return res.status(400).json({ success: false, message: 'Cannot send message to unapproved user' });

    const message = await Message.create({
      from: req.user.id,
      to,
      text,
      attachment: attachment || null,
      read: false
    });

    await Notification.create({
      userId: to,
      message: `New message from ${req.user.username}`,
      type: 'message',
      read: false,
      messageId: message._id
    });

    if (global.io) {
      const msgPayload = {
        id: message._id.toString(),
        from: req.user.id,
        fromUsername: req.user.username,
        fromPicture: req.user.profilePicture,
        to: message.to.toString(),
        text: message.text,
        read: false,
        createdAt: message.createdAt,
        isMine: false
      };
      global.io.to(to).emit('new_message', msgPayload);
      global.io.to(req.user.id).emit('message_sent', msgPayload);
    }

    logger.info(`Message sent from ${req.user.id} to ${to}`);
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { id: message._id.toString(), from: req.user.id, to: message.to.toString(), text: message.text, createdAt: message.createdAt }
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get conversation with a user
exports.getConversation = async (req, res) => {
  try {
    const { with: otherUserId } = req.query;
    if (!otherUserId) return res.status(400).json({ success: false, message: 'User ID required' });

    const messages = await Message.find({
      $or: [
        { from: req.user.id, to: otherUserId },
        { from: otherUserId, to: req.user.id }
      ]
    }).sort({ createdAt: 1 });

    await Message.updateMany(
      { from: otherUserId, to: req.user.id, read: false },
      { $set: { read: true } }
    );

    const otherUser = await User.findById(otherUserId);

    res.json({
      success: true,
      conversation: {
        with: {
          id: otherUser._id.toString(),
          username: otherUser.username,
          profilePicture: otherUser.profilePicture
        },
        messages: messages.map(msg => ({
          id: msg._id.toString(),
          from: msg.from.toString(),
          to: msg.to.toString(),
          text: msg.text,
          attachment: msg.attachment,
          read: msg.read,
          createdAt: msg.createdAt,
          isMine: msg.from.toString() === req.user.id
        }))
      }
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all conversations
exports.getConversations = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ from: req.user.id }, { to: req.user.id }]
    }).sort({ createdAt: -1 });

    const conversationMap = new Map();

    for (const msg of messages) {
      const partnerId = msg.from.toString() === req.user.id
        ? msg.to.toString()
        : msg.from.toString();

      if (!conversationMap.has(partnerId)) {
        const partner = await User.findById(partnerId);
        if (!partner) continue;
        const unreadCount = await Message.countDocuments({
          from: partnerId,
          to: req.user.id,
          read: false
        });
        conversationMap.set(partnerId, {
          user: { id: partner._id.toString(), username: partner.username, profilePicture: partner.profilePicture },
          lastMessage: { text: msg.text, createdAt: msg.createdAt, isMine: msg.from.toString() === req.user.id },
          unreadCount
        });
      }
    }

    res.json({ success: true, conversations: Array.from(conversationMap.values()) });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ to: req.user.id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.to.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
    await Message.findByIdAndUpdate(id, { read: true });
    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    logger.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
