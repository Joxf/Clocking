const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Sub-schemas for nested structures
const staffingRequirementSchema = new mongoose.Schema({
  min_total: { type: Number, default: 8 },
  min_nurses: { type: Number, default: 2 },
  min_senior_carers: { type: Number, default: 1 },
  min_carers: { type: Number, default: 4 },
  min_activities: { type: Number, default: 0 },
  min_kitchen: { type: Number, default: 1 },
  min_domestic: { type: Number, default: 0 }
}, { _id: false });

const shiftTypeStaffingSchema = new mongoose.Schema({
  early: { type: staffingRequirementSchema, default: () => ({}) },
  late: { type: staffingRequirementSchema, default: () => ({}) },
  night: { type: staffingRequirementSchema, default: () => ({ min_total: 4, min_nurses: 1, min_senior_carers: 1, min_carers: 2, min_kitchen: 0 }) },
  long_day: { type: staffingRequirementSchema, default: () => ({}) },
  weekend_modifier: { type: Number, default: 0.8 }
}, { _id: false });

const consecutiveShiftRulesSchema = new mongoose.Schema({
  max_consecutive_day_shifts: { type: Number, default: 5 },
  max_consecutive_night_shifts: { type: Number, default: 3 },
  mix_shift_types_counts: { type: Boolean, default: true },
  long_day_counts_as: { type: Number, default: 1 },
  mode: { type: String, default: 'soft' }
}, { _id: false });

const restRulesSchema = new mongoose.Schema({
  min_rest_hours: { type: Number, default: 11 },
  mode: { type: String, default: 'soft' }
}, { _id: false });

const weekendProtectionSchema = new mongoose.Schema({
  max_consecutive_weekends: { type: Number, default: 2 },
  weekend_days: { type: [String], default: ['saturday', 'sunday'] },
  partial_weekend_counts: { type: Boolean, default: false },
  mode: { type: String, default: 'soft' }
}, { _id: false });

const leaveValidationSchema = new mongoose.Schema({
  annual_leave_mode: { type: String, default: 'hard' },
  sick_leave_mode: { type: String, default: 'hard' },
  approved_day_off_mode: { type: String, default: 'hard' },
  pending_day_off_mode: { type: String, default: 'soft' }
}, { _id: false });

const overtimeRulesSchema = new mongoose.Schema({
  max_weekly_hours: { type: Number, default: 48 },
  max_monthly_hours: { type: Number, default: 192 },
  soft_overtime_threshold: { type: Number, default: 40 },
  hard_overtime_limit: { type: Number, default: 60 },
  max_consecutive_overtime_shifts: { type: Number, default: 3 },
  mode: { type: String, default: 'soft' }
}, { _id: false });

const agencyRulesSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  max_agency_per_shift: { type: Number, default: 4 },
  max_agency_percentage: { type: Number, default: 30.0 },
  require_manager_approval: { type: Boolean, default: true },
  require_reason: { type: Boolean, default: true },
  track_costs: { type: Boolean, default: false },
  mode: { type: String, default: 'soft' }
}, { _id: false });

const shiftPreferenceRulesSchema = new mongoose.Schema({
  respect_preferences: { type: Boolean, default: true },
  mode: { type: String, default: 'soft' }
}, { _id: false });

const pinSettingsSchema = new mongoose.Schema({
  pin_length: { type: Number, default: 4 },
  max_failed_attempts: { type: Number, default: 5 },
  lockout_duration_minutes: { type: Number, default: 15 },
  enable_progressive_delay: { type: Boolean, default: false },
  require_pin_change_days: { type: Number, default: 0 }
}, { _id: false });

const authenticationSettingsSchema = new mongoose.Schema({
  auth_mode: { type: String, default: 'qr_and_pin' },
  pin_settings: { type: pinSettingsSchema, default: () => ({}) }
}, { _id: false });

const lateEarlyReasonSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  reason_text: String,
  is_active: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const lateEarlyControlsSchema = new mongoose.Schema({
  enable_late_reason: { type: Boolean, default: true },
  enable_early_reason: { type: Boolean, default: true },
  late_grace_minutes: { type: Number, default: 5 },
  early_grace_minutes: { type: Number, default: 15 },
  late_reason_mandatory: { type: Boolean, default: true },
  early_reason_mandatory: { type: Boolean, default: false },
  notify_manager_on_late: { type: Boolean, default: true },
  notify_manager_on_early: { type: Boolean, default: false },
  enable_free_text: { type: Boolean, default: false },
  max_reasons_displayed: { type: Number, default: 10 },
  late_reasons: { type: [lateEarlyReasonSchema], default: () => [
    { reason_text: "Traffic/Transport issues", order: 1 },
    { reason_text: "Childcare issues", order: 2 },
    { reason_text: "Medical appointment", order: 3 },
    { reason_text: "Family emergency", order: 4 },
    { reason_text: "Weather conditions", order: 5 }
  ]},
  early_reasons: { type: [lateEarlyReasonSchema], default: () => [
    { reason_text: "Cover for colleague", order: 1 },
    { reason_text: "Early handover", order: 2 },
    { reason_text: "Training", order: 3 },
    { reason_text: "Meeting", order: 4 }
  ]}
}, { _id: false });

