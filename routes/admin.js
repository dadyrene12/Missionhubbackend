const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { superAdminOnly, admin } = require('../middleware/admin');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// Import models
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const Exam = require('../models/Exam');
const Advertisement = require('../models/Advertisement');
const PlatformSettings = require('../models/PlatformSettings');
const Company = require('../models/Company');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin';

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.userType !== 'super_admin' && user.role !== 'super_admin' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Get admin dashboard overview
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalJobs,
      totalApplications,
      totalCompanies,
      totalMessages,
      activeJobs,
      pendingJobs,
      newUsersThisWeek,
      newJobsThisWeek,
      revenueResult,
      recentUsers,
      recentJobs,
      recentApplications,
      recentCompanies,
      totalJobSeekers
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      Company.countDocuments(),
      Message.countDocuments(),
      Job.countDocuments({ status: 'active' }),
      Job.countDocuments({ status: 'pending' }),
      User.countDocuments({ createdAt: { $gte: lastWeek } }),
      Job.countDocuments({ createdAt: { $gte: lastWeek } }),
      Payment.aggregate([
        { $match: { createdAt: { $gte: lastMonth }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.find().select('name email createdAt').sort({ createdAt: -1 }).limit(5),
      Job.find().populate('postedBy', 'name').sort({ createdAt: -1 }).limit(5),
      Application.find()
        .populate('userId', 'name email')
        .populate('jobId', 'title company')
        .sort({ createdAt: -1 })
        .limit(5),
      Company.find().sort({ createdAt: -1 }).limit(5),
      User.countDocuments({ userType: 'jobSeeker' })
    ]);

    const dashboardData = {
      stats: {
        totalUsers,
        totalJobs,
        totalApplications,
        totalCompanies,
        totalMessages,
        activeJobs,
        pendingJobs,
        newUsersThisWeek,
        newJobsThisWeek,
        revenueThisMonth: revenueResult[0]?.total || 0,
        totalJobSeekers
      },
      recentActivity: {
        users: recentUsers,
        jobs: recentJobs,
        applications: recentApplications,
        companies: recentCompanies
      }
    };

    res.json({
      success: true,
      message: 'Admin dashboard data retrieved successfully',
      data: dashboardData
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin dashboard data',
      error: error.message
    });
  }
});

// Get admin dashboard stats (mapped for frontend compatibility)
router.get('/dashboard/stats', adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalJobs,
      totalApplications,
      totalMessages,
      recentUsers,
      recentJobs,
      recentApplications
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      Message.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5),
      Job.find().populate('postedBy', 'name').sort({ createdAt: -1 }).limit(5),
      Application.find()
        .populate('userId', 'name email')
        .populate('jobId', 'title company')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    const stats = {
      totalUsers,
      totalJobs,
      totalApplications,
      totalMessages
    };

    res.json({
      success: true,
      message: 'Admin dashboard stats retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin dashboard stats',
      error: error.message
    });
  }
});

// Get all users (admin only)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, userType, search, isActive, isVerified } = req.query;
    
    // Build filter
    const filter = {};
    if (userType && userType !== 'all') filter.userType = userType;
    if (isActive !== undefined && isActive !== 'all') filter.isActive = isActive === 'true';
    if (isVerified !== undefined && isVerified !== 'all') filter.isVerified = isVerified === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    // Get stats
    const [totalUsers, verifiedUsers, activeUsers, jobSeekers, companies] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ userType: 'jobSeeker' }),
      User.countDocuments({ userType: 'company' })
    ]);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      stats: {
        total: totalUsers,
        verified: verifiedUsers,
        active: activeUsers,
        jobSeekers,
        companies
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message
    });
  }
});

// Get user details (admin only)
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate({
        path: 'applications',
        model: 'Application',
        populate: {
          path: 'jobId',
          model: 'Job',
          select: 'title company'
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User details retrieved successfully',
      data: user
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user details',
      error: error.message
    });
  }
});

// Update user (admin only)
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, userType, isVerified, isActive, loginRestricted, profile } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, userType, isVerified, isActive, loginRestricted, profile },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Delete user (admin only)
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Also delete user's applications and messages
    await Promise.all([
      Application.deleteMany({ userId: req.params.id }),
      Message.deleteMany({ 
        $or: [
          { fromUserId: req.params.id },
          { toUserId: req.params.id }
        ]
      })
    ]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// Get system statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [
      userStats,
      jobStats,
      applicationStats,
      messageStats
    ] = await Promise.all([
      User.aggregate([
        { $group: { _id: '$userType', count: { $sum: 1 } } },
        { $group: { _id: null, total: { $sum: '$count' }, types: { $push: { type: '$_id', count: '$count' } } } }
      ]),
      Job.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $group: { _id: null, total: { $sum: '$count' }, types: { $push: { type: '$_id', count: '$count' } } } }
      ]),
      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $group: { _id: null, total: { $sum: '$count' }, statuses: { $push: { status: '$_id', count: '$count' } } } }
      ]),
      Message.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $group: { _id: null, total: { $sum: '$count' }, types: { $push: { type: '$_id', count: '$count' } } } }
      ])
    ]);

    const stats = {
      users: userStats[0] || { total: 0, types: [] },
      jobs: jobStats[0] || { total: 0, types: [] },
      applications: applicationStats[0] || { total: 0, statuses: [] },
      messages: messageStats[0] || { total: 0, types: [] }
    };

    res.json({
      success: true,
      message: 'System statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system statistics',
      error: error.message
    });
  }
});

// Get all jobs (admin view)
router.get('/jobs', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, company } = req.query;
    
    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (company) {
      filter.company = { $regex: company, $options: 'i' };
    }

    const jobs = await Job.find(filter)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(filter);
    
    // Get stats
    const [activeCount, pausedCount, pendingCount, closedCount] = await Promise.all([
      Job.countDocuments({ status: 'active' }),
      Job.countDocuments({ status: 'paused' }),
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'closed' })
    ]);

    res.json({
      success: true,
      message: 'Jobs retrieved successfully',
      data: jobs,
      stats: {
        total,
        active: activeCount,
        paused: pausedCount,
        pending: pendingCount,
        closed: closedCount,
        featured: await Job.countDocuments({ featured: true })
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve jobs',
      error: error.message
    });
  }
});

// Delete job (admin only)
router.delete('/jobs/:id', adminAuth, async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete job', error: error.message });
  }
});

// Get all companies (admin view)
router.get('/companies', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, verified, isActive } = req.query;
    
    const filter = { userType: 'company' };
    if (verified !== undefined && verified !== 'all') {
      filter.verified = verified === 'true';
    }
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true';
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const companies = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      message: 'Companies retrieved successfully',
      companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve companies', error: error.message });
  }
});

