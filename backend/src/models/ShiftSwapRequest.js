const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const shiftSwapRequestSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  requester_id: { type: String, required: true },
  requester_name: String,
  target_id: String,
  target_name: String,
  original_shift_id: { type: String, required: true },
  shift_date: { type: String, required: true },
  shift_start: { type: String, required: true },
  shift_end: { type: String, required: true },
  reason: String,
  message_to_manager: String,
  swap_type: { type: String, default: 'open' }, // open, direct, manager_request
  status: { type: String, default: 'pending_acceptance' }, // pending_acceptance, accepted_pending_approval, approved, rejected, cancelled
  accepted_by: String,
  accepted_by_name: String,
  manager_approved: { type: Boolean, default: false },
  approved_by: String,
  approved_at: Date,
  rejection_reason: String,
  care_home_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, { collection: 'shift_swap_requests' });

shiftSwapRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema);
