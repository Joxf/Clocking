const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendanceAuditSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  attendance_date: { type: String, required: true },
  employee_id: { type: String, required: true },
  adjusted_by: { type: String, required: true },
  adjusted_by_name: String,
  old_clock_in: String,
  new_clock_in: String,
  old_clock_out: String,
  new_clock_out: String,
  reason: String,
  timestamp: { type: Date, default: Date.now }
}, { collection: 'attendance_audit' });

attendanceAuditSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AttendanceAudit', attendanceAuditSchema);
