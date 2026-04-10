const mongoose = require('mongoose');

const userGamificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1
  },
  badges: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  streak: {
    current: {
      type: Number,
      default: 0,
      min: 0
    },
    longest: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLogin: {
      type: Date
    }
  },
  achievements: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      required: true
    },
    unlockedAt: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  activityLog: [{
    action: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      required: true
    },
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  statistics: {
    totalLogins: {
      type: Number,
      default: 0
    },
    totalApplications: {
      type: Number,
      default: 0
    },
    totalInterviews: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    profileViews: {
      type: Number,
      default: 0
    },
    assessmentsCompleted: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    }
  },
  preferences: {
    notifications: {
      levelUp: {
        type: Boolean,
        default: true
      },
      badgeEarned: {
        type: Boolean,
        default: true
      },
      streakMilestone: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      showProfile: {
        type: Boolean,
        default: true
      },
      showBadges: {
        type: Boolean,
        default: true
      },
      showLevel: {
        type: Boolean,
        default: true
      },
      showStreak: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
userGamificationSchema.index({ userId: 1 });
userGamificationSchema.index({ totalPoints: -1 });
userGamificationSchema.index({ currentLevel: -1 });
userGamificationSchema.index({ 'streak.current': -1 });

// Virtual for level progress
userGamificationSchema.virtual('levelProgress').get(function() {
  const gamificationService = require('../services/gamificationService');
  const currentLevel = gamificationService.getUserLevel(this.totalPoints);
  const nextLevel = gamificationService.levels.find(level => level.level === currentLevel.level + 1);
  
  if (!nextLevel) {
    return {
      current: currentLevel,
      next: null,
      progress: 100,
      pointsToNext: 0
    };
  }
  
  const pointsInCurrentLevel = this.totalPoints - currentLevel.minPoints;
  const pointsNeededForNext = nextLevel.minPoints - currentLevel.minPoints;
  const progress = (pointsInCurrentLevel / pointsNeededForNext) * 100;
  
  return {
    current: currentLevel,
    next: nextLevel,
    progress: Math.min(100, Math.max(0, progress)),
    pointsToNext: Math.max(0, nextLevel.minPoints - this.totalPoints)
  };
});

// Virtual for badge count
userGamificationSchema.virtual('badgeCount').get(function() {
  return this.badges.length;
});

// Virtual for achievement count
userGamificationSchema.virtual('achievementCount').get(function() {
  return this.achievements.length;
});

// Method to add points
userGamificationSchema.methods.addPoints = function(points, action, metadata = {}) {
  this.totalPoints += points;
  
  // Add to activity log
  this.activityLog.push({
    action,
    points,
    metadata,
    timestamp: new Date()
  });
  
  // Keep activity log limited to last 100 entries
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(-100);
  }
  
  return this.save();
};

// Method to add badge
userGamificationSchema.methods.addBadge = function(badgeData) {
  // Check if badge already exists
  const existingBadge = this.badges.find(b => b.id === badgeData.id);
  if (existingBadge) {
    return existingBadge;
  }
  
  this.badges.push({
    ...badgeData,
    earnedAt: new Date()
  });
  
  return this.save();
};

// Method to add achievement
userGamificationSchema.methods.addAchievement = function(achievementData) {
  // Check if achievement already exists
  const existingAchievement = this.achievements.find(a => a.id === achievementData.id);
  if (existingAchievement) {
    return existingAchievement;
  }
  
  this.achievements.push({
    ...achievementData,
    unlockedAt: new Date()
  });
  
  return this.save();
};

// Method to update streak
userGamificationSchema.methods.updateStreak = function() {
  const today = new Date();
  const lastLogin = this.streak.lastLogin;
  
  if (lastLogin) {
    const lastLoginDate = new Date(lastLogin);
    const daysDiff = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day
      this.streak.current++;
    } else if (daysDiff > 1) {
      // Streak broken
      this.streak.current = 1;
    }
    // daysDiff === 0 means same day, don't increment
  } else {
    // First login
    this.streak.current = 1;
  }
  
  this.streak.lastLogin = today;
  this.streak.longest = Math.max(this.streak.longest, this.streak.current);
  
  return this.save();
};

// Method to update statistics
userGamificationSchema.methods.updateStatistics = function(statType, increment = 1) {
  if (this.statistics.hasOwnProperty(statType)) {
    this.statistics[statType] += increment;
  }
  
  return this.save();
};

// Method to get recent activity
userGamificationSchema.methods.getRecentActivity = function(limit = 10) {
  return this.activityLog
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// Method to check if user has specific badge
userGamificationSchema.methods.hasBadge = function(badgeId) {
  return this.badges.some(badge => badge.id === badgeId);
};

// Method to check if user has specific achievement
userGamificationSchema.methods.hasAchievement = function(achievementId) {
  return this.achievements.some(achievement => achievement.id === achievementId);
};

// Static method to get top users by points
userGamificationSchema.statics.getTopUsers = function(limit = 10) {
  return this.find({})
    .sort({ totalPoints: -1 })
    .limit(limit)
    .populate('userId', 'name email profile.profilePhoto');
};

// Static method to get users by level
userGamificationSchema.statics.getUsersByLevel = function(level, limit = 10) {
  return this.find({ currentLevel: level })
    .sort({ totalPoints: -1 })
    .limit(limit)
    .populate('userId', 'name email profile.profilePhoto');
};

// Static method to get leaderboard
userGamificationSchema.statics.getLeaderboard = function(type = 'points', limit = 10) {
  let sortField = 'totalPoints';
  
  switch (type) {
    case 'streak':
      sortField = 'streak.current';
      break;
    case 'badges':
      sortField = 'badgeCount';
      break;
    case 'level':
      sortField = 'currentLevel';
      break;
    default:
      sortField = 'totalPoints';
  }
  
  return this.find({})
    .sort({ [sortField]: -1 })
    .limit(limit)
    .populate('userId', 'name email profile.profilePhoto');
};

// Pre-save middleware to update level based on points
userGamificationSchema.pre('save', function(next) {
  const gamificationService = require('../services/gamificationService');
  const newLevel = gamificationService.getUserLevel(this.totalPoints);
  
  if (newLevel.level !== this.currentLevel) {
    this.currentLevel = newLevel.level;
  }
  
  next();
});

module.exports = mongoose.model('UserGamification', userGamificationSchema);
