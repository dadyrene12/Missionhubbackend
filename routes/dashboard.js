const express = require('express');
const router = express.Router();

// Import models
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Message = require('../models/Message');

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
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate: now };
};

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange('30d');

    // Get real stats from database
    const [
      totalJobs,
      activeApplications,
      interviewsScheduled,
      offersReceived,
      pendingApplications,
      approvedApplications,
      rejectedApplications
    ] = await Promise.all([
      Job.countDocuments({ createdAt: { $gte: startDate } }),
      Application.countDocuments({ 
        createdAt: { $gte: startDate },
        status: { $in: ['pending', 'reviewed', 'approved'] }
      }),
      Application.countDocuments({ 
        createdAt: { $gte: startDate },
        status: 'approved'
      }),
      Math.floor((await Application.countDocuments({ 
        createdAt: { $gte: startDate },
        status: 'approved'
      })) * 0.6), // Mock offers from approved
      Application.countDocuments({ 
        createdAt: { $gte: startDate },
        status: 'pending'
      }),
      Application.countDocuments({ 
        createdAt: { $gte: startDate },
        status: 'approved'
      }),
      Application.countDocuments({ 
        createdAt: { $gte: startDate },
        status: 'rejected'
      })
    ]);

    const stats = {
      totalJobs,
      activeApplications,
      interviewsScheduled,
      offersReceived,
      pendingApplications,
      approvedApplications,
      rejectedApplications
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

// GET /api/dashboard/activities
router.get('/activities', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange('7d');

    // Get real activities from database
    const [
      recentApplications,
      recentMessages,
      recentJobs
    ] = await Promise.all([
      Application.find({ createdAt: { $gte: startDate } })
        .populate('jobId', 'title company')
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .limit(10),
      Message.find({ sentAt: { $gte: startDate } })
        .populate('fromUserId', 'name')
        .populate('toUserId', 'name')
        .sort({ sentAt: -1 })
        .limit(10),
      Job.find({ createdAt: { $gte: startDate } })
        .populate('postedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Combine and format activities
    const activities = [];

    // Add job applications
    recentApplications.forEach(app => {
      activities.push({
        id: app._id,
        type: 'application',
        message: `Applied to ${app.jobId?.title || 'Unknown Position'} at ${app.jobId?.company || 'Unknown Company'}`,
        timestamp: app.createdAt,
        company: app.jobId?.company || 'Unknown',
        user: app.userId?.name || 'Unknown User'
      });
    });

    // Add messages
    recentMessages.forEach(msg => {
      activities.push({
        id: msg._id,
        type: 'message',
        message: `${msg.subject}`,
        timestamp: msg.sentAt,
        company: null,
        user: `${msg.fromUserId?.name} → ${msg.toUserId?.name}`
      });
    });

    // Add job postings
    recentJobs.forEach(job => {
      activities.push({
        id: job._id,
        type: 'job_posted',
        message: `Posted new job: ${job.title}`,
        timestamp: job.createdAt,
        company: job.company,
        user: job.postedBy?.name || 'Unknown User'
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 20) // Return latest 20 activities
    });
  } catch (error) {
    console.error('Dashboard activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: error.message
    });
  }
});

// GET /api/dashboard/recruitment
router.get('/recruitment', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange('30d');

    // Get real recruitment data
    const [
      applicationsByStatus,
      monthlyApplications,
      totalApplications,
      hiredCount
    ] = await Promise.all([
      Application.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Application.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Application.countDocuments({ createdAt: { $gte: startDate } }),
      Application.countDocuments({ 
        status: 'approved', 
        createdAt: { $gte: startDate } 
      })
    ]);

    // Format application status data
    const statusMap = {
      pending: 0,
      reviewed: 0,
      approved: 0,
      rejected: 0
    };

    applicationsByStatus.forEach(item => {
      statusMap[item._id] = item.count;
    });

    const applicationStatus = {
      pending: statusMap.pending,
      under_review: statusMap.reviewed,
      interview: statusMap.approved,
      offer: Math.floor(statusMap.approved * 0.8),
      rejected: statusMap.rejected
    };

    // Format monthly data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = monthlyApplications.map(item => {
      const [year, month] = item._id.split('-');
      return {
        month: monthNames[parseInt(month) - 1],
        count: item.count
      };
    });

    // Fill missing months with zero
    const last6Months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = monthNames[date.getMonth()];
      const existing = monthlyData.find(m => m.month === monthStr);
      last6Months.push(existing || { month: monthStr, count: 0 });
    }

    const recruitmentData = {
      applicationStatus,
      monthlyApplications: last6Months,
      totalApplications,
      hiredCount,
      conversionRate: totalApplications > 0 ? ((hiredCount / totalApplications) * 100).toFixed(1) : 0
    };

    res.json({
      success: true,
      data: recruitmentData
    });
  } catch (error) {
    console.error('Dashboard recruitment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recruitment data',
      error: error.message
    });
  }
});

// GET /api/dashboard/financial
router.get('/financial', async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange('30d');

    // Get real financial data
    const [
      totalJobs,
      totalApplications,
      hiredApplications,
      approvedApplications
    ] = await Promise.all([
      Job.countDocuments({ createdAt: { $gte: startDate } }),
      Application.countDocuments({ createdAt: { $gte: startDate } }),
      Application.countDocuments({ 
        status: 'approved', 
        createdAt: { $gte: startDate } 
      }),
      Application.countDocuments({ 
        status: 'approved', 
        createdAt: { $gte: startDate } 
      })
    ]);

    // Calculate financial metrics
    const costPerJobPosting = 100;
    const costPerApplication = 50;
    const costPerHire = 4500;
    
    const totalEarnings = hiredApplications * 25000; // Mock revenue per hire
    const totalCosts = (totalJobs * costPerJobPosting) + (totalApplications * costPerApplication);
    const netProfit = totalEarnings - totalCosts;

    // Generate monthly earnings data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const monthlyEarnings = monthNames.map((month, index) => ({
      month,
      amount: Math.floor(Math.random() * 3000) + 6000 // Mock data with some variation
    }));

    const financialData = {
      totalEarnings,
      monthlyEarnings,
      totalCosts,
      netProfit,
      pendingPayments: Math.floor(totalEarnings * 0.1), // Mock pending payments
      completedProjects: hiredApplications,
      costPerHire,
      roi: totalCosts > 0 ? ((netProfit / totalCosts) * 100).toFixed(1) : 0
    };

    res.json({
      success: true,
      data: financialData
    });
  } catch (error) {
    console.error('Dashboard financial error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial data',
      error: error.message
    });
  }
});

module.exports = router;
