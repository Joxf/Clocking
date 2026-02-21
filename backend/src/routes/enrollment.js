const express = require('express');
const router = express.Router();
const { Employee, AuthEvent } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { hashPin, generateTotpSecret, generateProvisioningUri } = require('../utils/auth');

// POST /api/enrollment/generate-secret - Generate TOTP secret for employee
router.post('/generate-secret', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    
    const employee = await Employee.findOne({ employee_id }).lean();
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    // Generate new TOTP secret
    const totp_secret = generateTotpSecret();
    
    // Update employee
    await Employee.updateOne(
      { id: employee.id },
      { $set: { totp_secret, totp_enrolled: false, updated_at: new Date() } }
    );
    
    // Generate provisioning URI for mobile app
    const provisioning_uri = generateProvisioningUri(
      totp_secret,
      `${employee.first_name} ${employee.last_name}`
    );
    
    res.json({
      success: true,
      employee_id: employee.employee_id,
      totp_secret,
      provisioning_uri
    });
  } catch (error) {
    console.error('Generate secret error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/enrollment/set-pin - Set PIN for employee
router.post('/set-pin', authMiddleware, async (req, res) => {
  try {
    const { employee_id, pin } = req.body;
    
    const employee = await Employee.findOne({ employee_id }).lean();
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    // Check authorization
    if (req.user.id !== employee.id && !['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ detail: 'Not authorized' });
    }
    
    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ detail: 'PIN must be 4 digits' });
    }
    
    // Hash and store PIN
    const pin_hash = hashPin(pin);
    await Employee.updateOne(
      { id: employee.id },
      { $set: { pin_hash, updated_at: new Date() } }
    );
    
    res.json({ success: true, message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/enrollment/confirm - Confirm TOTP enrollment
router.post('/confirm', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    
    const employee = await Employee.findOne({ employee_id }).lean();
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    if (!employee.totp_secret) {
      return res.status(400).json({ detail: 'TOTP secret not generated' });
    }
    
    await Employee.updateOne(
      { id: employee.id },
      { $set: { totp_enrolled: true, updated_at: new Date() } }
    );
    
    res.json({ success: true, message: 'Enrollment confirmed' });
  } catch (error) {
    console.error('Confirm enrollment error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
