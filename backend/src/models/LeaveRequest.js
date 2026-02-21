const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const leaveRequestSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true },
  care_home_id: { type: String, required: true },
  leave_type: { type: String, required: true }, // annual, sick, unpaid, compassionate, maternity, paternity
  start_date: { type: String, required: true },
  end_date: { type: String, required: true },
  reason: String,
  status: { type: String, default: 'pending' }, // pending, approved, rejected, cancelled
  approved_by: String,
  sick_note_provided: { type: Boolean, default: false },
  notes: String,
  created_at: { type: Date, default: Date.now }
}, { collection: 'leave_requests' });

leaveRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
