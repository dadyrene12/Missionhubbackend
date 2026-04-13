const express = require('express');
const router = express.Router();
const User = require('../models/User');
const aiMatchingScheduler = require('../services/aiMatchingScheduler');

router.get('/settings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.userType === 'jobSeeker') {
      res.json({
        success: true,
        settings: {
          enabled: user.aiNotifications?.enabled ?? true,
          emailAlerts: user.aiNotifications?.emailAlerts ?? true,
          minMatchScore: user.aiNotifications?.minMatchScore ?? 50,
          matchedSkillsOnly: user.aiNotifications?.matchedSkillsOnly ?? false,
          matchedExperienceOnly: user.aiNotifications?.matchedExperienceOnly ?? false,
          frequency: user.aiNotifications?.frequency ?? 'immediate',
          lastNotifiedAt: user.aiNotifications?.lastNotifiedAt
        }
      });
    } else if (user.userType === 'company') {
      res.json({
        success: true,
        settings: {
          enabled: user.companyAiNotifications?.enabled ?? true,
          emailAlerts: user.companyAiNotifications?.emailAlerts ?? true,
          minMatchScore: user.companyAiNotifications?.minMatchScore ?? 50,
          notifyOnNewCandidate: user.companyAiNotifications?.notifyOnNewCandidate ?? true,
          frequency: user.companyAiNotifications?.frequency ?? 'immediate',
          lastNotifiedAt: user.companyAiNotifications?.lastNotifiedAt
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user type' });
    }
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { 
      enabled, 
      emailAlerts, 
      minMatchScore, 
      matchedSkillsOnly, 
      matchedExperienceOnly,
      notifyOnNewCandidate,
      frequency 
    } = req.body;

    if (user.userType === 'jobSeeker') {
      const aiNotifications = {
        enabled: enabled !== undefined ? enabled : user.aiNotifications?.enabled ?? true,
        emailAlerts: emailAlerts !== undefined ? emailAlerts : user.aiNotifications?.emailAlerts ?? true,
        minMatchScore: minMatchScore !== undefined ? minMatchScore : user.aiNotifications?.minMatchScore ?? 50,
        matchedSkillsOnly: matchedSkillsOnly !== undefined ? matchedSkillsOnly : user.aiNotifications?.matchedSkillsOnly ?? false,
        matchedExperienceOnly: matchedExperienceOnly !== undefined ? matchedExperienceOnly : user.aiNotifications?.matchedExperienceOnly ?? false,
        frequency: frequency || user.aiNotifications?.frequency || 'immediate'
      };

      await User.findByIdAndUpdate(user._id, { aiNotifications });
    } else if (user.userType === 'company') {
      const companyAiNotifications = {
        enabled: enabled !== undefined ? enabled : user.companyAiNotifications?.enabled ?? true,
        emailAlerts: emailAlerts !== undefined ? emailAlerts : user.companyAiNotifications?.emailAlerts ?? true,
        minMatchScore: minMatchScore !== undefined ? minMatchScore : user.companyAiNotifications?.minMatchScore ?? 50,
        notifyOnNewCandidate: notifyOnNewCandidate !== undefined ? notifyOnNewCandidate : user.companyAiNotifications?.notifyOnNewCandidate ?? true,
        frequency: frequency || user.companyAiNotifications?.frequency || 'immediate'
      };

      await User.findByIdAndUpdate(user._id, { companyAiNotifications });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    const updatedUser = await User.findById(user._id);
    const settings = user.userType === 'jobSeeker' 
      ? updatedUser.aiNotifications 
      : updatedUser.companyAiNotifications;

    res.json({
      success: true,
      message: 'AI notification settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const schedulerStatus = aiMatchingScheduler.getStatus();

    res.json({
      success: true,
      scheduler: schedulerStatus,
      user: {
        lastMatchCheck: user.lastAiMatchCheck,
        notificationsEnabled: user.userType === 'jobSeeker' 
          ? user.aiNotifications?.enabled 
          : user.companyAiNotifications?.enabled,
        matchHistoryCount: aiMatchingScheduler.matchHistory.size
      }
    });
  } catch (error) {
    console.error('Error fetching AI status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/trigger', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.userType !== 'company' && user.userType !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only companies or admins can trigger manual matching' });
    }

    const result = await aiMatchingScheduler.triggerManualRun();

    res.json({
      success: true,
      message: 'AI matching triggered successfully',
      result
    });
  } catch (error) {
    console.error('Error triggering AI matching:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
