const express = require('express');
const router = express.Router();
const { Employee, Shift, LeaveRequest, DayRequest, Attendance, ShiftSwapRequest, ReturnToWork } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES } = require('../config/constants');

// GET /api/staff/profile - Get current user's profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findOne(
      { id: req.user.id },
      { pin_hash: 0, totp_secret: 0 }
    ).lean();
    
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    // Get upcoming shifts
    const today = new Date().toISOString().split('T')[0];
    const upcomingShifts = await Shift.find({
      employee_id: req.user.id,
      shift_date: { $gte: today },
      status: { $in: ['scheduled', 'swapped'] }
    }).sort({ shift_date: 1 }).limit(10).lean();
    
    // Get pending leave requests
    const pendingLeave = await LeaveRequest.find({
      employee_id: req.user.id,
      status: 'pending'
    }).lean();
    
    // Get pending day requests
    const pendingDayRequests = await DayRequest.find({
      employee_id: req.user.id,
      status: 'pending'
    }).lean();
    
    // Get pending swap requests
    const pendingSwaps = await ShiftSwapRequest.find({
      $or: [
        { requester_id: req.user.id, status: { $in: ['pending_acceptance', 'accepted_pending_approval'] } },
        { target_id: req.user.id, status: 'pending_acceptance' }
      ]
    }).lean();
    
    // Get pending RTW
    const pendingRtw = await ReturnToWork.find({
      employee_id: req.user.id,
      status: { $in: ['pending', 'in_progress'] }
    }).lean();
    
    // Get today's attendance
    const todayAttendance = await Attendance.findOne({
      employee_id: req.user.id,
      date: today
    }).lean();
    
    res.json({
      employee,
      upcoming_shifts: upcomingShifts.map(s => ({
        ...s,
        template_info: SHIFT_TEMPLATES[s.template] || {}
      })),
      pending_leave: pendingLeave,
      pending_day_requests: pendingDayRequests,
      pending_swaps: pendingSwaps,
      pending_rtw: pendingRtw,
      today_attendance: todayAttendance
    });
  } catch (error) {
    console.error('Staff profile error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/staff/colleagues - Get colleagues in same care home
router.get('/colleagues', authMiddleware, async (req, res) => {
  try {
    const colleagues = await Employee.find(
      { care_home_id: req.user.care_home_id, status: 'active', id: { $ne: req.user.id } },
      { id: 1, employee_id: 1, first_name: 1, last_name: 1, job_title: 1, role: 1 }
    ).lean();
    
    res.json({ colleagues });
  } catch (error) {
    console.error('Get colleagues error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
