const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const overrideLogSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  manager_id: { type: String, required: true },
  manager_name: { type: String, required: true },
  rule_type: { type: String, required: true },
  rule_violated: { type: String, required: true },
  staff_id: { type: String, required: true },
  staff_name: { type: String, required: true },
  shift_date: { type: String, required: true },
  justification: { type: String, required: true },
  is_agency: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
}, { collection: 'override_logs' });

overrideLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('OverrideLog', overrideLogSchema);
