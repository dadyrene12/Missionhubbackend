const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job'
  },
  applicationId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Application'
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    name: String,
    url: String,
    size: String,
    type: String
  }],
  type: {
    type: String,
    enum: ['general', 'job_related', 'application_related'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  editedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true
});

messageSchema.index({ toUserId: 1, read: 1, sentAt: -1 });
messageSchema.index({ fromUserId: 1, sentAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);

