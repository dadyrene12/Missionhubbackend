const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'application',          // New applicant for job
      'application_update',  // Application status update
      'application_cancelled', // User cancelled their application
      'message',            // User sent a message
      'announcement',      // Super admin announcement
      'admin_notify',       // Admin/super admin notifying company
      'problem_report',     // Company reported a problem to super admin
      'interview',          // Interview scheduled
      'interview_scheduled',// Interview has been scheduled
      'interview_reminder', // Interview reminder
      'interview_cancelled',// Interview cancelled
      'interview_completed',// Interview completed
      'payment',            // Payment related
      'system',             // General system notifications
      'job',               // Job related notifications
      'job_posted',        // Job posted successfully
      'job_application',   // Job application received
      'verified',          // Account verification status
      'user',              // User related notifications
      'company',            // Company related notifications
      'ai_job_match',      // AI found a matching job for user
      'ai_candidate_match'  // AI found a matching candidate for company
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  senderId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  senderType: {
    type: String,
    enum: ['user', 'company', 'admin', 'super_admin', 'system']
  },
  jobDetails: {
    title: String,
    jobId: mongoose.Schema.ObjectId,
    company: String,
    status: String,
    salary: String,
    location: String,
    applicantName: String,
    applicantEmail: String
  },
  messageDetails: {
    subject: String,
    preview: String,
    messageId: mongoose.Schema.ObjectId
  },
  applicationDetails: {
    applicationId: mongoose.Schema.ObjectId,
    jobTitle: String,
    applicantName: String,
    applicantEmail: String,
    previousStatus: String,
    newStatus: String
  },
  problemDetails: {
    category: String,
    description: String,
    screenshots: [String],
    status: {
      type: String,
      enum: ['submitted', 'pending', 'in_progress', 'resolved', 'rejected'],
      default: 'submitted'
    },
    adminResponse: String,
    submittedAt: Date,
    respondedAt: Date,
    resolvedAt: Date,
    reporterName: String,
    reporterEmail: String,
    relatedJobId: mongoose.Schema.ObjectId,
    relatedApplicationId: mongoose.Schema.ObjectId
  },
  announcementDetails: {
    priority: String,
    category: String,
    expiresAt: Date
  },
  relatedId: {
    type: mongoose.Schema.ObjectId
  },
  relatedType: {
    type: String,
    enum: ['application', 'job', 'message', 'interview', 'payment', 'problem', 'announcement']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ senderId: 1, createdAt: -1 });
notificationSchema.index({ relatedType: 1, relatedId: 1 });

notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return this.save();
};

notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ userId, read: false });
};

notificationSchema.statics.getByUser = async function(userId, options = {}) {
  const { type, limit = 50, skip = 0 } = options;
  const query = { userId };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

notificationSchema.statics.getByType = async function(userId, type, limit = 50) {
  return this.find({ userId, type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

if (mongoose.models.Notification) {
  module.exports = mongoose.models.Notification;
} else {
  module.exports = mongoose.model('Notification', notificationSchema);
}
