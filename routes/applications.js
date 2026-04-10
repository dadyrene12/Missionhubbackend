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
    const applications = await Application.find({ userId: req.user.id })
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
    const jobs = await Job.find({ postedBy: req.user.id }).select('_id').lean();
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
    const jobs = await Job.find({ postedBy: req.user.id }).select('_id').lean();
    const jobIds = jobs.map(job => job._id);

    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId', 'title company')
      .populate('userId', 'name email profile')
      .sort({ createdAt: -1 })
      .lean();

    const transformedApps = applications.map(app => ({
      ...app,
      resume: app.resume || app.userId?.profile?.resume || null,
      skills: app.skills || app.userId?.profile?.skills || [],
    }));

    res.json({ success: true, data: transformedApps });
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

    const existingApplication = await Application.findOne({ jobId, userId: req.user.id });
    if (existingApplication) {
      return res.status(400).json({ success: false, message: 'You have already applied to this job' });
    }

    const user = await User.findById(req.user.id).select('profile').lean();
    const profileResume = user?.profile?.resume || null;
    const applicationResume = resume || profileResume;

    const application = await Application.create({
      jobId,
      userId: req.user.id,
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

    const populatedApplication = await Application.findById(application._id)
      .populate('jobId', 'title company')
      .populate('userId', 'name email profile');

    res.status(201).json({ success: true, data: populatedApplication });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update application status - MAIN FUNCTION WITH PROPER NOTIFICATIONS
router.put('/:id/status', protect, companyOnly, async (req, res) => {
  try {
    const { status, notes, sendEmail: shouldSendEmail = true, sendInApp: shouldSendInApp = true, customMessage, subject } = req.body;

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
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Check authorization
    if (application.jobId && application.jobId.postedBy && application.jobId.postedBy.toString() !== req.user.id && application.companyId?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this application' });
    }

    const previousStatus = application.status;
    
    // Update application
    application.status = status;
    if (notes) application.notes = notes;
    await application.save();

    // Get applicant info
    const applicant = await User.findById(application.userId?._id || application.userId);

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
      try {
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
            companyName: companyName,
            previousStatus: previousStatus,
            newStatus: status
          },
          relatedId: application._id,
          relatedType: 'application'
        });

        result.inAppNotificationSent = true;
        console.log(`✅ In-app notification sent to ${applicant.email}`);

      } catch (notifyError) {
        result.inAppNotificationError = notifyError.message;
        console.error('❌ In-app notification error:', notifyError.message);
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
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                <h2 style="color: white; margin: 0;">Application Update</h2>
              </div>
              <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                <p style="color: #333;">Dear ${applicantName},</p>
                <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea;">
                  ${customMessage.replace(/\n/g, '<br/>')}
                </div>
                <p style="color: #666; font-size: 14px;">Best regards,<br/>${companyName} Team</p>
              </div>
            </div>
          `;
        } else {
          // Use status-specific templates
          switch (status) {
            case 'reviewed':
              emailSubject = `Your Application for ${jobTitle} is Under Review`;
              emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="color: white; margin: 0;">Application Under Review</h2>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                    <p style="color: #333;">Dear ${applicantName},</p>
                    <p style="color: #333;">Great news! Your application for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong> is now being reviewed by the hiring team.</p>
                    <p style="color: #666;">We will keep you updated on any further progress.</p>
                    <p style="color: #666;">Best regards,<br/>The Hiring Team</p>
                  </div>
                </div>
              `;
              break;
            case 'approved':
              emailSubject = `Congratulations! Your Application for ${jobTitle} Has Been Approved!`;
              emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="color: white; margin: 0;">Congratulations!</h2>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                    <p style="color: #333;">Dear ${applicantName},</p>
                    <p style="color: #333;">We are thrilled to inform you that your application for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been <strong style="color: #10B981;">APPROVED</strong>!</p>
                    <p style="color: #666;">The company will reach out to you shortly with next steps.</p>
                    <p style="color: #666;">Best of luck!</p>
                    <p style="color: #666;">Best regards,<br/>The ${companyName} Team</p>
                  </div>
                </div>
              `;
              break;
            case 'rejected':
              emailSubject = `Application Update for ${jobTitle}`;
              emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="color: white; margin: 0;">Application Update</h2>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                    <p style="color: #333;">Dear ${applicantName},</p>
                    <p style="color: #333;">Thank you for your interest in the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
                    <p style="color: #666;">After careful consideration, we have decided to proceed with other candidates whose qualifications more closely match our current needs.</p>
                    <p style="color: #666;">We encourage you to apply for future positions that match your skills.</p>
                    <p style="color: #666;">We wish you the best in your career journey.</p>
                    <p style="color: #666;">Best regards,<br/>The ${companyName} Team</p>
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
    
    if (shouldSendEmail && sendEmail !== false) {
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
    console.error('❌ Update application status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message,
      error: error.message
    });
  }
});

// Update application
router.put('/:id', protect, async (req, res) => {
  try {
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
    res.status(500).json({ success: false, message: 'Server error' });
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

    if (application.userId.toString() !== req.user.id && req.user.userType !== 'company') {
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
