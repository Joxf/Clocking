const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Attendance, AttendanceAudit, Employee, Shift, ControlPreferences, Notification } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { SHIFT_TEMPLATES, COVERAGE_BASELINE, MIN_REST_HOURS } = require('../config/constants');
const { getDaysInMonth, parseShiftTimes, getWeekNumber } = require('../utils/helpers');

// POST /api/attendance/clock - Clock in or out
router.post('/clock', authMiddleware, async (req, res) => {
  try {
    const { action, late_early_reason, late_early_type } = req.body;
    
    if (!['clock_in', 'clock_out'].includes(action)) {
      return res.status(400).json({ detail: 'Invalid action' });
    }
    
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().split('T')[0];
    
    // Find today's attendance record
    let attendance = await Attendance.findOne({
      employee_id: req.user.id,
      date: todayStr
    }).lean();
    
    if (action === 'clock_in') {
      if (attendance && attendance.clock_in) {
        return res.status(400).json({ detail: 'Already clocked in today' });
      }
      
      // Determine status
      let status = 'present';
      if (late_early_type === 'late') {
        status = 'late';
      }
      
      const attendanceData = {
        clock_in: now,
        status
      };
      
      if (late_early_reason) {
        attendanceData.late_early_reason = late_early_reason;
        attendanceData.late_early_type = late_early_type;
      }
      
      if (attendance) {
        await Attendance.updateOne({ id: attendance.id }, { $set: attendanceData });
      } else {
        await Attendance.create({
          employee_id: req.user.id,
          care_home_id: req.user.care_home_id,
          date: todayStr,
          ...attendanceData
        });
      }
      
      // Send manager notification if late
      if (late_early_type === 'late') {
        const ctrlPrefs = await ControlPreferences.findOne({ care_home_id: req.user.care_home_id }).lean();
        let notifyOnLate = true;
        if (ctrlPrefs?.login?.late_early?.notify_manager_on_late === false) {
          notifyOnLate = false;
        }
        
        if (notifyOnLate) {
          const managers = await Employee.find({
            care_home_id: req.user.care_home_id,
            role: 'manager',
            status: 'active'
          }).lean();
          
          const employeeName = `${req.user.first_name} ${req.user.last_name}`;
          const reasonText = late_early_reason ? ` Reason: ${late_early_reason}` : '';
          
          for (const manager of managers) {
            await Notification.create({
              care_home_id: req.user.care_home_id,
              recipient_id: manager.id,
              title: 'Late Clock-In Alert',
              content: `${employeeName} clocked in late at ${now.toTimeString().slice(0, 5)}.${reasonText}`,
              notification_type: 'late_clock_in',
              related_id: req.user.id
            });
          }
        }
      }
      
      res.json({ success: true, action: 'clock_in', timestamp: now.toISOString() });
    } else {
      // clock_out
      if (!attendance || !attendance.clock_in) {
        return res.status(400).json({ detail: 'Not clocked in today' });
      }
      
      if (attendance.clock_out) {
        return res.status(400).json({ detail: 'Already clocked out today' });
      }
      
      await Attendance.updateOne({ id: attendance.id }, { $set: { clock_out: now } });
      
      // Get next shift
      const nextShift = await Shift.findOne({
        employee_id: req.user.id,
        shift_date: { $gt: todayStr },
        status: { $in: ['scheduled', 'swapped'] }
      }).sort({ shift_date: 1 }).lean();
      
      res.json({
        success: true,
        action: 'clock_out',
        timestamp: now.toISOString(),
        next_shift: nextShift
      });
    }
  } catch (error) {
    console.error('Clock action error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/status - Get current user's attendance status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const attendance = await Attendance.findOne({
      employee_id: req.user.id,
      date: todayStr
    }).lean();
    
    res.json({
      clocked_in: attendance?.clock_in != null,
      clocked_out: attendance?.clock_out != null,
      clock_in_time: attendance?.clock_in?.toISOString() || null,
      clock_out_time: attendance?.clock_out?.toISOString() || null
    });
  } catch (error) {
    console.error('Attendance status error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/today - Get today's attendance for care home
router.get('/today', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const attendanceRecords = await Attendance.find({
      care_home_id: req.user.care_home_id,
      date: todayStr
    }).lean();
    
    const employees = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active'
    }, { pin_hash: 0, totp_secret: 0 }).lean();
    
    const attendanceMap = {};
    attendanceRecords.forEach(a => { attendanceMap[a.employee_id] = a; });
    
    const result = employees.map(emp => {
      const att = attendanceMap[emp.id];
      return {
        employee: emp,
        clock_in: att?.clock_in?.toISOString() || null,
        clock_out: att?.clock_out?.toISOString() || null,
        status: att?.clock_in ? 'present' : 'absent'
      };
    });
    
    res.json({ date: todayStr, records: result });
  } catch (error) {
    console.error('Today attendance error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/calendar - Get calendar view for a month
router.get('/calendar', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year);
    const m = parseInt(month);
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: first, $lte: last },
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const attendance = await Attendance.find({
      care_home_id: req.user.care_home_id,
      date: { $gte: first, $lte: last }
    }).lean();
    
    const staff = await Employee.find({
      care_home_id: req.user.care_home_id,
      status: 'active',
      role: 'staff'
    }, { id: 1, employee_id: 1, first_name: 1, last_name: 1, job_title: 1, employment_type: 1 }).lean();
    
    const jobMap = {};
    staff.forEach(e => { jobMap[e.id] = e.job_title; });
    
    const days = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayShifts = shifts.filter(s => s.shift_date === ds);
      const dayAtt = attendance.filter(a => a.date === ds);
      const attMap = {};
      dayAtt.forEach(a => { attMap[a.employee_id] = a; });
      
      // Coverage per template
      const cov = {};
      for (const [tplKey, tpl] of Object.entries(SHIFT_TEMPLATES)) {
        const tplShifts = dayShifts.filter(s => s.template === tplKey);
        const nurseC = tplShifts.filter(s => jobMap[s.employee_id] === 'nurse').length;
        const carerC = tplShifts.filter(s => ['carer', 'senior_carer'].includes(jobMap[s.employee_id])).length;
        cov[tplKey] = { nurses: nurseC, carers: carerC, total: tplShifts.length };
      }
      
      const scheduledCount = new Set(dayShifts.map(s => s.employee_id)).size;
      const clockedInIds = new Set(dayAtt.filter(a => a.clock_in).map(a => a.employee_id));
      
      let lateCount = 0;
      let noShowCount = 0;
      const today = new Date().toISOString().split('T')[0];
      
      for (const s of dayShifts) {
        const att = attMap[s.employee_id];
        if (!att || !att.clock_in) {
          if (ds <= today) noShowCount++;
        } else {
          try {
            const ci = new Date(att.clock_in);
            const shiftStart = new Date(`${ds}T${s.start_time}:00Z`);
            if ((ci - shiftStart) / 1000 > 900) lateCount++;
          } catch (e) {}
        }
      }
      
      days[ds] = {
        scheduled: scheduledCount,
        clocked_in: clockedInIds.size,
        late: lateCount,
        no_show: noShowCount,
        coverage: cov
      };
    }
    
    res.json({ year: y, month: m, days });
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/day-detail - Get detailed attendance for a specific day
router.get('/day-detail', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { date } = req.query;
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: date,
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const attendance = await Attendance.find({
      care_home_id: req.user.care_home_id,
      date
    }).lean();
    const attMap = {};
    attendance.forEach(a => { attMap[a.employee_id] = a; });
    
    const staffIds = [...new Set([...shifts.map(s => s.employee_id), ...attendance.map(a => a.employee_id)])];
    const staff = await Employee.find(
      { id: { $in: staffIds } },
      { id: 1, employee_id: 1, first_name: 1, last_name: 1, job_title: 1, employment_type: 1 }
    ).lean();
    const empMap = {};
    staff.forEach(e => { empMap[e.id] = e; });
    
    const shiftGroups = {};
    const today = new Date().toISOString().split('T')[0];
    
    for (const [tplKey, tpl] of Object.entries(SHIFT_TEMPLATES)) {
      const tplShifts = shifts.filter(s => s.template === tplKey);
      const members = tplShifts.map(s => {
        const emp = empMap[s.employee_id] || {};
        const att = attMap[s.employee_id];
        const clockIn = att?.clock_in?.toISOString() || null;
        const clockOut = att?.clock_out?.toISOString() || null;
        
        let status = 'scheduled';
        if (clockIn) {
          try {
            const ci = new Date(clockIn);
            const shiftStart = new Date(`${date}T${s.start_time}:00Z`);
            status = (ci - shiftStart) / 1000 > 900 ? 'late' : 'present';
          } catch (e) {
            status = 'present';
          }
        } else if (date <= today) {
          status = 'no_show';
        }
        
        return {
          shift_id: s.id,
          internal_id: s.employee_id,
          employee_id: emp.employee_id || '',
          name: `${emp.first_name || ''} ${emp.last_name || ''}`,
          job_title: emp.job_title || '',
          employment_type: emp.employment_type || 'permanent',
          clock_in: clockIn,
          clock_out: clockOut,
          status,
          attendance_id: att?.id || null,
          is_agency_cover: s.is_agency_cover || false
        };
      });
      
      const nurseC = members.filter(m => m.job_title === 'nurse').length;
      const carerC = members.filter(m => ['carer', 'senior_carer'].includes(m.job_title)).length;
      const baselineMet = nurseC >= COVERAGE_BASELINE.nurse && carerC >= COVERAGE_BASELINE.carer;
      const overstaffed = nurseC > COVERAGE_BASELINE.nurse + 1 && carerC > COVERAGE_BASELINE.carer + 2;
      
      let color = baselineMet ? 'green' : 'red';
      if (overstaffed) color = 'blue';
      
      shiftGroups[tplKey] = {
        label: tpl.label,
        start: tpl.start,
        end: tpl.end,
        members,
        total: members.length,
        nurses: nurseC,
        carers: carerC,
        baseline_met: baselineMet,
        overstaffed,
        color
      };
    }
    
    res.json({ date, shifts: shiftGroups, baseline: COVERAGE_BASELINE });
  } catch (error) {
    console.error('Day detail error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/attendance/adjust - Manually adjust attendance
router.put('/adjust', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { employee_id, date, clock_in, clock_out, reason } = req.body;
    
    let att = await Attendance.findOne({
      care_home_id: req.user.care_home_id,
      employee_id,
      date
    }).lean();
    
    const oldClockIn = att?.clock_in?.toISOString() || null;
    const oldClockOut = att?.clock_out?.toISOString() || null;
    
    if (att) {
      const updateFields = {};
      if (clock_in !== undefined) updateFields.clock_in = clock_in ? new Date(clock_in) : null;
      if (clock_out !== undefined) updateFields.clock_out = clock_out ? new Date(clock_out) : null;
      
      if (Object.keys(updateFields).length > 0) {
        await Attendance.updateOne({ id: att.id }, { $set: updateFields });
      }
    } else {
      await Attendance.create({
        employee_id,
        care_home_id: req.user.care_home_id,
        date,
        clock_in: clock_in ? new Date(clock_in) : null,
        clock_out: clock_out ? new Date(clock_out) : null
      });
    }
    
    // Create audit log
    await AttendanceAudit.create({
      attendance_date: date,
      employee_id,
      adjusted_by: req.user.id,
      adjusted_by_name: `${req.user.first_name} ${req.user.last_name}`,
      old_clock_in: oldClockIn,
      new_clock_in: clock_in,
      old_clock_out: oldClockOut,
      new_clock_out: clock_out,
      reason
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Adjust attendance error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/audit - Get audit trail for attendance adjustments
router.get('/audit', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { date, employee_id } = req.query;
    const query = {};
    if (date) query.attendance_date = date;
    if (employee_id) query.employee_id = employee_id;
    
    const audits = await AttendanceAudit.find(query).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ audits });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/wtd-alerts - Working Time Directive alerts
router.get('/wtd-alerts', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
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
    }, { id: 1, employee_id: 1, first_name: 1, last_name: 1 }).lean();
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: first, $lte: last },
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const alerts = [];
    
    for (const emp of staff) {
      const empShifts = shifts.filter(s => s.employee_id === emp.id).sort((a, b) => a.shift_date.localeCompare(b.shift_date));
      const name = `${emp.first_name} ${emp.last_name}`;
      
      // Check weekly hours (>48h)
      const weekHours = {};
      for (const s of empShifts) {
        const d = new Date(s.shift_date);
        const weekNum = getWeekNumber(d);
        const hours = SHIFT_TEMPLATES[s.template]?.hours || 0;
        weekHours[weekNum] = (weekHours[weekNum] || 0) + hours;
      }
      
      for (const [wk, hrs] of Object.entries(weekHours)) {
        if (hrs > 48) {
          alerts.push({
            type: 'weekly_hours',
            employee: name,
            employee_id: emp.employee_id,
            message: `Week ${wk}: ${hrs}h scheduled (max 48h)`,
            severity: 'high'
          });
        }
      }
      
      // Check rest gaps (<11h)
      for (let i = 1; i < empShifts.length; i++) {
        try {
          const prev = parseShiftTimes(empShifts[i - 1]);
          const curr = parseShiftTimes(empShifts[i]);
          const gap = (curr.start - prev.end) / (1000 * 60 * 60);
          
          if (gap > 0 && gap < MIN_REST_HOURS) {
            alerts.push({
              type: 'rest_gap',
              employee: name,
              employee_id: emp.employee_id,
              message: `${Math.round(gap)}h rest between ${empShifts[i - 1].shift_date} and ${empShifts[i].shift_date} (min ${MIN_REST_HOURS}h)`,
              severity: 'high'
            });
          }
        } catch (e) {}
      }
    }
    
    res.json({ year: y, month: m, alerts });
  } catch (error) {
    console.error('WTD alerts error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/attendance/late-arrivals-report - Late arrivals report for managers
router.get('/late-arrivals-report', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year);
    const m = parseInt(month);
    
    const daysInMonth = getDaysInMonth(y, m);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    const employees = await Employee.find(
      { care_home_id: req.user.care_home_id },
      { id: 1, employee_id: 1, first_name: 1, last_name: 1, job_title: 1 }
    ).lean();
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });
    
    const shifts = await Shift.find({
      care_home_id: req.user.care_home_id,
      shift_date: { $gte: first, $lte: last },
      status: { $in: ['scheduled', 'completed'] }
    }).lean();
    
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[`${s.employee_id}_${s.shift_date}`] = s; });
    
    const attendanceRecords = await Attendance.find({
      care_home_id: req.user.care_home_id,
      date: { $gte: first, $lte: last }
    }).lean();
    
    const lateArrivals = [];
    
    for (const att of attendanceRecords) {
      if (!att.clock_in) continue;
      
      const emp = empMap[att.employee_id] || {};
      const clockIn = new Date(att.clock_in);
      const dateStr = att.date;
      
      const shiftKey = `${att.employee_id}_${dateStr}`;
      const shift = shiftMap[shiftKey];
      
      let isLate = false;
      let minutesLate = 0;
      let shiftStartStr = null;
      
      if (att.status === 'late' || att.late_early_type === 'late') {
        isLate = true;
      } else if (shift) {
        try {
          shiftStartStr = shift.start_time;
          const shiftStart = new Date(`${dateStr}T${shiftStartStr}:00Z`);
          const diff = (clockIn - shiftStart) / (1000 * 60);
          if (diff > 5) {
            isLate = true;
            minutesLate = Math.round(diff);
          }
        } catch (e) {}
      }
      
      if (isLate) {
        if (shift && !minutesLate) {
          try {
            shiftStartStr = shift.start_time;
            const shiftStart = new Date(`${dateStr}T${shiftStartStr}:00Z`);
            minutesLate = Math.round((clockIn - shiftStart) / (1000 * 60));
          } catch (e) {}
        }
        
        lateArrivals.push({
          date: dateStr,
          employee_id: emp.employee_id || '',
          employee_name: `${emp.first_name || ''} ${emp.last_name || ''}`,
          job_title: emp.job_title || '',
          scheduled_start: shiftStartStr || 'N/A',
          actual_clock_in: clockIn.toTimeString().slice(0, 5),
          minutes_late: minutesLate,
          reason: att.late_early_reason || '',
          shift_type: shift?.template || ''
        });
      }
    }
    
    // Sort by date desc, then minutes late desc
    lateArrivals.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.minutes_late - a.minutes_late;
    });
    
    // Calculate summary
    const uniqueEmployees = new Set(lateArrivals.map(a => a.employee_id));
    const totalLateCount = lateArrivals.length;
    const avgMinutesLate = totalLateCount > 0 ? lateArrivals.reduce((sum, a) => sum + a.minutes_late, 0) / totalLateCount : 0;
    
    const employeeCounts = {};
    lateArrivals.forEach(a => {
      employeeCounts[a.employee_id] = (employeeCounts[a.employee_id] || 0) + 1;
    });
    
    const repeatOffenders = Object.entries(employeeCounts)
      .filter(([_, count]) => count >= 3)
      .map(([empId, count]) => ({
        employee_id: empId,
        count,
        name: empMap[empId] ? `${empMap[empId].first_name} ${empMap[empId].last_name}` : ''
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json({
      year: y,
      month: m,
      summary: {
        total_late_arrivals: totalLateCount,
        unique_employees: uniqueEmployees.size,
        average_minutes_late: Math.round(avgMinutesLate * 10) / 10,
        repeat_offenders: repeatOffenders
      },
      late_arrivals: lateArrivals
    });
  } catch (error) {
    console.error('Late arrivals report error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
