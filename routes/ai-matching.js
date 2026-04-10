const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const aiMatchingService = require('../services/aiMatchingService');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Get personalized job recommendations for a user
router.get('/recommendations/jobs', protect, async (req, res) => {
  try {
    const { limit = 10, category, location } = req.query;
    const userId = req.user._id;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build job filters
    const jobFilters = { 
      status: 'active',
      postedBy: { $ne: userId } // Exclude user's own jobs
    };

    if (category) jobFilters.category = category;
    if (location) jobFilters.location = new RegExp(location, 'i');

    // Get available jobs
    const jobs = await Job.find(jobFilters)
      .populate('postedBy', 'name companyName logo')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get user's applications to exclude already applied jobs
    const applications = await Application.find({ userId });
    const appliedJobIds = applications.map(app => app.jobId.toString());

    // Filter out already applied jobs
    const availableJobs = jobs.filter(job => !appliedJobIds.includes(job._id.toString()));

    // Get AI-powered recommendations
    const recommendations = await aiMatchingService.findBestMatches(user, availableJobs, parseInt(limit));

    // Enhance recommendations with additional data
    const enhancedRecommendations = recommendations.map(rec => ({
      ...rec.job.toObject(),
      matchScore: rec.match.overallScore,
      matchBreakdown: rec.match.breakdown,
      recommendation: rec.match.recommendation,
      strengths: rec.match.strengths,
      gaps: rec.match.gaps,
      suggestions: aiMatchingService.generateRecommendations(rec.match)
    }));

    res.json({
      success: true,
      recommendations: enhancedRecommendations,
      total: enhancedRecommendations.length
    });

  } catch (error) {
    console.error('Get job recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recommendations'
    });
  }
});

// Get candidate recommendations for a job (for companies)
router.get('/recommendations/candidates/:jobId', protect, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 10 } = req.query;
    const companyId = req.user._id;

    // Verify job belongs to the company
    const job = await Job.findOne({ _id: jobId, postedBy: companyId });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or access denied'
      });
    }

    // Get candidates who have applied to this job
    const applications = await Application.find({ jobId })
      .populate('userId', 'name email profile');

    const candidates = applications.map(app => app.userId);

    // Get AI-powered candidate recommendations
    const recommendations = await aiMatchingService.findBestCandidates(job, candidates, parseInt(limit));

    // Enhance recommendations with additional data
    const enhancedRecommendations = recommendations.map(rec => ({
      ...rec.candidate.toObject(),
      matchScore: rec.match.overallScore,
      matchBreakdown: rec.match.breakdown,
      recommendation: rec.match.recommendation,
      strengths: rec.match.strengths,
      gaps: rec.match.gaps,
      application: applications.find(app => app.userId.toString() === rec.candidate._id.toString())
    }));

    res.json({
      success: true,
      recommendations: enhancedRecommendations,
      total: enhancedRecommendations.length
    });

  } catch (error) {
    console.error('Get candidate recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidate recommendations'
    });
  }
});

// Calculate match score for specific job and user
router.post('/match-score', protect, async (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.user._id;

    // Get job details
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate match score
    const matchResult = aiMatchingService.calculateMatchScore(user, job);

    res.json({
      success: true,
      matchResult,
      recommendations: aiMatchingService.generateRecommendations(matchResult)
    });

  } catch (error) {
    console.error('Calculate match score error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating match score'
    });
  }
});

// Get skill gap analysis
router.get('/skill-gap/:jobId', protect, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user._id;

    // Get job details
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate match and extract skill gap information
    const matchResult = aiMatchingService.calculateMatchScore(user, job);
    const skillGap = matchResult.gaps.find(gap => gap.area === 'skills');

    // Get learning resources recommendations
    const learningResources = await getLearningResources(skillGap?.suggestions || []);

    res.json({
      success: true,
      skillGap,
      learningResources,
      improvementPlan: generateImprovementPlan(matchResult.gaps)
    });

  } catch (error) {
    console.error('Skill gap analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while analyzing skill gap'
    });
  }
});

// Get market insights for a skill or category
router.get('/market-insights', async (req, res) => {
  try {
    const { skill, category, location } = req.query;

    // Build filter for market analysis
    const filter = { status: 'active' };
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(location, 'i');

    const jobs = await Job.find(filter);
    const totalJobs = jobs.length;

    // Analyze demand for specific skill
    let skillDemand = 0;
    let skillJobs = [];
    
    if (skill) {
      skillJobs = jobs.filter(job => job.skills && job.skills.includes(skill));
      skillDemand = totalJobs > 0 ? (skillJobs.length / totalJobs) * 100 : 0;
    }

    // Calculate average salary ranges
    const salaryRanges = {
      min: 0,
      max: 0,
      average: 0
    };

    const jobsWithSalary = jobs.filter(job => job.salaryMin && job.salaryMax);
    if (jobsWithSalary.length > 0) {
      salaryRanges.min = Math.min(...jobsWithSalary.map(job => job.salaryMin));
      salaryRanges.max = Math.max(...jobsWithSalary.map(job => job.salaryMax));
      salaryRanges.average = jobsWithSalary.reduce((sum, job) => sum + (job.salaryMin + job.salaryMax) / 2, 0) / jobsWithSalary.length;
    }

    // Experience level distribution
    const experienceDistribution = {};
    jobs.forEach(job => {
      const level = job.experience || 'not_specified';
      experienceDistribution[level] = (experienceDistribution[level] || 0) + 1;
    });

    // Top companies hiring
    const companyHiring = {};
    jobs.forEach(job => {
      const company = job.company || 'Unknown';
      companyHiring[company] = (companyHiring[company] || 0) + 1;
    });

    const topCompanies = Object.entries(companyHiring)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([company, count]) => ({ company, jobCount: count }));

    res.json({
      success: true,
      insights: {
        totalJobs,
        skillDemand,
        skillJobsCount: skillJobs.length,
        salaryRanges,
        experienceDistribution,
        topCompanies,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Market insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching market insights'
    });
  }
});

// Helper function to get learning resources
async function getLearningResources(suggestions) {
  // Mock data - in production, this would integrate with learning platforms
  const resources = [
    {
      title: 'Advanced JavaScript Course',
      provider: 'Tech Academy',
      duration: '8 weeks',
      level: 'Intermediate',
      rating: 4.8,
      url: '#'
    },
    {
      title: 'React Development Bootcamp',
      provider: 'Code Institute',
      duration: '12 weeks',
      level: 'Beginner to Advanced',
      rating: 4.9,
      url: '#'
    }
  ];

  return resources.filter(resource => 
    suggestions.some(suggestion => 
      resource.title.toLowerCase().includes(suggestion.toLowerCase()) ||
      suggestion.toLowerCase().includes('course') ||
      suggestion.toLowerCase().includes('learn')
    )
  );
}

// Helper function to generate improvement plan
function generateImprovementPlan(gaps) {
  const plan = {
    immediate: [],
    shortTerm: [],
    longTerm: []
  };

  gaps.forEach(gap => {
    switch (gap.area) {
      case 'skills':
        plan.immediate.push('Focus on acquiring key missing skills through online courses');
        plan.shortTerm.push('Work on personal projects to practice new skills');
        break;
      case 'experience':
        plan.shortTerm.push('Seek internship or junior positions to gain experience');
        plan.longTerm.push('Aim for leadership roles in current position');
        break;
      case 'education':
        plan.immediate.push('Consider relevant certifications');
        plan.longTerm.push('Pursue advanced degree if beneficial for career goals');
        break;
      default:
        plan.immediate.push('Review and update profile information');
    }
  });

  return plan;
}

module.exports = router;
