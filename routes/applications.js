const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

// Auth middleware
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
};

// Company only middleware
const companyOnly = (req, res, next) => {
  if (!req.user || (req.user.userType !== 'company' && req.user.role !== 'company_admin')) {
    return res.status(403).json({ success: false, message: 'Company accounts only' });
  }
  next();
};

// Get all applications
router.get('/', protect, async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('jobId', 'title company location type salary')
      .populate('userId', 'name email profile')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's applications
router.get('/my-applications', protect, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user._id })
      .populate('jobId', 'title company location type salary')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get company applications (for companies)
router.get('/company', protect, companyOnly, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).select('_id').lean();
    const jobIds = jobs.map(job => job._id);

    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId', 'title company location type salary')
      .populate('userId', 'name email profile.phone profile.location profile.bio profile.skills profile.resume profile.title profile.linkedin profile.github profile.portfolio profile.yearsOfExperience profile.desiredSalary profile.education profile.experience')
      .sort({ createdAt: -1 })
      .lean();

    const transformedApps = applications.map(app => ({
      ...app,
      resume: app.resume || app.userId?.profile?.resume || null,
      skills: app.skills || app.userId?.profile?.skills || [],
      experience: app.experience || app.userId?.profile?.experience || null,
      education: app.userId?.profile?.education || null,
      location: app.userId?.profile?.location || null,
      phone: app.userId?.profile?.phone || null,
      bio: app.userId?.profile?.bio || null,
      title: app.userId?.profile?.title || null,
      linkedin: app.userId?.profile?.linkedin || null,
      github: app.userId?.profile?.github || null,
      portfolio: app.userId?.profile?.portfolio || null,
      yearsOfExperience: app.userId?.profile?.yearsOfExperience || null,
      desiredSalary: app.userId?.profile?.desiredSalary || null,
    }));

    res.json({ success: true, data: transformedApps });
  } catch (error) {
    console.error('Get company applications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get applications for user's jobs
router.get('/for-my-jobs', protect, companyOnly, async (req, res) => {
  try {
    const applications = await Application.aggregate([
      {
        $lookup: {
          from: 'jobs',
          localField: 'jobId',
          foreignField: '_id',
          as: 'jobId'
        }
      },
      { $unwind: '$jobId' },
      { $match: { 'jobId.postedBy': req.user._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userId'
        }
      },
      { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1, status: 1, coverLetter: 1, createdAt: 1, updatedAt: 1,
          jobId: { _id: '$jobId._id', title: '$jobId.title' },
          userId: { 
            _id: '$userId._id', 
            name: '$userId.name', 
            email: '$userId.email',
            profilePhoto: '$userId.profile.profilePhoto',
            phone: '$userId.profile.phone',
            city: '$userId.profile.location',
            skills: '$userId.profile.skills',
            experience: '$userId.profile.experience',
            education: '$userId.profile.education',
            bio: '$userId.profile.bio',
            resume: '$userId.profile.resume.url'
          },
          aiScreening: 1, resume: 1, skills: 1
        }
      }
    ]);

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get applications for a specific job
router.get('/job/:jobId', protect, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.query;
    
    console.log('[DEBUG] GET /api/applications/job/:jobId called with jobId:', jobId, 'status:', status);
    
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }
    
    let query = { jobId };
    if (status) {
      query.status = status;
    }
    
    const applications = await Application.find(query)
      .populate('jobId', 'title')
      .populate('userId', 'name email profile')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('[DEBUG] Found applications:', applications.length);
    console.log('[DEBUG] Applications:', applications.map(a => ({ _id: a._id, status: a.status, userId: a.userId })));
    
    const transformedApps = applications.map(app => ({
      _id: app._id,
      jobId: app.jobId,
      candidateId: app.userId,
      status: app.status,
      createdAt: app.createdAt,
      applicantName: app.applicantName,
      applicantEmail: app.applicantEmail
    }));
    
    res.json({ success: true, data: transformedApps });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single application
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid application ID' });
    }
    
    const application = await Application.findById(id)
      .populate('jobId', 'title company location type salary description requirements benefits')
      .populate('userId', 'name email profile');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Submit application
router.post('/', protect, async (req, res) => {
  try {
    const { jobId, coverLetter, resume, answers } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    const job = await Job.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if job is closed
    if (job.status === 'closed') {
      return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' });
    }

    const existingApplication = await Application.findOne({ jobId, userId: req.user._id });
    if (existingApplication) {
      return res.status(400).json({ success: false, message: 'You have already applied to this job' });
    }

    const user = await User.findById(req.user._id).select('profile').lean();
    const profileResume = user?.profile?.resume || null;
    const applicationResume = resume || profileResume;

    const application = await Application.create({
      jobId,
      userId: req.user._id,
      jobTitle: job.title,
      company: job.company,
      applicantName: req.user.name,
      applicantEmail: req.user.email,
      coverLetter,
      resume: applicationResume,
      answers: answers || [],
      status: 'pending',
      companyId: job.companyId || job.postedBy
    });

    await Job.findByIdAndUpdate(jobId, { $inc: { applicants: 1 } });

    // Send notification to company
    const companyUserId = job.companyId || job.postedBy;
    if (companyUserId) {
      try {
        await Notification.create({
          userId: companyUserId,
          type: 'job_application',
          title: 'New Job Application',
          message: `${req.user.name || 'A candidate'} has applied for ${job.title}. View their application now!`,
          priority: 'high',
          senderType: 'user',
          senderId: req.user._id,
          jobDetails: {
            jobId: job._id,
            title: job.title,
            company: job.company,
            location: job.location,
            type: job.type
          },
          applicationDetails: {
            applicationId: application._id,
            jobTitle: job.title,
            applicantName: req.user.name,
            applicantEmail: req.user.email,
            applicantTitle: user?.profile?.title,
            applicantSkills: user?.profile?.skills,
            applicantExperience: user?.profile?.experience,
            applicantLocation: user?.profile?.location,
            applicantYearsOfExperience: user?.profile?.yearsOfExperience
          },
          relatedId: application._id,
          relatedType: 'application'
        });

        // Send email to company
        const applicantSkills = user?.profile?.skills || [];
        const skillsText = applicantSkills.length > 0 
          ? `<p><strong>Skills:</strong> ${applicantSkills.slice(0, 5).join(', ')}</p>` 
          : '';

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center;">
              <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" style="width: 180px; margin-bottom: 15px;">
              <h2 style="color: white; margin: 0; font-size: 22px;">New Job Application</h2>
            </div>
            <div style="padding: 30px;">
              <p style="color: #1f2937; font-size: 16px;">Hello,</p>
              <p style="color: #1f2937; font-size: 16px;"><strong>${req.user.name || 'A candidate'}</strong> has applied for the position of <strong>${job.title}</strong>.</p>
              
              <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Applicant Details</h3>
                <p style="color: #6B7280; margin: 5px 0; font-size: 14px;">
                  <strong>Name:</strong> ${req.user.name || 'Not provided'}
                </p>
                <p style="color: #6B7280; margin: 5px 0; font-size: 14px;">
                  <strong>Email:</strong> ${req.user.email}
                </p>
                ${user?.profile?.title ? `<p style="color: #6B7280; margin: 5px 0; font-size: 14px;"><strong>Title:</strong> ${user.profile.title}</p>` : ''}
                ${user?.profile?.location ? `<p style="color: #6B7280; margin: 5px 0; font-size: 14px;"><strong>Location:</strong> ${user.profile.location}</p>` : ''}
                ${user?.profile?.yearsOfExperience ? `<p style="color: #6B7280; margin: 5px 0; font-size: 14px;"><strong>Experience:</strong> ${user.profile.yearsOfExperience} years</p>` : ''}
                ${skillsText}
              </div>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/company/applications/${application._id}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; text-decoration: none; font-weight: 600; border-radius: 8px;">View Application</a>
              </div>
            </div>
            <div style="background: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
            </div>
          </div>
        `;

        const companyUser = await User.findById(companyUserId);
        if (companyUser?.email) {
          await emailService.sendEmail({
            email: companyUser.email,
            subject: `New Application for ${job.title} - ${req.user.name || 'Candidate'}`,
            message: emailHtml
          });
          console.log(`✅ Application notification email sent to company: ${companyUser.email}`);
        }
      } catch (notifError) {
        console.error('Error sending application notification:', notifError.message);
      }
    }

    const populatedApplication = await Application.findById(application._id)
      .populate('jobId', 'title company')
      .populate('userId', 'name email profile');

    res.status(201).json({ 
      success: true, 
      data: populatedApplication,
      message: 'Application submitted successfully. The company has been notified.'
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update application status - MAIN FUNCTION WITH PROPER NOTIFICATIONS
router.put('/:id/status', protect, companyOnly, async (req, res) => {
  try {
    const { status, notes, sendEmail: shouldSendEmail = true, sendInApp: shouldSendInApp = true, customMessage, subject } = req.body;

    console.log('\n=== PUT /api/applications/:id/status ===');
    console.log('Application ID:', req.params.id);
    console.log('Status:', status);
    console.log('User:', req.user._id);

    // Validate status
    if (!status || !['pending', 'reviewed', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid status is required. Must be: pending, reviewed, approved, or rejected' 
      });
    }

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid application ID' });
    }

    // Find application
    const application = await Application.findById(req.params.id).populate('jobId').populate('userId');

    if (!application) {
      console.log('Application not found');
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    console.log('Application found:', application._id);
    console.log('Job postedBy:', application.jobId?.postedBy);
    console.log('CompanyId:', application.companyId);

    // Check authorization - handle null/undefined postedBy safely
    const userId = req.user._id.toString();
    const postedBy = application.jobId?.postedBy ? application.jobId.postedBy.toString() : null;
    const companyId = application.companyId ? application.companyId.toString() : null;
    
    if (postedBy && postedBy !== userId && companyId !== userId) {
      console.log('Auth failed:', { userId, postedBy, companyId });
      return res.status(403).json({ success: false, message: 'Not authorized to update this application' });
    }

    const previousStatus = application.status;
    
    // Update application
    application.status = status;
    if (notes) application.notes = notes;
    await application.save();

    console.log('Application updated, prev:', previousStatus, 'new:', status);

    // Get applicant info - handle both populated and non-populated cases
    const applicantId = application.userId?._id || application.userId;
    const applicant = await User.findById(applicantId);

    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant user not found' });
    }

    const jobTitle = application.jobId?.title || application.jobTitle || 'the position';
    const companyName = application.jobId?.company || application.company || 'the company';
    const applicantName = applicant.name || 'Applicant';

    // Result tracking
    const result = {
      applicationUpdated: true,
      inAppNotificationSent: false,
      emailSent: false,
      inAppNotificationError: null,
      emailError: null
};

    // Send in-app notification
    if (shouldSendInApp && shouldSendInApp !== false) {
      let notificationTitle = '';
      let notificationMessage = '';
      let notificationPriority = 'normal';

      switch (status) {
        case 'reviewed':
          notificationTitle = 'Application Under Review';
          notificationMessage = `Your application for ${jobTitle} at ${companyName} is being reviewed.`;
          break;
        case 'approved':
          notificationTitle = 'Application Approved!';
          notificationMessage = `Great news! Your application for ${jobTitle} at ${companyName} has been approved. Contact will be made shortly.`;
          notificationPriority = 'high';
          break;
        case 'rejected':
          notificationTitle = 'Application Update';
          notificationMessage = `Your application for ${jobTitle} at ${companyName} has been updated.`;
          break;
        default:
          notificationTitle = 'Application Status Updated';
          notificationMessage = `Your application for ${jobTitle} has been updated to ${status}.`;
      }

      // Use custom message if provided
      if (customMessage) {
        notificationMessage = customMessage;
      }

      try {
        await Notification.create({
          userId: applicant._id,
          type: 'application_update',
          title: notificationTitle,
          message: notificationMessage,
          priority: notificationPriority,
          senderType: 'company',
          read: false,
          applicationDetails: {
            applicationId: application._id,
            jobTitle: jobTitle,
            applicantName: applicantName,
            previousStatus: previousStatus,
            newStatus: status
          },
          relatedId: application._id,
          relatedType: 'application'
        });
        result.inAppNotificationSent = true;
      } catch (notifError) {
        console.error('Failed to create notification:', notifError.message);
        result.inAppNotificationError = notifError.message;
      }
    }

    // Send email notification
    if (shouldSendEmail && shouldSendEmail !== false && applicant.email) {
      try {
        let emailSubject = subject || '';
        let emailHtml = '';

        // If custom message provided
        if (customMessage) {
          emailSubject = subject || `Update on Your Application for ${jobTitle}`;
          emailHtml = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
    <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" style="width: 180px; margin-bottom: 15px;">
    <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Application Update</h2>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px;">Dear <strong>${applicantName}</strong>,</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1;">
      <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0;">${customMessage.replace(/\n/g, '</p><p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0;">')}</p>
    </div>
    <p style="color: #9ca3af; font-size: 13px; margin: 30px 0 0;">Best regards,<br/><strong style="color: #1f2937;">The ${companyName} Team</strong></p>
  </div>
  <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
  </div>
</div>
          `;
        } else {
          // Use status-specific templates
          switch (status) {
            case 'reviewed':
              emailSubject = `Your Application for ${jobTitle} is Under Review`;
              emailHtml = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 40px 30px; text-align: center;">
    <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" style="width: 180px; margin-bottom: 15px;">
    <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Application Under Review</h2>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px;">Dear <strong>${applicantName}</strong>,</p>
    <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Great news! Your application for the position of <strong style="color: #1f2937;">${jobTitle}</strong> at <strong style="color: #1f2937;">${companyName}</strong> is now being reviewed by our hiring team.</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">We will keep you updated on any further progress.</p>
    </div>
    <p style="color: #9ca3af; font-size: 13px; margin: 30px 0 0;">Best regards,<br/><strong style="color: #1f2937;">The ${companyName} Hiring Team</strong></p>
  </div>
  <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
  </div>
</div>
              `;
              break;
            case 'approved':
              emailSubject = `Congratulations! Your Application for ${jobTitle} Has Been Approved!`;
              emailHtml = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059670 100%); padding: 40px 30px; text-align: center;">
    <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" style="width: 180px; margin-bottom: 15px;">
    <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
    <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Congratulations!</h2>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px;">Dear <strong>${applicantName}</strong>,</p>
    <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">We are thrilled to inform you that your application for the position of <strong style="color: #1f2937;">${jobTitle}</strong> at <strong style="color: #1f2937;">${companyName}</strong> has been <span style="color: #10b981; font-weight: bold;">APPROVED</span>!</p>
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
      <p style="color: #065f46; font-size: 14px; font-weight: 600; margin: 0;">The company will reach out to you shortly with next steps.</p>
    </div>
    <p style="color: #9ca3af; font-size: 13px; margin: 30px 0 0;">Best of luck!<br/><strong style="color: #1f2937;">The ${companyName} Team</strong></p>
  </div>
  <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
  </div>
</div>
              `;
              break;
            case 'rejected':
              emailSubject = `Application Update for ${jobTitle}`;
              emailHtml = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px; text-align: center;">
    <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" style="width: 180px; margin-bottom: 15px;">
    <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Application Update</h2>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px;">Dear <strong>${applicantName}</strong>,</p>
    <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">Thank you for your interest in the position of <strong style="color: #1f2937;">${jobTitle}</strong> at <strong style="color: #1f2937;">${companyName}</strong>.</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 25px 0;">
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px;">After careful consideration, we have decided to proceed with other candidates whose qualifications more closely match our current needs.</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">We encourage you to apply for future positions that match your skills.</p>
    </div>
    <p style="color: #9ca3af; font-size: 13px; margin: 30px 0 0;">We wish you the best in your career journey!<br/><strong style="color: #1f2937;">The ${companyName} Team</strong></p>
  </div>
  <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
  </div>
</div>
              `;
              break;
          }
        }

        if (emailSubject && emailHtml) {
          const emailResult = await emailService.sendEmail({
            email: applicant.email,
            subject: emailSubject,
            message: emailHtml
          });
          
          result.emailSent = emailResult;
          if (emailResult) {
            console.log(`✅ Email sent successfully to ${applicant.email}`);
          } else {
            result.emailError = 'Email service returned false';
          }
        }

      } catch (emailError) {
        result.emailError = emailError.message;
        console.error('❌ Email sending error:', emailError.message);
      }
    }

    // Build response message
    let message = `Application ${status}`;
    const notifications = [];
    
    if (shouldSendInApp && shouldSendInApp !== false) {
      if (result.inAppNotificationSent) {
        notifications.push('in-app notification');
      } else if (result.inAppNotificationError) {
        notifications.push('in-app notification (failed)');
      }
    }
    
    if (shouldSendEmail && shouldSendEmail !== false) {
      if (result.emailSent) {
        notifications.push('email');
      } else if (result.emailError) {
        notifications.push('email (failed)');
      }
    }
    
    if (notifications.length > 0) {
      message += ` & ${notifications.join(' & ')} sent`;
    }

    console.log(`\n📋 Application Status Update Complete:`);
    console.log(`   Applicant: ${applicantName} (${applicant.email})`);
    console.log(`   Position: ${jobTitle}`);
    console.log(`   Status: ${previousStatus} → ${status}`);
    console.log(`   In-App Notification: ${result.inAppNotificationSent ? '✅ Sent' : '❌ ' + (result.inAppNotificationError || 'Not sent')}`);
    console.log(`   Email: ${result.emailSent ? '✅ Sent' : '❌ ' + (result.emailError || 'Not sent')}`);
    console.log('');

    res.json({ 
      success: true, 
      message: message,
      data: application,
      notificationResult: result
    });

} catch (error) {
    console.error('Error updating application status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update application status: ' + error.message
    });
  }
});

// Update application (generic)
router.put('/:id', protect, async (req, res) => {
  try {
    console.log('\n=== PUT /api/applications/:id (generic) ===');
    console.log('ID:', req.params.id);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid application ID' });
    }

    const { coverLetter, resume, notes } = req.body;

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { coverLetter, resume, notes },
      { new: true }
    ).populate('jobId', 'title company')
     .populate('userId', 'name email');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Cancel/withdraw application
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid application ID' });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.userId.toString() !== req.user._id.toString() && req.user.userType !== 'company') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Application.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    await Job.findByIdAndUpdate(application.jobId, { $inc: { applicants: -1 } });

    res.json({ success: true, message: 'Application cancelled successfully' });
  } catch (error) {
    console.error('Cancel application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
