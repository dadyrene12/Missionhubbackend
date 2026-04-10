const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if already subscribed
    const existing = await Newsletter.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ success: false, message: 'Already subscribed' });
      }
      // Reactivate unsubscribed user
      existing.status = 'active';
      existing.subscribedAt = new Date();
      await existing.save();
      return res.json({ success: true, message: 'Successfully resubscribed!' });
    }

    // Create new subscription
    const subscriber = await Newsletter.create({ email: email.toLowerCase() });
    res.status(201).json({ success: true, message: 'Successfully subscribed!' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    subscriber.status = 'unsubscribed';
    await subscriber.save();
    
    res.json({ success: true, message: 'Successfully unsubscribed' });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all subscribers (admin only - would need auth middleware in production)
router.get('/', async (req, res) => {
  try {
    const subscribers = await Newsletter.find({ status: 'active' }).sort({ subscribedAt: -1 });
    res.json({ success: true, data: subscribers });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
