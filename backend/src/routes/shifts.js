const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Shift, Employee, Attendance, LeaveRequest, DayRequest } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES } = require('../config/constants');

// GET /api/shifts/my-rota - Get current user's rota
router.get('/my-rota', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    const shifts = await Shift.find({
      employee_id: req.user.id,
      shift_date: { $gte: first, $lte: last }
    }).sort({ shift_date: 1 }).lean();
    
    res.json({ shifts });
  } catch (error) {
    console.error('My rota error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/shifts/today - Get today's shifts
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: today,
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const employeeIds = [...new Set(shifts.map(s => s.employee_id))];
    const employees = await Employee.find(
      { id: { $in: employeeIds } },
      { pin_hash: 0, totp_secret: 0 }
    ).lean();
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });
    
    const attendance = await Attendance.find({
      care_home_id: req.user.care_home_id,
      date: today
    }).lean();
    const attMap = {};
    attendance.forEach(a => { attMap[a.employee_id] = a; });
    
    const result = shifts.map(s => ({
      shift: s,
      employee: empMap[s.employee_id] || null,
      attendance: attMap[s.employee_id] || null
    }));
    
    res.json({ date: today, shifts: result });
  } catch (error) {
    console.error('Today shifts error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/shifts/next - Get user's next shift
router.get('/next', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const nextShift = await Shift.findOne({
      employee_id: req.user.id,
      shift_date: { $gte: today },
      status: { $in: ['scheduled', 'swapped'] }
    }).sort({ shift_date: 1 }).lean();
    
    if (!nextShift) {
      return res.json({ next_shift: null });
    }
    
    const template = SHIFT_TEMPLATES[nextShift.template] || {};
    
    res.json({
      next_shift: {
        ...nextShift,
        template_info: template
      }
    });
  } catch (error) {
    console.error('Next shift error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
