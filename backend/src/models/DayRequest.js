const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const dayRequestSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true },
  care_home_id: { type: String, required: true },
  request_type: { type: String, required: true }, // day_on, day_off
  requested_date: { type: String, required: true },
  reason: String,
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  approved_by: String,
  created_at: { type: Date, default: Date.now }
}, { collection: 'day_requests' });

dayRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('DayRequest', dayRequestSchema);
