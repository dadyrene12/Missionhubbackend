const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscriptionService');
const { protect, authorize, authorizePermission } = require('../middleware/auth');

// Get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = subscriptionService.getPlans();
    
    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription plans'
    });
  }
});

// Get current user subscription
router.get('/current', protect, async (req, res) => {
  try {
    const subscription = await subscriptionService.getActiveSubscription(req.user._id);
    const usage = await subscriptionService.getSubscriptionUsage(req.user._id);
    
    res.json({
      success: true,
      subscription,
      usage
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription'
    });
  }
});

// Create new subscription
router.post('/create', protect, authorize('company'), async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;
    
    if (!planId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID and payment method are required'
      });
    }

    const subscription = await subscriptionService.createSubscription(
      req.user._id,
      planId,
      paymentMethod
    );

    res.json({
      success: true,
      subscription,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating subscription'
    });
  }
});

// Upgrade subscription
router.post('/upgrade', protect, authorize('company'), async (req, res) => {
  try {
    const { newPlanId } = req.body;
    
    if (!newPlanId) {
      return res.status(400).json({
        success: false,
        message: 'New plan ID is required'
      });
    }

    const result = await subscriptionService.upgradeSubscription(req.user._id, newPlanId);

    res.json({
      success: true,
      ...result,
      message: 'Subscription upgraded successfully'
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while upgrading subscription'
    });
  }
});

// Cancel subscription
router.post('/cancel', protect, authorize('company'), async (req, res) => {
  try {
    const { reason } = req.body;

    const result = await subscriptionService.cancelSubscription(req.user._id, reason);

    res.json({
      success: true,
      ...result,
      message: 'Subscription cancellation processed'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while cancelling subscription'
    });
  }
});

// Check subscription limits
router.get('/check-limit/:action', protect, async (req, res) => {
  try {
    const { action } = req.params;
    const count = parseInt(req.query.count) || 1;

    const check = await subscriptionService.checkSubscriptionLimit(
      req.user._id,
      action,
      count
    );

    res.json({
      success: true,
      check
    });
  } catch (error) {
    console.error('Check subscription limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking subscription limit'
    });
  }
});

// Get subscription usage statistics
router.get('/usage', protect, async (req, res) => {
  try {
    const usage = await subscriptionService.getSubscriptionUsage(req.user._id);

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    console.error('Get subscription usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription usage'
    });
  }
});

// Generate subscription report (admin only)
router.get('/report', protect, authorizePermission('view_analytics'), async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    const report = await subscriptionService.generateSubscriptionReport(timeRange);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Generate subscription report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating subscription report'
    });
  }
});

// Check subscription expiration (admin only)
router.post('/check-expirations', protect, authorizePermission('manage_subscriptions'), async (req, res) => {
  try {
    const result = await subscriptionService.checkSubscriptionExpirations();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Check subscription expirations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking subscription expirations'
    });
  }
});

module.exports = router;