const sessionControlsSchema = new mongoose.Schema({
  staff_session_timeout_minutes: { type: Number, default: 5 },
  manager_session_timeout_minutes: { type: Number, default: 60 },
  auto_logout_on_inactivity: { type: Boolean, default: true },
  allow_multiple_devices: { type: Boolean, default: false }
}, { _id: false });

const loginControlsSchema = new mongoose.Schema({
  authentication: { type: authenticationSettingsSchema, default: () => ({}) },
  late_early: { type: lateEarlyControlsSchema, default: () => ({}) },
  session: { type: sessionControlsSchema, default: () => ({}) }
}, { _id: false });

const leaveControlsSchema = new mongoose.Schema({
  minimum_notice_days: { type: Number, default: 14 },
  max_consecutive_leave_days: { type: Number, default: 14 },
  max_day_off_requests_per_month: { type: Number, default: 4 },
  block_blackout_dates: { type: Boolean, default: false },
  blackout_dates: { type: [String], default: [] },
  allow_emergency_leave_override: { type: Boolean, default: true },
  auto_approve_short_leave: { type: Boolean, default: false },
  short_leave_threshold_days: { type: Number, default: 3 }
}, { _id: false });

const swapControlsSchema = new mongoose.Schema({
  allow_direct_swaps: { type: Boolean, default: true },
  allow_open_swaps: { type: Boolean, default: true },
  require_manager_approval: { type: Boolean, default: true },
  auto_approve_if_rules_satisfied: { type: Boolean, default: false },
  swap_request_expiry_hours: { type: Number, default: 48 }
}, { _id: false });

const requestsControlsSchema = new mongoose.Schema({
  leave: { type: leaveControlsSchema, default: () => ({}) },
  swap: { type: swapControlsSchema, default: () => ({}) }
}, { _id: false });

const graceToleranceControlsSchema = new mongoose.Schema({
  max_monthly_late_occurrences: { type: Number, default: 3 },
  auto_flag_habitual_lateness: { type: Boolean, default: true },
  auto_notify_manager_threshold: { type: Number, default: 3 },
  auto_generate_staff_note: { type: Boolean, default: true }
}, { _id: false });

const attendancePatternControlsSchema = new mongoose.Schema({
  alert_frequent_early_leave: { type: Boolean, default: true },
  early_leave_threshold_monthly: { type: Number, default: 3 },
  alert_excessive_overtime: { type: Boolean, default: true },
  overtime_alert_threshold_hours: { type: Number, default: 10 }
}, { _id: false });

const shiftConfirmationRulesSchema = new mongoose.Schema({
  require_shift_confirmation: { type: Boolean, default: false },
  auto_unassign_hours: { type: Number, default: 24 },
  send_confirmation_reminder: { type: Boolean, default: true },
  reminder_hours_before: { type: Number, default: 48 }
}, { _id: false });

const escalationRulesSchema = new mongoose.Schema({
  auto_notify_backup_staff: { type: Boolean, default: true },
  auto_suggest_overtime: { type: Boolean, default: true },
  auto_suggest_agency: { type: Boolean, default: false },
  escalate_to_regional_manager: { type: Boolean, default: false },
  under_coverage_threshold_hours: { type: Number, default: 12 }
}, { _id: false });

const additionalControlsSchema = new mongoose.Schema({
  grace_tolerance: { type: graceToleranceControlsSchema, default: () => ({}) },
  attendance_patterns: { type: attendancePatternControlsSchema, default: () => ({}) },
  shift_confirmation: { type: shiftConfirmationRulesSchema, default: () => ({}) },
  escalation: { type: escalationRulesSchema, default: () => ({}) }
}, { _id: false });

// Main Control Preferences Schema
const controlPreferencesSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  care_home_id: { type: String, required: true },
  staffing: { type: shiftTypeStaffingSchema, default: () => ({}) },
  consecutive: { type: consecutiveShiftRulesSchema, default: () => ({}) },
  rest: { type: restRulesSchema, default: () => ({}) },
  weekend: { type: weekendProtectionSchema, default: () => ({}) },
  leave: { type: leaveValidationSchema, default: () => ({}) },
  overtime: { type: overtimeRulesSchema, default: () => ({}) },
  agency: { type: agencyRulesSchema, default: () => ({}) },
  preferences: { type: shiftPreferenceRulesSchema, default: () => ({}) },
  conflict_detection_enabled: { type: Boolean, default: true },
  log_all_overrides: { type: Boolean, default: true },
  login: { type: loginControlsSchema, default: () => ({}) },
  requests: { type: requestsControlsSchema, default: () => ({}) },
  additional: { type: additionalControlsSchema, default: () => ({}) },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'control_preferences' });

controlPreferencesSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ControlPreferences', controlPreferencesSchema);
