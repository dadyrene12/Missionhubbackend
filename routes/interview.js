const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Interview = require('../models/Interview');
const Job = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const emailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');

// GET /api/interview/company - Get company's interviews
router.get('/company', protect, async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.user._id });
    
    let interviews = [];
    if (company) {
      interviews = await Interview.find({ companyId: company._id })
        .populate('candidateId', 'name email profile.profilePhoto profile.phone')
        .populate('jobId', 'title')
        .sort({ scheduledDate: -1 });
    }

    return res.json({ success: true, interviews });
  } catch (error) {
    console.error('Get company interviews error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching interviews' });
  }
});

// GET /api/interview/candidate - Get candidate's interviews
router.get('/candidate', protect, async (req, res) => {
  try {
    const interviews = await Interview.find({ candidateId: req.user._id })
      .populate('companyId', 'name logo')
      .populate('jobId', 'title')
      .sort({ scheduledDate: -1 });

    return res.json({ success: true, interviews });
  } catch (error) {
    console.error('Get candidate interviews error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching interviews' });
  }
});

// GET /api/interview/candidates - Get ONLY approved candidates
router.get('/candidates', protect, async (req, res) => {
  try {
    const { search } = req.query;
    
    let applications = await Application.find({ 
      companyId: req.user._id,
      status: 'approved'
    })
      .populate('userId', 'name email profile.profilePhoto profile.headline')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 });

    let candidates = applications.map(app => ({
      _id: app.userId?._id,
      name: app.userId?.name || app.applicantName || 'Unknown',
      email: app.userId?.email || app.applicantEmail || '',
      profilePhoto: app.userId?.profile?.profilePhoto,
      headline: app.userId?.profile?.headline,
      jobId: app.jobId?._id,
      jobTitle: app.jobId?.title || app.jobTitle || 'Position',
      applicationId: app._id,
      applicationStatus: app.status
    }));

    if (candidates.length === 0) {
      const query = { userType: 'jobSeeker', isActive: true, isVerified: true };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      const users = await User.find(query)
        .select('name email profile.profilePhoto profile.headline')
        .sort({ createdAt: -1 })
        .limit(100);

      candidates = users.map(user => ({
        _id: user._id,
        name: user.name || 'Unknown',
        email: user.email || '',
        profilePhoto: user.profile?.profilePhoto,
        headline: user.profile?.headline,
        jobId: null,
        jobTitle: 'Direct Hiring',
        applicationId: null,
        applicationStatus: 'verified'
      }));
    }

    return res.json({ success: true, candidates });
  } catch (error) {
    console.error('Get candidates error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching candidates' });
  }
});

// GET /api/interview/users - Get verified job seekers for direct hiring
router.get('/users', protect, async (req, res) => {
  try {
    const { search } = req.query;
    
    const query = { userType: 'jobSeeker', isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('name email profile.profilePhoto profile.headline profile.skills')
      .sort({ createdAt: -1 })
      .limit(100);

    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name || 'Unknown',
      email: user.email || '',
      profilePhoto: user.profile?.profilePhoto,
      headline: user.profile?.headline,
      skills: user.profile?.skills || [],
      type: 'direct_hire'
    }));

    return res.json({ success: true, users: formattedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// GET /api/interview/jobs - Get company's jobs
router.get('/jobs', protect, async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.user._id });
    const query = company ? { companyId: company._id } : { postedBy: req.user._id };
    
    const jobs = await Job.find(query)
      .select('title company location')
      .sort({ createdAt: -1 });

    return res.json({ success: true, jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching jobs' });
  }
});

// GET /api/interview/:id - Get single interview
router.get('/:id', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidateId', 'name email profile.profilePhoto profile.phone')
      .populate('companyId', 'name logo')
      .populate('jobId', 'title');

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    return res.json({ success: true, interview });
  } catch (error) {
    console.error('Get interview error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching interview' });
  }
});

