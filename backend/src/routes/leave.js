const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { LeaveRequest, Employee, Notification, ReturnToWork } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/leave-requests - Get leave requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = { care_home_id: req.user.care_home_id };
    
    // Non-managers can only see their own requests
    if (!['manager', 'admin'].includes(req.user.role)) {
      query.employee_id = req.user.id;
    }
    
    const requests = await LeaveRequest.find(query).sort({ created_at: -1 }).lean();
    res.json({ requests });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/leave-requests - Create leave request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason } = req.body;
    
    const newRequest = await LeaveRequest.create({
      employee_id: req.user.id,
      care_home_id: req.user.care_home_id,
      leave_type,
      start_date,
      end_date,
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
        title: 'New Leave Request',
        content: `${req.user.first_name} ${req.user.last_name} has requested ${leave_type} leave from ${start_date} to ${end_date}`,
        notification_type: 'leave_request',
        related_id: newRequest.id
      });
    }
    
    res.json({ success: true, request: newRequest });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/leave-requests/:request_id/approve - Approve leave request
router.put('/:request_id/approve', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const request = await LeaveRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    await LeaveRequest.updateOne(
      { id: request.id },
      { $set: { status: 'approved', approved_by: req.user.id } }
    );
    
    // Notify employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: request.employee_id,
      title: 'Leave Request Approved',
      content: `Your ${request.leave_type} leave request from ${request.start_date} to ${request.end_date} has been approved`,
      notification_type: 'leave_approved',
      related_id: request.id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/leave-requests/:request_id/reject - Reject leave request
router.put('/:request_id/reject', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    
    const request = await LeaveRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    await LeaveRequest.updateOne(
      { id: request.id },
      { $set: { status: 'rejected', notes: rejection_reason } }
    );
    
    // Notify employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: request.employee_id,
      title: 'Leave Request Rejected',
      content: `Your ${request.leave_type} leave request has been rejected. ${rejection_reason || ''}`,
      notification_type: 'leave_rejected',
      related_id: request.id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// DELETE /api/leave-requests/:request_id - Cancel leave request
router.delete('/:request_id', authMiddleware, async (req, res) => {
  try {
    const request = await LeaveRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    // Only allow cancellation by owner or manager
    if (request.employee_id !== req.user.id && !['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ detail: 'Not authorized' });
    }
    
    await LeaveRequest.updateOne(
      { id: request.id },
      { $set: { status: 'cancelled' } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel leave request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/leave/overview - Get leave overview for managers
router.get('/overview', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const requests = await LeaveRequest.find({
      care_home_id: req.user.care_home_id
    }).lean();
    
    const employees = await Employee.find({
      care_home_id: req.user.care_home_id
    }, { id: 1, employee_id: 1, first_name: 1, last_name: 1 }).lean();
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });
    
    const enrichedRequests = requests.map(r => ({
      ...r,
      employee: empMap[r.employee_id] || null
    }));
    
    res.json({ requests: enrichedRequests });
  } catch (error) {
    console.error('Leave overview error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/leave/sickness-trends/:employee_id - Get sickness trends
router.get('/sickness-trends/:employee_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const sickLeaves = await LeaveRequest.find({
      employee_id: req.params.employee_id,
      leave_type: 'sick',
      care_home_id: req.user.care_home_id
    }).sort({ start_date: -1 }).lean();
    
    res.json({ sickness_records: sickLeaves });
  } catch (error) {
    console.error('Sickness trends error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/leave/create-for-staff - Manager creates leave request for a staff member
router.post('/create-for-staff', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, reason, status } = req.body;
    
    // Validate employee exists and is in same care home
    const employee = await Employee.findOne({
      id: employee_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    const newRequest = await LeaveRequest.create({
      employee_id,
      care_home_id: req.user.care_home_id,
      leave_type,
      start_date,
      end_date,
      reason: reason || '',
      status: status || 'approved', // Manager-created leaves are typically pre-approved
      approved_by: req.user.id,
      notes: `Created by manager: ${req.user.first_name} ${req.user.last_name}`
    });
    
    // Notify the employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: employee_id,
      title: 'Leave Added',
      content: `${req.user.first_name} ${req.user.last_name} has added ${leave_type} leave for you from ${start_date} to ${end_date}`,
      notification_type: 'leave_added',
      related_id: newRequest.id
    });
    
    // If it's sick leave and status is approved, create RTW record
    if (leave_type === 'sick' && (status === 'approved' || !status)) {
      await ReturnToWork.create({
        care_home_id: req.user.care_home_id,
        employee_id: employee_id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        sick_leave_id: newRequest.id,
        return_date: end_date,
        due_date: end_date
      });
    }
    
    res.json({ success: true, request: newRequest });
  } catch (error) {
    console.error('Create leave for staff error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/leave/update/:request_id - Manager updates a leave request
router.put('/update/:request_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason, status } = req.body;
    
    const request = await LeaveRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    const updates = {};
    if (leave_type) updates.leave_type = leave_type;
    if (start_date) updates.start_date = start_date;
    if (end_date) updates.end_date = end_date;
    if (reason !== undefined) updates.reason = reason;
    if (status) {
      updates.status = status;
      if (status === 'approved') {
        updates.approved_by = req.user.id;
      }
    }
    
    await LeaveRequest.updateOne(
      { id: request.id },
      { $set: updates }
    );
    
    // Notify the employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: request.employee_id,
      title: 'Leave Updated',
      content: `Your ${leave_type || request.leave_type} leave request has been updated by ${req.user.first_name} ${req.user.last_name}`,
      notification_type: 'leave_updated',
      related_id: request.id
    });
    
    const updatedRequest = await LeaveRequest.findOne({ id: request.id }).lean();
    res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// DELETE /api/leave/delete/:request_id - Manager deletes a leave request
router.delete('/delete/:request_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const request = await LeaveRequest.findOne({
      id: req.params.request_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!request) {
      return res.status(404).json({ detail: 'Request not found' });
    }
    
    // Delete the leave request
    await LeaveRequest.deleteOne({ id: request.id });
    
    // Also delete any associated RTW record
    await ReturnToWork.deleteOne({ sick_leave_id: request.id });
    
    // Notify the employee
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: request.employee_id,
      title: 'Leave Removed',
      content: `Your ${request.leave_type} leave from ${request.start_date} to ${request.end_date} has been removed by ${req.user.first_name} ${req.user.last_name}`,
      notification_type: 'leave_removed',
      related_id: request.id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/leave/mark-rtw/:leave_id - Mark return to work
router.put('/mark-rtw/:leave_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const leave = await LeaveRequest.findOne({
      id: req.params.leave_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!leave) {
      return res.status(404).json({ detail: 'Leave request not found' });
    }
    
    // Create RTW record if sick leave
    if (leave.leave_type === 'sick') {
      const employee = await Employee.findOne({ id: leave.employee_id }).lean();
      
      await ReturnToWork.create({
        care_home_id: req.user.care_home_id,
        employee_id: leave.employee_id,
        employee_name: `${employee?.first_name || ''} ${employee?.last_name || ''}`,
        sick_leave_id: leave.id,
        return_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0]
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark RTW error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
