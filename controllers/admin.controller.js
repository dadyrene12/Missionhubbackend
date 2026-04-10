const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Company = require('../models/Company');
const Payment = require('../models/Payment');
const Activity = require('../models/Activity');
const Exam = require('../models/Exam');
const Interview = require('../models/Interview');
const Subscription = require('../models/Subscription');
const Advertisement = require('../models/Advertisement');
const PlatformSettings = require('../models/PlatformSettings');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const stats = await Promise.all([
    User.countDocuments({ userType: 'jobSeeker' }),
    User.countDocuments({ userType: 'company' }),
    Job.countDocuments({ status: 'active' }),
    Application.countDocuments(),
    Job.countDocuments(),
    User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]),
    Job.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  const newUsersThisWeek = stats[5][0]?.count || 0;
  const newJobsThisWeek = stats[6][0]?.count || 0;
  const revenueThisMonth = stats[7][0]?.total || 0;

  res.status(200).json({
    success: true,
    data: {
      totalJobSeekers: stats[0],
      totalCompanies: stats[1],
      activeJobs: stats[2],
      totalApplications: stats[3],
      totalJobs: stats[4],
      newUsersThisWeek,
      newJobsThisWeek,
      revenueThisMonth
    }
  });
});

exports.getUsers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, userType, isVerified, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (userType) query.userType = userType;
  if (isVerified !== undefined) query.isVerified = isVerified === 'true';
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: users
  });
});

exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({ success: true, data: user });
});

exports.createUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, userType, role, permissions } = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ErrorResponse('User with this email already exists', 400));
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    userType: userType || 'jobSeeker',
    role: role || userType,
    permissions: permissions || [],
    isVerified: true,
    isActive: true
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      role: user.role
    }
  });
});

exports.updateUser = asyncHandler(async (req, res, next) => {
  const { name, email, userType, role, permissions, isActive, isVerified, profile } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    return next(new ErrorResponse('Cannot modify super admin', 403));
  }

  const updateData = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email.toLowerCase();
  if (userType) updateData.userType = userType;
  if (role) updateData.role = role;
  if (permissions) updateData.permissions = permissions;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (isVerified !== undefined) updateData.isVerified = isVerified;
  if (profile) updateData.profile = { ...user.profile.toObject(), ...profile };

  const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  }).select('-password');

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: updatedUser
  });
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (user.role === 'super_admin') {
    return next(new ErrorResponse('Cannot delete super admin', 403));
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});

exports.toggleUserStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (user.role === 'super_admin') {
    return next(new ErrorResponse('Cannot modify super admin status', 403));
  }

  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { isActive: user.isActive }
  });
});

exports.getJobs = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, status, category, type, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) query.status = status;
  if (category) query.category = category;
  if (type) query.type = type;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [jobs, total] = await Promise.all([
    Job.find(query)
      .populate('postedBy', 'name email profile')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Job.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: jobs.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: jobs
  });
});

exports.getJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id)
    .populate('postedBy', 'name email profile')
    .lean();
  
  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({ success: true, data: job });
});

exports.updateJob = asyncHandler(async (req, res, next) => {
  let job = await Job.findById(req.params.id);

  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }

  job = await Job.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('postedBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Job updated successfully',
    data: job
  });
});

exports.deleteJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findByIdAndDelete(req.params.id);

  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Job deleted successfully'
  });
});

exports.getApplications = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, status, jobId, companyId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) query.status = status;
  if (jobId) query.jobId = jobId;
  if (companyId) query.companyId = companyId;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [applications, total] = await Promise.all([
    Application.find(query)
      .populate('jobId', 'title company')
      .populate('userId', 'name email profile')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Application.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: applications.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: applications
  });
});

exports.getApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id)
    .populate('jobId', 'title company description')
    .populate('userId', 'name email profile')
    .lean();
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({ success: true, data: application });
});

exports.updateApplication = asyncHandler(async (req, res, next) => {
  let application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }

  application = await Application.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('jobId', 'title company').populate('userId', 'name email');

  res.status(200).json({
    success: true,
    message: 'Application updated successfully',
    data: application
  });
});

exports.deleteApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findByIdAndDelete(req.params.id);

  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Application deleted successfully'
  });
});

exports.getCompanies = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, verified, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = { userType: 'company' };
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'profile.companyName': { $regex: search, $options: 'i' } }
    ];
  }
  
  if (verified !== undefined) query.isVerified = verified === 'true';

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [companies, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: companies.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: companies
  });
});

