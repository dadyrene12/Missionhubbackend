const User = require('../models/User');
const Job = require('../models/Job');
const asyncHandler = require('../middleware/async');
const ApiResponse = require('../utils/apiResponse');

// @desc    Get company profile and stats
// @route   GET /api/company/profile
// @access  Private (company)
const getCompanyProfile = asyncHandler(async (req, res) => {
  if (req.user.userType !== 'company') {
    return res.status(403).json(ApiResponse.error('Only companies can access this endpoint'));
  }

  // Get company user profile
  const user = await User.findById(req.user.id).select('-password');

  // Get company stats
  const jobs = await Job.countDocuments({ postedBy: req.user.id });
  const applications = await Job.aggregate([
    { $match: { postedBy: req.user.id } },
    { $group: { _id: null, total: { $sum: '$applicants' } } }
  ]);

  res.status(200).json(ApiResponse.success({
    profile: user,
    stats: {
      totalJobs: jobs,
      totalApplicants: applications[0]?.total || 0
    }
  }));
});

module.exports = {
  getCompanyProfile
};

