require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const enrollmentRoutes = require('./routes/enrollment');
const employeesRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const shiftsRoutes = require('./routes/shifts');
const plannerRoutes = require('./routes/planner');
const leaveRoutes = require('./routes/leave');
const dayRequestsRoutes = require('./routes/dayRequests');
const shiftSwapsRoutes = require('./routes/shiftSwaps');
const notificationsRoutes = require('./routes/notifications');
const messagesRoutes = require('./routes/messages');
const rtwRoutes = require('./routes/rtw');
const controlPreferencesRoutes = require('./routes/controlPreferences');
const staffRoutes = require('./routes/staff');
const dashboardRoutes = require('./routes/dashboard');
const calendarRoutes = require('./routes/calendar');
const managerRoutes = require('./routes/manager');
const kioskRoutes = require('./routes/kiosk');
const seedRoutes = require('./routes/seed');
const sickLeaveRoutes = require('./routes/sickLeave');
const operationalRoutes = require('./routes/operational');
const careHomesRoutes = require('./routes/careHomes');

const app = express();
const PORT = 8001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS === '*' ? '*' : process.env.CORS_ORIGINS?.split(','),
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
connectDB();

// Health check
app.get('/api/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CareHome Clocking System API - Node.js',
    version: '1.0.0'
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/leave-requests', leaveRoutes);
app.use('/api/day-requests', dayRequestsRoutes);
app.use('/api/shift-swaps', shiftSwapsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/rtw', rtwRoutes);
app.use('/api/control-preferences', controlPreferencesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/sick-leave', sickLeaveRoutes);
app.use('/api/operational', operationalRoutes);
app.use('/api/care-homes', careHomesRoutes);
app.use('/api/leave', leaveRoutes);

// Additional route aliases to match the Python backend
app.use('/api/kiosk-devices', kioskRoutes);
app.use('/api/sync', kioskRoutes);
app.use('/api/reports', attendanceRoutes);

// Reports endpoint for late arrivals (aliased)
app.get('/api/reports/late-arrivals', (req, res, next) => {
  req.url = '/late-arrivals-report' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  attendanceRoutes(req, res, next);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ detail: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ detail: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
