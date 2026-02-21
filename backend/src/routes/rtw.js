const express = require('express');
const router = express.Router();
const { ReturnToWork, Employee } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/rtw - Get return to work records
router.get('/', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const records = await ReturnToWork.find({
      care_home_id: req.user.care_home_id
    }).sort({ created_at: -1 }).lean();
    
    res.json({ records });
  } catch (error) {
    console.error('Get RTW error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/rtw/pending-count - Get pending RTW count
router.get('/pending-count', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const count = await ReturnToWork.countDocuments({
      care_home_id: req.user.care_home_id,
      status: { $in: ['pending', 'in_progress'] }
    });
    
    res.json({ count });
  } catch (error) {
    console.error('RTW pending count error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/rtw/my-pending - Get user's pending RTW
router.get('/my-pending', authMiddleware, async (req, res) => {
  try {
    const records = await ReturnToWork.find({
      employee_id: req.user.id,
      status: { $in: ['pending', 'in_progress'] }
    }).lean();
    
    res.json({ records });
  } catch (error) {
    console.error('My pending RTW error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/rtw/:rtw_id - Get RTW record details
router.get('/:rtw_id', authMiddleware, async (req, res) => {
  try {
    const record = await ReturnToWork.findOne({
      id: req.params.rtw_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!record) {
      return res.status(404).json({ detail: 'RTW record not found' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('Get RTW error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/rtw/:rtw_id/manager - Update manager section of RTW
router.put('/:rtw_id/manager', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const {
      mgr_fit_to_return, mgr_absence_discussed, mgr_affects_safe_working,
      mgr_adjustments_needed, mgr_adjustment_types, mgr_occupational_health,
      mgr_work_related, mgr_incident_followup, mgr_followup_required, mgr_followup_timeframe
    } = req.body;
    
    const updateData = {
      manager_completed: true,
      manager_completed_by: req.user.id,
      manager_completed_at: new Date(),
      updated_at: new Date()
    };
    
    if (mgr_fit_to_return !== undefined) updateData.mgr_fit_to_return = mgr_fit_to_return;
    if (mgr_absence_discussed !== undefined) updateData.mgr_absence_discussed = mgr_absence_discussed;
    if (mgr_affects_safe_working !== undefined) updateData.mgr_affects_safe_working = mgr_affects_safe_working;
    if (mgr_adjustments_needed !== undefined) updateData.mgr_adjustments_needed = mgr_adjustments_needed;
    if (mgr_adjustment_types !== undefined) updateData.mgr_adjustment_types = mgr_adjustment_types;
    if (mgr_occupational_health !== undefined) updateData.mgr_occupational_health = mgr_occupational_health;
    if (mgr_work_related !== undefined) updateData.mgr_work_related = mgr_work_related;
    if (mgr_incident_followup !== undefined) updateData.mgr_incident_followup = mgr_incident_followup;
    if (mgr_followup_required !== undefined) updateData.mgr_followup_required = mgr_followup_required;
    if (mgr_followup_timeframe !== undefined) updateData.mgr_followup_timeframe = mgr_followup_timeframe;
    
    const result = await ReturnToWork.updateOne(
      { id: req.params.rtw_id, care_home_id: req.user.care_home_id },
      { $set: updateData }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'RTW record not found' });
    }
    
    // Check if both sections complete
    const record = await ReturnToWork.findOne({ id: req.params.rtw_id }).lean();
    if (record.manager_completed && record.staff_completed) {
      await ReturnToWork.updateOne(
        { id: req.params.rtw_id },
        { $set: { status: 'completed' } }
      );
    } else {
      await ReturnToWork.updateOne(
        { id: req.params.rtw_id },
        { $set: { status: 'in_progress' } }
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update RTW manager error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/rtw/:rtw_id/staff - Update staff section of RTW
router.put('/:rtw_id/staff', authMiddleware, async (req, res) => {
  try {
    const {
      staff_fit_to_return, staff_fully_recovered, staff_ongoing_symptoms,
      staff_feels_safe, staff_needs_adjustments, staff_adjustment_types,
      staff_understands_reporting, staff_agrees_outcome
    } = req.body;
    
    // Verify employee owns this RTW
    const record = await ReturnToWork.findOne({ id: req.params.rtw_id }).lean();
    if (!record || record.employee_id !== req.user.id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }
    
    const updateData = {
      staff_completed: true,
      staff_completed_at: new Date(),
      updated_at: new Date()
    };
    
    if (staff_fit_to_return !== undefined) updateData.staff_fit_to_return = staff_fit_to_return;
    if (staff_fully_recovered !== undefined) updateData.staff_fully_recovered = staff_fully_recovered;
    if (staff_ongoing_symptoms !== undefined) updateData.staff_ongoing_symptoms = staff_ongoing_symptoms;
    if (staff_feels_safe !== undefined) updateData.staff_feels_safe = staff_feels_safe;
    if (staff_needs_adjustments !== undefined) updateData.staff_needs_adjustments = staff_needs_adjustments;
    if (staff_adjustment_types !== undefined) updateData.staff_adjustment_types = staff_adjustment_types;
    if (staff_understands_reporting !== undefined) updateData.staff_understands_reporting = staff_understands_reporting;
    if (staff_agrees_outcome !== undefined) updateData.staff_agrees_outcome = staff_agrees_outcome;
    
    await ReturnToWork.updateOne(
      { id: req.params.rtw_id },
      { $set: updateData }
    );
    
    // Check if both sections complete
    const updatedRecord = await ReturnToWork.findOne({ id: req.params.rtw_id }).lean();
    if (updatedRecord.manager_completed && updatedRecord.staff_completed) {
      await ReturnToWork.updateOne(
        { id: req.params.rtw_id },
        { $set: { status: 'completed' } }
      );
    } else {
      await ReturnToWork.updateOne(
        { id: req.params.rtw_id },
        { $set: { status: 'in_progress' } }
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update RTW staff error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/staff/:employee_id/rtw-status - Get RTW status for employee
router.get('/staff/:employee_id/rtw-status', authMiddleware, async (req, res) => {
  try {
    const pendingRtw = await ReturnToWork.findOne({
      employee_id: req.params.employee_id,
      status: { $in: ['pending', 'in_progress'] }
    }).lean();
    
    res.json({ has_pending_rtw: !!pendingRtw, rtw: pendingRtw });
  } catch (error) {
    console.error('RTW status error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
