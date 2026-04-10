// Gamification Service - User Engagement and Rewards
class GamificationService {
  constructor() {
    this.pointsSystem = {
      // Profile completion
      'profile_complete': 50,
      'profile_photo': 25,
      'skills_added': 10,
      'experience_added': 15,
      'education_added': 15,
      
      // Job application activities
      'job_applied': 10,
      'application_approved': 50,
      'application_rejected': -5,
      'interview_scheduled': 25,
      'interview_completed': 30,
      
      // Social features
      'message_sent': 5,
      'profile_viewed': 2,
      'recommendation_given': 15,
      'review_left': 20,
      
      // Learning activities
      'skill_assessment_completed': 25,
      'course_completed': 100,
      'certification_added': 75,
      
      // Company activities
      'job_posted': 20,
      'candidate_hired': 100,
      'company_verified': 50,
      
      // Daily/weekly activities
      'daily_login': 5,
      'weekly_active': 25,
      'monthly_active': 50
    };

    this.badges = {
      // Profile badges
      'profile_rookie': { name: 'Profile Rookie', description: 'Complete your profile', points: 50, icon: '👤' },
      'profile_expert': { name: 'Profile Expert', description: 'Complete 80% of profile sections', points: 100, icon: '⭐' },
      'profile_master': { name: 'Profile Master', description: 'Complete 100% of profile sections', points: 200, icon: '👑' },
      
      // Application badges
      'application_starter': { name: 'Application Starter', description: 'Apply to your first job', points: 25, icon: '📝' },
      'frequent_applicant': { name: 'Frequent Applicant', description: 'Apply to 10 jobs', points: 100, icon: '🚀' },
      'application_pro': { name: 'Application Pro', description: 'Apply to 50 jobs', points: 250, icon: '💼' },
      
      // Interview badges
      'interview_rookie': { name: 'Interview Rookie', description: 'Complete your first interview', points: 50, icon: '🎯' },
      'interview_regular': { name: 'Interview Regular', description: 'Complete 5 interviews', points: 150, icon: '🎪' },
      'interview_expert': { name: 'Interview Expert', description: 'Complete 20 interviews', points: 300, icon: '🏆' },
      
      // Social badges
      'social_butterfly': { name: 'Social Butterfly', description: 'Send 50 messages', points: 100, icon: '🦋' },
      'network_builder': { name: 'Network Builder', description: 'Connect with 25 professionals', points: 150, icon: '🌐' },
      
      // Learning badges
      'knowledge_seeker': { name: 'Knowledge Seeker', description: 'Complete 5 skill assessments', points: 125, icon: '📚' },
      'continuous_learner': { name: 'Continuous Learner', description: 'Complete 20 skill assessments', points: 300, icon: '🎓' },
      
      // Company badges
      'hiring_hero': { name: 'Hiring Hero', description: 'Hire your first candidate', points: 100, icon: '🦸' },
      'talent_magnet': { name: 'Talent Magnet', description: 'Hire 10 candidates', points: 500, icon: '🧲' },
      
      // Streak badges
      'week_warrior': { name: 'Week Warrior', description: '7-day login streak', points: 50, icon: '🔥' },
      'month_champion': { name: 'Month Champion', description: '30-day login streak', points: 200, icon: '🏅' },
      'year_legend': { name: 'Year Legend', description: '365-day login streak', points: 1000, icon: '💎' }
    };

    this.levels = [
      { level: 1, name: 'Newcomer', minPoints: 0, maxPoints: 99, color: '#808080' },
      { level: 2, name: 'Explorer', minPoints: 100, maxPoints: 299, color: '#4CAF50' },
      { level: 3, name: 'Achiever', minPoints: 300, maxPoints: 699, color: '#2196F3' },
      { level: 4, name: 'Expert', minPoints: 700, maxPoints: 1499, color: '#9C27B0' },
      { level: 5, name: 'Master', minPoints: 1500, maxPoints: 2999, color: '#FF9800' },
      { level: 6, name: 'Legend', minPoints: 3000, maxPoints: 5999, color: '#F44336' },
      { level: 7, name: 'Elite', minPoints: 6000, maxPoints: Infinity, color: '#FFD700' }
    ];

    this.leaderboards = {
      'weekly_points': { name: 'Weekly Points', period: 'weekly' },
      'monthly_points': { name: 'Monthly Points', period: 'monthly' },
      'all_time_points': { name: 'All Time Points', period: 'all_time' },
      'most_applications': { name: 'Most Applications', period: 'monthly' },
      'highest_hired': { name: 'Top Companies', period: 'monthly' }
    };
  }

