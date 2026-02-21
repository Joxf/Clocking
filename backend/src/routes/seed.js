const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { CareHome, Employee, Shift, ControlPreferences, LeaveRequest, DayRequest, ReturnToWork, Attendance, ShiftSwapRequest } = require('../models');
const { hashPin, generateTotpSecret } = require('../utils/auth');
const { SHIFT_TEMPLATES } = require('../config/constants');
const { getDaysInMonth } = require('../utils/helpers');

// POST /api/seed - Seed initial data
router.post('/', async (req, res) => {
  try {
    // Check if already seeded
    const existingCareHome = await CareHome.findOne({}).lean();
    if (existingCareHome) {
      return res.json({ success: true, message: 'Already seeded', care_home_id: existingCareHome.id });
    }
    
    // Create care home
    const careHome = await CareHome.create({
      name: 'Sunrise Care Home',
      address: '123 Care Street, Healthcare City',
      phone: '01onal23 456789'
    });
    
    // Create employees
    const employees = [
      { employee_id: 'MGR001', first_name: 'Sarah', last_name: 'Johnson', role: 'manager', job_title: 'nurse', employment_type: 'permanent' },
      { employee_id: 'MGR002', first_name: 'James', last_name: 'Wilson', role: 'manager', job_title: 'senior_carer', employment_type: 'permanent' },
      { employee_id: 'STF001', first_name: 'Emily', last_name: 'Brown', role: 'staff', job_title: 'nurse', employment_type: 'permanent', shift_preferences: ['no_nights'] },
      { employee_id: 'STF002', first_name: 'Michael', last_name: 'Davis', role: 'staff', job_title: 'carer', employment_type: 'permanent', shift_preferences: ['flexible'] },
      { employee_id: 'STF003', first_name: 'Jessica', last_name: 'Martinez', role: 'staff', job_title: 'carer', employment_type: 'permanent', shift_preferences: ['earlies_only'] },
      { employee_id: 'STF004', first_name: 'David', last_name: 'Anderson', role: 'staff', job_title: 'senior_carer', employment_type: 'permanent', shift_preferences: ['lates_only'] },
      { employee_id: 'STF005', first_name: 'Lisa', last_name: 'Thomas', role: 'staff', job_title: 'nurse', employment_type: 'permanent', shift_preferences: ['nights_only'] },
      { employee_id: 'STF006', first_name: 'Robert', last_name: 'Taylor', role: 'staff', job_title: 'carer', employment_type: 'agency', shift_preferences: ['flexible'] },
      { employee_id: 'STF007', first_name: 'Amanda', last_name: 'White', role: 'staff', job_title: 'activities', employment_type: 'permanent', shift_preferences: ['weekdays_only'] },
      { employee_id: 'STF008', first_name: 'Chris', last_name: 'Harris', role: 'staff', job_title: 'kitchen', employment_type: 'permanent', shift_preferences: ['earlies_only'] },
      { employee_id: 'ADM001', first_name: 'Admin', last_name: 'User', role: 'admin', job_title: 'administrator', employment_type: 'permanent' }
    ];
    
    for (const emp of employees) {
      await Employee.create({
        ...emp,
        care_home_id: careHome.id,
        totp_secret: generateTotpSecret(),
        totp_enrolled: true,
        pin_hash: hashPin('1234'),
        contract_hours: emp.role === 'staff' ? 36 : 40
      });
    }
    
    // Create default control preferences
    await ControlPreferences.create({
      care_home_id: careHome.id
    });
    
    res.json({ success: true, care_home_id: careHome.id, employees_created: employees.length });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/seed/leave-data - Seed Leave & Availability data for 2026
router.post('/leave-data', async (req, res) => {
  try {
    const careHome = await CareHome.findOne({}).lean();
    if (!careHome) {
      return res.status(400).json({ detail: 'No care home found. Run /api/seed first.' });
    }
    
    const staff = await Employee.find({ care_home_id: careHome.id, role: 'staff' }).lean();
    if (staff.length === 0) {
      return res.status(400).json({ detail: 'No staff found' });
    }
    
    // Clear existing leave data
    await LeaveRequest.deleteMany({ care_home_id: careHome.id });
    await DayRequest.deleteMany({ care_home_id: careHome.id });
    await ReturnToWork.deleteMany({ care_home_id: careHome.id });
    
    const leaveRequests = [];
    const dayRequests = [];
    const rtwRecords = [];
    
    // Create various leave requests for 2026
    // Past approved annual leave
    leaveRequests.push({
      employee_id: staff[0].id,
      care_home_id: careHome.id,
      leave_type: 'annual',
      start_date: '2026-01-06',
      end_date: '2026-01-10',
      reason: 'Family holiday',
      status: 'approved',
      approved_by: 'Manager'
    });
    
    // Pending annual leave request
    leaveRequests.push({
      employee_id: staff[1].id,
      care_home_id: careHome.id,
      leave_type: 'annual',
      start_date: '2026-03-02',
      end_date: '2026-03-06',
      reason: 'Spring break trip',
      status: 'pending'
    });
    
    // Another pending leave
    leaveRequests.push({
      employee_id: staff[2].id,
      care_home_id: careHome.id,
      leave_type: 'annual',
      start_date: '2026-02-23',
      end_date: '2026-02-27',
      reason: 'Visiting family abroad',
      status: 'pending'
    });
    
    // Current sick leave (needs RTW)
    leaveRequests.push({
      employee_id: staff[3].id,
      care_home_id: careHome.id,
      leave_type: 'sick',
      start_date: '2026-02-10',
      end_date: '2026-02-14',
      reason: 'Flu symptoms',
      status: 'approved',
      sick_note_provided: true
    });
    
    // Past sick leave
    leaveRequests.push({
      employee_id: staff[4].id,
      care_home_id: careHome.id,
      leave_type: 'sick',
      start_date: '2026-01-20',
      end_date: '2026-01-22',
      reason: 'Back pain',
      status: 'approved',
      sick_note_provided: false
    });
    
    // Compassionate leave
    leaveRequests.push({
      employee_id: staff[5].id,
      care_home_id: careHome.id,
      leave_type: 'compassionate',
      start_date: '2026-02-17',
      end_date: '2026-02-19',
      reason: 'Family bereavement',
      status: 'approved'
    });
    
    // Maternity leave
    leaveRequests.push({
      employee_id: staff[6].id,
      care_home_id: careHome.id,
      leave_type: 'maternity',
      start_date: '2026-04-01',
      end_date: '2026-06-30',
      reason: 'Maternity leave',
      status: 'approved'
    });
    
    // Upcoming annual leave
    leaveRequests.push({
      employee_id: staff[0].id,
      care_home_id: careHome.id,
      leave_type: 'annual',
      start_date: '2026-04-15',
      end_date: '2026-04-22',
      reason: 'Easter holiday',
      status: 'approved'
    });
    
    // Rejected leave request
    leaveRequests.push({
      employee_id: staff[7].id,
      care_home_id: careHome.id,
      leave_type: 'annual',
      start_date: '2026-02-14',
      end_date: '2026-02-14',
      reason: 'Valentine\'s day',
      status: 'rejected',
      notes: 'Short staffed on this day'
    });
    
    // Unpaid leave
    leaveRequests.push({
      employee_id: staff[2].id,
      care_home_id: careHome.id,
      leave_type: 'unpaid',
      start_date: '2026-05-01',
      end_date: '2026-05-05',
      reason: 'Personal matters',
      status: 'pending'
    });
    
    // Day off requests
    dayRequests.push({
      employee_id: staff[0].id,
      care_home_id: careHome.id,
      request_type: 'day_off',
      requested_date: '2026-02-20',
      reason: 'Doctor appointment',
      status: 'approved'
    });
    
    dayRequests.push({
      employee_id: staff[1].id,
      care_home_id: careHome.id,
      request_type: 'day_off',
      requested_date: '2026-02-25',
      reason: 'Personal errand',
      status: 'pending'
    });
    
    dayRequests.push({
      employee_id: staff[4].id,
      care_home_id: careHome.id,
      request_type: 'day_on',
      requested_date: '2026-02-22',
      reason: 'Want extra hours',
      status: 'pending'
    });
    
    dayRequests.push({
      employee_id: staff[3].id,
      care_home_id: careHome.id,
      request_type: 'day_off',
      requested_date: '2026-03-01',
      reason: 'Child school event',
      status: 'pending'
    });
    
    // RTW records that need to be completed
    // RTW for David Anderson (sick leave Feb 10-14) - needs manager completion
    rtwRecords.push({
      care_home_id: careHome.id,
      employee_id: staff[3].id,
      employee_name: `${staff[3].first_name} ${staff[3].last_name}`,
      sick_leave_id: 'sick-leave-david',
      return_date: '2026-02-15',
      due_date: '2026-02-17',
      status: 'pending',
      manager_completed: false,
      staff_completed: false
    });
    
    // RTW for Lisa Thomas (past sick leave) - staff completed, needs manager
    rtwRecords.push({
      care_home_id: careHome.id,
      employee_id: staff[4].id,
      employee_name: `${staff[4].first_name} ${staff[4].last_name}`,
      sick_leave_id: 'sick-leave-lisa',
      return_date: '2026-01-23',
      due_date: '2026-01-25',
      status: 'in_progress',
      manager_completed: false,
      staff_completed: true,
      staff_completed_at: new Date('2026-01-23'),
      staff_fit_to_return: true,
      staff_fully_recovered: true,
      staff_ongoing_symptoms: false,
      staff_feels_safe: true,
      staff_needs_adjustments: false,
      staff_understands_reporting: true,
      staff_agrees_outcome: true
    });
    
    // RTW for Emily Brown - completed example
    rtwRecords.push({
      care_home_id: careHome.id,
      employee_id: staff[0].id,
      employee_name: `${staff[0].first_name} ${staff[0].last_name}`,
      sick_leave_id: 'sick-leave-emily',
      return_date: '2026-01-15',
      due_date: '2026-01-17',
      status: 'completed',
      manager_completed: true,
      manager_completed_at: new Date('2026-01-16'),
      mgr_fit_to_return: true,
      mgr_absence_discussed: true,
      mgr_affects_safe_working: false,
      mgr_adjustments_needed: false,
      mgr_occupational_health: false,
      mgr_work_related: false,
      mgr_incident_followup: false,
      mgr_followup_required: false,
      staff_completed: true,
      staff_completed_at: new Date('2026-01-15'),
      staff_fit_to_return: true,
      staff_fully_recovered: true,
      staff_ongoing_symptoms: false,
      staff_feels_safe: true,
      staff_needs_adjustments: false,
      staff_understands_reporting: true,
      staff_agrees_outcome: true
    });
    
    // Insert all records
    await LeaveRequest.insertMany(leaveRequests);
    await DayRequest.insertMany(dayRequests);
    await ReturnToWork.insertMany(rtwRecords);
    
    res.json({
      success: true,
      created: {
        leave_requests: leaveRequests.length,
        day_requests: dayRequests.length,
        rtw_records: rtwRecords.length
      }
    });
  } catch (error) {
    console.error('Seed leave data error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/seed/shifts - Seed shifts for current month
router.post('/shifts', async (req, res) => {
  try {
    const { care_home_id, year, month } = req.body;
    
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    const daysInMonth = getDaysInMonth(y, m);
    
    // Get staff
    const staff = await Employee.find({
      care_home_id,
      status: 'active',
      role: 'staff'
    }).lean();
    
    if (staff.length === 0) {
      return res.status(400).json({ detail: 'No staff found' });
    }
    
    // Clear existing shifts
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    await Shift.deleteMany({
      care_home_id,
      shift_date: { $gte: first, $lte: last }
    });
    
    // Create shifts
    const templates = Object.keys(SHIFT_TEMPLATES);
    const shiftsToCreate = [];
    
    let staffIndex = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      for (const template of templates) {
        const tpl = SHIFT_TEMPLATES[template];
        const emp = staff[staffIndex % staff.length];
        
        shiftsToCreate.push({
          employee_id: emp.id,
          care_home_id,
          shift_date: dateStr,
          start_time: tpl.start,
          end_time: tpl.end,
          template
        });
        
        staffIndex++;
      }
    }
    
    await Shift.insertMany(shiftsToCreate);
    
    res.json({ success: true, shifts_created: shiftsToCreate.length });
  } catch (error) {
    console.error('Seed shifts error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
