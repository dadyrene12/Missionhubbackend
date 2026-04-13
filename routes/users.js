const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const { role, search } = req.query;
    
    let query = {};
    
    if (role === 'jobSeeker') {
      query.userType = 'jobSeeker';
    } else if (role === 'company') {
      query.userType = 'company';
    }
    
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

router.get('/me', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user.toProfileJSON();

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
      desiredSalary,
      linkedin,
      github,
      portfolio,
      title,
      industry,
      yearsOfExperience,
      currentSalary,
      workAuthorization,
      relocation,
      preferredLocation,
      remoteWork,
      languages,
      certifications,
      coverLetter,
      availability,
      expectedSalary,
      salaryCurrency,
      nationality,
      dateOfBirth,
      gender,
      experienceDetails,
      educationDetails,
      deleteResume,
      deleteCV,
      resume,
      cv,
      documents,
      profilePhoto
    } = req.body;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

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

    const updateFields = {};
    
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email.toLowerCase().trim();

    const profileUpdates = {};
    
    if (phone !== undefined) profileUpdates['profile.phone'] = phone;
    if (location !== undefined) profileUpdates['profile.location'] = location;
    if (bio !== undefined) profileUpdates['profile.bio'] = bio;
    if (title !== undefined) profileUpdates['profile.title'] = title;
    if (industry !== undefined) profileUpdates['profile.industry'] = industry;
    
    if (skills !== undefined) {
      profileUpdates['profile.skills'] = Array.isArray(skills) 
        ? skills.filter(s => s && s.trim()) 
        : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);
    }
    
    if (experience !== undefined) profileUpdates['profile.experience'] = experience;
    if (education !== undefined) profileUpdates['profile.education'] = education;
    if (preferredJobType !== undefined) profileUpdates['profile.preferredJobType'] = preferredJobType;
    if (desiredSalary !== undefined) profileUpdates['profile.desiredSalary'] = desiredSalary;
    if (currentSalary !== undefined) profileUpdates['profile.currentSalary'] = currentSalary;
    if (expectedSalary !== undefined) profileUpdates['profile.expectedSalary'] = expectedSalary;
    if (salaryCurrency !== undefined) profileUpdates['profile.salaryCurrency'] = salaryCurrency;
    
    if (linkedin !== undefined) profileUpdates['profile.linkedin'] = linkedin;
    if (github !== undefined) profileUpdates['profile.github'] = github;
    if (portfolio !== undefined) profileUpdates['profile.portfolio'] = portfolio;
    if (linkedin !== undefined) profileUpdates['profile.linkedinUrl'] = linkedin;
    if (github !== undefined) profileUpdates['profile.githubUrl'] = github;
    if (portfolio !== undefined) profileUpdates['profile.websiteUrl'] = portfolio;
    
    if (yearsOfExperience !== undefined) profileUpdates['profile.yearsOfExperience'] = yearsOfExperience;
    if (workAuthorization !== undefined) profileUpdates['profile.workAuthorization'] = workAuthorization;
    if (relocation !== undefined) profileUpdates['profile.relocation'] = relocation;
    if (availability !== undefined) profileUpdates['profile.availability'] = availability;
    if (preferredLocation !== undefined) profileUpdates['profile.preferredLocation'] = preferredLocation;
    if (remoteWork !== undefined) profileUpdates['profile.remoteWork'] = remoteWork;
    
    if (languages !== undefined) profileUpdates['profile.languages'] = Array.isArray(languages) ? languages : [];
    if (certifications !== undefined) profileUpdates['profile.certifications'] = Array.isArray(certifications) ? certifications : [];
    if (coverLetter !== undefined) profileUpdates['profile.coverLetter'] = coverLetter;
    
    if (nationality !== undefined) profileUpdates['profile.nationality'] = nationality;
    if (dateOfBirth !== undefined) profileUpdates['profile.dateOfBirth'] = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) profileUpdates['profile.gender'] = gender;
    
    if (experienceDetails !== undefined && Array.isArray(experienceDetails)) {
      profileUpdates['profile.experienceDetails'] = experienceDetails.map(exp => ({
        company: exp.company || '',
        title: exp.title || '',
        location: exp.location || '',
        startDate: exp.startDate ? new Date(exp.startDate) : null,
        endDate: exp.endDate ? new Date(exp.endDate) : null,
        current: exp.current || false,
        description: exp.description || ''
      }));
    }
    
    if (educationDetails !== undefined && Array.isArray(educationDetails)) {
      profileUpdates['profile.educationDetails'] = educationDetails.map(edu => ({
        institution: edu.institution || '',
        degree: edu.degree || '',
        field: edu.field || '',
        startDate: edu.startDate ? new Date(edu.startDate) : null,
        endDate: edu.endDate ? new Date(edu.endDate) : null
      }));
    }

    if (resume !== undefined) profileUpdates['profile.resume'] = resume;
    if (cv !== undefined) profileUpdates['profile.cv'] = cv;
    if (documents !== undefined) profileUpdates['profile.documents'] = documents;
    if (profilePhoto !== undefined) profileUpdates['profile.profilePhoto'] = profilePhoto;

    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates['profile.lastProfileUpdate'] = new Date();
    }

    const allUpdates = { ...updateFields, ...profileUpdates };

    if (deleteResume) {
      allUpdates['profile.resume'] = { name: '', url: '', uploadDate: null, size: '', type: '' };
    }
    
    if (deleteCV) {
      allUpdates['profile.cv'] = { name: '', url: '', uploadDate: null, size: '', type: '' };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: allUpdates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user.toProfileJSON();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userData
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

router.put('/me/batch', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid updates array'
      });
    }

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: userId },
        update: { $set: update }
      }
    }));

    await User.collection.bulkWrite(bulkOps);

    const user = await User.findById(userId);
    const userData = user.toProfileJSON();

    res.json({
      success: true,
      message: 'Profile batch update successful',
      data: userData
    });
  } catch (error) {
    console.error('Batch update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

router.post('/profile/photo', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { photoUrl } = req.body;
    
    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Photo URL is required'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { 'profile.profilePhoto': photoUrl } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
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
      name: name || '',
      url: url || '',
      uploadDate: new Date(),
      size: size || '',
      type: type || ''
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { 'profile.resume': resumeData } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: {
        resume: user.profile.resume,
        user
      }
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resume',
      error: error.message
    });
  }
});

