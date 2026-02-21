const express = require('express');
const router = express.Router();
const { Employee, Shift, LeaveRequest, DayRequest } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES } = require('../config/constants');
const { getDaysInMonth } = require('../utils/helpers');

// GET /api/calendar/team-availability - Get team availability for a date
router.get('/team-availability', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { date } = req.query;
    
    // Get all staff
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }, { pin_hash: 0, totp_secret: 0 }).lean();
    
    // Get shifts for date
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: date,
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    // Get leave for date
    const leaves = await LeaveRequest.find({
      care_home_id: req.user.care_home_id,
      status: 'approved',
      start_date: { $lte: date },
      end_date: { $gte: date }
    }).lean();
    
    // Get day off requests for date
    const dayOffs = await DayRequest.find({
      care_home_id: req.user.care_home_id,
      status: 'approved',
      request_type: 'day_off',
      requested_date: date
    }).lean();
    
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.employee_id] = s; });
    
    const leaveSet = new Set(leaves.map(l => l.employee_id));
    const dayOffSet = new Set(dayOffs.map(d => d.employee_id));
    
    const availability = staff.map(emp => {
      const shift = shiftMap[emp.id];
      const onLeave = leaveSet.has(emp.id);
      const dayOff = dayOffSet.has(emp.id);
      
      let status = 'available';
      if (shift) status = 'scheduled';
      else if (onLeave) status = 'on_leave';
      else if (dayOff) status = 'day_off';
      
      return {
        employee: emp,
        status,
        shift: shift ? { ...shift, template_info: SHIFT_TEMPLATES[shift.template] || {} } : null
      };
    });
    
    res.json({ date, availability });
  } catch (error) {
    console.error('Team availability error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/calendar/monthly-rota - Get monthly rota
router.get('/monthly-rota', authMiddleware, async (req, res) => {
  try {
    const { year, month, employee_id } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    const empId = employee_id || req.user.id;
    
    const shifts = await Shift.find({
      employee_id: empId,
      shift_date: { $gte: first, $lte: last }
    }).lean();
    
    const leaveRequests = await LeaveRequest.find({
      employee_id: empId,
      status: 'approved',
      start_date: { $lte: last },
      end_date: { $gte: first }
    }).lean();
    
    // Build calendar data
    const calendar = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const shift = shifts.find(s => s.shift_date === dateStr);
      const leave = leaveRequests.find(l => l.start_date <= dateStr && l.end_date >= dateStr);
      
      calendar[dateStr] = {
        shift: shift ? { ...shift, template_info: SHIFT_TEMPLATES[shift.template] || {} } : null,
        leave: leave || null
      };
    }
    
    res.json({ year: y, month: m, calendar });
  } catch (error) {
    console.error('Monthly rota error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/calendar/team-rota - Get team rota for a week
router.get('/team-rota', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all staff
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }, { pin_hash: 0, totp_secret: 0 }).lean();
    
    // Get shifts
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: start_date, $lte: end_date }
    }).lean();
    
    // Build team rota
    const teamRota = staff.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id);
      return {
        employee: emp,
        shifts: empShifts.map(s => ({
          ...s,
          template_info: SHIFT_TEMPLATES[s.template] || {}
        }))
      };
    });
    
    res.json({ start_date, end_date, team_rota: teamRota });
  } catch (error) {
    console.error('Team rota error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
