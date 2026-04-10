const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Company = require('../models/Company');

const { protect, checkEmailVerification } = require('../middleware/auth');

// GET /api/company/profile - Get company profile
router.get('/profile', protect, async (req, res) => {
  try {
    console.log('\n=== GET /company/profile ===');
    console.log('User ID:', req.user._id);
    console.log('User Type:', req.user.userType);

    // Get user with emailVerified
    const user = await User.findById(req.user._id).select('emailVerified');
    
    // Get company by owner
    const company = await Company.findOne({ owner: req.user._id });

    res.json({
      success: true,
      data: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        isEmailVerified: user?.emailVerified || false,
        companyName: company?.name || req.user.profile?.companyName || req.user.name,
        companySize: req.user.profile?.companySize || '',
        industry: company?.industry || req.user.profile?.industry || '',
        description: company?.description || req.user.profile?.description || '',
        location: company?.location || req.user.profile?.location || '',
        website: company?.website || req.user.profile?.companyWebsite || '',
        logo: company?.logo || req.user.profile?.logo || ''
      }
    });
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/company/profile - Update company profile
router.put('/profile', protect, async (req, res) => {
  try {
    console.log('\n=== PUT /company/profile ===');
    console.log('User ID:', req.user._id);
    console.log('Body:', req.body);

    const { companyName, companySize, industry, description, location, website, phone, logo } = req.body;

    // Update User profile
    const userUpdate = {};
    if (companyName) userUpdate['profile.companyName'] = companyName;
    if (companySize) userUpdate['profile.companySize'] = companySize;
    if (industry) userUpdate['profile.industry'] = industry;
    if (description) userUpdate['profile.description'] = description;
    if (location) userUpdate['profile.location'] = location;
    if (phone) userUpdate.phone = phone;
    if (logo) userUpdate['profile.logo'] = logo;

    await User.findByIdAndUpdate(req.user._id, userUpdate);

    // Update or create Company record
    let company = await Company.findOne({ owner: req.user._id });
    if (company) {
      await Company.findByIdAndUpdate(company._id, {
        name: companyName || company.name,
        industry,
        description,
        location,
        website,
        logo
      });
    } else if (companyName) {
      company = await Company.create({
        name: companyName,
        email: req.user.email,
        owner: req.user._id,
        industry,
        description,
        location,
        website,
        logo
      });
    }

    // Get updated user
    const updatedUser = await User.findById(req.user._id).select('-password');

    res.json({
      success: true,
      message: 'Company profile updated',
      data: {
        ...updatedUser.toObject(),
        company: company
      }
    });
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// GET /api/company/jobs - Get company jobs
router.get('/jobs', protect, async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.user._id });
    const query = company ? { companyId: company._id } : { postedBy: req.user._id };

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/company/applications - Get company applications
router.get('/applications', protect, async (req, res) => {
  try {
    const applications = await Application.find({ companyId: req.user._id })
      .populate('userId', 'name email profile')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/company/applications/:id/status - Update application status
router.put('/applications/:id/status', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const application = await Application.findById(id).populate('jobId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Check authorization via job or companyId
    if (application.jobId?.postedBy?.toString() !== req.user.id && application.companyId?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    application.status = status;
    if (notes) application.notes = notes;
    application.updatedAt = new Date();
    await application.save();

    res.json({ success: true, data: application, message: `Status updated to ${status}` });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// POST /api/company/upload-logo - Upload company logo
router.post('/upload-logo', protect, async (req, res) => {
  try {
    const { logo } = req.body;
    
    if (!logo) {
      return res.status(400).json({ success: false, message: 'No logo provided' });
    }

    // Update User profile
    await User.findByIdAndUpdate(req.user._id, { 'profile.logo': logo });

    // Update or create Company record
    let company = await Company.findOne({ owner: req.user._id });
    if (company) {
      await Company.findByIdAndUpdate(company._id, { logo });
    } else {
      company = await Company.create({
        name: req.user.profile?.companyName || req.user.name,
        email: req.user.email,
        owner: req.user._id,
        logo
      });
    }

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { logo }
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ success: false, message: 'Error uploading logo' });
  }
});

// DELETE /api/company/delete-account - Delete company account
router.delete('/delete-account', protect, checkEmailVerification, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete account' });
    }

    // Verify password - use static method to get password
    const user = await User.findByIdWithPassword(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Delete company profile
    await Company.deleteOne({ owner: req.user._id });

    // Delete all jobs posted by this user
    await Job.deleteMany({ postedBy: req.user._id });

    // Delete all applications
    await Application.deleteMany({ companyId: req.user._id });

    // Delete user account
    await User.deleteOne({ _id: req.user._id });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, message: 'Error deleting account' });
  }
});

// POST /api/company/send-verification - Send verification email for sensitive actions
router.post('/send-verification', protect, async (req, res) => {
  try {
    const { action } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // Generate verification code (always generate new code for security)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.emailVerificationToken = verificationCode;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    console.log(`[VERIFY] Code for ${user.email}: ${verificationCode}`);

    // Send verification email
    const { sendEmail } = require('../services/emailService');
    try {
      await sendEmail({
        email: user.email,
        subject: `Verify your email - ${action}`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0;">Verify Your Email</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px;">
              <p style="color: #374151;">Hello ${user.name || 'there'},</p>
              <p style="color: #374151;">You requested to ${action}. Please use the verification code below:</p>
              <div style="background: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border: 2px dashed #e5e7eb;">
                <h1 style="color: #6366f1; margin: 0; font-size: 32px; letter-spacing: 8px;">${verificationCode}</h1>
              </div>
              <p style="color: #6b7280; font-size: 12px;">This code will expire in 10 minutes.</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError.message);
      // Continue anyway - code is saved in DB
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined,
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Error sending verification:', error);
    res.status(500).json({ success: false, message: 'Error sending verification code' });
  }
});

// POST /api/company/export-data - Export all company data
router.post('/export-data', protect, async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.user._id });
    
    const jobs = await Job.find(company ? { companyId: company._id } : { postedBy: req.user._id })
      .populate('applications', 'userId status createdAt')
      .lean();
    
    const applications = await Application.find({ companyId: req.user._id })
      .populate('userId', 'name email phone profile')
      .populate('jobId', 'title')
      .lean();
    
    const user = await User.findById(req.user._id).select('-password').lean();
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt
      },
      company: company ? {
        name: company.name,
        industry: company.industry,
        description: company.description,
        location: company.location,
        website: company.website,
        createdAt: company.createdAt
      } : null,
      jobs: jobs.map(job => ({
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        location: job.location,
        salary: job.salary,
        jobType: job.jobType,
        status: job.status,
        createdAt: job.createdAt,
        applicationCount: job.applications?.length || 0
      })),
      applications: applications.map(app => ({
        applicantName: app.userId?.name,
        applicantEmail: app.userId?.email,
        jobTitle: app.jobId?.title,
        status: app.status,
        appliedAt: app.createdAt,
        updatedAt: app.updatedAt
      })),
      stats: {
        totalJobs: jobs.length,
        totalApplications: applications.length,
        pendingApplications: applications.filter(a => a.status === 'pending').length,
        approvedApplications: applications.filter(a => a.status === 'approved').length,
        rejectedApplications: applications.filter(a => a.status === 'rejected').length
      }
    };
    
    res.json({
      success: true,
      message: 'Data exported successfully',
      data: exportData
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, message: 'Error exporting data' });
  }
});

