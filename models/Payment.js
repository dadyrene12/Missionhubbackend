const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  type: {
    type: String,
    enum: ['job_posting', 'advertisement', 'subscription', 'exam', 'featured_profile', 'advertise', 'prove'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  gateway: {
    type: String,
    enum: ['stripe', 'paypal', 'manual', 'mtn', 'cash', 'airtel', 'free'],
    default: 'manual'
  },
  transactionId: String,
  reference: String,
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  receiptUrl: String,
  subscriptionId: String,
  periodEnd: Date,
  invoicePdf: String,
  advertiseDetails: {
    title: String,
    description: String,
    duration: Number,
    startDate: Date,
    endDate: Date,
    positions: Number
  },
  proveDetails: {
    applicantId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    applicationId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Application'
    }
  }
}, {
  timestamps: true
});

paymentSchema.index({ companyId: 1, status: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

