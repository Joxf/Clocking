const express = require('express');
const router = express.Router();
const { Shift, Employee, Attendance } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES, COVERAGE_BASELINE } = require('../config/constants');
const { getDaysInMonth } = require('../utils/helpers');

// GET /api/operational/heatmap - Get staffing heatmap
router.get('/heatmap', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: first, $lte: last },
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    // Build heatmap
    const heatmap = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayShifts = shifts.filter(s => s.shift_date === dateStr);
      
      heatmap[dateStr] = {};
      for (const [tplKey, tpl] of Object.entries(SHIFT_TEMPLATES)) {
        const tplShifts = dayShifts.filter(s => s.template === tplKey);
        heatmap[dateStr][tplKey] = {
          count: tplShifts.length,
          intensity: tplShifts.length / 8 // Normalize to 0-1 (assuming 8 is full)
        };
      }
    }
    
    res.json({ year: y, month: m, heatmap });
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/operational/under-coverage - Get under-coverage alerts
router.get('/under-coverage', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: start_date, $lte: end_date },
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active'
    }, { id: 1, job_title: 1 }).lean();
    const jobMap = {};
    staff.forEach(e => { jobMap[e.id] = e.job_title; });
    
    // Find under-coverage dates
    const alerts = [];
    const dates = [...new Set(shifts.map(s => s.shift_date))].sort();
    
    for (const date of dates) {
      for (const [tplKey, tpl] of Object.entries(SHIFT_TEMPLATES)) {
        const tplShifts = shifts.filter(s => s.shift_date === date && s.template === tplKey);
        const nurses = tplShifts.filter(s => jobMap[s.employee_id] === 'nurse').length;
        const carers = tplShifts.filter(s => ['carer', 'senior_carer'].includes(jobMap[s.employee_id])).length;
        
        if (nurses < COVERAGE_BASELINE.nurse || carers < COVERAGE_BASELINE.carer) {
          alerts.push({
            date,
            shift_type: tplKey,
            nurses_scheduled: nurses,
            nurses_required: COVERAGE_BASELINE.nurse,
            carers_scheduled: carers,
            carers_required: COVERAGE_BASELINE.carer,
            severity: nurses === 0 || carers === 0 ? 'critical' : 'warning'
          });
        }
      }
    }
    
    res.json({ alerts });
  } catch (error) {
    console.error('Under coverage error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
