const express = require('express');
const router = express.Router();
const { LeaveRequest, ShiftSwapRequest, DayRequest, Employee, ManagerNote } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/manager/pending-approvals - Get all pending approvals
router.get('/pending-approvals', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    // Get pending leave requests
    const pendingLeave = await LeaveRequest.find({
      care_home_id: req.user.care_home_id,
      status: 'pending'
    }).lean();
    
    // Get pending swap requests
    const pendingSwaps = await ShiftSwapRequest.find({
      care_home_id: req.user.care_home_id,
      status: { $in: ['pending_acceptance', 'accepted_pending_approval'] }
    }).lean();
    
    // Get pending day requests
    const pendingDayRequests = await DayRequest.find({
      care_home_id: req.user.care_home_id,
      status: 'pending'
    }).lean();
    
    // Enrich with employee names
    const employeeIds = [
      ...new Set([
        ...pendingLeave.map(l => l.employee_id),
        ...pendingSwaps.map(s => s.requester_id),
        ...pendingDayRequests.map(d => d.employee_id)
      ])
    ];
    
    const employees = await Employee.find(
      { id: { $in: employeeIds } },
      { id: 1, first_name: 1, last_name: 1, employee_id: 1 }
    ).lean();
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });
    
    res.json({
      leave_requests: pendingLeave.map(l => ({
        ...l,
        employee: empMap[l.employee_id] || null
      })),
      swap_requests: pendingSwaps,
      day_requests: pendingDayRequests.map(d => ({
        ...d,
        employee: empMap[d.employee_id] || null
      }))
    });
  } catch (error) {
    console.error('Pending approvals error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/manager/notes/:employee_id - Get notes for an employee
router.get('/notes/:employee_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const notes = await ManagerNote.find({
      employee_id: req.params.employee_id,
      care_home_id: req.user.care_home_id
    }).sort({ created_at: -1 }).lean();
    
    res.json({ notes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/manager/notes/:employee_id - Add a note for an employee
router.post('/notes/:employee_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { content, note_type } = req.body;
    
    const note = await ManagerNote.create({
      care_home_id: req.user.care_home_id,
      employee_id: req.params.employee_id,
      manager_id: req.user.id,
      manager_name: `${req.user.first_name} ${req.user.last_name}`,
      content,
      note_type: note_type || 'general'
    });
    
    res.json({ success: true, note });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// DELETE /api/manager/notes/:note_id - Delete a note
router.delete('/notes/:note_id', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    await ManagerNote.deleteOne({
      id: req.params.note_id,
      care_home_id: req.user.care_home_id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
