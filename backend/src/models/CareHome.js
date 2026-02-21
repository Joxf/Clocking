const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const careHomeSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  name: { type: String, required: true },
  address: String,
  phone: String,
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true }
}, { collection: 'care_homes' });

careHomeSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('CareHome', careHomeSchema);