// POST /api/interview/schedule - Schedule new interview
router.post('/schedule', protect, async (req, res) => {
  try {
    const { candidateId, jobId, applicationId, type, scheduledDate, duration, location, meetingLink, notes, sendReminder, customMessage, reminder } = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate is required' });
    }
    if (!scheduledDate) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    let company = await Company.findOne({ owner: req.user._id });
    if (!company) {
      company = await Company.create({
        name: req.user.name || 'My Company',
        email: req.user.email,
        owner: req.user._id
      });
    }

    const candidate = await User.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Handle reminder - can be a number or object with beforeMinutes
    let reminderData = { enabled: true, beforeMinutes: 30, sent: false };
    if (reminder) {
      if (typeof reminder === 'object') {
        reminderData = { enabled: true, beforeMinutes: reminder.beforeMinutes || 30, sent: false };
      } else if (typeof reminder === 'number') {
        reminderData = { enabled: true, beforeMinutes: reminder, sent: false };
      }
    } else if (sendReminder === false) {
      reminderData = { enabled: false, beforeMinutes: 30, sent: false };
    }

    const interview = await Interview.create({
      companyId: company._id,
      candidateId,
      jobId: jobId || null,
      applicationId: applicationId || null,
      type: type || 'video',
      scheduledDate: new Date(scheduledDate),
      duration: parseInt(duration) || 60,
      location: location || '',
      meetingLink: meetingLink || '',
      joinLink: meetingLink || '',
      notes: notes || customMessage || '',
      reminder: reminderData,
      status: 'scheduled'
    });

    const populatedInterview = await Interview.findById(interview._id)
      .populate('candidateId', 'name email profile.profilePhoto profile.phone')
      .populate('jobId', 'title');

    const companyInfo = await Company.findById(company._id);
    const jobInfo = jobId ? await Job.findById(jobId) : null;

    // Create notification using notification service
    await NotificationService.interviewScheduled(
      candidateId,
      interview,
      companyInfo?.name || 'The Company',
      jobInfo?.title || 'the position',
      scheduledDate,
      meetingLink
    );

    // Build custom message section for email
    const customMessageSection = customMessage ? `
      <div style="background: #f0f9ff; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
        <h3 style="color: #0369a1; margin-top: 0;">Message from the Company</h3>
        <p style="white-space: pre-line; color: #334155;">${customMessage}</p>
      </div>
    ` : '';
    
    const notesSection = notes ? `
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Additional Notes:</strong></p>
        <p style="white-space: pre-line; color: #475569; font-size: 14px; margin: 5px 0 0 0;">${notes}</p>
      </div>
    ` : '';

    // Send email with custom message
    try {
      await emailService.sendEmail({
        email: candidate.email,
        subject: `Interview Scheduled: ${jobInfo?.title || 'Position'} at ${companyInfo?.name || 'Company'}`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; text-align: center; margin: 0; border-radius: 12px 12px 0 0;">
              Interview Scheduled! 🎉
            </h2>
            <div style="background: #fff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <p style="font-size: 16px;">Dear <strong>${candidate.name || 'Candidate'}</strong>,</p>
              <p style="font-size: 16px; color: #475569;">Great news! Your interview has been scheduled. Please find the details below.</p>
              ${customMessageSection}
              <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #6366f1;">
                <h3 style="color: #4338ca; margin-top: 0;">📅 Interview Details</h3>
                <table style="width: 100%;">
                  <tr><td style="padding: 8px 0; color: #64748b;"><strong>🏢 Company:</strong></td><td style="padding: 8px 0;">${companyInfo?.name || 'Company'}</td></tr>
                  <tr><td style="padding: 8px 0; color: #64748b;"><strong>💼 Position:</strong></td><td style="padding: 8px 0;">${jobInfo?.title || 'Position'}</td></tr>
                  <tr><td style="padding: 8px 0; color: #64748b;"><strong>📆 Date:</strong></td><td style="padding: 8px 0;">${new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                  <tr><td style="padding: 8px 0; color: #64748b;"><strong>⏰ Time:</strong></td><td style="padding: 8px 0;">${new Date(scheduledDate).toLocaleTimeString()}</td></tr>
                  <tr><td style="padding: 8px 0; color: #64748b;"><strong>📝 Type:</strong></td><td style="padding: 8px 0;">${type || 'Video'} Call</td></tr>
                  <tr><td style="padding: 8px 0; color: #64748b;"><strong>⏱️ Duration:</strong></td><td style="padding: 8px 0;">${parseInt(duration) || 60} minutes</td></tr>
                  ${location ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>📍 Location:</strong></td><td style="padding: 8px 0;">${location}</td></tr>` : ''}
                  ${meetingLink ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>🔗 Meeting Link:</strong></td><td style="padding: 8px 0;"><a href="${meetingLink}" style="color: #6366f1;">${meetingLink}</a></td></tr>` : ''}
                </table>
              </div>
              ${notesSection}
              <p style="font-size: 14px; color: #64748b;">Please make sure to join on time and prepare any required documents.</p>
              <p style="font-size: 14px; color: #94a3b8; margin-top: 30px;">Best regards,<br><strong>${companyInfo?.name || 'The Company'} Team</strong></p>
              <p style="font-size: 12px; color: #cbd5e1; text-align: center; margin-top: 20px;">This email was sent via MissionHub Platform</p>
            </div>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Email error:', emailErr.message);
    }

    return res.json({ success: true, interview: populatedInterview, message: 'Interview scheduled successfully' });
  } catch (error) {
    console.error('Schedule error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error scheduling interview' });
  }
});

// POST /api/interview/schedule-batch - Schedule interviews for all approved applicants
router.post('/schedule-batch', protect, async (req, res) => {
  try {
    const { jobId, scheduledDate, type, duration, location, meetingLink, notes, title, reminder } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }
    if (!scheduledDate) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    let company = await Company.findOne({ owner: req.user._id });
    if (!company) {
      company = await Company.create({
        name: req.user.name || 'My Company',
        email: req.user.email,
        owner: req.user._id
      });
    }

    const applications = await Application.find({
      jobId,
      status: { $in: ['approved', 'interviewing'] }
    }).populate('userId', 'name email profile.profilePhoto profile.phone');

    if (applications.length === 0) {
      return res.status(400).json({ success: false, message: 'No approved applicants found for this job' });
    }

    const jobInfo = await Job.findById(jobId);
    const scheduledDateObj = new Date(scheduledDate);
    const createdInterviews = [];

    let reminderData = { enabled: true, beforeMinutes: 30, sent: false };
    if (reminder) {
      if (typeof reminder === 'object') {
        reminderData = { enabled: true, beforeMinutes: reminder.beforeMinutes || 30, sent: false };
      } else if (typeof reminder === 'number') {
        reminderData = { enabled: true, beforeMinutes: reminder, sent: false };
      }
    }

    for (const application of applications) {
      const candidate = application.userId;
      if (!candidate) continue;

      const interview = await Interview.create({
        companyId: company._id,
        candidateId: candidate._id,
        jobId: jobId,
        applicationId: application._id,
        type: type || 'video',
        scheduledDate: scheduledDateObj,
        duration: parseInt(duration) || 60,
        location: location || '',
        meetingLink: meetingLink || '',
        joinLink: meetingLink || '',
        notes: notes || '',
        title: title || 'Interview',
        reminder: reminderData,
        status: 'scheduled'
      });

      const populatedInterview = await Interview.findById(interview._id)
        .populate('candidateId', 'name email profile.profilePhoto profile.phone')
        .populate('jobId', 'title');

      await NotificationService.interviewScheduled(
        candidate._id,
        interview,
        company?.name || 'The Company',
        jobInfo?.title || 'the position',
        scheduledDate,
        meetingLink
      );

      try {
        await emailService.sendEmail({
          email: candidate.email,
          subject: `Interview Scheduled: ${jobInfo?.title || 'Position'} at ${company?.name || 'Company'}`,
          message: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; text-align: center; margin: 0; border-radius: 12px 12px 0 0;">
                Interview Scheduled! 🎉
              </h2>
              <div style="background: #fff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <p style="font-size: 16px;">Dear <strong>${candidate.name || 'Candidate'}</strong>,</p>
                <p style="font-size: 16px; color: #475569;">Great news! Your interview has been scheduled. Please find the details below.</p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #6366f1;">
                  <h3 style="color: #4338ca; margin-top: 0;">📅 Interview Details</h3>
                  <table style="width: 100%;">
                    <tr><td style="padding: 8px 0; color: #64748b;"><strong>🏢 Company:</strong></td><td style="padding: 8px 0;">${company?.name || 'Company'}</td></tr>
                    <tr><td style="padding: 8px 0; color: #64748b;"><strong>💼 Position:</strong></td><td style="padding: 8px 0;">${jobInfo?.title || 'Position'}</td></tr>
                    <tr><td style="padding: 8px 0; color: #64748b;"><strong>📆 Date:</strong></td><td style="padding: 8px 0;">${scheduledDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                    <tr><td style="padding: 8px 0; color: #64748b;"><strong>⏰ Time:</strong></td><td style="padding: 8px 0;">${scheduledDateObj.toLocaleTimeString()}</td></tr>
                    <tr><td style="padding: 8px 0; color: #64748b;"><strong>📝 Type:</strong></td><td style="padding: 8px 0;">${type || 'Video'} Call</td></tr>
                    <tr><td style="padding: 8px 0; color: #64748b;"><strong>⏱️ Duration:</strong></td><td style="padding: 8px 0;">${parseInt(duration) || 60} minutes</td></tr>
                    ${location ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>📍 Location:</strong></td><td style="padding: 8px 0;">${location}</td></tr>` : ''}
                    ${meetingLink ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>🔗 Meeting Link:</strong></td><td style="padding: 8px 0;"><a href="${meetingLink}" style="color: #6366f1;">${meetingLink}</a></td></tr>` : ''}
                  </table>
                </div>
                ${notes ? `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;"><p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Additional Notes:</strong></p><p style="white-space: pre-line; color: #475569; font-size: 14px; margin: 5px 0 0 0;">${notes}</p></div>` : ''}
                <p style="font-size: 14px; color: #64748b;">Please make sure to join on time and prepare any required documents.</p>
                <p style="font-size: 14px; color: #94a3b8; margin-top: 30px;">Best regards,<br><strong>${company?.name || 'The Company'} Team</strong></p>
                <p style="font-size: 12px; color: #cbd5e1; text-align: center; margin-top: 20px;">This email was sent via MissionHub Platform</p>
              </div>
            </div>
          `
        });
      } catch (emailErr) {
        console.error('Batch email error:', emailErr.message);
      }

      createdInterviews.push(populatedInterview);
    }

    return res.json({ success: true, interviews: createdInterviews, message: `Scheduled interviews for ${createdInterviews.length} applicants` });
  } catch (error) {
    console.error('Batch schedule error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error scheduling batch interviews' });
  }
});

// POST /api/interview/:id/reminder - Send reminder
router.post('/:id/reminder', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidateId', 'name email profile.phone')
      .populate('jobId', 'title');

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    const company = await Company.findOne({ owner: req.user._id });
    const companyId = interview.companyId?.toString ? interview.companyId.toString() : interview.companyId;
    const ownerId = company ? company._id.toString() : null;
    
    if (ownerId !== companyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const candidate = interview.candidateId;
    const jobInfo = interview.jobId;

    // Create notification using notification service
    await NotificationService.interviewReminder(
      candidate._id,
      interview,
      'The Company',
      jobInfo?.title || 'the position'
    );

    // Send email reminder
    try {
      await emailService.sendEmail({
        email: candidate.email,
        subject: `Reminder: Interview Tomorrow - ${jobInfo?.title || 'Position'}`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #fff; background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; text-align: center; margin: 0; border-radius: 12px 12px 0 0;">
              Interview Reminder
            </h2>
            <div style="background: #fff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <p style="font-size: 16px;">Dear <strong>${candidate.name || 'Candidate'}</strong>,</p>
              <p style="font-size: 16px;">This is a reminder about your upcoming interview:</p>
              <div style="background: #fef3c7; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <h3 style="color: #92400e; margin-top: 0;">Upcoming Interview</h3>
                <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(interview.scheduledDate).toLocaleDateString()}</p>
                <p style="margin: 8px 0;"><strong>Time:</strong> ${new Date(interview.scheduledDate).toLocaleTimeString()}</p>
                <p style="margin: 8px 0;"><strong>Position:</strong> ${jobInfo?.title || 'Position'}</p>
                ${interview.meetingLink ? `<p style="margin: 8px 0;"><strong>Meeting Link:</strong> <a href="${interview.meetingLink}" style="color: #3b82f6;">${interview.meetingLink}</a></p>` : ''}
              </div>
              <p style="font-size: 14px;">Please be ready 5-10 minutes before the scheduled time.</p>
              <p style="font-size: 14px; color: #888; margin-top: 30px;">Best regards,<br><strong>MissionHub Team</strong></p>
            </div>
          </div>
        `
      });

      // Update reminder sent status
      interview.reminder = interview.reminder || {};
      interview.reminder.sent = true;
      interview.reminder.sentAt = new Date();
      await interview.save();

    } catch (emailErr) {
      console.error('Email reminder error:', emailErr.message);
    }

    return res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Reminder error:', error);
    return res.status(500).json({ success: false, message: 'Error sending reminder' });
  }
});

// PUT /api/interview/:id/cancel - Cancel interview
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    const company = await Company.findOne({ owner: req.user._id });
    const userId = req.user._id.toString();
    const candidateId = interview.candidateId?.toString ? interview.candidateId.toString() : interview.candidateId;
    const companyId = interview.companyId?.toString ? interview.companyId.toString() : interview.companyId;
    const ownerId = company ? company._id.toString() : null;

    const isCompanyOwner = ownerId && companyId === ownerId;
    const isCandidate = candidateId === userId;

    if (!isCompanyOwner && !isCandidate) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { reason } = req.body;
    interview.status = 'cancelled';
    if (reason) interview.cancelReason = reason;
    interview.cancelledBy = req.user._id;
    interview.cancelledByType = req.user.userType;
    await interview.save();

    if (isCompanyOwner) {
      await NotificationService.interviewCancelled(
        interview.candidateId,
        interview,
        'The Company',
        'the position'
      );
    }

    return res.json({ success: true, message: 'Interview cancelled successfully' });
  } catch (error) {
    console.error('Cancel error:', error);
    return res.status(500).json({ success: false, message: 'Error cancelling interview' });
  }
});