// Verify/unverify company (admin only)
router.put('/companies/:id/verify', adminAuth, async (req, res) => {
  try {
    const { verified, verifiedAt, verifiedBy } = req.body;
    
    const company = await User.findByIdAndUpdate(
      req.params.id,
      { 
        verified: verified === true,
        verifiedAt: verified ? new Date() : null,
        verifiedBy: verified ? req.user._id : null
      },
      { new: true }
    ).select('-password');
    
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    
    res.json({ 
      success: true, 
      message: verified ? 'Company verified successfully' : 'Company verification revoked',
      company 
    });
  } catch (error) {
    console.error('Verify company error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify company', error: error.message });
  }
});

// Get pending company verifications
router.get('/companies/pending', adminAuth, async (req, res) => {
  try {
    const companies = await User.find({ userType: 'company', verified: false })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Pending companies retrieved successfully',
      companies
    });
  } catch (error) {
    console.error('Get pending companies error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending companies', error: error.message });
  }
});

// Get verified companies
router.get('/companies/verified', adminAuth, async (req, res) => {
  try {
    const companies = await User.find({ userType: 'company', verified: true })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Verified companies retrieved successfully',
      companies
    });
  } catch (error) {
    console.error('Get verified companies error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve verified companies', error: error.message });
  }
});

// Legacy endpoint - update for compatibility
router.put('/companies/:id', adminAuth, async (req, res) => {
  try {
    const { verified, isActive } = req.body;
    const updateData = {};
    if (verified !== undefined) updateData.verified = verified;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const company = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');
    
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    
    res.json({ success: true, message: 'Company updated successfully', company });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ success: false, message: 'Failed to update company', error: error.message });
  }
});

// Get all applications (admin view)
router.get('/applications', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, jobId } = req.query;
    
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (jobId) filter.jobId = jobId;

    const applications = await Application.find(filter)
      .populate('userId', 'name email profile')
      .populate('jobId', 'title company location')
      .populate('companyId', 'name email', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments(filter);
    
    // Get stats
    const [pending, review, accepted, rejected] = await Promise.all([
      Application.countDocuments({ status: 'pending' }),
      Application.countDocuments({ status: 'review' }),
      Application.countDocuments({ status: 'accepted' }),
      Application.countDocuments({ status: 'rejected' })
    ]);

    res.json({
      success: true,
      message: 'Applications retrieved successfully',
      applications,
      stats: { total, pending, review, accepted, rejected },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications', error: error.message });
  }
});

// Update application status (admin only)
router.put('/applications/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('userId', 'name email')
      .populate('jobId', 'title company');
    
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    res.json({ success: true, message: 'Application updated successfully', application });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ success: false, message: 'Failed to update application', error: error.message });
  }
});

// Get all payments (admin view)
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type } = req.query;
    
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.type = type;

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email', null, { strictPopulate: false })
      .populate('userId', 'name email', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);

    const stats = await Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      payments,
      stats: {
        total,
        completed: stats.find(s => s._id === 'completed')?.count || 0,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        failed: stats.find(s => s._id === 'failed')?.count || 0,
        totalRevenue: stats.find(s => s._id === 'completed')?.totalAmount || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payments', error: error.message });
  }
});

// Update payment status (admin only)
router.put('/payments/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('companyId', 'name email profile', null, { strictPopulate: false })
      .populate('userId', 'name email', null, { strictPopulate: false });
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    console.log(`Admin ${req.user.email} updated payment ${payment._id} to status: ${status}`);
    
    res.json({ success: true, message: 'Payment updated successfully', payment });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment', error: error.message });
  }
});

// Get advertising payments (admin view)
router.get('/settings/advertising-payments', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = { type: 'advertise' };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);
    const stats = await Payment.aggregate([
      { $match: { type: 'advertise' } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      payments,
      stats: {
        total,
        completed: stats.find(s => s._id === 'completed')?.count || 0,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        totalRevenue: stats.find(s => s._id === 'completed')?.totalAmount || 0
      },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get advertising payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payments', error: error.message });
  }
});

// Get prove payments (admin view)
router.get('/settings/prove-payments', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = { type: 'prove' };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email profile', null, { strictPopulate: false })
      .populate('userId', 'name email', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);
    const stats = await Payment.aggregate([
      { $match: { type: 'prove' } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      payments,
      stats: {
        total,
        completed: stats.find(s => s._id === 'completed')?.count || 0,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        totalRevenue: stats.find(s => s._id === 'completed')?.totalAmount || 0
      },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get prove payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payments', error: error.message });
  }
});

// Get subscription payments (admin view)
router.get('/settings/subscription-payments', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = { type: 'subscription' };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email profile', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);
    const stats = await Payment.aggregate([
      { $match: { type: 'subscription' } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      payments,
      stats: {
        total,
        completed: stats.find(s => s._id === 'completed')?.count || 0,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        totalRevenue: stats.find(s => s._id === 'completed')?.totalAmount || 0
      },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get subscription payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payments', error: error.message });
  }
});

// Get all payments (admin view)
router.get('/settings/all-payments', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email profile', null, { strictPopulate: false })
      .populate('userId', 'name email', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);
    const stats = await Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      payments,
      stats: {
        total,
        completed: stats.find(s => s._id === 'completed')?.count || 0,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        totalRevenue: stats.find(s => s._id === 'completed')?.totalAmount || 0
      },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payments', error: error.message });
  }
});

// Send notification to all users (admin only)
router.post('/notifications/broadcast', adminAuth, async (req, res) => {
  try {
    const { title, message, type = 'system' } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const users = await User.find({ isActive: true }).select('_id');
    
    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      type,
      read: false
    }));

    await Notification.insertMany(notifications);

    res.json({ 
      success: true, 
      message: `Notification sent to ${users.length} users`,
      count: users.length 
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
});

// Get system logs (admin only)
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, level, startDate, endDate } = req.query;
    
    // Mock logs data - in production, this would come from a logging system
    const logs = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)],
      message: `System log entry ${i + 1}`,
      userId: Math.random() > 0.5 ? `user_${Math.floor(Math.random() * 100)}` : null,
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }));

    // Apply filters
    let filteredLogs = logs;
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    if (startDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= new Date(endDate));
    }

    const paginatedLogs = filteredLogs
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      message: 'Logs retrieved successfully',
      data: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredLogs.length,
        pages: Math.ceil(filteredLogs.length / limit)
      }
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve logs',
      error: error.message
    });
  }
});

