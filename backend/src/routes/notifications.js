const express = require('express');
const router = express.Router();
const { Notification } = require('../models');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications - Get user's notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient_id: req.user.id
    }).sort({ created_at: -1 }).limit(50).lean();
    
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/notifications/:notification_id/read - Mark notification as read
router.put('/:notification_id/read', authMiddleware, async (req, res) => {
  try {
    await Notification.updateOne(
      { id: req.params.notification_id, recipient_id: req.user.id },
      { $set: { is_read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient_id: req.user.id, is_read: false },
      { $set: { is_read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
