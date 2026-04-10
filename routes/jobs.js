const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

// Import models
const Job = require('../models/Job');

// Valid ObjectId check helper
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get all jobs (public)
router.get('/', async (req, res) => {
  try {
    console.log('📋 GET /api/jobs called (from routes/jobs.js)');
    const { page = 1, limit = 10, category, type, experience, location, remote } = req.query;
    
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (type) filter.type = type;
    if (experience) filter.experience = experience;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (remote === 'true') filter.remote = true;

    const jobs = await Job.find(filter)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 10)
      .skip((parseInt(page) - 1) * (parseInt(limit) || 10))
      .lean();
    
    const total = await Job.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      page: parseInt(page) || 1,
      totalPages: Math.ceil(total / (parseInt(limit) || 10)),
      data: jobs
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching jobs',
      data: []
    });
  }
});

// Get company jobs - MUST come before /:id route, only for companies
router.get('/company', protect, async (req, res) => {
  try {
    console.log('🔍 Fetching company jobs for user:', req.user.email);
    
    // Only return jobs posted by this company (use lean() to avoid validation)
    const jobs = await Job.find({ postedBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`📊 Found ${jobs.length} jobs for company`);
    
    res.json({ 
      success: true, 
      message: 'Company jobs retrieved successfully',
      data: jobs
    });
  } catch (error) {
    console.error('Error fetching company jobs:', error);
    res.json({ 
      success: false, 
      message: 'Error fetching company jobs',
      data: []
    });
  }
});

// Get job performance data - for dashboard charts
router.get('/performance', protect, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).lean();
    
    const months = [];
    const jobsPosted = [];
    const applicants = [];
    const views = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(date.toLocaleString('default', { month: 'short' }));
      
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthJobs = jobs.filter(j => {
        const created = new Date(j.createdAt);
        return created >= monthStart && created <= monthEnd;
      });
      
      jobsPosted.push(monthJobs.length);
      applicants.push(monthJobs.reduce((sum, j) => sum + (j.applicants || 0), 0));
      views.push(monthJobs.reduce((sum, j) => sum + (j.views || 0), 0));
    }
    
    res.json({
      success: true,
      data: { months, jobsPosted, applicants, views }
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ success: false, message: 'Error fetching performance data' });
  }
});

// Get single job - MUST come after /company route
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Handle special routes that aren't ObjectIds
  if (!isValidObjectId(id)) {
    return res.json({ 
      success: false, 
      message: 'Invalid job ID',
      data: null
    });
  }
  
  try {
    const job = await Job.findById(id).populate('postedBy', 'name email').lean();
    if (!job) {
      res.json({ 
        success: false, 
        message: 'Job not found',
        data: null
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Job details retrieved',
        data: job
      });
    }
  } catch (error) {
    console.error('Error fetching job:', error);
    res.json({ 
      success: false, 
      message: 'Error fetching job',
      data: null
    });
  }
});

// Create job - Only companies can post jobs
router.post('/', protect, async (req, res) => {
  try {
    console.log('📝 Creating new job:', req.body.title);
    console.log('👤 User:', req.user?.email, 'Type:', req.user?.userType);
    
    // Authorization check - only companies can post jobs
    if (req.user.userType !== 'company' && req.user.role !== 'company_admin') {
      console.log('⛔ Access denied - User is not a company');
      return res.status(403).json({
        success: false,
        message: 'Only company accounts can post jobs. Please use a company account.',
        error: 'UNAUTHORIZED'
      });
    }
    
    const userId = req.user._id;
    
    // Get company name from user profile or use a default
    const companyName = req.body.company || req.user.name || req.user.companyName || 'Company';
    
    // Ensure required fields with defaults
    const jobData = {
      title: req.body.title || '',
      description: req.body.description || '',
      location: req.body.location || '',
      type: req.body.type || 'full-time',
      category: req.body.category || 'technology',
      experience: req.body.experience || 'mid',
      company: companyName,
      salary: req.body.salary || '',
      salaryMin: req.body.salaryMin || 0,
      salaryMax: req.body.salaryMax || 0,
      requirements: req.body.requirements || [],
      benefits: req.body.benefits || [],
      skills: req.body.skills || [],
      status: req.body.status || 'draft',
      remote: req.body.remote || false,
      urgent: req.body.urgent || false,
      postedBy: userId,
      companyId: userId,
      applicants: 0,
      views: 0,
      createdAt: new Date()
    };
    
    if (req.body.deadline) {
      jobData.deadline = req.body.deadline;
    }
    
    const job = await Job.create(jobData);
    
    console.log('✅ Job created successfully:', job._id);
    
    res.json({ 
      success: true, 
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Error creating job',
      data: null
    });
  }
});

// Update job - Only the owner company can update
router.put('/:id', protect, async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).lean();
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: `Job ${jobId} not found`
      });
    }
    
    // Check ownership - only the company that posted the job can update it
    if (job.postedBy && job.postedBy.toString() !== req.user._id.toString()) {
      console.log('⛔ Access denied - User is not the job owner');
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs.'
      });
    }
    
    // Prevent updating postedBy and companyId
    const { postedBy, companyId, ...updateData } = req.body;
    
    const updatedJob = await Job.findByIdAndUpdate(jobId, updateData, { new: true, runValidators: false }).lean();
    
    res.json({ 
      success: true, 
      message: `Job ${jobId} updated successfully`,
      data: updatedJob
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Error updating job',
      data: null
    });
  }
});

// Delete job - Only the owner company can delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).lean();
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: `Job ${jobId} not found`
      });
    }
    
    // Check ownership - only the company that posted the job can delete it (allow if no owner set)
    if (job.postedBy && job.postedBy.toString() !== req.user._id.toString()) {
      console.log('⛔ Access denied - User is not the job owner');
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own jobs.'
      });
    }
    
    await Job.findByIdAndDelete(jobId);
    
    res.json({ 
      success: true, 
      message: `Job ${jobId} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Error deleting job',
      data: null
    });
  }
});

module.exports = router;