exports.getCompany = asyncHandler(async (req, res, next) => {
  const company = await User.findById(req.params.id)
    .select('-password')
    .populate('profile')
    .lean();
  
  if (!company || (company.userType !== 'company' && company.role !== 'company')) {
    return next(new ErrorResponse(`Company not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({ success: true, data: company });
});

exports.verifyCompany = asyncHandler(async (req, res, next) => {
  const company = await User.findById(req.params.id);
  
  if (!company) {
    return next(new ErrorResponse(`Company not found with id of ${req.params.id}`, 404));
  }

  company.isVerified = true;
  await company.save();

  res.status(200).json({
    success: true,
    message: 'Company verified successfully',
    data: { isVerified: true }
  });
});

exports.unverifyCompany = asyncHandler(async (req, res, next) => {
  const company = await User.findById(req.params.id);
  
  if (!company) {
    return next(new ErrorResponse(`Company not found with id of ${req.params.id}`, 404));
  }

  company.isVerified = false;
  await company.save();

  res.status(200).json({
    success: true,
    message: 'Company verification removed',
    data: { isVerified: false }
  });
});

exports.getActivities = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, type, promoted, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (type) query.type = type;
  if (promoted !== undefined) query.promoted = promoted === 'true';

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .populate('companyId', 'name email')
      .populate('postedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Activity.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: activities.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: activities
  });
});

exports.updateActivity = asyncHandler(async (req, res, next) => {
  let activity = await Activity.findById(req.params.id);

  if (!activity) {
    return next(new ErrorResponse(`Activity not found with id of ${req.params.id}`, 404));
  }

  activity = await Activity.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('companyId', 'name email');

  res.status(200).json({
    success: true,
    message: 'Activity updated successfully',
    data: activity
  });
});

exports.deleteActivity = asyncHandler(async (req, res, next) => {
  const activity = await Activity.findByIdAndDelete(req.params.id);

  if (!activity) {
    return next(new ErrorResponse(`Activity not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Activity deleted successfully'
  });
});

exports.getExams = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) query.status = status;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [exams, total] = await Promise.all([
    Exam.find(query)
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Exam.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: exams.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: exams
  });
});

exports.updateExam = asyncHandler(async (req, res, next) => {
  let exam = await Exam.findById(req.params.id);

  if (!exam) {
    return next(new ErrorResponse(`Exam not found with id of ${req.params.id}`, 404));
  }

  exam = await Exam.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    message: 'Exam updated successfully',
    data: exam
  });
});

exports.deleteExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findByIdAndDelete(req.params.id);

  if (!exam) {
    return next(new ErrorResponse(`Exam not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Exam deleted successfully'
  });
});

exports.getPayments = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, status, type, gateway, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (status) query.status = status;
  if (type) query.type = type;
  if (gateway) query.gateway = gateway;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [payments, total, revenueStats] = await Promise.all([
    Payment.find(query)
      .populate('companyId', 'name email')
      .populate('userId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Payment.countDocuments(query),
    Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  res.status(200).json({
    success: true,
    count: payments.length,
    total,
    totalRevenue: revenueStats[0]?.total || 0,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: payments
  });
});

exports.updatePayment = asyncHandler(async (req, res, next) => {
  let payment = await Payment.findById(req.params.id);

  if (!payment) {
    return next(new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404));
  }

  payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('companyId', 'name email');

  res.status(200).json({
    success: true,
    message: 'Payment updated successfully',
    data: payment
  });
});

exports.getAdvertisements = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, status, active, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (status) query.status = status;
  if (active !== undefined) query.isActive = active === 'true';

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [ads, total] = await Promise.all([
    Advertisement.find(query)
      .populate('companyId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Advertisement.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: ads.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: ads
  });
});

exports.updateAdvertisement = asyncHandler(async (req, res, next) => {
  let ad = await Advertisement.findById(req.params.id);

  if (!ad) {
    return next(new ErrorResponse(`Advertisement not found with id of ${req.params.id}`, 404));
  }

  ad = await Advertisement.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('companyId', 'name email');

  res.status(200).json({
    success: true,
    message: 'Advertisement updated successfully',
    data: ad
  });
});

exports.deleteAdvertisement = asyncHandler(async (req, res, next) => {
  const ad = await Advertisement.findByIdAndDelete(req.params.id);

  if (!ad) {
    return next(new ErrorResponse(`Advertisement not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Advertisement deleted successfully'
  });
});

exports.getSubscriptions = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, status, plan, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  
  if (status) query['subscription.status'] = status;
  if (plan) query['subscription.plan'] = plan;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [subscriptions, total] = await Promise.all([
    User.find({ userType: 'company', ...query })
      .select('name email profile subscription')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments({ userType: 'company', ...query })
  ]);

  res.status(200).json({
    success: true,
    count: subscriptions.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: subscriptions
  });
});

