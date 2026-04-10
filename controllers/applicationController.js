const Application = require('../models/Application');
const Job = require('../models/Job');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get company applications
// @route   GET /api/applications/company
// @access  Private (company)
const getCompanyApplications = asyncHandler(async (req, res) => {
  if (req.user.userType !== 'company') {
    return res.status(403).json(ApiResponse.error('Only companies can access their applications'));
  }

  const jobs = await Job.find({ 
    $or: [
      { postedBy: req.user.id },
      { companyId: req.user.id }
    ]
  });
  const jobIds = jobs.map(job => job._id);

  const applications = await Application.find({ 
    jobId: { $in: jobIds } 
  })
  .populate('jobId')
  .populate('userId', 'name email profile')
  .sort({ createdAt: -1 });

  res.status(200).json(ApiResponse.success({
    count: applications.length,
    applications
  }));
});

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private (company)
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const application = await Application.findById(req.params.id).populate('jobId');
  if (!application) {
    return res.status(404).json(ApiResponse.error('Application not found'));
  }

  // Check authorization via job ownership
  const job = await Job.findById(application.jobId);
  if (job.postedBy.toString() !== req.user.id && job.companyId.toString() !== req.user.id) {
    return res.status(403).json(ApiResponse.error('Not authorized to update this application'));
  }

  application.status = status;
  if (notes !== undefined) application.notes = notes;
  
  await application.save();

  res.status(200).json(ApiResponse.success({
    message: 'Application status updated',
    application
  }));
});

module.exports = {
  getCompanyApplications,
  updateApplicationStatus
};

