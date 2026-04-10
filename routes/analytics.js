const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

// Import models
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Message = require('../models/Message');

// Admin middleware for analytics routes
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.userType !== 'super_admin' && req.user.userType !== 'admin' && req.user.userType !== 'company') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

// Protect middleware for analytics routes
const protect = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

// Helper function to calculate date range
const getDateRange = (range) => {
  const now = new Date();
  let startDate;

  switch (range) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate: now };
};

// Dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    
    const totalJobs = await Job.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalApplications = await Application.countDocuments();
    const totalMessages = await Message.countDocuments();
    
    const recentJobs = await Job.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('postedBy', 'name');
    
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    const jobsByCategory = await Job.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    const applicationsByStatus = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      analytics: {
        totals: {
          jobs: totalJobs,
          users: totalUsers,
          applications: totalApplications,
          messages: totalMessages
        },
        recentJobs,
        recentUsers,
        jobsByCategory,
        applicationsByStatus
      }
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard analytics'
    });
  }
});

// User-specific analytics
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const applications = await Application.find({ userId })
      .populate('jobId', 'title company')
      .sort({ createdAt: -1 });
    
    const stats = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(a => a.status === 'pending').length,
      approvedApplications: applications.filter(a => a.status === 'approved').length,
      rejectedApplications: applications.filter(a => a.status === 'rejected').length
    };
    
    res.json({
      success: true,
      analytics: {
        user,
        applications,
        stats
      }
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user analytics'
    });
  }
});

// Company-specific analytics
router.get('/companies/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const jobs = await Job.find({ postedBy: companyId });
    const jobIds = jobs.map(j => j._id);
    
    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    const stats = {
      totalJobsPosted: jobs.length,
      activeJobs: jobs.length,
      totalApplications: applications.length,
      pendingApplications: applications.filter(a => a.status === 'pending').length,
      approvedApplications: applications.filter(a => a.status === 'approved').length,
      rejectedApplications: applications.filter(a => a.status === 'rejected').length
    };
    
    res.json({
      success: true,
      analytics: {
        jobs,
        applications,
        stats
      }
    });
  } catch (error) {
    console.error('Company analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching company analytics'
    });
  }
});

// Job-specific analytics
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    const applications = await Application.find({ jobId })
      .populate('userId', 'name email profile')
      .sort({ createdAt: -1 });
    
    const stats = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(a => a.status === 'pending').length,
      reviewedApplications: applications.filter(a => a.status === 'reviewed').length,
      approvedApplications: applications.filter(a => a.status === 'approved').length,
      rejectedApplications: applications.filter(a => a.status === 'rejected').length
    };
    
    res.json({
      success: true,
      analytics: {
        job,
        applications,
        stats
      }
    });
  } catch (error) {
    console.error('Job analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching job analytics'
    });
  }
});

// Generate reports
router.post('/reports', async (req, res) => {
  try {
    const { type = 'summary', startDate, endDate } = req.body;
    
    const filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate) filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
    
    let data;
    switch (type) {
      case 'jobs':
        data = await Job.find(filter).populate('postedBy', 'name email');
        break;
      case 'users':
        data = await User.find(filter).select('-password');
        break;
      case 'applications':
        data = await Application.find(filter)
          .populate('userId', 'name email')
          .populate('jobId', 'title company');
        break;
      default:
        data = {
          jobs: await Job.countDocuments(filter),
          users: await User.countDocuments(filter),
          applications: await Application.countDocuments(filter),
          messages: await Message.countDocuments(filter)
        };
    }
    
    res.json({
      success: true,
      report: {
        type,
        generatedAt: new Date(),
        data
      }
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating report'
    });
  }
});

// Export analytics data
router.post('/export', async (req, res) => {
  try {
    const { data, format = 'json' } = req.body;
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.json');
      res.json({ success: true, data });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format'
      });
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting analytics'
    });
  }
});

// Real-time stats
router.get('/realtime', async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalApplications = await Application.countDocuments();
    
    res.json({
      success: true,
      realtime: {
        activeJobs: totalJobs,
        activeUsers: totalUsers,
        activeApplications: totalApplications,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching real-time analytics'
    });
  }
});

// Performance metrics
router.get('/performance', async (req, res) => {
  try {
    const performance = {
      responseTime: 150,
      errorRate: 0.5,
      throughput: 1000,
      databasePerformance: {
        avgQueryTime: 25,
        connections: 10,
        operationsPerSecond: 500
      },
      cacheHitRate: 85
    };
    
    res.json({
      success: true,
      performance,
      timeRange: '24h'
    });
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance metrics'
    });
  }
});

// Financial analytics
router.get('/financial', async (req, res) => {
  try {
    const financial = {
      totalRevenue: 0,
      monthlyRevenue: [],
      subscriptionBreakdown: {
        basic: 0,
        premium: 0,
        enterprise: 0
      },
      adRevenue: 0,
      expenses: 0,
      profit: 0
    };
    
    res.json({
      success: true,
      data: financial
    });
  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching financial analytics'
    });
  }
});

// Recruitment analytics
router.get('/recruitment', async (req, res) => {
  try {
    const recruitment = {
      totalApplications: 0,
      totalHires: 0,
      conversionRate: 0,
      averageTimeToHire: 0,
      topSources: [],
      byStatus: {
        pending: 0,
        reviewed: 0,
        interview: 0,
        hired: 0,
        rejected: 0
      }
    };
    
    res.json({
      success: true,
      data: recruitment
    });
  } catch (error) {
    console.error('Recruitment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recruitment analytics'
    });
  }
});

module.exports = router;
