const express = require('express');
const router = express.Router();
const { ControlPreferences, OverrideLog } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/control-preferences - Get control preferences
router.get('/', authMiddleware, async (req, res) => {
  try {
    let prefs = await ControlPreferences.findOne({
      care_home_id: req.user.care_home_id
    }).lean();
    
    // Create default if not exists
    if (!prefs) {
      prefs = await ControlPreferences.create({
        care_home_id: req.user.care_home_id
      });
      prefs = prefs.toObject();
    }
    
    res.json(prefs);
  } catch (error) {
    console.error('Get control preferences error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/control-preferences/policies - Get policies summary
router.get('/policies', authMiddleware, async (req, res) => {
  try {
    const prefs = await ControlPreferences.findOne({
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!prefs) {
      return res.json({ policies: {} });
    }
    
    // Extract policy summary
    const policies = {
      consecutive: prefs.consecutive,
      rest: prefs.rest,
      weekend: prefs.weekend,
      overtime: prefs.overtime,
      agency: prefs.agency,
      preferences: prefs.preferences
    };
    
    res.json({ policies });
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/control-preferences - Update control preferences
router.put('/', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date() };
    
    const result = await ControlPreferences.updateOne(
      { care_home_id: req.user.care_home_id },
      { $set: updates },
      { upsert: true }
    );
    
    const prefs = await ControlPreferences.findOne({
      care_home_id: req.user.care_home_id
    }).lean();
    
    res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('Update control preferences error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/control-preferences/staffing-requirements/:shift_type - Get staffing requirements
router.get('/staffing-requirements/:shift_type', authMiddleware, async (req, res) => {
  try {
    const prefs = await ControlPreferences.findOne({
      care_home_id: req.user.care_home_id
    }).lean();
    
    const shiftType = req.params.shift_type;
    const requirements = prefs?.staffing?.[shiftType] || {};
    
    res.json({ requirements });
  } catch (error) {
    console.error('Get staffing requirements error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/control-preferences/override-log - Log an override
router.post('/override-log', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { rule_type, rule_violated, staff_id, staff_name, shift_date, justification, is_agency } = req.body;
    
    const log = await OverrideLog.create({
      care_home_id: req.user.care_home_id,
      manager_id: req.user.id,
      manager_name: `${req.user.first_name} ${req.user.last_name}`,
      rule_type,
      rule_violated,
      staff_id,
      staff_name,
      shift_date,
      justification,
      is_agency: is_agency || false
    });
    
    res.json({ success: true, log });
  } catch (error) {
    console.error('Create override log error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/control-preferences/override-logs - Get override logs
router.get('/override-logs', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query;
    
    const query = { care_home_id: req.user.care_home_id };
    if (start_date && end_date) {
      query.shift_date = { $gte: start_date, $lte: end_date };
    }
    
    const logs = await OverrideLog.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit) || 100)
      .lean();
    
    res.json({ logs });
  } catch (error) {
    console.error('Get override logs error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
