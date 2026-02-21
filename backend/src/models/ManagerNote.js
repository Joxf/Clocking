const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const managerNoteSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  employee_id: { type: String, required: true },
  manager_id: { type: String, required: true },
  manager_name: String,
  content: { type: String, required: true },
  note_type: { type: String, default: 'general' },
  created_at: { type: Date, default: Date.now }
}, { collection: 'manager_notes' });

managerNoteSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ManagerNote', managerNoteSchema);
