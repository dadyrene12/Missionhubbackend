// Subscription and Billing Service
class SubscriptionService {
  constructor() {
    this.plans = {
      free: {
        id: 'free',
        name: 'Free',
        price: 0,
        duration: 'lifetime',
        features: [
          'Post up to 3 jobs',
          'Basic candidate search',
          'Standard support',
          'Basic analytics'
        ],
        limits: {
          jobs: 3,
          candidates: 50,
          messages: 100,
          storage: 100 // MB
        }
      },
      basic: {
        id: 'basic',
        name: 'Basic',
        price: 29,
        duration: 'monthly',
        features: [
          'Post up to 10 jobs',
          'Advanced candidate search',
          'Email support',
          'Detailed analytics',
          'Company branding',
          'AI job matching'
        ],
        limits: {
          jobs: 10,
          candidates: 500,
          messages: 1000,
          storage: 500
        }
      },
      premium: {
        id: 'premium',
        name: 'Premium',
        price: 99,
        duration: 'monthly',
        features: [
          'Unlimited job postings',
          'Premium candidate search',
          'Priority support',
          'Advanced analytics & reports',
          'Custom company page',
          'AI-powered recommendations',
          'Video interviews',
          'ATS integration'
        ],
        limits: {
          jobs: -1, // unlimited
          candidates: 5000,
          messages: 10000,
          storage: 2000
        }
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 299,
        duration: 'monthly',
        features: [
          'Everything in Premium',
          'White-label solution',
          'Dedicated account manager',
          'Custom integrations',
          'Advanced security features',
          'API access',
          'Custom reporting',
          'SLA guarantee'
        ],
        limits: {
          jobs: -1,
          candidates: -1,
          messages: -1,
          storage: 10000
        }
      }
    };
  }

  // Get available plans
  getPlans() {
    return this.plans;
  }

  // Get specific plan details
  getPlan(planId) {
    return this.plans[planId] || null;
  }

  // Check if user can perform action based on subscription
  async checkSubscriptionLimit(userId, action, count = 1) {
    const User = require('../models/User');
    const Payment = require('../models/Payment');
    const Job = require('../models/Job');
    const Message = require('../models/Message');

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Get active subscription
    const subscription = await this.getActiveSubscription(userId);
    const plan = this.plans[subscription?.plan] || this.plans.free;

    let currentUsage = 0;
    let limit = 0;

    switch (action) {
      case 'post_job':
        currentUsage = await Job.countDocuments({ postedBy: userId });
        limit = plan.limits.jobs;
        break;
      
      case 'view_candidates':
        currentUsage = await this.getCandidateViewsCount(userId);
        limit = plan.limits.candidates;
        break;
      
      case 'send_message':
        currentUsage = await Message.countDocuments({ 
          $or: [{ fromUserId: userId }, { toUserId: userId }],
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });
        limit = plan.limits.messages;
        break;
      
      case 'upload_file':
        currentUsage = await this.getStorageUsage(userId);
        limit = plan.limits.storage;
        break;
      
      default:
        return { allowed: true, remaining: limit };
    }

    const allowed = limit === -1 || (currentUsage + count) <= limit;
    const remaining = limit === -1 ? 'unlimited' : Math.max(0, limit - currentUsage);

    return { allowed, remaining, currentUsage, limit, plan: plan.id };
  }

  // Get active subscription for user
  async getActiveSubscription(userId) {
    const Payment = require('../models/Payment');
    
    const activeSubscription = await Payment.findOne({
      companyId: userId,
      status: 'completed',
      subscriptionPlan: { $exists: true },
      endDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    return activeSubscription;
  }

  // Create or upgrade subscription
  async createSubscription(userId, planId, paymentMethod) {
    const User = require('../models/User');
    const Payment = require('../models/Payment');
    const CompanyProfile = require('../models/CompanyProfile');

    const plan = this.plans[planId];
    if (!plan) throw new Error('Invalid plan');

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    if (plan.duration === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.duration === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create payment record
    const payment = await Payment.create({
      companyId: userId,
      amount: plan.price,
      currency: 'USD',
      paymentMethod,
      subscriptionPlan: planId,
      subscriptionStatus: 'active',
      paymentDate: startDate,
      startDate,
      endDate,
      description: `${plan.name} subscription - ${plan.duration}`,
      status: 'completed'
    });

    // Update company profile
    await CompanyProfile.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          'subscription.plan': planId,
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.status': 'active'
        }
      },
      { upsert: true }
    );

    return payment;
  }

  // Upgrade subscription
  async upgradeSubscription(userId, newPlanId) {
    const currentSubscription = await this.getActiveSubscription(userId);
    const newPlan = this.plans[newPlanId];
    
    if (!newPlan) throw new Error('Invalid plan');
    if (!currentSubscription) throw new Error('No active subscription found');

    // Calculate prorated amount
    const remainingDays = Math.ceil((currentSubscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const currentPlan = this.plans[currentSubscription.subscriptionPlan];
    const dailyRate = currentPlan.price / 30;
    const proratedRefund = Math.max(0, dailyRate * remainingDays);

    // Create upgrade payment
    const upgradeAmount = Math.max(0, newPlan.price - proratedRefund);

    if (upgradeAmount > 0) {
      await this.createSubscription(userId, newPlanId, 'account_credit');
    }

    // Cancel old subscription
    await Payment.findByIdAndUpdate(currentSubscription._id, {
      subscriptionStatus: 'upgraded',
      endDate: new Date()
    });

    return {
      upgraded: true,
      newPlan: newPlanId,
      refundAmount: proratedRefund,
      upgradeAmount
    };
  }

  // Cancel subscription
  async cancelSubscription(userId, reason = '') {
    const currentSubscription = await this.getActiveSubscription(userId);
    
    if (!currentSubscription) throw new Error('No active subscription found');

    // Update subscription to cancel at end of period
    await Payment.findByIdAndUpdate(currentSubscription._id, {
      subscriptionStatus: 'cancelled',
      cancellationReason: reason,
      autoRenew: false
    });

    // Update company profile
    const CompanyProfile = require('../models/CompanyProfile');
    await CompanyProfile.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          'subscription.status': 'cancelled',
          'subscription.cancelledAt': new Date()
        }
      }
    );