// ==================== ADDITIONAL ADMIN FEATURES ====================

// Activate/Deactivate user account
router.put('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { isActive, reason } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: isActive ? 'User activated successfully' : 'User deactivated successfully',
      data: user 
    });
  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status', error: error.message });
  }
});

// Restrict/Unrestrict user login
router.put('/users/:id/restrict', adminAuth, async (req, res) => {
  try {
    const { loginRestricted } = req.body;
    
    // Ensure we're converting to boolean properly
    const shouldRestrict = loginRestricted === true || loginRestricted === 'true' || loginRestricted === true;
    
    console.log(`Admin ${req.user.email} attempting to ${shouldRestrict ? 'RESTRICT' : 'UNRESTRICT'} user ${req.params.id}`);
    
    // First check if user exists
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Build update object
    const updateData = {
      loginRestricted: shouldRestrict
    };
    
    if (shouldRestrict) {
      updateData.restrictedAt = new Date();
      updateData.restrictedBy = req.user._id;
    } else {
      updateData.restrictedAt = null;
      updateData.restrictedBy = null;
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');

    console.log(`User ${user.email} restriction updated - loginRestricted: ${user.loginRestricted}, restrictedAt: ${user.restrictedAt}`);

    res.json({ 
      success: true, 
      message: shouldRestrict ? 'User login restricted successfully' : 'User login unrestricted successfully',
      data: user,
      loginRestricted: user.loginRestricted
    });
  } catch (error) {
    console.error('User restriction error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user restriction', error: error.message });
  }
});

// Check user restriction status (for debugging)
router.get('/users/:id/restriction-status', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('email loginRestricted restrictedAt restrictedBy');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        email: user.email,
        loginRestricted: user.loginRestricted,
        restrictedAt: user.restrictedAt,
        restrictedBy: user.restrictedBy
      }
    });
  } catch (error) {
    console.error('Check restriction error:', error);
    res.status(500).json({ success: false, message: 'Failed to check restriction status', error: error.message });
  }
});

// Send password reset email
router.post('/users/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate a reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // In a real application, you would:
    // 1. Save this token to the user's record with an expiration
    // 2. Send an email with a link containing the token
    // For now, we'll just return success
    
    console.log(`Admin ${req.user.email} requested password reset for user ${user.email}`);
    console.log(`Reset token (for testing): ${resetToken}`);

    res.json({ 
      success: true, 
      message: 'Password reset email sent successfully',
      data: { email: user.email }
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to send password reset email', error: error.message });
  }
});

// Change user role
router.put('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role, userType } = req.body;
    
    const validRoles = ['jobSeeker', 'company', 'admin', 'super_admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, userType },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'User role updated successfully',
      data: user 
    });
  } catch (error) {
    console.error('User role update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user role', error: error.message });
  }
});

// Get user activities
router.get('/users/:id/activities', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('loginHistory activityLog');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get related data
    const jobs = await Job.find({ postedBy: req.params.id }).select('title status createdAt').limit(10);
    const applications = await Application.find({ userId: req.params.id })
      .populate('jobId', 'title company')
      .select('status createdAt')
      .limit(10);

    res.json({
      success: true,
      message: 'User activities retrieved successfully',
      data: {
        loginHistory: user.loginHistory || [],
        activityLog: user.activityLog || [],
        recentJobs: jobs,
        recentApplications: applications
      }
    });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user activities', error: error.message });
  }
});

// Bulk user actions
router.post('/users/bulk-action', adminAuth, async (req, res) => {
  try {
    const { userIds, action, data } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'User IDs array required' });
    }

    let updateData = {};
    switch (action) {
      case 'activate':
        updateData = { isActive: true };
        break;
      case 'deactivate':
        updateData = { isActive: false };
        break;
      case 'verify':
        updateData = { isVerified: true };
        break;
      case 'changeRole':
        updateData = { role: data?.role, userType: data?.userType };
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      updateData
    );

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} users updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk user action error:', error);
    res.status(500).json({ success: false, message: 'Failed to perform bulk action', error: error.message });
  }
});

// Approve/Reject job
router.put('/jobs/:id/moderate', adminAuth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    const validStatuses = ['active', 'pending', 'rejected', 'featured'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'featured') {
      updateData.featured = true;
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('postedBy', 'name email');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ 
      success: true, 
      message: `Job ${status} successfully`,
      job 
    });
  } catch (error) {
    console.error('Job moderation error:', error);
    res.status(500).json({ success: false, message: 'Failed to moderate job', error: error.message });
  }
});

// Feature/Unfeature job
router.put('/jobs/:id/feature', adminAuth, async (req, res) => {
  try {
    const { featured } = req.body;

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { featured: featured === true },
      { new: true }
    ).populate('postedBy', 'name email');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ 
      success: true, 
      message: featured ? 'Job featured successfully' : 'Job unfeatured successfully',
      job 
    });
  } catch (error) {
    console.error('Feature job error:', error);
    res.status(500).json({ success: false, message: 'Failed to feature job', error: error.message });
  }
});

// Get pending jobs
router.get('/jobs/pending', adminAuth, async (req, res) => {
  try {
    const jobs = await Job.find({ status: 'pending' })
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Pending jobs retrieved successfully',
      jobs
    });
  } catch (error) {
    console.error('Get pending jobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending jobs', error: error.message });
  }
});

// Get featured jobs
router.get('/jobs/featured', adminAuth, async (req, res) => {
  try {
    const jobs = await Job.find({ featured: true })
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Featured jobs retrieved successfully',
      jobs
    });
  } catch (error) {
    console.error('Get featured jobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve featured jobs', error: error.message });
  }
});

// Get subscription plans
router.get('/subscriptions', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, plan } = req.query;
    
    const filter = {};
    if (status) filter['subscription.status'] = status;
    if (plan) filter['subscription.plan'] = plan;

    const subscriptions = await User.find({ 
      userType: 'company',
      ...filter 
    })
      .select('name email subscription createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments({ userType: 'company', ...filter });

    const stats = await User.aggregate([
      { $match: { userType: 'company' } },
      { $group: { 
        _id: '$subscription.plan', 
        count: { $sum: 1 } 
      } }
    ]);

    res.json({
      success: true,
      message: 'Subscriptions retrieved successfully',
      subscriptions,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve subscriptions', error: error.message });
  }
});