exports.updateSubscription = asyncHandler(async (req, res, next) => {
  const { plan, status, endDate } = req.body;

  const user = await User.findById(req.params.id);
  
  if (!user || (user.userType !== 'company' && user.role !== 'company')) {
    return next(new ErrorResponse(`Company not found with id of ${req.params.id}`, 404));
  }

  const updateData = {};
  if (plan) updateData['subscription.plan'] = plan;
  if (status) updateData['subscription.status'] = status;
  if (endDate) updateData['subscription.endDate'] = new Date(endDate);
  if (!endDate && plan) updateData['subscription.startDate'] = new Date();

  const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  }).select('name email subscription');

  res.status(200).json({
    success: true,
    message: 'Subscription updated successfully',
    data: updatedUser
  });
});

exports.getPlatformSettings = asyncHandler(async (req, res, next) => {
  const settings = await PlatformSettings.getSettings();

  res.status(200).json({
    success: true,
    data: settings
  });
});

exports.updatePlatformSettings = asyncHandler(async (req, res, next) => {
  const settings = await PlatformSettings.updateSettings(req.body, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Platform settings updated successfully',
    data: settings
  });
});

exports.getSystemStats = asyncHandler(async (req, res, next) => {
  const stats = await Promise.all([
    User.countDocuments(),
    Job.countDocuments(),
    Application.countDocuments(),
    Payment.countDocuments({ status: 'completed' }),
    Activity.countDocuments(),
    Exam.countDocuments(),
    Advertisement.countDocuments(),
    User.aggregate([
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]),
    Job.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers: stats[0],
      totalJobs: stats[1],
      totalApplications: stats[2],
      totalPayments: stats[3],
      totalActivities: stats[4],
      totalExams: stats[5],
      totalAdvertisements: stats[6],
      userTypes: stats[7],
      jobStatuses: stats[8],
      applicationStatuses: stats[9],
      revenueStats: stats[10][0] || { total: 0, count: 0 }
    }
  });
});

exports.getSystemLogs = asyncHandler(async (req, res, next) => {
  const logs = [
    { timestamp: new Date(), level: 'info', message: 'System running' },
    { timestamp: new Date(), level: 'info', message: 'Admin dashboard accessed' }
  ];
  
  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs
  });
});

exports.getNotifications = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, read, type } = req.query;

  const query = {};
  
  if (read !== undefined) query.read = read === 'true';
  if (type) query.type = type;

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: notifications
  });
});

exports.sendNotification = asyncHandler(async (req, res, next) => {
  const { userId, type, title, message, priority, jobDetails, messageDetails, actions, relatedId, relatedType } = req.body;

  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    priority: priority || 'normal',
    jobDetails: jobDetails || {},
    messageDetails: messageDetails || {},
    actions: actions || [],
    relatedId,
    relatedType,
    read: false
  });

  res.status(201).json({
    success: true,
    message: 'Notification sent successfully',
    data: notification
  });
});

exports.broadcastNotification = asyncHandler(async (req, res, next) => {
  const { type, title, message, priority, userType } = req.body;

  const query = userType ? { userType } : {};
  const users = await User.find(query).select('_id').lean();

  const notifications = await Promise.all(
    users.map(user => 
      Notification.create({
        userId: user._id,
        type,
        title,
        message,
        priority: priority || 'normal',
        read: false
      })
    )
  );

  res.status(201).json({
    success: true,
    message: `Notification sent to ${notifications.length} users`,
    data: { count: notifications.length }
  });
});

exports.getMessages = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, senderId, receiverId } = req.query;

  const query = {};
  if (senderId) query.sender = senderId;
  if (receiverId) query.receiver = receiverId;

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Message.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: messages
  });
});

exports.deleteMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.findByIdAndDelete(req.params.id);

  if (!message) {
    return next(new ErrorResponse(`Message not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully'
  });
});

exports.getInterviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, status, type } = req.query;

  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;

  const skip = (page - 1) * limit;

  const [interviews, total] = await Promise.all([
    Interview.find(query)
      .populate('applicationId', 'jobId userId')
      .populate('scheduledBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Interview.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: interviews.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: interviews
  });
});

exports.updateInterview = asyncHandler(async (req, res, next) => {
  let interview = await Interview.findById(req.params.id);

  if (!interview) {
    return next(new ErrorResponse(`Interview not found with id of ${req.params.id}`, 404));
  }

  interview = await Interview.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    message: 'Interview updated successfully',
    data: interview
  });
});

exports.getAllAnalytics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const dateQuery = {};
  if (startDate) dateQuery.$gte = new Date(startDate);
  if (endDate) dateQuery.$lte = new Date(endDate);

  const userStats = await User.aggregate([
    { $match: Object.keys(dateQuery).length ? { createdAt: dateQuery } : {} },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  const jobStats = await Job.aggregate([
    { $match: Object.keys(dateQuery).length ? { createdAt: dateQuery } : {} },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  const applicationStats = await Application.aggregate([
    { $match: Object.keys(dateQuery).length ? { createdAt: dateQuery } : {} },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      userRegistrationTrend: userStats,
      jobPostingTrend: jobStats,
      applicationTrend: applicationStats
    }
  });
});
