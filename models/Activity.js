const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  location: String,
  date: {
    type: Date,
    required: true
  },
  time: String,
  type: {
    type: String,
    enum: ['workshop', 'seminar', 'webinar', 'meetup', 'conference', 'training'],
    default: 'workshop'
  },
  tags: [String],
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  postedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  promoted: {
    type: Boolean,
    default: false
  },
  attendees: [{
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'cancelled'],
      default: 'registered'
    },
    registeredAt: Date
  }],
  contactEmail: String,
  contactPhone: String,
  maxAttendees: Number,
  image: String,
  details: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Activity', activitySchema);