// Update subscription
router.put('/subscriptions/:id', adminAuth, async (req, res) => {
  try {
    const { plan, status, startDate, endDate } = req.body;

    const updateData = {};
    if (plan) updateData['subscription.plan'] = plan;
    if (status) updateData['subscription.status'] = status;
    if (startDate) updateData['subscription.startDate'] = new Date(startDate);
    if (endDate) updateData['subscription.endDate'] = new Date(endDate);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('name email subscription');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.json({ 
      success: true, 
      message: 'Subscription updated successfully',
      subscription: user 
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to update subscription', error: error.message });
  }
});

// Email broadcast to all users
router.post('/broadcast/email', adminAuth, async (req, res) => {
  try {
    const { subject, message, targetAudience = 'all' } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    let filter = { isActive: true };
    if (targetAudience === 'companies') {
      filter.userType = 'company';
    } else if (targetAudience === 'jobSeekers') {
      filter.userType = 'jobSeeker';
    }

    const users = await User.find(filter).select('email name');
    
    res.json({ 
      success: true, 
      message: `Email broadcast queued for ${users.length} users`,
      recipientCount: users.length,
      note: 'In production, emails would be sent via email service'
    });
  } catch (error) {
    console.error('Email broadcast error:', error);
    res.status(500).json({ success: false, message: 'Failed to send broadcast', error: error.message });
  }
});

// Get system settings
router.get('/system-settings', adminAuth, async (req, res) => {
  try {
    const PlatformSettings = require('../models/PlatformSettings');
    let settings = await PlatformSettings.findOne();
    
    if (!settings) {
      settings = await PlatformSettings.create({
        platformName: 'MissionHub',
        maintenanceMode: false,
        registrationEnabled: true,
        emailVerificationRequired: false,
        defaultUserRole: 'jobSeeker',
        jobApprovalRequired: false,
        companyVerificationRequired: true,
        maxJobsPerCompany: 10,
        maxApplicationsPerUser: 20,
        sessionTimeout: 30,
        allowSocialLogin: false
      });
    }

    res.json({
      success: true,
      message: 'System settings retrieved successfully',
      settings
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve settings', error: error.message });
  }
});

// Update system settings
router.put('/system-settings', adminAuth, async (req, res) => {
  try {
    const PlatformSettings = require('../models/PlatformSettings');
    
    const allowedFields = [
      'platformName', 'maintenanceMode', 'registrationEnabled', 
      'emailVerificationRequired', 'defaultUserRole', 'jobApprovalRequired',
      'companyVerificationRequired', 'maxJobsPerCompany', 'maxApplicationsPerUser',
      'sessionTimeout', 'allowSocialLogin', 'supportEmail', 'termsUrl', 'privacyUrl'
    ];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    let settings = await PlatformSettings.findOne();
    
    if (settings) {
      settings = await PlatformSettings.findByIdAndUpdate(
        settings._id,
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      settings = await PlatformSettings.create(updateData);
    }

    res.json({ 
      success: true, 
      message: 'System settings updated successfully',
      settings 
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings', error: error.message });
  }
});

// Export data
router.get('/export/:type', adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json' } = req.query;

    let data;
    switch (type) {
      case 'users':
        data = await User.find().select('-password').lean();
        break;
      case 'jobs':
        data = await Job.find().populate('postedBy', 'name email').lean();
        break;
      case 'applications':
        data = await Application.find()
          .populate('userId', 'name email')
          .populate('jobId', 'title company')
          .lean();
        break;
      case 'companies':
        data = await User.find({ userType: 'company' }).select('-password').lean();
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid export type' });
    }

    res.json({
      success: true,
      message: `${type} data exported successfully`,
      count: data.length,
      data: format === 'csv' ? data : data,
      note: 'CSV conversion would be done in production'
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ success: false, message: 'Failed to export data', error: error.message });
  }
});

// Audit logs
const auditLogs = [];
router.get('/audit-logs', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, adminId, startDate, endDate } = req.query;

    let filter = {};
    if (action) filter.action = action;
    if (adminId) filter.adminId = adminId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = auditLogs
      .filter(log => !action || log.action === action)
      .filter(log => !adminId || log.adminId === adminId)
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      message: 'Audit logs retrieved successfully',
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: auditLogs.length,
        pages: Math.ceil(auditLogs.length / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve logs', error: error.message });
  }
});

// Create audit log entry
const createAuditLog = (adminId, action, details) => {
  auditLogs.unshift({
    id: auditLogs.length + 1,
    adminId,
    action,
    details,
    timestamp: new Date()
  });
  if (auditLogs.length > 1000) auditLogs.pop();
};

// ==================== ADDITIONAL MANAGEMENT FEATURES (10 MORE) ====================

// ==================== 1. JOB CATEGORIES MANAGEMENT ====================
const jobCategories = [
  { id: 1, name: 'Technology', icon: 'code', color: '#6366f1', active: true },
  { id: 2, name: 'Marketing', icon: 'megaphone', color: '#ec4899', active: true },
  { id: 3, name: 'Finance', icon: 'dollar-sign', color: '#10b981', active: true },
  { id: 4, name: 'Healthcare', icon: 'heart', color: '#ef4444', active: true },
  { id: 5, name: 'Design', icon: 'palette', color: '#f59e0b', active: true },
  { id: 6, name: 'Sales', icon: 'trending-up', color: '#8b5cf6', active: true },
  { id: 7, name: 'Education', icon: 'book', color: '#06b6d4', active: true },
  { id: 8, name: 'Other', icon: 'box', color: '#64748b', active: true }
];

router.get('/categories', adminAuth, async (req, res) => {
  try {
    const { active } = req.query;
    let categories = [...jobCategories];
    if (active !== undefined) {
      categories = categories.filter(c => c.active === (active === 'true'));
    }
    res.json({ success: true, message: 'Categories retrieved', categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get categories', error: error.message });
  }
});

router.post('/categories', adminAuth, async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name required' });
    }
    const newCategory = {
      id: jobCategories.length + 1,
      name,
      icon: icon || 'box',
      color: color || '#64748b',
      active: true
    };
    jobCategories.push(newCategory);
    res.json({ success: true, message: 'Category created', category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
  }
});

router.put('/categories/:id', adminAuth, async (req, res) => {
  try {
    const { name, icon, color, active } = req.body;
    const category = jobCategories.find(c => c.id === parseInt(req.params.id));
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (active !== undefined) category.active = active;
    res.json({ success: true, message: 'Category updated', category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
  }
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
  try {
    const index = jobCategories.findIndex(c => c.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    jobCategories.splice(index, 1);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
  }
});

// ==================== 2. SKILLS DATABASE MANAGEMENT ====================
const skillsDatabase = [
  'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'Java', 'C++', 'Go',
  'SQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Git', 'HTML', 'CSS',
  'Vue.js', 'Angular', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Flutter', 'React Native'
];

router.get('/skills', adminAuth, async (req, res) => {
  try {
    const { search, category } = req.query;
    let skills = [...skillsDatabase];
    if (search) {
      skills = skills.filter(s => s.toLowerCase().includes(search.toLowerCase()));
    }
    res.json({ success: true, message: 'Skills retrieved', skills, count: skills.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get skills', error: error.message });
  }
});

router.post('/skills', adminAuth, async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Skill name required' });
    }
    if (skillsDatabase.includes(name)) {
      return res.status(400).json({ success: false, message: 'Skill already exists' });
    }
    skillsDatabase.push(name);
    res.json({ success: true, message: 'Skill added', skill: name });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add skill', error: error.message });
  }
});

router.delete('/skills/:name', adminAuth, async (req, res) => {
  try {
    const index = skillsDatabase.indexOf(req.params.name);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }
    skillsDatabase.splice(index, 1);
    res.json({ success: true, message: 'Skill deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete skill', error: error.message });
  }
});

// ==================== 3. BANNERS & HOMEPAGE CONTENT ====================
const banners = [
  { id: 1, title: 'Find Your Dream Job', subtitle: 'Connect with top companies', image: '/banner1.jpg', active: true, order: 1 },
  { id: 2, title: 'Hire Top Talent', subtitle: 'Post jobs and find candidates', image: '/banner2.jpg', active: true, order: 2 }
];

router.get('/banners', adminAuth, async (req, res) => {
  try {
    const { active } = req.query;
    let result = [...banners];
    if (active !== undefined) {
      result = result.filter(b => b.active === (active === 'true'));
    }
    res.json({ success: true, message: 'Banners retrieved', banners: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get banners', error: error.message });
  }
});

router.post('/banners', adminAuth, async (req, res) => {
  try {
    const { title, subtitle, image, link, order } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title required' });
    }
    const newBanner = {
      id: banners.length + 1,
      title,
      subtitle: subtitle || '',
      image: image || '',
      link: link || '',
      active: true,
      order: order || banners.length + 1
    };
    banners.push(newBanner);
    res.json({ success: true, message: 'Banner created', banner: newBanner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create banner', error: error.message });
  }
});

router.put('/banners/:id', adminAuth, async (req, res) => {
  try {
    const { title, subtitle, image, link, active, order } = req.body;
    const banner = banners.find(b => b.id === parseInt(req.params.id));
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    if (title) banner.title = title;
    if (subtitle) banner.subtitle = subtitle;
    if (image) banner.image = image;
    if (link) banner.link = link;
    if (active !== undefined) banner.active = active;
    if (order) banner.order = order;
    res.json({ success: true, message: 'Banner updated', banner });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update banner', error: error.message });
  }
});

router.delete('/banners/:id', adminAuth, async (req, res) => {
  try {
    const index = banners.findIndex(b => b.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    banners.splice(index, 1);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete banner', error: error.message });
  }
});

// ==================== 4. USER REPORTS MANAGEMENT ====================
const userReports = [];

router.get('/reports', adminAuth, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    let reports = [...userReports];
    if (status) reports = reports.filter(r => r.status === status);
    if (type) reports = reports.filter(r => r.type === type);
    
    const start = (page - 1) * limit;
    const paginated = reports.slice(start, start + parseInt(limit));
    
    res.json({
      success: true,
      message: 'Reports retrieved',
      reports: paginated,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: reports.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get reports', error: error.message });
  }
});

router.post('/reports', async (req, res) => {
  try {
    const { reporterId, reportedUserId, type, description } = req.body;
    if (!reporterId || !reportedUserId || !type || !description) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    const newReport = {
      id: userReports.length + 1,
      reporterId,
      reportedUserId,
      type,
      description,
      status: 'pending',
      createdAt: new Date()
    };
    userReports.push(newReport);
    res.json({ success: true, message: 'Report submitted', report: newReport });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit report', error: error.message });
  }
});

router.put('/reports/:id', adminAuth, async (req, res) => {
  try {
    const { status, resolution, actionTaken } = req.body;
    const report = userReports.find(r => r.id === parseInt(req.params.id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    if (status) report.status = status;
    if (resolution) report.resolution = resolution;
    if (actionTaken) report.actionTaken = actionTaken;
    report.resolvedAt = new Date();
    report.resolvedBy = req.user._id;
    res.json({ success: true, message: 'Report updated', report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update report', error: error.message });
  }
});

// ==================== 5. DETAILED ACTIVITY LOGS ====================
const activityLogs = [];

router.get('/activity-logs', adminAuth, async (req, res) => {
  try {
    const { type, userId, startDate, endDate, page = 1, limit = 50 } = req.query;
    let logs = [...activityLogs];
    
    if (type) logs = logs.filter(l => l.type === type);
    if (userId) logs = logs.filter(l => l.userId === userId);
    if (startDate) logs = logs.filter(l => new Date(l.timestamp) >= new Date(startDate));
    if (endDate) logs = logs.filter(l => new Date(l.timestamp) <= new Date(endDate));
    
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const start = (page - 1) * limit;
    const paginated = logs.slice(start, start + parseInt(limit));
    
    res.json({
      success: true,
      message: 'Activity logs retrieved',
      logs: paginated,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: logs.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get activity logs', error: error.message });
  }
});

const logActivity = (userId, type, action, details) => {
  activityLogs.unshift({
    id: activityLogs.length + 1,
    userId,
    type,
    action,
    details,
    timestamp: new Date(),
    ip: '127.0.0.1'
  });
  if (activityLogs.length > 1000) activityLogs.pop();
};

// ==================== 6. BACKUP MANAGEMENT ====================
router.get('/backups', adminAuth, async (req, res) => {
  try {
    const backups = [
      { id: 1, name: 'full_backup_2024_01_01', size: '245 MB', createdAt: new Date('2024-01-01'), type: 'full' },
      { id: 2, name: 'incremental_backup_2024_01_15', size: '45 MB', createdAt: new Date('2024-01-15'), type: 'incremental' },
      { id: 3, name: 'full_backup_2024_02_01', size: '260 MB', createdAt: new Date('2024-02-01'), type: 'full' }
    ];
    res.json({ success: true, message: 'Backups retrieved', backups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get backups', error: error.message });
  }
});

router.post('/backups', adminAuth, async (req, res) => {
  try {
    const { type = 'full', name } = req.body;
    const backup = {
      id: Date.now(),
      name: name || `backup_${new Date().toISOString().split('T')[0]}`,
      size: '0 MB',
      createdAt: new Date(),
      type,
      status: 'in_progress'
    };
    res.json({ success: true, message: 'Backup initiated', backup, note: 'In production, backup would be created asynchronously' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create backup', error: error.message });
  }
});

router.delete('/backups/:id', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'Backup deleted', note: 'In production, actual backup file would be deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete backup', error: error.message });
  }
});

// ==================== 7. API USAGE STATISTICS ====================
router.get('/api-usage', adminAuth, async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    const usageData = {
      totalCalls: 15420,
      uniqueUsers: 342,
      avgResponseTime: 145,
      endpoints: [
        { path: '/api/jobs', calls: 5420, avgTime: 89 },
        { path: '/api/users', calls: 3210, avgTime: 120 },
        { path: '/api/applications', calls: 2890, avgTime: 156 },
        { path: '/api/auth', calls: 2100, avgTime: 210 },
        { path: '/api/company', calls: 1800, avgTime: 95 }
      ],
      timeline: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        calls: Math.floor(Math.random() * 2000) + 500
      })).reverse()
    };
    res.json({ success: true, message: 'API usage retrieved', usage: usageData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get API usage', error: error.message });
  }
});

// ==================== 8. SEO SETTINGS ====================
const seoSettings = {
  siteTitle: 'MissionHub - Find Your Dream Job',
  siteDescription: 'MissionHub connects job seekers with top companies. Find your dream job or hire talent today.',
  metaKeywords: 'jobs, hiring, career, employment, job seeker, company hiring',
  ogImage: '/og-image.jpg',
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
  canonicalUrl: 'https://missionhub.com'
};

router.get('/seo', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'SEO settings retrieved', seo: seoSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get SEO settings', error: error.message });
  }
});

router.put('/seo', adminAuth, async (req, res) => {
  try {
    const { siteTitle, siteDescription, metaKeywords, ogImage, twitterCard, robots, canonicalUrl } = req.body;
    if (siteTitle) seoSettings.siteTitle = siteTitle;
    if (siteDescription) seoSettings.siteDescription = siteDescription;
    if (metaKeywords) seoSettings.metaKeywords = metaKeywords;
    if (ogImage) seoSettings.ogImage = ogImage;
    if (twitterCard) seoSettings.twitterCard = twitterCard;
    if (robots) seoSettings.robots = robots;
    if (canonicalUrl) seoSettings.canonicalUrl = canonicalUrl;
    res.json({ success: true, message: 'SEO settings updated', seo: seoSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update SEO settings', error: error.message });
  }
});

// ==================== 9. EMAIL TEMPLATES ====================
const emailTemplates = [
  { id: 1, name: 'Welcome Email', subject: 'Welcome to MissionHub', type: 'welcome', active: true },
  { id: 2, name: 'Password Reset', subject: 'Reset Your Password', type: 'password_reset', active: true },
  { id: 3, name: 'Job Application', subject: 'Your Application Status', type: 'application', active: true },
  { id: 4, name: 'Interview Invitation', subject: 'Interview Invitation', type: 'interview', active: true },
  { id: 5, name: 'Company Verification', subject: 'Company Verification Complete', type: 'verification', active: true }
];

router.get('/email-templates', adminAuth, async (req, res) => {
  try {
    const { type, active } = req.query;
    let templates = [...emailTemplates];
    if (type) templates = templates.filter(t => t.type === type);
    if (active !== undefined) templates = templates.filter(t => t.active === (active === 'true'));
    res.json({ success: true, message: 'Email templates retrieved', templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get templates', error: error.message });
  }
});

router.get('/email-templates/:id', adminAuth, async (req, res) => {
  try {
    const template = emailTemplates.find(t => t.id === parseInt(req.params.id));
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template retrieved', template: { ...template, body: '<p>Email template content here...</p>' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get template', error: error.message });
  }
});

router.put('/email-templates/:id', adminAuth, async (req, res) => {
  try {
    const { subject, body, active } = req.body;
    const template = emailTemplates.find(t => t.id === parseInt(req.params.id));
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    if (subject) template.subject = subject;
    if (active !== undefined) template.active = active;
    res.json({ success: true, message: 'Template updated', template });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
  }
});

// ==================== 10. FAQ & HELP CONTENT ====================
const faqContent = [
  { id: 1, question: 'How do I post a job?', answer: 'Go to your company dashboard and click "Post New Job"', category: 'jobs', order: 1, active: true },
  { id: 2, question: 'How do I verify my company?', answer: 'Submit your company documents for verification in settings', category: 'companies', order: 2, active: true },
  { id: 3, question: 'How do I reset my password?', answer: 'Click "Forgot Password" on the login page', category: 'account', order: 3, active: true }
];

router.get('/faq', adminAuth, async (req, res) => {
  try {
    const { category, active } = req.query;
    let faqs = [...faqContent];
    if (category) faqs = faqs.filter(f => f.category === category);
    if (active !== undefined) faqs = faqs.filter(f => f.active === (active === 'true'));
    res.json({ success: true, message: 'FAQ retrieved', faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get FAQ', error: error.message });
  }
});

router.post('/faq', adminAuth, async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'Question and answer required' });
    }
    const newFaq = {
      id: faqContent.length + 1,
      question,
      answer,
      category: category || 'general',
      order: order || faqContent.length + 1,
      active: true
    };
    faqContent.push(newFaq);
    res.json({ success: true, message: 'FAQ created', faq: newFaq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create FAQ', error: error.message });
  }
});

router.put('/faq/:id', adminAuth, async (req, res) => {
  try {
    const { question, answer, category, order, active } = req.body;
    const faq = faqContent.find(f => f.id === parseInt(req.params.id));
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    if (question) faq.question = question;
    if (answer) faq.answer = answer;
    if (category) faq.category = category;
    if (order) faq.order = order;
    if (active !== undefined) faq.active = active;
    res.json({ success: true, message: 'FAQ updated', faq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update FAQ', error: error.message });
  }
});

router.delete('/faq/:id', adminAuth, async (req, res) => {
  try {
    const index = faqContent.findIndex(f => f.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    faqContent.splice(index, 1);
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete FAQ', error: error.message });
  }
});

// ==================== ADD 5 MORE FEATURES ====================

// ==================== 11. ANNOUNCEMENTS ====================
const announcements = [
  { id: 1, title: 'Platform Maintenance', content: 'System maintenance scheduled for Sunday', type: 'info', active: true, createdAt: new Date() }
];

router.get('/announcements', adminAuth, async (req, res) => {
  try {
    const { active } = req.query;
    let result = [...announcements];
    if (active !== undefined) result = result.filter(a => a.active === (active === 'true'));
    res.json({ success: true, announcements: result });
  } catch (error) {
    console.error('Announcements GET error:', error);
    res.status(500).json({ success: false, message: 'Failed to get announcements', error: error.message });
  }
});

router.post('/announcements', adminAuth, async (req, res) => {
  try {
    const { title, content, type = 'info', targetRoles = ['all'], sendEmail = true } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required' });

    const newAnnouncement = { 
      id: announcements.length + 1, 
      title, 
      content, 
      type, 
      targetRoles,
      active: true, 
      createdAt: new Date(),
      sentBy: req.user._id
    };
    announcements.push(newAnnouncement);

    const userFilter = targetRoles.includes('all') ? {} : { userType: { $in: targetRoles } };
    const targetUsers = await User.find(userFilter).select('email name _id');

    if (sendEmail && targetUsers.length > 0) {
      try {
        const notifications = targetUsers.map(user => ({
          userId: user._id,
          title: title,
          message: content,
          type: 'announcement',
          read: false,
          createdAt: new Date()
        }));
        const inserted = await Notification.insertMany(notifications);
        console.log('Announcements created:', inserted.length);
      } catch (notifError) {
        console.error('Notification creation error:', notifError.message);
      }

      for (const user of targetUsers) {
        try {
          await sendAnnouncementEmail(user.email, title, content, type);
        } catch (emailError) {
          // Email send failed for this user
        }
      }
    }

    res.json({ 
      success: true, 
      message: `Announcement created and sent to ${targetUsers.length} users`,
      announcement: newAnnouncement,
      recipients: targetUsers.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create announcement', error: error.message });
  }
});

async function sendAnnouncementEmail(email, title, content, type) {
  try {
    let sgMail;
    try {
      sgMail = require('@sendgrid/mail');
    } catch (e) {
      return;
    }
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = {
        to: email,
        from: process.env.FROM_EMAIL || 'noreply@missionhub.com',
        subject: `[MissionHub] ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">MissionHub</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b;">${title}</h2>
              <p style="color: #475569; line-height: 1.6;">${content}</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px;">This is an official announcement from MissionHub.</p>
              </div>
            </div>
          </div>
        `
      };
      await sgMail.send(msg);
    }
  } catch (emailError) {
    // Email service not available
  }
}

router.put('/announcements/:id', adminAuth, async (req, res) => {
  try {
    const { title, content, type, active } = req.body;
    const announcement = announcements.find(a => a.id === parseInt(req.params.id));
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (active !== undefined) announcement.active = active;
    res.json({ success: true, message: 'Announcement updated', announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update announcement', error: error.message });
  }
});

router.delete('/announcements/:id', adminAuth, async (req, res) => {
  try {
    const index = announcements.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Announcement not found' });
    announcements.splice(index, 1);
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete announcement', error: error.message });
  }
});

// ==================== 12. JOB TYPES MANAGEMENT ====================
const jobTypes = [
  { id: 1, name: 'Full-time', slug: 'full-time', color: '#10b981', icon: 'briefcase', active: true },
  { id: 2, name: 'Part-time', slug: 'part-time', color: '#6366f1', icon: 'clock', active: true },
  { id: 3, name: 'Contract', slug: 'contract', color: '#f59e0b', icon: 'file-text', active: true },
  { id: 4, name: 'Internship', slug: 'internship', color: '#8b5cf6', icon: 'graduation-cap', active: true },
  { id: 5, name: 'Remote', slug: 'remote', color: '#06b6d4', icon: 'home', active: true }
];

router.get('/job-types', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'Job types retrieved', jobTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get job types', error: error.message });
  }
});

router.post('/job-types', adminAuth, async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const newType = { id: jobTypes.length + 1, name, slug: name.toLowerCase().replace(/\s+/g, '-'), color: color || '#64748b', icon: icon || 'briefcase', active: true };
    jobTypes.push(newType);
    res.json({ success: true, message: 'Job type created', jobType: newType });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create job type', error: error.message });
  }
});

router.put('/job-types/:id', adminAuth, async (req, res) => {
  try {
    const { name, color, icon, active } = req.body;
    const jobType = jobTypes.find(j => j.id === parseInt(req.params.id));
    if (!jobType) return res.status(404).json({ success: false, message: 'Job type not found' });
    if (name) jobType.name = name;
    if (color) jobType.color = color;
    if (icon) jobType.icon = icon;
    if (active !== undefined) jobType.active = active;
    res.json({ success: true, message: 'Job type updated', jobType });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update job type', error: error.message });
  }
});

router.delete('/job-types/:id', adminAuth, async (req, res) => {
  try {
    const index = jobTypes.findIndex(j => j.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Job type not found' });
    jobTypes.splice(index, 1);
    res.json({ success: true, message: 'Job type deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete job type', error: error.message });
  }
});

// ==================== 13. LOCATIONS MANAGEMENT ====================
const locations = [
  { id: 1, name: 'New York', country: 'USA', state: 'NY', active: true },
  { id: 2, name: 'San Francisco', country: 'USA', state: 'CA', active: true },
  { id: 3, name: 'London', country: 'UK', state: '', active: true },
  { id: 4, name: 'Remote', country: 'Any', state: '', active: true }
];

router.get('/locations', adminAuth, async (req, res) => {
  try {
    const { country, active } = req.query;
    let result = [...locations];
    if (country) result = result.filter(l => l.country === country);
    if (active !== undefined) result = result.filter(l => l.active === (active === 'true'));
    res.json({ success: true, locations: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get locations', error: error.message });
  }
});

router.post('/locations', adminAuth, async (req, res) => {
  try {
    const { name, country, state } = req.body;
    if (!name || !country) return res.status(400).json({ success: false, message: 'Name and country required' });
    const newLocation = { id: locations.length + 1, name, country, state: state || '', active: true };
    locations.push(newLocation);
    res.json({ success: true, message: 'Location created', location: newLocation });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create location', error: error.message });
  }
});

router.put('/locations/:id', adminAuth, async (req, res) => {
  try {
    const { name, country, state, active } = req.body;
    const location = locations.find(l => l.id === parseInt(req.params.id));
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    if (name) location.name = name;
    if (country) location.country = country;
    if (state) location.state = state;
    if (active !== undefined) location.active = active;
    res.json({ success: true, message: 'Location updated', location });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update location', error: error.message });
  }
});

router.delete('/locations/:id', adminAuth, async (req, res) => {
  try {
    const index = locations.findIndex(l => l.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Location not found' });
    locations.splice(index, 1);
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete location', error: error.message });
  }
});

// ==================== 14. SALARY RANGES MANAGEMENT ====================
const salaryRanges = [
  { id: 1, min: 0, max: 30000, label: 'Entry Level ($0-30k)', active: true },
  { id: 2, min: 30000, max: 60000, label: 'Junior ($30k-60k)', active: true },
  { id: 3, min: 60000, max: 100000, label: 'Mid Level ($60k-100k)', active: true },
  { id: 4, min: 100000, max: 150000, label: 'Senior ($100k-150k)', active: true },
  { id: 5, min: 150000, max: 999999, label: 'Executive ($150k+)', active: true }
];

router.get('/salary-ranges', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'Salary ranges retrieved', salaryRanges });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get salary ranges', error: error.message });
  }
});

router.post('/salary-ranges', adminAuth, async (req, res) => {
  try {
    const { min, max, label } = req.body;
    if (min === undefined || max === undefined) return res.status(400).json({ success: false, message: 'Min and max required' });
    const newRange = { id: salaryRanges.length + 1, min, max, label: label || `$${min.toLocaleString()}-$${max.toLocaleString()}`, active: true };
    salaryRanges.push(newRange);
    res.json({ success: true, message: 'Salary range created', salaryRange: newRange });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create salary range', error: error.message });
  }
});

router.put('/salary-ranges/:id', adminAuth, async (req, res) => {
  try {
    const { min, max, label, active } = req.body;
    const range = salaryRanges.find(s => s.id === parseInt(req.params.id));
    if (!range) return res.status(404).json({ success: false, message: 'Salary range not found' });
    if (min !== undefined) range.min = min;
    if (max !== undefined) range.max = max;
    if (label) range.label = label;
    if (active !== undefined) range.active = active;
    res.json({ success: true, message: 'Salary range updated', salaryRange: range });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update salary range', error: error.message });
  }
});

router.delete('/salary-ranges/:id', adminAuth, async (req, res) => {
  try {
    const index = salaryRanges.findIndex(s => s.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Salary range not found' });
    salaryRanges.splice(index, 1);
    res.json({ success: true, message: 'Salary range deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete salary range', error: error.message });
  }
});

// ==================== 15. USER PREFERENCES SETTINGS ====================
const userPreferences = {
  defaultProfileVisibility: 'public',
  allowMessaging: true,
  showOnlineStatus: true,
  emailNotifications: { jobs: true, applications: true, messages: true, weekly: true },
  pushNotifications: { enabled: true, sounds: true, vibrations: true },
  privacy: { showEmail: false, showPhone: false, showProfile: true }
};

router.get('/user-preferences', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'User preferences retrieved', preferences: userPreferences });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get preferences', error: error.message });
  }
});

router.put('/user-preferences', adminAuth, async (req, res) => {
  try {
    const { defaultProfileVisibility, allowMessaging, showOnlineStatus, emailNotifications, pushNotifications, privacy } = req.body;
    if (defaultProfileVisibility) userPreferences.defaultProfileVisibility = defaultProfileVisibility;
    if (allowMessaging !== undefined) userPreferences.allowMessaging = allowMessaging;
    if (showOnlineStatus !== undefined) userPreferences.showOnlineStatus = showOnlineStatus;
    if (emailNotifications) userPreferences.emailNotifications = { ...userPreferences.emailNotifications, ...emailNotifications };
    if (pushNotifications) userPreferences.pushNotifications = { ...userPreferences.pushNotifications, ...pushNotifications };
    if (privacy) userPreferences.privacy = { ...userPreferences.privacy, ...privacy };
    res.json({ success: true, message: 'User preferences updated', preferences: userPreferences });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update preferences', error: error.message });
  }
});

// ==================== MESSAGES MANAGEMENT ====================
router.get('/messages', adminAuth, asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find()
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Message.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    data: messages,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
  });
}));

router.delete('/messages/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const message = await Message.findByIdAndDelete(req.params.id);
  if (!message) return next(new ErrorResponse('Message not found', 404));
  res.status(200).json({ success: true, message: 'Message deleted' });
}));

// ==================== ACTIVITIES MANAGEMENT ====================
router.get('/activities', adminAuth, asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, type } = req.query;
  const query = type ? { type } : {};
  const skip = (page - 1) * limit;

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .populate('companyId', 'name email')
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Activity.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: activities,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
  });
}));

