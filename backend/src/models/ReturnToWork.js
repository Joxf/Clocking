const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const returnToWorkSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  employee_id: { type: String, required: true },
  employee_name: { type: String, required: true },
  sick_leave_id: { type: String, required: true },
  return_date: { type: String, required: true },
  due_date: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, in_progress, completed, overdue
  manager_completed: { type: Boolean, default: false },
  manager_completed_by: String,
  manager_completed_at: Date,
  mgr_fit_to_return: Boolean,
  mgr_absence_discussed: Boolean,
  mgr_affects_safe_working: Boolean,
  mgr_adjustments_needed: Boolean,
  mgr_adjustment_types: { type: [String], default: [] },
  mgr_occupational_health: Boolean,
  mgr_work_related: Boolean,
  mgr_incident_followup: Boolean,
  mgr_followup_required: Boolean,
  mgr_followup_timeframe: String,
  staff_completed: { type: Boolean, default: false },
  staff_completed_at: Date,
  staff_fit_to_return: Boolean,
  staff_fully_recovered: Boolean,
  staff_ongoing_symptoms: Boolean,
  staff_feels_safe: Boolean,
  staff_needs_adjustments: Boolean,
  staff_adjustment_types: { type: [String], default: [] },
  staff_understands_reporting: Boolean,
  staff_agrees_outcome: Boolean,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'return_to_work' });

returnToWorkSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ReturnToWork', returnToWorkSchema);
