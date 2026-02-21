const express = require('express');
const router = express.Router();
const { Message } = require('../models');
const { authMiddleware } = require('../middleware/auth');

// GET /api/messages - Get user's messages
router.get('/', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { recipient_id: req.user.id },
        { recipient_id: null, care_home_id: req.user.care_home_id },
        { sender_id: req.user.id }
      ]
    }).sort({ created_at: -1 }).limit(100).lean();
    
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/messages - Send a message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { recipient_id, recipient_role, subject, content, message_type, related_id } = req.body;
    
    const newMessage = await Message.create({
      care_home_id: req.user.care_home_id,
      sender_id: req.user.id,
      sender_name: `${req.user.first_name} ${req.user.last_name}`,
      recipient_id,
      recipient_role,
      subject,
      content,
      message_type: message_type || 'general',
      related_id
    });
    
    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/messages/:message_id/read - Mark message as read
router.put('/:message_id/read', authMiddleware, async (req, res) => {
  try {
    await Message.updateOne(
      { id: req.params.message_id },
      { $set: { is_read: true }, $addToSet: { read_by: req.user.id } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
