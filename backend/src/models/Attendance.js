const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendanceSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true },
  care_home_id: { type: String, required: true },
  kiosk_device_id: String,
  date: String, // YYYY-MM-DD
  clock_in: Date,
  clock_out: Date,
  status: { type: String, default: 'present' }, // present, late, early_leave, absent
  late_early_reason: String,
  late_early_type: String, // 'late' or 'early'
  notes: String,
  created_at: { type: Date, default: Date.now }
}, { collection: 'attendance' });

attendanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
