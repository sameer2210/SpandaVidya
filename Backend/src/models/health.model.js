const mongoose = require('mongoose');

const healthSchema = new mongoose.Schema({
  deviceId: String,

  temperature: Number,
  pulseRate: Number,

  bloodPressure: {
    systolic: Number,
    diastolic: Number,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('HealthData', healthSchema);