    return {
      cancelled: true,
      endDate: currentSubscription.endDate,
      message: 'Subscription will be cancelled at the end of the current billing period'
    };
  }

  // Get subscription usage statistics
  async getSubscriptionUsage(userId) {
    const Job = require('../models/Job');
    const Message = require('../models/Message');

    const subscription = await this.getActiveSubscription(userId);
    const plan = this.plans[subscription?.plan] || this.plans.free;

    const [
      jobCount,
      messageCount,
      candidateViews,
      storageUsage
    ] = await Promise.all([
      Job.countDocuments({ postedBy: userId }),
      Message.countDocuments({ 
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      this.getCandidateViewsCount(userId),
      this.getStorageUsage(userId)
    ]);

    return {
      plan: plan.id,
      planName: plan.name,
      limits: plan.limits,
      usage: {
        jobs: jobCount,
        messages: messageCount,
        candidateViews,
        storage: storageUsage
      },
      subscription: subscription ? {
        status: subscription.subscriptionStatus,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew !== false
      } : null
    };
  }

  // Check subscription expiration and send notifications
  async checkSubscriptionExpirations() {
    const Payment = require('../models/Payment');
    const websocketService = require('./websocketService');

    // Find subscriptions expiring in 7 days
    const expiringSoon = await Payment.find({
      subscriptionStatus: 'active',
      endDate: { 
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    }).populate('companyId', 'name email');

    // Send notifications
    for (const subscription of expiringSoon) {
      await websocketService.createNotification(
        subscription.companyId._id,
        'subscription',
        'Subscription Expiring Soon',
        `Your ${subscription.subscriptionPlan} subscription will expire on ${subscription.endDate.toLocaleDateString()}`,
        {
          priority: 'high',
          actions: [
            { label: 'Renew Now', primary: true, handler: 'renew_subscription' },
            { label: 'View Plans', primary: false, handler: 'view_plans' }
          ]
        }
      );
    }

    return {
      notified: expiringSoon.length,
      message: `Sent expiration notifications to ${expiringSoon.length} users`
    };
  }

  // Helper methods
  async getCandidateViewsCount(userId) {
    // This would track candidate profile views
    // For now, return a mock value
    return Math.floor(Math.random() * 100);
  }

  async getStorageUsage(userId) {
    const fs = require('fs');
    const path = require('path');
    
    const uploadsDir = path.join(__dirname, '../uploads', userId.toString());
    
    if (!fs.existsSync(uploadsDir)) {
      return 0;
    }

    let totalSize = 0;
    const files = fs.readdirSync(uploadsDir);
    
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }

    // Convert to MB
    return Math.round(totalSize / (1024 * 1024));
  }

  // Generate subscription report
  async generateSubscriptionReport(timeRange = '30d') {
    const Payment = require('../models/Payment');
    const User = require('../models/User');

    const dateRange = this.getDateRange(timeRange);

    const [
      totalRevenue,
      activeSubscriptions,
      newSubscriptions,
      cancellations,
      planDistribution,
      churnRate
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { paymentDate: { $gte: dateRange.start }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.countDocuments({
        subscriptionStatus: 'active',
        endDate: { $gt: new Date() }
      }),
      Payment.countDocuments({
        createdAt: { $gte: dateRange.start },
        subscriptionPlan: { $exists: true }
      }),
      Payment.countDocuments({
        subscriptionStatus: 'cancelled',
        updatedAt: { $gte: dateRange.start }
      }),
      Payment.aggregate([
        { $match: { subscriptionStatus: 'active', endDate: { $gt: new Date() } } },
        { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } }
      ]),
      this.calculateChurnRate(dateRange)
    ]);

    return {
      revenue: totalRevenue[0]?.total || 0,
      activeSubscriptions,
      newSubscriptions,
      cancellations,
      planDistribution,
      churnRate,
      timeRange,
      generatedAt: new Date()
    };
  }

  async calculateChurnRate(dateRange) {
    const Payment = require('../models/Payment');
    
    const periodStart = dateRange.start;
    const previousPeriodStart = new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      startOfPeriodSubscriptions,
      endOfPeriodSubscriptions,
      newSubscriptions
    ] = await Promise.all([
      Payment.countDocuments({
        subscriptionStatus: 'active',
        createdAt: { $lt: periodStart }
      }),
      Payment.countDocuments({
        subscriptionStatus: 'active',
        endDate: { $gt: dateRange.end }
      }),
      Payment.countDocuments({
        createdAt: { $gte: periodStart, $lte: dateRange.end },
        subscriptionPlan: { $exists: true }
      })
    ]);

    const churned = startOfPeriodSubscriptions + newSubscriptions - endOfPeriodSubscriptions;
    const churnRate = startOfPeriodSubscriptions > 0 ? (churned / startOfPeriodSubscriptions) * 100 : 0;

    return Math.round(churnRate * 100) / 100;
  }

  getDateRange(timeRange) {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start, end };
  }
}

module.exports = new SubscriptionService();
