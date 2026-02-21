const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const offlineAuthQueueSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true },
  kiosk_device_id: String,
  auth_type: { type: String, required: true }, // clock_in, clock_out
  timestamp: { type: Date, required: true },
  synced: { type: Boolean, default: false },
  synced_at: Date,
  created_at: { type: Date, default: Date.now }
}, { collection: 'offline_auth_queue' });

offlineAuthQueueSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('OfflineAuthQueue', offlineAuthQueueSchema);
