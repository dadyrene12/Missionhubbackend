const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const aiMatchingService = require('../services/aiMatchingService');
const aiScreeningService = require('../services/aiScreeningService');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

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

// AI Screening Routes
router.post('/screening/screen-candidate', protect, async (req, res) => {
  try {
    const { applicationId } = req.body;
    
    console.log('[AI Screening] Screen request for:', applicationId);
    
    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    const application = await Application.findById(applicationId)
      .populate('userId', 'name email profile profilePhoto');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    let job;
    if (application.jobId) {
      job = await Job.findById(application.jobId);
    }
    
    if (!job) {
      // If no job found, create a minimal job object for screening
      job = {
        title: 'Position',
        description: '',
        requirements: '',
        responsibilities: '',
        skills: [],
        experience: '',
        education: '',
        salaryMin: 0,
        salaryMax: 0,
        location: '',
        type: 'Full-time',
        benefits: ''
      };
    }

    console.log('[AI Screening] Screening candidate for job:', job.title);

    const screeningResult = await aiScreeningService.screenCandidate(application, job);

    await Application.findByIdAndUpdate(applicationId, {
      aiScreening: screeningResult,
      screenedAt: new Date()
    });

    res.json({
      success: true,
      screening: screeningResult
    });

  } catch (error) {
    console.error('[AI Screening] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error screening candidate: ' + error.message
    });
  }
});

router.post('/screening/screen-job-candidates', protect, async (req, res) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    const job = await Job.findOne({ _id: jobId, postedBy: req.user._id });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or access denied'
      });
    }

    const applications = await Application.find({ jobId })
      .populate('userId', 'name email profile profilePhoto');

    if (applications.length === 0) {
      return res.json({
        success: true,
        message: 'No applicants found for this job',
        results: []
      });
    }

    const results = await aiScreeningService.batchScreenCandidates(applications, job);

    for (const result of results) {
      const app = applications.find(a => 
        a._id.toString() === result.candidateId || 
        a.userId?._id?.toString() === result.candidateId
      );
      if (app) {
        await Application.findByIdAndUpdate(app._id, {
          aiScreening: result,
          screenedAt: new Date()
        });
      }
    }

    res.json({
      success: true,
      jobId: job._id,
      jobTitle: job.title,
      totalApplicants: applications.length,
      results: results
    });

  } catch (error) {
    console.error('Batch screening error:', error);
    res.status(500).json({
      success: false,
      message: 'Error batch screening candidates: ' + error.message
    });
  }
});

router.post('/screening/analyze-resume', protect, async (req, res) => {
  try {
    const { applicationId, jobId } = req.body;
    
    let resumeText = '';
    let jobSkills = [];
    
    if (applicationId) {
      const application = await Application.findById(applicationId);
      if (application) {
        resumeText = application.resume || application.coverLetter || '';
      }
    }
    
    if (jobId) {
      const job = await Job.findById(jobId);
      if (job) {
        jobSkills = job.skills || [];
      }
    }

    const analysis = await aiScreeningService.analyzeResumeQuality(resumeText, jobSkills);

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Resume analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing resume: ' + error.message
    });
  }
});

router.post('/screening/generate-job-description', protect, async (req, res) => {
  try {
    const { companyInfo, requirements } = req.body;
    
    if (!requirements) {
      return res.status(400).json({
        success: false,
        message: 'Job requirements are required'
      });
    }

    const company = companyInfo || {
      name: req.user.name,
      description: '',
      industry: 'Technology',
      companySize: '11-50'
    };

    const generated = await aiScreeningService.generateJobDescription(company, requirements);

    res.json({
      success: true,
      generated
    });

  } catch (error) {
    console.error('Generate job description error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating job description: ' + error.message
    });
  }
});

