const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { LeaveRequest, ReturnToWork, Employee } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// POST /api/sick-leave/record - Record sick leave
router.post('/record', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, reason } = req.body;
    
    const sickLeave = await LeaveRequest.create({
      employee_id: req.user.id,
      care_home_id: req.user.care_home_id,
      leave_type: 'sick',
      start_date,
      end_date,
      reason,
      status: 'approved' // Sick leave is auto-approved
    });
    
    res.json({ success: true, leave: sickLeave });
  } catch (error) {
    console.error('Record sick leave error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/sick-leave/my-records - Get user's sick leave records
router.get('/my-records', authMiddleware, async (req, res) => {
  try {
    const records = await LeaveRequest.find({
      employee_id: req.user.id,
      leave_type: 'sick'
    }).sort({ start_date: -1 }).lean();
    
    res.json({ records });
  } catch (error) {
    console.error('My sick leave error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/sick-leave/all - Get all sick leave records (manager)
router.get('/all', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const records = await LeaveRequest.find({
      care_home_id: req.user.care_home_id,
      leave_type: 'sick'
    }).sort({ start_date: -1 }).lean();
    
    // Enrich with employee data
    const employeeIds = [...new Set(records.map(r => r.employee_id))];
    const employees = await Employee.find(
      { id: { $in: employeeIds } },
      { id: 1, first_name: 1, last_name: 1, employee_id: 1 }
    ).lean();
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });
    
    res.json({
      records: records.map(r => ({
        ...r,
        employee: empMap[r.employee_id] || null
      }))
    });
  } catch (error) {
    console.error('All sick leave error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/sick-leave/:record_id/return-to-work - Mark return to work
router.put('/:record_id/return-to-work', authMiddleware, async (req, res) => {
  try {
    const leave = await LeaveRequest.findOne({
      id: req.params.record_id,
      leave_type: 'sick'
    }).lean();
    
    if (!leave) {
      return res.status(404).json({ detail: 'Sick leave record not found' });
    }
    
    // Create RTW record
    const employee = await Employee.findOne({ id: leave.employee_id }).lean();
    
    const rtw = await ReturnToWork.create({
      care_home_id: leave.care_home_id,
      employee_id: leave.employee_id,
      employee_name: `${employee?.first_name || ''} ${employee?.last_name || ''}`,
      sick_leave_id: leave.id,
      return_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0]
    });
    
    res.json({ success: true, rtw });
  } catch (error) {
    console.error('Return to work error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
