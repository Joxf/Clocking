const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Shift, Employee, LeaveRequest, DayRequest, ControlPreferences, OverrideLog } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES, COVERAGE_BASELINE, MIN_REST_HOURS } = require('../config/constants');
const { getDaysInMonth, parseShiftTimes, isWeekend } = require('../utils/helpers');

// GET /api/planner/templates - Get shift templates
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    res.json({ templates: SHIFT_TEMPLATES });
  } catch (error) {
    console.error('Templates error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/planner/monthly - Get monthly planner data
router.get('/monthly', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year);
    const m = parseInt(month);
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    // Get staff
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }, { pin_hash: 0, totp_secret: 0 }).lean();
    
    // Get shifts
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: first, $lte: last }
    }).lean();
    
    // Get leave requests
    const leaveRequests = await LeaveRequest.find({
      care_home_id: req.user.care_home_id,
      status: { $in: ['pending', 'approved'] },
      start_date: { $lte: last },
      end_date: { $gte: first }
    }).lean();
    
    // Get day requests
    const dayRequests = await DayRequest.find({
      care_home_id: req.user.care_home_id,
      status: { $in: ['pending', 'approved'] },
      requested_date: { $gte: first, $lte: last }
    }).lean();
    
    // Build staff with hours
    const staffWithHours = staff.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id && s.status !== 'cancelled');
      const scheduledHours = empShifts.reduce((sum, s) => {
        const tpl = SHIFT_TEMPLATES[s.template];
        return sum + (tpl ? tpl.hours : 0);
      }, 0);
      
      return {
        ...emp,
        scheduled_hours: scheduledHours,
        contract_hours: emp.contract_hours || 36
      };
    });
    
    // Build leave map
    const leaveMap = {};
    for (const lr of leaveRequests) {
      const start = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr >= first && dateStr <= last) {
          const key = `${lr.employee_id}_${dateStr}`;
          leaveMap[key] = { type: lr.leave_type, status: lr.status };
        }
      }
    }
    
    // Build day request map
    const dayRequestMap = {};
    for (const dr of dayRequests) {
      const key = `${dr.employee_id}_${dr.requested_date}`;
      dayRequestMap[key] = { type: dr.request_type, status: dr.status };
    }
    
    res.json({
      year: y,
      month: m,
      staff: staffWithHours,
      shifts,
      leave: leaveRequests, // Array of leave requests for frontend isOnLeave check
      leave_map: leaveMap,
      day_request_map: dayRequestMap,
      templates: SHIFT_TEMPLATES
    });
  } catch (error) {
    console.error('Monthly planner error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/planner/assign - Assign shift to employee
router.post('/assign', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { employee_id, shift_date, template, shift_type, is_agency_cover, notes, force } = req.body;
    
    // Validate template
    if (!SHIFT_TEMPLATES[template]) {
      return res.status(400).json({ detail: 'Invalid shift template' });
    }
    
    const tpl = SHIFT_TEMPLATES[template];
    
    // Check for existing shift on same date
    const existingShift = await Shift.findOne({
      employee_id,
      shift_date,
      status: { $ne: 'cancelled' }
    }).lean();
    
    if (existingShift && !force) {
      return res.status(400).json({ 
        detail: 'Employee already has a shift on this date',
        existing_shift: existingShift
      });
    }
    
    // If force and existing, update instead
    if (existingShift && force) {
      await Shift.updateOne(
        { id: existingShift.id },
        { $set: {
          template,
          start_time: tpl.start,
          end_time: tpl.end,
          shift_type: shift_type || 'regular',
          is_agency_cover: is_agency_cover || false,
          notes,
          assigned_by: req.user.id
        }}
      );
      
      const updatedShift = await Shift.findOne({ id: existingShift.id }).lean();
      return res.json({ success: true, shift: updatedShift, updated: true });
    }
    
    // Create new shift
    const newShift = await Shift.create({
      employee_id,
      care_home_id: req.user.care_home_id,
      shift_date,
      start_time: tpl.start,
      end_time: tpl.end,
      template,
      shift_type: shift_type || 'regular',
      is_agency_cover: is_agency_cover || false,
      notes,
      assigned_by: req.user.id
    });
    
    res.json({ success: true, shift: newShift });
  } catch (error) {
    console.error('Assign shift error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// DELETE /api/planner/unassign/:shift_id - Unassign shift
router.delete('/unassign/:shift_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const result = await Shift.deleteOne({
      id: req.params.shift_id,
      care_home_id: req.user.care_home_id
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Shift not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Unassign shift error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/planner/move - Move shift to different date/employee
router.put('/move', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { shift_id, new_date, new_employee_id, force } = req.body;
    
    const shift = await Shift.findOne({
      id: shift_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!shift) {
      return res.status(404).json({ detail: 'Shift not found' });
    }
    
    const updateData = {};
    if (new_date) updateData.shift_date = new_date;
    if (new_employee_id) updateData.employee_id = new_employee_id;
    
    await Shift.updateOne({ id: shift_id }, { $set: updateData });
    
    const updatedShift = await Shift.findOne({ id: shift_id }).lean();
    res.json({ success: true, shift: updatedShift });
  } catch (error) {
    console.error('Move shift error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/planner/overtime - Get overtime summary for month
router.get('/overtime', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year);
    const m = parseInt(month);
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }, { id: 1, employee_id: 1, first_name: 1, last_name: 1, contract_hours: 1 }).lean();
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: first, $lte: last },
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const result = staff.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id);
      const scheduledHours = empShifts.reduce((sum, s) => {
        return sum + (SHIFT_TEMPLATES[s.template]?.hours || 0);
      }, 0);
      
      const contractHours = emp.contract_hours || 36;
      const overtime = Math.max(0, scheduledHours - (contractHours * (daysInMonth / 7)));
      
      return {
        employee_id: emp.employee_id,
        name: `${emp.first_name} ${emp.last_name}`,
        contract_hours: contractHours,
        scheduled_hours: scheduledHours,
        overtime_hours: overtime
      };
    }).filter(e => e.overtime_hours > 0);
    
    res.json({ year: y, month: m, overtime: result });
  } catch (error) {
    console.error('Overtime error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/planner/validate - Validate a potential shift assignment
router.post('/validate', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    // Basic validation - can be expanded
    res.json({ valid: true, warnings: [], errors: [] });
  } catch (error) {
    console.error('Validate error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/planner/coverage - Get coverage summary for a date range
router.get('/coverage', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
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
    
    // Group by date and template
    const coverage = {};
    const dates = [...new Set(shifts.map(s => s.shift_date))].sort();
    
    for (const date of dates) {
      coverage[date] = {};
      for (const [tplKey, tpl] of Object.entries(SHIFT_TEMPLATES)) {
        const tplShifts = shifts.filter(s => s.shift_date === date && s.template === tplKey);
        const nurses = tplShifts.filter(s => jobMap[s.employee_id] === 'nurse').length;
        const carers = tplShifts.filter(s => ['carer', 'senior_carer'].includes(jobMap[s.employee_id])).length;
        
        coverage[date][tplKey] = {
          total: tplShifts.length,
          nurses,
          carers,
          baseline_met: nurses >= COVERAGE_BASELINE.nurse && carers >= COVERAGE_BASELINE.carer
        };
      }
    }
    
    res.json({ coverage, baseline: COVERAGE_BASELINE });
  } catch (error) {
    console.error('Coverage error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/planner/seed-month - Seed shifts for a month
router.post('/seed-month', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { year, month, clear_existing } = req.body;
    const y = parseInt(year);
    const m = parseInt(month);
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    // Clear existing if requested
    if (clear_existing) {
      await Shift.deleteMany({
        care_home_id: req.user.care_home_id,
        shift_date: { $gte: first, $lte: last }
      });
    }
    
    // Get staff
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }).lean();
    
    if (staff.length === 0) {
      return res.status(400).json({ detail: 'No active staff found' });
    }
    
    const templates = Object.keys(SHIFT_TEMPLATES);
    const shiftsToCreate = [];
    
    // Simple round-robin assignment
    let staffIndex = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      for (const template of templates) {
        const tpl = SHIFT_TEMPLATES[template];
        const emp = staff[staffIndex % staff.length];
        
        // Check employee preferences
        const prefs = emp.shift_preferences || [];
        let shouldAssign = true;
        
        if (prefs.includes('no_nights') && template === 'night') shouldAssign = false;
        if (prefs.includes('nights_only') && template !== 'night') shouldAssign = false;
        if (prefs.includes('earlies_only') && template !== 'early') shouldAssign = false;
        if (prefs.includes('lates_only') && template !== 'late') shouldAssign = false;
        
        if (shouldAssign) {
          shiftsToCreate.push({
            employee_id: emp.id,
            care_home_id: req.user.care_home_id,
            shift_date: dateStr,
            start_time: tpl.start,
            end_time: tpl.end,
            template,
            shift_type: 'regular',
            assigned_by: req.user.id
          });
        }
        
        staffIndex++;
      }
    }
    
    // Insert shifts
    if (shiftsToCreate.length > 0) {
      await Shift.insertMany(shiftsToCreate);
    }
    
    res.json({ success: true, shifts_created: shiftsToCreate.length });
  } catch (error) {
    console.error('Seed month error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/planner/assign-random-preferences - Assign random shift preferences to employees
router.post('/assign-random-preferences', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const preferenceOptions = [
      ['flexible'],
      ['no_nights'],
      ['nights_only'],
      ['earlies_only'],
      ['lates_only'],
      ['weekdays_only'],
      ['weekends_only']
    ];
    
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }).lean();
    
    let updated = 0;
    for (const emp of staff) {
      if (!emp.shift_preferences || emp.shift_preferences.length === 0) {
        const randomPrefs = preferenceOptions[Math.floor(Math.random() * preferenceOptions.length)];
        await Employee.updateOne(
          { id: emp.id },
          { $set: { shift_preferences: randomPrefs, updated_at: new Date() } }
        );
        updated++;
      }
    }
    
    res.json({ success: true, employees_updated: updated });
  } catch (error) {
    console.error('Assign preferences error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/planner/save - Batch save shifts (for the new batch-save model)
router.post('/save', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { shifts_to_create, shifts_to_update, shifts_to_delete } = req.body;
    
    // Delete shifts
    if (shifts_to_delete && shifts_to_delete.length > 0) {
      await Shift.deleteMany({
        id: { $in: shifts_to_delete },
        care_home_id: req.user.care_home_id
      });
    }
    
    // Update shifts
    if (shifts_to_update && shifts_to_update.length > 0) {
      for (const shift of shifts_to_update) {
        await Shift.updateOne(
          { id: shift.id, care_home_id: req.user.care_home_id },
          { $set: shift }
        );
      }
    }
    
    // Create shifts
    if (shifts_to_create && shifts_to_create.length > 0) {
      const shiftsWithCareHome = shifts_to_create.map(s => ({
        ...s,
        care_home_id: req.user.care_home_id,
        assigned_by: req.user.id
      }));
      await Shift.insertMany(shiftsWithCareHome);
    }
    
    res.json({
      success: true,
      created: shifts_to_create?.length || 0,
      updated: shifts_to_update?.length || 0,
      deleted: shifts_to_delete?.length || 0
    });
  } catch (error) {
    console.error('Save shifts error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