  // Award points to user
  async awardPoints(userId, action, metadata = {}) {
    const User = require('../models/User');
    const UserGamification = require('../models/UserGamification');
    const websocketService = require('./websocketService');

    const points = this.pointsSystem[action] || 0;
    
    if (points === 0) return { awarded: 0, message: 'No points for this action' };

    // Find or create gamification record
    let gamification = await UserGamification.findOne({ userId });
    
    if (!gamification) {
      gamification = await UserGamification.create({
        userId,
        totalPoints: points,
        currentLevel: 1,
        badges: [],
        streak: {
          current: 0,
          longest: 0,
          lastLogin: null
        },
        achievements: [],
        activityLog: []
      });
    } else {
      gamification.totalPoints += points;
    }

    // Check for level up
    const previousLevel = gamification.currentLevel;
    const newLevel = this.getUserLevel(gamification.totalPoints);
    
    if (newLevel.level > previousLevel) {
      gamification.currentLevel = newLevel.level;
      
      // Send level up notification
      await websocketService.createNotification(
        userId,
        'gamification',
        'Level Up! 🎉',
        `Congratulations! You've reached level ${newLevel.level}: ${newLevel.name}`,
        {
          priority: 'high',
          relatedId: gamification._id,
          relatedType: 'gamification'
        }
      );
    }

    // Check for new badges
    const newBadges = await this.checkAndAwardBadges(userId, gamification);
    
    // Add to activity log
    gamification.activityLog.push({
      action,
      points,
      metadata,
      timestamp: new Date()
    });

    // Keep activity log limited to last 100 entries
    if (gamification.activityLog.length > 100) {
      gamification.activityLog = gamification.activityLog.slice(-100);
    }

    await gamification.save();

    return {
      awarded: points,
      totalPoints: gamification.totalPoints,
      level: newLevel,
      newBadges,
      message: `Awarded ${points} points for ${action}`
    };
  }

  // Check and award badges
  async checkAndAwardBadges(userId, gamification) {
    const UserGamification = require('../models/UserGamification');
    const websocketService = require('./websocketService');
    
    const newBadges = [];
    const currentBadges = gamification.badges.map(b => b.id);

    // Check each badge condition
    for (const [badgeId, badge] of Object.entries(this.badges)) {
      if (currentBadges.includes(badgeId)) continue; // Already has this badge

      const earned = await this.checkBadgeCondition(userId, badgeId, gamification);
      
      if (earned) {
        gamification.badges.push({
          id: badgeId,
          name: badge.name,
          description: badge.description,
          points: badge.points,
          icon: badge.icon,
          earnedAt: new Date()
        });
        
        newBadges.push(badge);
        
        // Send badge notification
        await websocketService.createNotification(
          userId,
          'gamification',
          'New Badge Earned! 🏆',
          `You've earned the "${badge.name}" badge! ${badge.description}`,
          {
            priority: 'high',
            relatedId: gamification._id,
            relatedType: 'badge'
          }
        );
      }
    }

    return newBadges;
  }

  // Check if user meets badge condition
  async checkBadgeCondition(userId, badgeId, gamification) {
    const User = require('../models/User');
    const Application = require('../models/Application');
    const Interview = require('../models/Interview');
    const Message = require('../models/Message');

    switch (badgeId) {
      case 'profile_rookie':
        return await this.isProfileComplete(userId, 0.3);
      
      case 'profile_expert':
        return await this.isProfileComplete(userId, 0.8);
      
      case 'profile_master':
        return await this.isProfileComplete(userId, 1.0);
      
      case 'application_starter':
        const applicationCount = await Application.countDocuments({ userId });
        return applicationCount >= 1;
      
      case 'frequent_applicant':
        const appCount = await Application.countDocuments({ userId });
        return appCount >= 10;
      
      case 'application_pro':
        const proAppCount = await Application.countDocuments({ userId });
        return proAppCount >= 50;
      
      case 'interview_rookie':
        const interviewCount = await Interview.countDocuments({ candidateId: userId, status: 'completed' });
        return interviewCount >= 1;
      
      case 'interview_regular':
        const regularInterviewCount = await Interview.countDocuments({ candidateId: userId, status: 'completed' });
        return regularInterviewCount >= 5;
      
      case 'interview_expert':
        const expertInterviewCount = await Interview.countDocuments({ candidateId: userId, status: 'completed' });
        return expertInterviewCount >= 20;
      
      case 'social_butterfly':
        const messageCount = await Message.countDocuments({ fromUserId: userId });
        return messageCount >= 50;
      
      case 'week_warrior':
        return gamification.streak.current >= 7;
      
      case 'month_champion':
        return gamification.streak.current >= 30;
      
      case 'year_legend':
        return gamification.streak.current >= 365;
      
      default:
        return false;
    }
  }

  // Check profile completion
  async isProfileComplete(userId, threshold = 1.0) {
    const User = require('../models/User');
    
    const user = await User.findById(userId);
    if (!user) return false;

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

    const completionRate = completedFields / requiredFields.length;
    return completionRate >= threshold;
  }

  // Get nested object value
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  // Get user level based on points
  getUserLevel(points) {
    return this.levels.find(level => points >= level.minPoints && points <= level.maxPoints) || this.levels[0];
  }