router.get('/screening/stats', protect, async (req, res) => {
  try {
    const { jobId } = req.query;
    
    let filter = {};
    
    if (jobId && jobId !== 'all') {
      try {
        filter.jobId = jobId;
      } catch (e) {
        // Invalid jobId, return empty stats
      }
    }
    
    const screenedApplications = await Application.find({
      ...filter,
      aiScreening: { $exists: true }
    })
    .populate('userId', 'name');
    
    const stats = {
      totalScreened: screenedApplications.length,
      averageScore: 0,
      scoreDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      },
      topCandidates: []
    };

    if (screenedApplications.length > 0) {
      const scores = screenedApplications
        .map(app => app.aiScreening?.overallScore || 0)
        .filter(score => score > 0);
      
      if (scores.length > 0) {
        stats.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        stats.scoreDistribution.excellent = scores.filter(s => s >= 85).length;
        stats.scoreDistribution.good = scores.filter(s => s >= 70 && s < 85).length;
        stats.scoreDistribution.fair = scores.filter(s => s >= 50 && s < 70).length;
        stats.scoreDistribution.poor = scores.filter(s => s < 50).length;
      }

      stats.topCandidates = screenedApplications
        .filter(app => app.aiScreening?.overallScore >= 70)
        .sort((a, b) => (b.aiScreening?.overallScore || 0) - (a.aiScreening?.overallScore || 0))
        .slice(0, 5)
        .map(app => ({
          applicationId: app._id,
          candidateName: app.userId?.name || 'Unknown',
          score: app.aiScreening?.overallScore || 0,
          strengths: (app.aiScreening?.strengths || []).slice(0, 2),
          screenedAt: app.aiScreening?.screenedAt
        }));
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Screening stats error:', error);
    res.json({
      success: true,
      stats: {
        totalScreened: 0,
        averageScore: 0,
        scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        topCandidates: []
      }
    });
  }
});

router.get('/screening/candidate/:applicationId', protect, async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const application = await Application.findById(applicationId)
      .populate('userId', 'name email profile profilePhoto')
      .populate('jobId', 'title');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const screening = application.aiScreening || null;

    res.json({
      success: true,
      application,
      screening
    });

  } catch (error) {
    console.error('Get screening error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching screening: ' + error.message
    });
  }
});

router.post('/analyze-jobs', protect, async (req, res) => {
  try {
    const adminUser = req.user;
    
    if (adminUser.userType !== 'super_admin' && adminUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { minMatchScore = 50, limit = 50 } = req.body;

    const users = await User.find({ userType: 'jobSeeker', isActive: true })
      .select('name email profile aiNotifications')
      .limit(100);

    const jobs = await Job.find({ status: 'active' })
      .populate('postedBy', 'name companyName')
      .limit(limit);

    let totalNotifications = 0;
    let totalMatches = 0;

    for (const user of users) {
      const userSkills = user.profile?.skills || [];
      const userExperience = user.profile?.experience || '';
      const userTitle = user.profile?.title || '';

      if (userSkills.length === 0 && !userExperience) continue;

      const userApplications = await Application.find({ userId: user._id });
      const appliedJobIds = userApplications.map(app => app.jobId.toString());
      const availableJobs = jobs.filter(job => !appliedJobIds.includes(job._id.toString()));

      if (availableJobs.length === 0) continue;

      for (const job of availableJobs.slice(0, 10)) {
        const jobSkills = job.skills || [];
        const jobExperience = job.experience || '';
        const jobTitle = job.title || '';

        const userSkillsLower = userSkills.map(s => s.toLowerCase());
        const jobSkillsLower = jobSkills.map(s => s.toLowerCase());
        
        const skillsMatch = userSkillsLower.some(skill => jobSkillsLower.includes(skill));
        const experienceMatch = userExperience && jobExperience && 
          (userExperience.toLowerCase().includes(jobExperience.toLowerCase()) ||
           jobExperience.toLowerCase().includes(userExperience.toLowerCase()));

        if (skillsMatch || experienceMatch) {
          totalMatches++;
          
          const matchType = skillsMatch && experienceMatch ? 'both' : skillsMatch ? 'skills' : 'experience';
          const matchScore = skillsMatch && experienceMatch ? 90 : 70;

          await Notification.create({
            userId: user._id,
            type: 'ai_job_match',
            title: 'Job Match Found!',
            message: `We found a job that matches your profile: ${job.title} at ${job.postedBy?.companyName || 'a company'}. Your ${matchType} match this job requirements.`,
            priority: 'normal',
            senderId: adminUser._id,
            senderType: 'system',
            jobDetails: {
              title: job.title,
              jobId: job._id,
              company: job.postedBy?.companyName || '',
              status: 'active',
              salary: job.salaryMax ? `${job.salaryMin}-${job.salaryMax}` : '',
              location: job.location || ''
            }
          });

          totalNotifications++;
        }
      }
    }

    res.json({
      success: true,
      message: `Analyzed ${users.length} users against ${jobs.length} jobs`,
      results: {
        totalUsers: users.length,
        totalJobs: jobs.length,
        totalMatches,
        notificationsSent: totalNotifications
      }
    });

  } catch (error) {
    console.error('Analyze all jobs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