router.post('/profile/cv', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { name, url, size, type } = req.body;

    const cvData = {
      name: name || '',
      url: url || '',
      uploadDate: new Date(),
      size: size || '',
      type: type || ''
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { 'profile.cv': cvData } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'CV updated successfully',
      data: {
        cv: user.profile.cv,
        user
      }
    });
  } catch (error) {
    console.error('Upload CV error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update CV',
      error: error.message
    });
  }
});

router.post('/profile/document', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { name, url, size, type, category } = req.body;

    const mongoose = require('mongoose');
    const documentData = {
      _id: new mongoose.Types.ObjectId(),
      name: name || '',
      url: url || '',
      uploadDate: new Date(),
      size: size || '',
      type: type || '',
      category: category || 'general'
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { 'profile.documents': documentData } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Document added successfully',
      data: {
        document: documentData,
        user
      }
    });
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add document',
      error: error.message
    });
  }
});

router.delete('/profile/document/:documentId', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { documentId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const mongoose = require('mongoose');
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { 'profile.documents': { _id: new mongoose.Types.ObjectId(documentId) } } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: user
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message
    });
  }
});

router.put('/profile/experience', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { experienceDetails } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const formattedExperience = (experienceDetails || []).map(exp => ({
      company: exp.company || '',
      title: exp.title || '',
      location: exp.location || '',
      startDate: exp.startDate ? new Date(exp.startDate) : null,
      endDate: exp.endDate ? new Date(exp.endDate) : null,
      current: exp.current || false,
      description: exp.description || ''
    }));

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'profile.experienceDetails': formattedExperience,
          'profile.lastProfileUpdate': new Date()
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Experience updated successfully',
      data: user.profile.experienceDetails
    });
  } catch (error) {
    console.error('Update experience error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update experience',
      error: error.message
    });
  }
});

router.put('/profile/education', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { educationDetails } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const formattedEducation = (educationDetails || []).map(edu => ({
      institution: edu.institution || '',
      degree: edu.degree || '',
      field: edu.field || '',
      startDate: edu.startDate ? new Date(edu.startDate) : null,
      endDate: edu.endDate ? new Date(edu.endDate) : null
    }));

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'profile.educationDetails': formattedEducation,
          'profile.lastProfileUpdate': new Date()
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Education updated successfully',
      data: user.profile.educationDetails
    });
  } catch (error) {
    console.error('Update education error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update education',
      error: error.message
    });
  }
});

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

    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

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

router.get('/saved-jobs', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

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

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

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

router.delete('/account', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    await Promise.all([
      User.findByIdAndDelete(userId),
      Application.deleteMany({ userId })
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

    const user = await User.findById(userId);

    const stats = {
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      successRate: totalApplications > 0 ? 
        ((approvedApplications / totalApplications) * 100).toFixed(1) : 0,
      profileCompletion: user?.calculateProfileCompletion() || 0,
      isProfileComplete: user?.isProfileComplete || false
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
