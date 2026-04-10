const express = require('express');
const router = express.Router();
const gamificationService = require('../services/gamificationService');
const { protect } = require('../middleware/auth');

// Get user gamification profile
router.get('/profile', protect, async (req, res) => {
  try {
    const profile = await gamificationService.getUserGamificationProfile(req.user._id);

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Get gamification profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching gamification profile'
    });
  }
});

// Award points to user
router.post('/award-points', protect, async (req, res) => {
  try {
    const { action, metadata } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required'
      });
    }

    const result = await gamificationService.awardPoints(req.user._id, action, metadata);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Award points error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while awarding points'
    });
  }
});

// Update login streak
router.post('/login-streak', protect, async (req, res) => {
  try {
    const streak = await gamificationService.updateLoginStreak(req.user._id);

    res.json({
      success: true,
      streak,
      message: 'Login streak updated'
    });
  } catch (error) {
    console.error('Update login streak error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating login streak'
    });
  }
});

// Get leaderboard
router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 10 } = req.query;

    const leaderboard = await gamificationService.getLeaderboard(type, parseInt(limit));

    res.json({
      success: true,
      leaderboard,
      type
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leaderboard'
    });
  }
});

// Get available badges
router.get('/badges', (req, res) => {
  try {
    const badges = gamificationService.getAvailableBadges();

    res.json({
      success: true,
      badges
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching badges'
    });
  }
});

// Get levels information
router.get('/levels', (req, res) => {
  try {
    const levels = gamificationService.getLevels();

    res.json({
      success: true,
      levels
    });
  } catch (error) {
    console.error('Get levels error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching levels'
    });
  }
});

// Create challenge (admin only)
router.post('/challenges', protect, async (req, res) => {
  try {
    // Only admins can create challenges
    if (req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const challengeData = req.body;
    const challenge = await gamificationService.createChallenge(challengeData);

    res.json({
      success: true,
      challenge,
      message: 'Challenge created successfully'
    });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating challenge'
    });
  }
});

// Join challenge
router.post('/challenges/:challengeId/join', protect, async (req, res) => {
  try {
    const { challengeId } = req.params;

    const challenge = await gamificationService.joinChallenge(req.user._id, challengeId);

    res.json({
      success: true,
      challenge,
      message: 'Joined challenge successfully'
    });
  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while joining challenge'
    });
  }
});

// Get active challenges
router.get('/challenges', async (req, res) => {
  try {
    const challenges = await gamificationService.getActiveChallenges();

    res.json({
      success: true,
      challenges
    });
  } catch (error) {
    console.error('Get active challenges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active challenges'
    });
  }
});

// Get user rank
router.get('/rank', protect, async (req, res) => {
  try {
    const rank = await gamificationService.getUserRank(req.user._id);

    res.json({
      success: true,
      rank
    });
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user rank'
    });
  }
});

// Get points system information
router.get('/points-system', (req, res) => {
  try {
    const pointsSystem = gamificationService.pointsSystem;

    res.json({
      success: true,
      pointsSystem
    });
  } catch (error) {
    console.error('Get points system error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching points system'
    });
  }
});

module.exports = router;
