const mongoose = require('mongoose');

const jobSourceSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  adapter: {
    type: String,
    required: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  autoSync: {
    type: Boolean,
    default: true
  },
  syncIntervalHours: {
    type: Number,
    default: 6
  },
  lastSync: Date,
  lastStatus: {
    type: String,
    enum: ['idle', 'running', 'success', 'error'],
    default: 'idle'
  },
  lastError: String,
  lastJobCount: {
    type: Number,
    default: 0
  },
  totalImported: {
    type: Number,
    default: 0
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.JobSource || mongoose.model('JobSource', jobSourceSchema);
