const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Get user activities
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    // Users can only access their own activities unless they're admin
    if (req.user._id.toString() !== userId && req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access these activities'
      });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Mock activities data - in production, this would come from a database
    const activities = [
      {
        id: 1,
        type: 'job_application',
        description: 'Applied for Senior Frontend Developer position',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        metadata: {
          jobId: 'job123',
          company: 'Tech Corp',
          status: 'pending'
        }
      },
      {
        id: 2,
        type: 'profile_update',
        description: 'Updated profile skills',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        metadata: {
          skills: ['React', 'Node.js', 'MongoDB']
        }
      },
      {
        id: 3,
        type: 'interview_scheduled',
        description: 'Interview scheduled with Tech Corp',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        metadata: {
          interviewDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          type: 'video'
        }
      }
    ];

    // Filter by type if specified
    const filteredActivities = type 
      ? activities.filter(activity => activity.type === type)
      : activities;

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedActivities = filteredActivities.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      activities: paginatedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredActivities.length,
        pages: Math.ceil(filteredActivities.length / limit)
      }
    });

  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activities'
    });
  }
});

// Get company activities
router.get('/company/:companyId', protect, authorize('company'), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    // Companies can only access their own activities unless they're admin
    if (req.user._id.toString() !== companyId && req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access these activities'
      });
    }

    // Mock company activities data
    const activities = [
      {
        id: 1,
        type: 'job_posted',
        description: 'Posted new job: Senior Frontend Developer',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        metadata: {
          jobId: 'job456',
          applications: 15,
          views: 120
        }
      },
      {
        id: 2,
        type: 'candidate_hired',
        description: 'Hired John Doe for Backend Developer position',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        metadata: {
          candidateId: 'user789',
          position: 'Backend Developer',
          salary: 85000
        }
      },
      {
        id: 3,
        type: 'interview_completed',
        description: 'Completed interview with Jane Smith',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        metadata: {
          candidateId: 'user101',
          position: 'UI Designer',
          rating: 4.5
        }
      }
    ];

    // Filter by type if specified
    const filteredActivities = type 
      ? activities.filter(activity => activity.type === type)
      : activities;

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedActivities = filteredActivities.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      activities: paginatedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredActivities.length,
        pages: Math.ceil(filteredActivities.length / limit)
      }
    });

  } catch (error) {
    console.error('Get company activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activities'
    });
  }
});

// Log activity
router.post('/log', protect, async (req, res) => {
  try {
    const { type, description, metadata = {} } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Activity type and description are required'
      });
    }

    // Create activity log entry
    const activity = {
      userId: req.user._id,
      userType: req.user.userType,
      type,
      description,
      metadata,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // In production, this would be saved to database
    console.log('Activity logged:', activity);

    res.json({
      success: true,
      activity,
      message: 'Activity logged successfully'
    });

  } catch (error) {
    console.error('Log activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while logging activity'
    });
  }
});

// Get activity statistics
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;

    // Mock statistics data
    const stats = {
      totalActivities: 1250,
      userRegistrations: 85,
      jobApplications: 420,
      interviewsScheduled: 65,
      messagesSent: 680,
      profileUpdates: 180,
      timeRange,
      breakdown: {
        byType: [
          { type: 'job_application', count: 420, percentage: 33.6 },
          { type: 'message_sent', count: 680, percentage: 54.4 },
          { type: 'profile_update', count: 180, percentage: 14.4 },
          { type: 'interview_scheduled', count: 65, percentage: 5.2 }
        ],
        byUserType: [
          { userType: 'jobSeeker', count: 850, percentage: 68.0 },
          { userType: 'company', count: 400, percentage: 32.0 }
        ],
        daily: [
          { date: '2024-01-01', count: 180 },
          { date: '2024-01-02', count: 165 },
          { date: '2024-01-03', count: 195 },
          { date: '2024-01-04', count: 210 },
          { date: '2024-01-05', count: 175 },
          { date: '2024-01-06', count: 160 },
          { date: '2024-01-07', count: 165 }
        ]
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activity statistics'
    });
  }
});

// Get activity types
router.get('/types', (req, res) => {
  try {
    const types = [
      { id: 'job_application', name: 'Job Application', description: 'User applied for a job' },
      { id: 'profile_update', name: 'Profile Update', description: 'User updated their profile' },
      { id: 'interview_scheduled', name: 'Interview Scheduled', description: 'Interview was scheduled' },
      { id: 'interview_completed', name: 'Interview Completed', description: 'Interview was completed' },
      { id: 'job_posted', name: 'Job Posted', description: 'Company posted a new job' },
      { id: 'candidate_hired', name: 'Candidate Hired', description: 'Company hired a candidate' },
      { id: 'message_sent', name: 'Message Sent', description: 'User sent a message' },
      { id: 'login', name: 'Login', description: 'User logged in' },
      { id: 'registration', name: 'Registration', description: 'New user registered' }
    ];

    res.json({
      success: true,
      types
    });

  } catch (error) {
    console.error('Get activity types error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activity types'
    });
  }
});

// Delete activity (admin only)
router.delete('/:activityId', protect, authorize('admin'), async (req, res) => {
  try {
    const { activityId } = req.params;

    // In production, this would delete from database
    console.log(`Activity ${activityId} deleted by admin ${req.user._id}`);

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting activity'
    });
  }
});

module.exports = router;
