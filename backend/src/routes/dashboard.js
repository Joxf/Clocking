const express = require('express');
const router = express.Router();
const { Employee, Shift, Attendance, LeaveRequest, ShiftSwapRequest, DayRequest } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES, COVERAGE_BASELINE } = require('../config/constants');

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's shifts
    const todayShifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: today,
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    // Get today's attendance
    const todayAttendance = await Attendance.find({
      care_home_id: req.user.care_home_id,
      date: today
    }).lean();
    
    // Get active staff count
    const activeStaff = await Employee.countDocuments({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    });
    
    // Get pending requests
    const pendingLeave = await LeaveRequest.countDocuments({
      care_home_id: req.user.care_home_id,
      status: 'pending'
    });
    
    const pendingSwaps = await ShiftSwapRequest.countDocuments({
      care_home_id: req.user.care_home_id,
      status: { $in: ['pending_acceptance', 'accepted_pending_approval'] }
    });
    
    const pendingDayRequests = await DayRequest.countDocuments({
      care_home_id: req.user.care_home_id,
      status: 'pending'
    });
    
    // Calculate coverage
    const clockedInToday = todayAttendance.filter(a => a.clock_in).length;
    const scheduledToday = todayShifts.length;
    
    res.json({
      today: {
        scheduled: scheduledToday,
        clocked_in: clockedInToday,
        coverage_percentage: scheduledToday > 0 ? Math.round((clockedInToday / scheduledToday) * 100) : 0
      },
      staff: {
        active: activeStaff
      },
      pending: {
        leave_requests: pendingLeave,
        swap_requests: pendingSwaps,
        day_requests: pendingDayRequests,
        total: pendingLeave + pendingSwaps + pendingDayRequests
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
