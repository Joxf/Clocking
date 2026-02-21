const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { KioskDevice, Employee, Attendance, Shift, OfflineAuthQueue } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { hashPin, verifyPin } = require('../utils/auth');

// GET /api/kiosk-devices - Get kiosk devices
router.get('-devices', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const devices = await KioskDevice.find({
      care_home_id: req.user.care_home_id
    }).lean();
    
    res.json({ devices });
  } catch (error) {
    console.error('Get kiosk devices error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/kiosk/register - Register a new kiosk device
router.post('/register', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { device_name, device_pin, location } = req.body;
    
    if (!/^\d{6}$/.test(device_pin)) {
      return res.status(400).json({ detail: 'Device PIN must be 6 digits' });
    }
    
    const device = await KioskDevice.create({
      care_home_id: req.user.care_home_id,
      device_name,
      device_pin_hash: hashPin(device_pin),
      location
    });
    
    res.json({
      success: true,
      device: {
        id: device.id,
        device_name: device.device_name,
        location: device.location
      }
    });
  } catch (error) {
    console.error('Register kiosk error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/kiosk/heartbeat - Kiosk heartbeat
router.post('/heartbeat', async (req, res) => {
  try {
    const { device_id } = req.body;
    
    await KioskDevice.updateOne(
      { id: device_id },
      { $set: { last_seen: new Date() } }
    );
    
    res.json({ success: true, server_time: new Date().toISOString() });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/kiosk/offline-bundle - Get offline bundle for kiosk
router.get('/offline-bundle', async (req, res) => {
  try {
    const { device_id, care_home_id } = req.query;
    
    // Get active employees
    const employees = await Employee.find(
      { care_home_id, status: 'active' },
      { id: 1, employee_id: 1, first_name: 1, last_name: 1, pin_hash: 1, job_title: 1 }
    ).lean();
    
    // Get today's shifts
    const today = new Date().toISOString().split('T')[0];
    const shifts = await Shift.find({
      care_home_id,
      shift_date: today
    }).lean();
    
    res.json({
      employees: employees.map(e => ({
        id: e.id,
        employee_id: e.employee_id,
        first_name: e.first_name,
        last_name: e.last_name,
        pin_hash: e.pin_hash,
        job_title: e.job_title
      })),
      shifts,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Offline bundle error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/kiosk/offline-auth - Process offline authentication
router.post('/offline-auth', async (req, res) => {
  try {
    const { employee_id, pin, action, timestamp, kiosk_device_id } = req.body;
    
    const employee = await Employee.findOne({ id: employee_id }).lean();
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }
    
    if (!verifyPin(pin, employee.pin_hash)) {
      return res.status(401).json({ detail: 'Invalid PIN' });
    }
    
    // Queue the offline event
    await OfflineAuthQueue.create({
      employee_id,
      kiosk_device_id,
      auth_type: action,
      timestamp: new Date(timestamp)
    });
    
    res.json({ success: true, queued: true });
  } catch (error) {
    console.error('Offline auth error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/sync/offline-events - Sync offline events
router.post('/sync/offline-events', authMiddleware, async (req, res) => {
  try {
    const { events } = req.body;
    
    let synced = 0;
    for (const event of events) {
      const { employee_id, action, timestamp } = event;
      const date = new Date(timestamp).toISOString().split('T')[0];
      
      let attendance = await Attendance.findOne({
        employee_id,
        date
      }).lean();
      
      if (action === 'clock_in') {
        if (!attendance) {
          await Attendance.create({
            employee_id,
            care_home_id: req.user.care_home_id,
            date,
            clock_in: new Date(timestamp)
          });
        } else if (!attendance.clock_in) {
          await Attendance.updateOne(
            { id: attendance.id },
            { $set: { clock_in: new Date(timestamp) } }
          );
        }
      } else if (action === 'clock_out') {
        if (attendance && !attendance.clock_out) {
          await Attendance.updateOne(
            { id: attendance.id },
            { $set: { clock_out: new Date(timestamp) } }
          );
        }
      }
      
      synced++;
    }
    
    res.json({ success: true, synced });
  } catch (error) {
    console.error('Sync events error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
