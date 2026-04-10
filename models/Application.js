const mongoose = require('mongoose');

console.log('[DEBUG] Loading Application model...');

// Force delete any cached model to avoid duplicate definitions
if (mongoose.models.Application) {
  console.log('[DEBUG] Deleting cached Application model');
  delete mongoose.models.Application;
}

const resumeSchema = new mongoose.Schema({
  name: String,
  url: String,
  uploadDate: Date,
  size: String,
  type: String
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job',
    required: true
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  applicantName: {
    type: String,
    required: true
  },
  applicantEmail: {
    type: String,
    required: true
  },
  coverLetter: String,
  resume: {
    type: resumeSchema,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'approved', 'rejected', 'interviewed', 'hired', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  answers: [{
    question: String,
    answer: String
  }],
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

applicationSchema.pre('validate', function(next) {
  if (this.resume && typeof this.resume === 'string') {
    try {
      this.resume = JSON.parse(this.resume);
    } catch (e) {
      // Not a JSON string, keep as is
    }
  }
  next();
});

applicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });
applicationSchema.index({ userId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ companyId: 1, createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, status: 1 });

const Application = mongoose.model('Application', applicationSchema);

console.log('[DEBUG] Application model registered');
console.log('[DEBUG] Application schema paths:', Object.keys(Application.schema.paths));
console.log('[DEBUG] Application schema resume:', Application.schema.paths.resume);
console.log('[DEBUG] Application schema companyId:', Application.schema.paths.companyId);

module.exports = Application;