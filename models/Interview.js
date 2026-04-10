const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Application'
  },
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Company',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  candidate: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job'
  },
  type: {
    type: String,
    enum: ['phone', 'video', 'technical', 'hr', 'panel', 'final', 'onsite', 'in-person'],
    default: 'video'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  schedule: {
    date: Date,
    time: String,
    timezone: String,
    duration: Number
  },
  duration: {
    type: Number,
    default: 60
  },
  location: String,
  meetingLink: String,
  joinLink: String,
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'],
    default: 'scheduled'
  },
  notes: String,
  title: String,
  description: String,
  score: Number,
  feedback: String,
  recordingUrl: String,
  interviewers: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  reminder: {
    enabled: { type: Boolean, default: true },
    beforeMinutes: { type: Number, default: 30 },
    sent: { type: Boolean, default: false },
    sentAt: Date
  },
  reminders: [{
    type: { type: String, enum: ['email', 'notification'] },
    scheduledFor: Date,
    sent: { type: Boolean, default: false },
    sentAt: Date
  }],
  cancelledBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  cancelledByType: {
    type: String,
    enum: ['company', 'jobSeeker']
  },
  cancelReason: String
}, {
  timestamps: true
});

interviewSchema.virtual('candidateObj').get(function() {
  return this.candidateId || this.candidate;
});

interviewSchema.set('toJSON', { virtuals: true });
interviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Interview || mongoose.model('Interview', interviewSchema);
