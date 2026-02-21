const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const shiftSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  employee_id: { type: String, required: true },
  care_home_id: { type: String, required: true },
  shift_date: { type: String, required: true }, // YYYY-MM-DD
  start_time: { type: String, required: true }, // HH:MM
  end_time: { type: String, required: true },
  template: { type: String, default: 'custom' }, // early, late, night, long_day, custom
  shift_type: { type: String, default: 'regular' }, // regular, overtime, on_call
  status: { type: String, default: 'scheduled' }, // scheduled, completed, missed, swapped
  is_agency_cover: { type: Boolean, default: false },
  notes: String,
  assigned_by: String,
  created_at: { type: Date, default: Date.now }
}, { collection: 'shifts' });

shiftSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Shift', shiftSchema);