  // Update login streak
  async updateLoginStreak(userId) {
    const UserGamification = require('../models/UserGamification');
    
    let gamification = await UserGamification.findOne({ userId });
    
    if (!gamification) {
      gamification = await UserGamification.create({
        userId,
        totalPoints: 0,
        currentLevel: 1,
        badges: [],
        streak: {
          current: 1,
          longest: 1,
          lastLogin: new Date()
        },
        achievements: [],
        activityLog: []
      });
    } else {
      const today = new Date();
      const lastLogin = gamification.streak.lastLogin;
      
      // Check if last login was yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastLogin) {
        const lastLoginDate = new Date(lastLogin);
        const daysDiff = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day
          gamification.streak.current++;
        } else if (daysDiff > 1) {
          // Streak broken
          gamification.streak.current = 1;
        }
        // daysDiff === 0 means same day, don't increment
      }
      
      gamification.streak.lastLogin = today;
      gamification.streak.longest = Math.max(gamification.streak.longest, gamification.streak.current);
    }

    await gamification.save();

    // Award daily login points
    await this.awardPoints(userId, 'daily_login', { streak: gamification.streak.current });

    return gamification.streak;
  }

  // Get leaderboard
  async getLeaderboard(type, limit = 10) {
    const UserGamification = require('../models/UserGamification');
    const User = require('../models/User');

    let sortField = 'totalPoints';
    let filter = {};

    switch (type) {
      case 'weekly_points':
        // This would require weekly tracking - simplified for now
        sortField = 'totalPoints';
        break;
      case 'monthly_points':
        sortField = 'totalPoints';
        break;
      case 'most_applications':
        // This would require application count tracking
        sortField = 'totalPoints';
        break;
      case 'highest_hired':
        // Company specific leaderboard
        filter = { userType: 'company' };
        sortField = 'totalPoints';
        break;
      default:
        sortField = 'totalPoints';
    }

    const leaderboard = await UserGamification.find(filter)
      .sort({ [sortField]: -1 })
      .limit(limit)
      .populate('userId', 'name email profile.profilePhoto');

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: entry.userId,
      points: entry.totalPoints,
      level: this.getUserLevel(entry.totalPoints),
      badges: entry.badges.length,
      streak: entry.streak.current
    }));
  }

  // Get user gamification profile
  async getUserGamificationProfile(userId) {
    const UserGamification = require('../models/UserGamification');
    
    let gamification = await UserGamification.findOne({ userId })
      .populate('userId', 'name email profile.profilePhoto');

    if (!gamification) {
      // Create default profile
      gamification = await UserGamification.create({
        userId,
        totalPoints: 0,
        currentLevel: 1,
        badges: [],
        streak: {
          current: 0,
          longest: 0,
          lastLogin: null
        },
        achievements: [],
        activityLog: []
      });
      
      gamification = await UserGamification.findOne({ userId })
        .populate('userId', 'name email profile.profilePhoto');
    }

    const level = this.getUserLevel(gamification.totalPoints);
    const nextLevel = this.levels[level.level] || level;
    const pointsToNextLevel = nextLevel.minPoints - gamification.totalPoints;

    return {
      user: gamification.userId,
      totalPoints: gamification.totalPoints,
      currentLevel: level,
      pointsToNextLevel: Math.max(0, pointsToNextLevel),
      badges: gamification.badges,
      streak: gamification.streak,
      recentActivity: gamification.activityLog.slice(-10),
      rank: await this.getUserRank(userId),
      achievements: gamification.achievements
    };
  }

  // Get user rank on leaderboard
  async getUserRank(userId) {
    const UserGamification = require('../models/UserGamification');
    
    const userPoints = await UserGamification.findOne({ userId });
    if (!userPoints) return null;

    const rank = await UserGamification.countDocuments({
      totalPoints: { $gt: userPoints.totalPoints }
    });

    return rank + 1;
  }

  // Get available badges
  getAvailableBadges() {
    return Object.entries(this.badges).map(([id, badge]) => ({
      id,
      ...badge
    }));
  }

  // Get levels information
  getLevels() {
    return this.levels;
  }

  // Create challenge or competition
  async createChallenge(challengeData) {
    const Challenge = require('../models/Challenge');
    
    const challenge = await Challenge.create({
      ...challengeData,
      status: 'active',
      participants: [],
      rewards: challengeData.rewards || [],
      createdAt: new Date()
    });

    return challenge;
  }

  // Join challenge
  async joinChallenge(userId, challengeId) {
    const Challenge = require('../models/Challenge');
    const websocketService = require('./websocketService');
    
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    
    if (challenge.participants.includes(userId)) {
      throw new Error('Already joined this challenge');
    }

    challenge.participants.push(userId);
    await challenge.save();

    await websocketService.createNotification(
      userId,
      'challenge',
      'Challenge Joined! 🎯',
      `You've joined the "${challenge.title}" challenge`,
      {
        priority: 'normal',
        relatedId: challengeId,
        relatedType: 'challenge'
      }
    );

    return challenge;
  }

  // Get active challenges
  async getActiveChallenges() {
    const Challenge = require('../models/Challenge');
    
    return await Challenge.find({
      status: 'active',
      endDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });
  }
}

module.exports = new GamificationService();