// POST /api/company/verify-action - Verify email for sensitive actions
router.post('/verify-action', protect, async (req, res) => {
  try {
    const { code, action } = req.body;
    
    // Trim the code to handle any whitespace issues
    const trimmedCode = code ? code.toString().trim() : '';
    
    if (!trimmedCode) {
      return res.status(400).json({ success: false, message: 'Verification code is required' });
    }

    const user = await User.findById(req.user._id);

    // Check if there's a stored code
    if (!user.emailVerificationToken) {
      return res.status(400).json({ success: false, message: 'No verification code found. Please request a new one.' });
    }

    // Check if code is valid (exact match)
    if (user.emailVerificationToken !== trimmedCode) {
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
    }

    // Check if code is expired
    if (user.emailVerificationExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    // Clear verification and mark email as verified
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    user.emailVerified = true;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      verified: true,
      action
    });
  } catch (error) {
    console.error('Error verifying action:', error);
    res.status(500).json({ success: false, message: 'Error verifying action' });
  }
});

// POST /api/company/2fa/enable - Enable two-factor authentication
router.post('/2fa/enable', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user.twoFactorEnabled) {
      return res.json({
        success: true,
        message: '2FA is already enabled',
        twoFactorEnabled: true
      });
    }
    
    const twoFactorSecret = require('crypto').randomBytes(20).toString('hex');
    const twoFactorToken = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.twoFactorSecret = twoFactorSecret;
    user.twoFactorToken = twoFactorToken;
    user.twoFactorTokenExpire = Date.now() + 10 * 60 * 1000;
    await user.save();
    
    res.json({
      success: true,
      message: '2FA setup initiated',
      twoFactorEnabled: false,
      setupToken: twoFactorToken,
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ success: false, message: 'Error enabling 2FA' });
  }
});

// POST /api/company/2fa/verify - Verify 2FA setup
router.post('/2fa/verify', protect, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }
    
    const user = await User.findById(req.user._id);
    
    if (user.twoFactorToken !== token) {
      return res.status(400).json({ success: false, message: 'Invalid verification token' });
    }
    
    if (user.twoFactorTokenExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification token expired' });
    }
    
    user.twoFactorEnabled = true;
    user.twoFactorToken = undefined;
    user.twoFactorTokenExpire = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: '2FA enabled successfully',
      twoFactorEnabled: true
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ success: false, message: 'Error verifying 2FA' });
  }
});

// POST /api/company/2fa/disable - Disable two-factor authentication
router.post('/2fa/disable', protect, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }
    
    const user = await User.findByIdWithPassword(req.user._id);
    
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
    
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: '2FA disabled successfully',
      twoFactorEnabled: false
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ success: false, message: 'Error disabling 2FA' });
  }
});

// GET /api/company/2fa/status - Get 2FA status
router.get('/2fa/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('twoFactorEnabled');
    
    res.json({
      success: true,
      twoFactorEnabled: user.twoFactorEnabled || false
    });
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    res.status(500).json({ success: false, message: 'Error getting 2FA status' });
  }
});

module.exports = router;
