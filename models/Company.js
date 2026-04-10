const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: String,
  industry: String,
  companySize: String,
  founded: Date,
  location: String,
  website: String,
  linkedin: String,
  logo: String,
  banner: String,
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  stats: {
    jobsPosted: { type: Number, default: 0 },
    applicants: { type: Number, default: 0 },
    views: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);

