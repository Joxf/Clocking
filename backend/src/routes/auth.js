const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Employee, AuthEvent } = require('../models');
const { authMiddleware, createToken, requireRoles } = require('../middleware/auth');
const { hashPin, verifyPin, generateTotpSecret, verifyTotp, generateProvisioningUri } = require('../utils/auth');
const { JWT_EXPIRATION_HOURS } = require('../config/constants');

// POST /api/auth/validate-qr - Step 1: Validate QR code from mobile authenticator
router.post('/validate-qr', async (req, res) => {
  try {
    const { qr_data } = req.body;
    
    // Parse QR data: employee_id:totp_token
    const parts = qr_data.split(':');
    if (parts.length !== 2) {
      return res.status(400).json({ detail: 'Invalid QR format' });
    }
    
    const [employee_id, totp_token] = parts;
    
    // Find employee
    const employee = await Employee.findOne({ employee_id }).lean();
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    // Check if account is active
    if (employee.status !== 'active') {
      return res.status(403).json({ detail: 'Account is not active' });
    }
    
    // Check lockout
    if (employee.lockout_until && new Date(employee.lockout_until) > new Date()) {
      return res.status(429).json({ detail: 'Account locked. Try again later.' });
    }
    
    // Check if enrolled
    if (!employee.totp_enrolled || !employee.totp_secret) {
      return res.status(400).json({ detail: 'Employee not enrolled for TOTP' });
    }
    
    // Verify TOTP
    if (!verifyTotp(employee.totp_secret, totp_token)) {
      await AuthEvent.create({
        employee_id: employee.id,
        event_type: 'totp_failed'
      });
      return res.status(401).json({ detail: 'QR code expired. Please scan a fresh code from your phone.' });
    }
    
    // Reset failed attempts on success
    await Employee.updateOne(
      { id: employee.id },
      { $set: { failed_attempts: 0, updated_at: new Date() } }
    );
    
    res.json({
      success: true,
      employee_id: employee.id,
      employee_code: employee.employee_id,
      name: `${employee.first_name} ${employee.last_name}`,
      requires_pin: true
    });
  } catch (error) {
    console.error('QR validation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/auth/validate-pin - Step 2: Validate PIN and create session
router.post('/validate-pin', async (req, res) => {
  try {
    const { employee_id, pin } = req.body;
    
    const employee = await Employee.findOne({ id: employee_id }).lean();
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    // Check lockout
    if (employee.lockout_until && new Date(employee.lockout_until) > new Date()) {
      return res.status(429).json({ detail: 'Account locked' });
    }
    
    // Verify PIN
    if (!employee.pin_hash || !verifyPin(pin, employee.pin_hash)) {
      // Increment failed attempts
      await Employee.updateOne(
        { id: employee.id },
        { $inc: { failed_attempts: 1 } }
      );
      
      const updatedEmployee = await Employee.findOne({ id: employee.id }).lean();
      if (updatedEmployee.failed_attempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000);
        await Employee.updateOne(
          { id: employee.id },
          { $set: { lockout_until: lockoutTime } }
        );
      }
      
      await AuthEvent.create({
        employee_id: employee.id,
        event_type: 'pin_failed'
      });
      
      return res.status(401).json({ detail: 'Invalid PIN' });
    }
    
    // Success - reset failed attempts
    await Employee.updateOne(
      { id: employee.id },
      { $set: { failed_attempts: 0, updated_at: new Date() } }
    );
    
    // Log success
    await AuthEvent.create({
      employee_id: employee.id,
      event_type: 'login_success'
    });
    
    const token = createToken(employee);
    const expires_at = new Date(Date.now() + JWT_EXPIRATION_HOURS * 60 * 60 * 1000);
    
    // Remove sensitive data
    const safeEmployee = { ...employee };
    delete safeEmployee.pin_hash;
    delete safeEmployee.totp_secret;
    delete safeEmployee._id;
    delete safeEmployee.__v;
    
    res.json({
      token,
      employee: safeEmployee,
      expires_at: expires_at.toISOString()
    });
  } catch (error) {
    console.error('PIN validation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await AuthEvent.create({
      employee_id: req.user.id,
      event_type: 'logout'
    });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/auth/mobile-token/:employee_code - Get mobile auth token for demo
router.get('/mobile-token/:employee_code', async (req, res) => {
  try {
    const employee = await Employee.findOne({ 
      employee_id: req.params.employee_code, 
      status: 'active' 
    }).lean();
    
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    if (!employee.totp_secret) {
      return res.status(400).json({ detail: 'TOTP not set up for this employee' });
    }
    
    const { authenticator } = require('otplib');
    const currentToken = authenticator.generate(employee.totp_secret);
    
    res.json({
      employee_code: employee.employee_id,
      name: `${employee.first_name} ${employee.last_name}`,
      current_token: currentToken,
      qr_data: `${employee.employee_id}:${currentToken}`,
      valid_for_seconds: 30 - (Math.floor(Date.now() / 1000) % 30)
    });
  } catch (error) {
    console.error('Mobile token error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/auth/mobile-employees - Get all employees for mobile auth demo
router.get('/mobile-employees', async (req, res) => {
  try {
    const { authenticator } = require('otplib');
    const employees = await Employee.find({ status: 'active' }).lean();
    
    const employeesWithTokens = employees.map(emp => {
      let currentToken = null;
      let qrData = null;
      
      if (emp.totp_secret && emp.totp_enrolled) {
        currentToken = authenticator.generate(emp.totp_secret);
        qrData = `${emp.employee_id}:${currentToken}`;
      }
      
      return {
        employee_id: emp.employee_id,
        name: `${emp.first_name} ${emp.last_name}`,
        role: emp.role,
        job_title: emp.job_title,
        totp_enrolled: emp.totp_enrolled,
        current_token: currentToken,
        qr_data: qrData
      };
    });
    
    res.json({
      employees: employeesWithTokens,
      valid_for_seconds: 30 - (Math.floor(Date.now() / 1000) % 30)
    });
  } catch (error) {
    console.error('Mobile employees error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
