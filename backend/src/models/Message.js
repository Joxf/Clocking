const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const messageSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  sender_id: { type: String, required: true },
  sender_name: { type: String, required: true },
  recipient_id: String,
  recipient_role: String,
  subject: { type: String, required: true },
  content: { type: String, required: true },
  message_type: { type: String, default: 'general' },
  related_id: String,
  is_read: { type: Boolean, default: false },
  read_by: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now }
}, { collection: 'messages' });

messageSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);
