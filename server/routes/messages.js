const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getConversations,
  getUnreadCount,
  markAsRead,
  sendContactMessage,
  getContactMessages,
  deleteContactMessage
} = require('../controllers/messageController');
const { protect, approvedOnly } = require('../middleware/auth');

// Public route - no authentication required
router.post('/contact', sendContactMessage);

// Protected routes
router.post('/', protect, approvedOnly, sendMessage);
router.get('/conversations', protect, approvedOnly, getConversations);
router.get('/contact-messages', protect, getContactMessages);
router.get('/unread-count', protect, approvedOnly, getUnreadCount);
router.put('/:id/read', protect, approvedOnly, markAsRead);
router.delete('/contact/:id', protect, deleteContactMessage);
router.get('/', protect, approvedOnly, getConversation);

module.exports = router;