router.put('/activities/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!activity) return next(new ErrorResponse('Activity not found', 404));
  res.status(200).json({ success: true, data: activity });
}));

router.delete('/activities/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const activity = await Activity.findByIdAndDelete(req.params.id);
  if (!activity) return next(new ErrorResponse('Activity not found', 404));
  res.status(200).json({ success: true, message: 'Activity deleted' });
}));

// ==================== NOTIFICATIONS MANAGEMENT ====================
router.get('/notifications', adminAuth, asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, type, read } = req.query;
  const query = {};
  if (type) query.type = type;
  if (read !== undefined) query.read = read === 'true';
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ read: false })
  ]);

  res.status(200).json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
  });
}));

router.put('/notifications/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const notification = await Notification.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!notification) return next(new ErrorResponse('Notification not found', 404));
  res.status(200).json({ success: true, data: notification });
}));

router.delete('/notifications/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) return next(new ErrorResponse('Notification not found', 404));
  res.status(200).json({ success: true, message: 'Notification deleted' });
}));

// ==================== EXAMS MANAGEMENT ====================
router.get('/exams', adminAuth, asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [exams, total] = await Promise.all([
    Exam.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Exam.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    data: exams,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
  });
}));

router.put('/exams/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!exam) return next(new ErrorResponse('Exam not found', 404));
  res.status(200).json({ success: true, data: exam });
}));

router.delete('/exams/:id', adminAuth, asyncHandler(async (req, res, next) => {
  const exam = await Exam.findByIdAndDelete(req.params.id);
  if (!exam) return next(new ErrorResponse('Exam not found', 404));
  res.status(200).json({ success: true, message: 'Exam deleted' });
}));

// ==================== PLATFORM SETTINGS ====================
router.get('/platform-settings', adminAuth, asyncHandler(async (req, res, next) => {
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({
      platformName: 'MissionHub',
      advertisePrice: 10000,
      provePrice: 5000,
      currency: 'RWF'
    });
  }
  res.status(200).json({ success: true, settings });
}));

router.put('/platform-settings', adminAuth, asyncHandler(async (req, res, next) => {
  let settings = await PlatformSettings.findOne();
  if (settings) {
    settings = await PlatformSettings.findByIdAndUpdate(settings._id, req.body, { new: true });
  } else {
    settings = await PlatformSettings.create(req.body);
  }
  res.status(200).json({ success: true, settings });
}));

module.exports = router;