// PUT /api/interview/:id/complete - Mark interview as complete
router.put('/:id/complete', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    const company = await Company.findOne({ owner: req.user._id });
    const companyId = interview.companyId?.toString ? interview.companyId.toString() : interview.companyId;
    const ownerId = company ? company._id.toString() : null;
    const isOwner = ownerId && companyId === ownerId;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    interview.status = 'completed';
    await interview.save();

    return res.json({ success: true, message: 'Interview marked as completed' });
  } catch (error) {
    console.error('Complete error:', error);
    return res.status(500).json({ success: false, message: 'Error completing interview' });
  }
});

// PUT /api/interview/:id - Update interview
router.put('/:id', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    const company = await Company.findOne({ owner: req.user._id });
    const companyId = interview.companyId?.toString ? interview.companyId.toString() : interview.companyId;
    const ownerId = company ? company._id.toString() : null;
    const isOwner = ownerId && companyId === ownerId;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { scheduledDate, duration, type, location, meetingLink, notes, status, sendEmail, title } = req.body;

    if (scheduledDate) interview.scheduledDate = new Date(scheduledDate);
    if (duration) interview.duration = parseInt(duration);
    if (type) interview.type = type;
    if (location !== undefined) interview.location = location;
    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (notes !== undefined) interview.notes = notes;
    if (status) interview.status = status;
    if (title !== undefined) interview.title = title;

    await interview.save();

    if (status && sendEmail && interview.candidateId) {
      const candidate = await User.findById(interview.candidateId);
      if (candidate) {
        const job = await Job.findById(interview.jobId);
        const companyDoc = await Company.findById(interview.companyId);
        
        try {
          if (status === 'completed') {
            await emailService.sendInterviewCompletion(candidate.email, {
              candidateName: candidate.name,
              companyName: companyDoc?.name || 'the company',
              jobTitle: job?.title || 'the position',
              date: new Date(interview.scheduledDate).toLocaleDateString()
            });
          } else if (status === 'cancelled') {
            await emailService.sendInterviewCancellation(candidate.email, {
              candidateName: candidate.name,
              companyName: companyDoc?.name || 'the company',
              jobTitle: job?.title || 'the position',
              date: new Date(interview.scheduledDate).toLocaleDateString()
            });
          }
        } catch (emailErr) {
          console.error('Interview update email error:', emailErr.message);
        }
      }
    }

    const updatedInterview = await Interview.findById(interview._id)
      .populate('candidateId', 'name email profile.profilePhoto profile.phone')
      .populate('jobId', 'title');

    return res.json({ success: true, interview: updatedInterview, message: 'Interview updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({ success: false, message: 'Error updating interview' });
  }
});

// DELETE /api/interview/:id - Delete interview
router.delete('/:id', protect, async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    const company = await Company.findOne({ owner: req.user._id });
    const companyId = interview.companyId?.toString ? interview.companyId.toString() : interview.companyId;
    const ownerId = company ? company._id.toString() : null;
    const isOwner = ownerId && companyId === ownerId;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Interview.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: 'Interview deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ success: false, message: 'Error deleting interview' });
  }
});

module.exports = router;
