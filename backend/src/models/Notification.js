const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const notificationSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  recipient_id: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  notification_type: { type: String, required: true }, // leave_approved, leave_rejected, swap_request, etc.
  related_id: String,
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
}, { collection: 'notifications' });

notificationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
