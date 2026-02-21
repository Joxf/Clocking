const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const kioskDeviceSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  device_name: { type: String, required: true },
  device_pin_hash: { type: String, required: true },
  location: String,
  is_active: { type: Boolean, default: true },
  last_seen: Date,
  created_at: { type: Date, default: Date.now }
}, { collection: 'kiosk_devices' });

kioskDeviceSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('KioskDevice', kioskDeviceSchema);
