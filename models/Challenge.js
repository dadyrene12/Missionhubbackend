const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  type: {
    type: String,
    required: true,
    enum: ['points', 'applications', 'interviews', 'profile_completion', 'social']
  },
  targetValue: {
    type: Number,
    required: true,
    min: 1
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  participants: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  rewards: [{
    type: {
      type: String,
      enum: ['points', 'badge', 'certificate', 'feature']
    },
    value: mongoose.Schema.Types.Mixed,
    description: String
  }],
  rules: {
    type: String,
    maxlength: [1000, 'Rules cannot be more than 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    category: {
      type: String,
      enum: ['individual', 'team', 'company'],
      default: 'individual'
    },
    maxParticipants: {
      type: Number,
      min: 1
    }
  }
}, {
  timestamps: true
});

// Indexes
challengeSchema.index({ type: 1, status: 1 });
challengeSchema.index({ startDate: 1, endDate: 1 });
challengeSchema.index({ participants: 1 });

// Virtual for checking if challenge is active
challengeSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && now >= this.startDate && now <= this.endDate;
});

// Virtual for days remaining
challengeSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endTime = new Date(this.endDate);
  const diffTime = endTime - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Method to check if user can join challenge
challengeSchema.methods.canUserJoin = function(userId) {
  // Check if challenge is active
  if (!this.isActive) return false;
  
  // Check if user is already a participant
  if (this.participants.includes(userId)) return false;
  
  // Check if challenge has max participants limit
  if (this.metadata.maxParticipants && this.participants.length >= this.metadata.maxParticipants) {
    return false;
  }
  
  return true;
};

// Method to get participant progress
challengeSchema.methods.getParticipantProgress = async function(userId) {
  const UserGamification = require('./UserGamification');
  const gamification = await UserGamification.findOne({ userId });
  
  if (!gamification) return 0;
  
  let progress = 0;
  
  switch (this.type) {
    case 'points':
      progress = gamification.totalPoints;
      break;
    case 'applications':
      // This would require tracking applications in gamification
      progress = 0; // Placeholder
      break;
    case 'interviews':
      // This would require tracking interviews in gamification
      progress = 0; // Placeholder
      break;
    case 'profile_completion':
      progress = await this.calculateProfileCompletion(userId);
      break;
    case 'social':
      // This would require tracking social activities
      progress = 0; // Placeholder
      break;
  }
  
  return Math.min(progress, this.targetValue);
};

// Helper method to calculate profile completion
challengeSchema.methods.calculateProfileCompletion = async function(userId) {
  const User = require('./User');
  const user = await User.findById(userId);
  
  if (!user) return 0;
  
  const requiredFields = [
    'name',
    'email',
    'profile.phone',
    'profile.location',
    'profile.bio',
    'profile.skills',
    'profile.experience',
    'profile.education'
  ];
  
  let completedFields = 0;
  
  for (const field of requiredFields) {
    const value = this.getNestedValue(user, field);
    if (value && (typeof value !== 'string' || value.trim().length > 0)) {
      if (Array.isArray(value) && value.length > 0) {
        completedFields++;
      } else if (!Array.isArray(value)) {
        completedFields++;
      }
    }
  }
  
  const completionRate = (completedFields / requiredFields.length) * 100;
  return Math.round(completionRate);
};

// Helper method to get nested object value
challengeSchema.methods.getNestedValue = function(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
};

// Static method to get active challenges
challengeSchema.statics.getActiveChallenges = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ createdAt: -1 });
};

// Static method to get challenges by type
challengeSchema.statics.getChallengesByType = function(type) {
  return this.find({ type, status: 'active' }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Challenge', challengeSchema);
