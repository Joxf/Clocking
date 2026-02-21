const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { DayRequest, Employee, Notification } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/day-requests - Get day requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = { care_home_id: req.user.care_home_id };
    
    if (!['manager', 'admin'].includes(req.user.role)) {
      query.employee_id = req.user.id;
    }
    
    const requests = await DayRequest.find(query).sort({ created_at: -1 }).lean();
    res.json({ requests });
  } catch (error) {
    console.error('Get day requests error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/day-requests - Create day request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { request_type, requested_date, reason } = req.body;
    
    const newRequest = await DayRequest.create({
      employee_id: req.user.id,
      care_home_id: req.user.care_home_id,
      request_type,
      requested_date,
      reason
    });
    
    // Notify managers
    const managers = await Employee.find({
      care_home_id: req.user.care_home_id,
      role: 'manager',
      status: 'active'
    }).lean();
    
    for (const manager of managers) {
      await Notification.create({
        care_home_id: req.user.care_home_id,
        recipient_id: manager.id,
        title: 'New Day Request',
        content: `${req.user.first_name} ${req.user.last_name} has requested a ${request_type} on ${requested_date}`,
        notification_type: 'day_request',
        related_id: newRequest.id
      });
    }
    
    res.json({ success: true, request: newRequest });
  } catch (error) {
    console.error('Create day request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/day-requests/:request_id/approve - Approve day request
router.put('/:request_id/approve', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const request = await DayRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    await DayRequest.updateOne(
      { id: request.id },
      { $set: { status: 'approved', approved_by: req.user.id } }
    );
    
    // Notify employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: request.employee_id,
      title: 'Day Request Approved',
      content: `Your ${request.request_type} request for ${request.requested_date} has been approved`,
      notification_type: 'day_request_approved',
      related_id: request.id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Approve day request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/day-requests/:request_id/reject - Reject day request
router.put('/:request_id/reject', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    
    const request = await DayRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    await DayRequest.updateOne(
      { id: request.id },
      { $set: { status: 'rejected' } }
    );
    
    // Notify employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: request.employee_id,
      title: 'Day Request Rejected',
      content: `Your ${request.request_type} request for ${request.requested_date} has been rejected. ${rejection_reason || ''}`,
      notification_type: 'day_request_rejected',
      related_id: request.id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reject day request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
