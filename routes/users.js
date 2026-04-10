const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

// Import middleware
const { protect } = require('../middleware/auth');

// Get all users (for messaging - limited info)
router.get('/', protect, async (req, res) => {
  try {
    const { role, search } = req.query;
    
    let query = {};
    
    // Filter by user type
    if (role === 'jobSeeker') {
      query.userType = 'jobSeeker';
    } else if (role === 'company') {
      query.userType = 'company';
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('name email userType company avatar createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: users
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

// Get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Merge profile data to ensure all fields are available at top level for convenience
    const userData = user.toObject();
    
    // Also set top-level fields from profile for convenience
    if (userData.profile) {
      userData.phone = userData.profile.phone;
      userData.location = userData.profile.location;
      userData.title = userData.profile.title;
      userData.bio = userData.profile.bio;
      userData.skills = userData.profile.skills || [];
      userData.experience = userData.profile.experience;
      userData.education = userData.profile.education;
      userData.linkedin = userData.profile.linkedin;
      userData.github = userData.profile.github;
      userData.portfolio = userData.profile.portfolio;
      userData.yearsOfExperience = userData.profile.yearsOfExperience;
      userData.desiredSalary = userData.profile.desiredSalary;
      userData.resume = userData.profile.resume;
      userData.profile = userData.profile; // Keep original profile object
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: userData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/me', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const {
      name,
      email,
      phone,
      location,
      bio,
      skills,
      experience,
      education,
      preferredJobType,
      salaryExpectation,
      linkedin,
      github,
      portfolio,
      title,
      industry,
      company,
      yearsOfExperience,
      currentSalary,
      desiredSalary,
      workAuthorization,
      relocation,
      deleteResume
    } = req.body;

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(), 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
    }

    // Handle delete resume request
    if (deleteResume) {
      await User.findByIdAndUpdate(userId, { $unset: { 'profile.resume': 1 } });
      const user = await User.findById(userId).select('-password');
      return res.json({
        success: true,
        message: 'Resume deleted successfully',
        data: user
      });
    }

    // Build update data - store ALL profile fields in the profile object
    const updateData = {
      name,
      email: email ? email.toLowerCase().trim() : undefined,
    };

    // Build profile object with all fields - ALWAYS include fields (even if empty)
    const profileData = {};
    
    // Store all fields directly
    profileData.phone = phone || '';
    profileData.location = location || '';
    profileData.bio = bio || '';
    profileData.skills = Array.isArray(skills) ? skills : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);
    profileData.experience = experience || '';
    profileData.education = education || '';
    profileData.preferredJobType = preferredJobType || '';
    profileData.salaryExpectation = salaryExpectation || '';
    profileData.linkedin = linkedin || '';
    profileData.github = github || '';
    profileData.portfolio = portfolio || '';
    profileData.title = title || '';
    profileData.industry = industry || '';
    profileData.company = company || '';
    profileData.yearsOfExperience = yearsOfExperience || '';
    profileData.currentSalary = currentSalary || '';
    profileData.desiredSalary = desiredSalary || '';
    profileData.workAuthorization = workAuthorization || '';
    profileData.relocation = relocation;

    console.log('Updating profile with data:', JSON.stringify({ name, email, profileData }, null, 2));

    // Always add profile object
    updateData.profile = profileData;

    // Remove undefined values from top level
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    console.log('Final updateData:', JSON.stringify(updateData, null, 2));

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
    
    console.log('Profile updated successfully. Saved data:', JSON.stringify({
      name: user.name,
      email: user.email,
      profile: user.profile
    }, null, 2));
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Upload profile photo
router.post('/profile/photo', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // This would handle file upload - for now, return mock response
    const photoUrl = `/uploads/profiles/${userId}-${Date.now()}.jpg`;

    const user = await User.findByIdAndUpdate(
      userId,
      { 'profile.profilePhoto': photoUrl },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        photoUrl,
        user
      }
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: error.message
    });
  }
});

// Upload resume
router.post('/profile/resume', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { name, url, size, type } = req.body;

    const resumeData = {
      name,
      url,
      uploadDate: new Date(),
      size,
      type
    };

    // Use raw MongoDB update to bypass mongoose schema validation
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { 'profile.resume': resumeData } }
    );

    const user = await User.findById(userId).select('-password');

    res.json({
      success: true,
      message: 'Resume uploaded successfully',
      data: {
        resume: resumeData,
        user
      }
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload resume',
      error: error.message
    });
  }
});

// Change password
router.put('/password', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Get user's applications
router.get('/applications', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const applications = await Application.find({ userId })
      .populate('jobId', 'title company location type salary')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Applications retrieved successfully',
      data: applications
    });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve applications',
      error: error.message
    });
  }
});

// Get user's saved jobs
router.get('/saved-jobs', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // For now, return empty array - would implement saved jobs functionality
    res.json({
      success: true,
      message: 'Saved jobs retrieved successfully',
      data: []
    });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve saved jobs',
      error: error.message
    });
  }
});

// Save/unsave job
router.post('/saved-jobs/:jobId', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { jobId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // For now, just return success - would implement saved jobs functionality
    res.json({
      success: true,
      message: 'Job saved successfully'
    });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save job',
      error: error.message
    });
  }
});

// Delete user account
router.delete('/account', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Delete user and related data
    await Promise.all([
      User.findByIdAndDelete(userId),
      Application.deleteMany({ userId }),
      // Would also delete messages, notifications, etc.
    ]);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
});

// Get user statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const [
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications
    ] = await Promise.all([
      Application.countDocuments({ userId }),
      Application.countDocuments({ userId, status: 'pending' }),
      Application.countDocuments({ userId, status: 'approved' }),
      Application.countDocuments({ userId, status: 'rejected' })
    ]);

    const stats = {
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      successRate: totalApplications > 0 ? 
        ((approvedApplications / totalApplications) * 100).toFixed(1) : 0
    };

    res.json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user statistics',
      error: error.message
    });
  }
});

module.exports = router;