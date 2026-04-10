const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'monthly', 'yearly', 'advertisement'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  autoRenew: {
    type: Boolean,
    default: true
  },
  amount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  paymentMethod: {
    type: String,
    enum: ['mtn', 'airtel', 'card', 'bank'],
    default: 'mtn'
  },
  phoneNumber: String,
  features: {
    unlimitedJobs: { type: Boolean, default: false },
    aiMatching: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: false },
    interviewScheduling: { type: Boolean, default: false },
    priorityVisibility: { type: Boolean, default: false },
    homepageBanner: { type: Boolean, default: false },
    socialPromotion: { type: Boolean, default: false },
    featuredListings: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

subscriptionSchema.index({ companyId: 1, status: 1 });
subscriptionSchema.index({ companyId: 1, endDate: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
