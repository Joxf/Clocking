const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Employee } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { hashPin, generateTotpSecret } = require('../utils/auth');

// GET /api/employees - List all employees
router.get('/', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const employees = await Employee.find(
      { care_home_id: req.user.care_home_id },
      { pin_hash: 0, totp_secret: 0 }
    ).lean();
    
    res.json({ employees });
  } catch (error) {
    console.error('List employees error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/employees/list - List all employees with full details
router.get('/list', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const employees = await Employee.find(
      { care_home_id: req.user.care_home_id },
      { pin_hash: 0, totp_secret: 0 }
    ).lean();
    
    res.json({ employees });
  } catch (error) {
    console.error('List employees error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/employees/lookup/:employee_code - Public lookup for demo mode
router.get('/lookup/:employee_code', async (req, res) => {
  try {
    const employee = await Employee.findOne(
      { employee_id: req.params.employee_code, status: 'active' },
      { pin_hash: 0, totp_secret: 0 }
    ).lean();
    
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Lookup employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/employees/:employee_id - Get employee details
router.get('/:employee_id', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findOne(
      { employee_id: req.params.employee_id },
      { pin_hash: 0, totp_secret: 0 }
    ).lean();
    
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    // Check authorization
    if (!['manager', 'admin'].includes(req.user.role) && req.user.id !== employee.id) {
      return res.status(403).json({ detail: 'Not authorized' });
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/employees - Create new employee (admin only)
router.post('/', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const { employee_id, care_home_id, first_name, last_name, email, phone, role, job_title, employment_type, status } = req.body;
    
    // Check if employee_id already exists
    const existing = await Employee.findOne({ employee_id });
    if (existing) {
      return res.status(400).json({ detail: 'Employee ID already exists' });
    }
    
    const newEmployee = await Employee.create({
      employee_id,
      care_home_id,
      first_name,
      last_name,
      email,
      phone,
      role,
      job_title,
      employment_type: employment_type || 'permanent',
      status: status || 'active'
    });
    
    res.json({ success: true, employee_id: newEmployee.employee_id });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/employees/create - Create new employee (manager/admin)
router.post('/create', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, phone, role, job_title, employment_type, contract_hours, shift_preferences, pin } = req.body;
    
    // Generate employee ID
    const count = await Employee.countDocuments({ care_home_id: req.user.care_home_id });
    const employee_id = `EMP${String(count + 1).padStart(3, '0')}`;
    
    // Check if employee_id already exists
    const existing = await Employee.findOne({ employee_id });
    if (existing) {
      return res.status(400).json({ detail: 'Employee ID already exists' });
    }
    
    // Generate TOTP secret
    const totp_secret = generateTotpSecret();
    
    // Create employee
    const newEmployee = await Employee.create({
      employee_id,
      care_home_id: req.user.care_home_id,
      first_name,
      last_name,
      email,
      phone,
      role: role || 'staff',
      job_title,
      employment_type: employment_type || 'permanent',
      contract_hours: contract_hours || 36.0,
      shift_preferences: shift_preferences || [],
      totp_secret,
      totp_enrolled: true,
      pin_hash: pin ? hashPin(pin) : hashPin('1234')
    });
    
    res.json({
      success: true,
      employee: {
        id: newEmployee.id,
        employee_id: newEmployee.employee_id,
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        role: newEmployee.role,
        job_title: newEmployee.job_title
      }
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/employees/:employee_id/status - Update employee status
router.put('/:employee_id/status', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'on_leave'].includes(status)) {
      return res.status(400).json({ detail: 'Invalid status' });
    }
    
    const result = await Employee.updateOne(
      { employee_id: req.params.employee_id },
      { $set: { status, updated_at: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/employees/:emp_id/update - Update employee details
router.put('/:emp_id/update', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, phone, job_title, employment_type, contract_hours, shift_preferences } = req.body;
    
    const updateData = { updated_at: new Date() };
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (job_title) updateData.job_title = job_title;
    if (employment_type) updateData.employment_type = employment_type;
    if (contract_hours !== undefined) updateData.contract_hours = contract_hours;
    if (shift_preferences !== undefined) updateData.shift_preferences = shift_preferences;
    
    const result = await Employee.updateOne(
      { id: req.params.emp_id, care_home_id: req.user.care_home_id },
      { $set: updateData }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/employees/:emp_id/reset-pin - Reset employee PIN
router.put('/:emp_id/reset-pin', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { new_pin } = req.body;
    
    if (!/^\d{4}$/.test(new_pin)) {
      return res.status(400).json({ detail: 'PIN must be 4 digits' });
    }
    
    const pin_hash = hashPin(new_pin);
    
    const result = await Employee.updateOne(
      { id: req.params.emp_id, care_home_id: req.user.care_home_id },
      { $set: { pin_hash, failed_attempts: 0, lockout_until: null, updated_at: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json({ success: true, message: 'PIN reset successfully' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/employees/:emp_id/reset-totp - Reset employee TOTP
router.put('/:emp_id/reset-totp', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const totp_secret = generateTotpSecret();
    
    const result = await Employee.updateOne(
      { id: req.params.emp_id, care_home_id: req.user.care_home_id },
      { $set: { totp_secret, totp_enrolled: true, updated_at: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json({ success: true, message: 'TOTP reset successfully', totp_secret });
  } catch (error) {
    console.error('Reset TOTP error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/employees/:emp_id/deactivate - Deactivate employee
router.put('/:emp_id/deactivate', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const result = await Employee.updateOne(
      { id: req.params.emp_id, care_home_id: req.user.care_home_id },
      { $set: { status: 'inactive', updated_at: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Deactivate employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PUT /api/employees/:emp_id/activate - Activate employee
router.put('/:emp_id/activate', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const result = await Employee.updateOne(
      { id: req.params.emp_id, care_home_id: req.user.care_home_id },
      { $set: { status: 'active', updated_at: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Activate employee error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
