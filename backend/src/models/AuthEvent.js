const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const authEventSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true },
  kiosk_device_id: String,
  event_type: { type: String, required: true }, // login_success, login_failed, logout, pin_failed, totp_failed
  ip_address: String,
  user_agent: String,
  timestamp: { type: Date, default: Date.now }
}, { collection: 'auth_events' });

authEventSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AuthEvent', authEventSchema);
