const Job = require('../models/Job');

// @desc    Get all jobs
// @route   GET /api/jobs
exports.getJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ status: 'active' })
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company jobs (FIXED)
// @route   GET /api/jobs/company
exports.getCompanyJobs = async (req, res, next) => {
  try {
    // Ensure user is authenticated (handled by middleware in route)
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Company accounts only.' 
      });
    }
    
    // ✅ REMOVED: Do not validate req.params.id here. 
    // This function is for listing, not fetching a single item.
    
    const jobs = await Job.find({ 
      $or: [
        { companyId: req.user.id },
        { postedBy: req.user.id }
      ]
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
exports.getJob = async (req, res, next) => {
  try {
    // ✅ VALIDATION: Only check ID here in the single job fetcher
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }

    const job = await Job.findById(req.params.id).populate('postedBy', 'name email');
    
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.status(200).json({
      success: true,
      job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new job
// @route   POST /api/jobs
exports.createJob = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.postedBy = req.user.id;
    req.body.companyId = req.user.id;

    const job = await Job.create(req.body);

    res.status(201).json({
      success: true,
      job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
exports.updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Make sure user is job owner
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Make sure user is job owner
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await job.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};