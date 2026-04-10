const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Company',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['job_boost', 'profile_featured', 'company_sponsored', 'event'],
    required: true
  },
  targetAudience: String,
  budget: Number,
  durationDays: Number,
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed'],
    default: 'draft'
  },
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  image: String,
  link: String,
  positions: Number
}, {
  timestamps: true
});

module.exports = mongoose.models.Advertisement || mongoose.model('Advertisement', advertisementSchema);

