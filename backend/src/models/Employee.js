const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const employeeSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true }, // Human-readable ID like "EMP001"
  care_home_id: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: String,
  phone: String,
  role: { type: String, required: true }, // staff, manager, admin
  job_title: { type: String, required: true }, // nurse, senior_carer, carer, activities, kitchen, maintenance
  employment_type: { type: String, default: 'permanent' }, // permanent, agency, bank
  status: { type: String, default: 'active' }, // active, inactive, on_leave
  contract_hours: { type: Number, default: 36.0 },
  shift_preferences: { type: [String], default: [] }, // nights_only, weekends_only, etc.
  pin_hash: String,
  totp_secret: String,
  totp_enrolled: { type: Boolean, default: false },
  failed_attempts: { type: Number, default: 0 },
  lockout_until: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'employees' });

employeeSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
