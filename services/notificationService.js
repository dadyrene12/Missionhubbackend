const Notification = require('../models/Notification');
const { sendEmail, sendNewMessageEmail, sendApplicationStatusEmail } = require('./emailService');

const NotificationService = {
  async create(data) {
    try {
      const notification = await Notification.create({
        userId: data.userId,
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        priority: data.priority || 'normal',
        read: false,
        senderId: data.senderId,
        senderType: data.senderType,
        jobDetails: data.jobDetails,
        messageDetails: data.messageDetails,
        applicationDetails: data.applicationDetails,
        problemDetails: data.problemDetails,
        announcementDetails: data.announcementDetails,
        relatedId: data.relatedId,
        relatedType: data.relatedType,
        metadata: data.metadata,
        expiresAt: data.expiresAt
      });
      console.log(`Notification created for user ${data.userId}: ${data.title}`);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error.message);
      return null;
    }
  },

  async createMany(notifications) {
    try {
      const inserted = await Notification.insertMany(notifications);
      console.log(`${inserted.length} notifications created`);
      return inserted;
    } catch (error) {
      console.error('Error creating notifications:', error.message);
      return [];
    }
  },

  async newApplicationReceived(companyUserId, application, applicant) {
    return this.create({
      userId: companyUserId,
      type: 'application',
      title: 'New Job Application',
      message: `${applicant.name || 'A candidate'} has applied for ${application.jobTitle || 'your job'}. View their application now.`,
      priority: 'normal',
      senderId: applicant._id,
      senderType: 'user',
      applicationDetails: {
        applicationId: application._id,
        jobTitle: application.jobTitle,
        applicantName: applicant.name,
        applicantEmail: applicant.email
      },
      jobDetails: {
        title: application.jobTitle,
        jobId: application.jobId,
        company: application.company
      },
      relatedId: application._id,
      relatedType: 'application'
    });
  },

  async applicationStatusChanged(userId, application, newStatus, companyName, options = {}) {
    const { sendEmailNotification = true, sendInAppNotification = true, customMessage, subject } = options;
    
    let title, message, priority = 'normal';
    
    switch (newStatus) {
      case 'reviewed':
        title = 'Application Under Review';
        message = `Your application for ${application.jobTitle || 'the position'} at ${companyName} is being reviewed.`;
        break;
      case 'approved':
        title = 'Application Approved!';
        message = `Great news! Your application for ${application.jobTitle || 'the position'} at ${companyName} has been approved.`;
        priority = 'high';
        break;
      case 'rejected':
        title = 'Application Update';
        message = `Your application for ${application.jobTitle || 'the position'} at ${companyName} has been ${newStatus}.`;
        break;
      default:
        title = 'Application Status Updated';
        message = `Your application status for ${application.jobTitle || 'the position'} has been updated to ${newStatus}.`;
    }

    const notification = await this.create({
      userId,
      type: 'application',
      title,
      message,
      priority,
      senderType: 'company',
      applicationDetails: {
        applicationId: application._id,
        jobTitle: application.jobTitle,
        previousStatus: application.status,
        newStatus
      },
      relatedId: application._id,
      relatedType: 'application'
    });

    const User = require('../models/User');
    const user = await User.findById(userId);

    if (sendEmailNotification && user?.email) {
      try {
        await sendApplicationStatusEmail(user.email, {
          status: newStatus,
          applicantName: user.name || 'Applicant',
          jobTitle: application.jobTitle || 'the position',
          company: companyName || 'the company',
          customMessage: customMessage
        });
        console.log(`Application status email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send application status email:', emailError.message);
      }
    }

    return notification;
  },

  async applicationCancelled(companyUserId, application, applicantName) {
    return this.create({
      userId: companyUserId,
      type: 'application_cancelled',
      title: 'Application Cancelled',
      message: `${applicantName || 'A candidate'} has cancelled their application for ${application.jobTitle || 'the position'}.`,
      priority: 'normal',
      senderType: 'user',
      applicationDetails: {
        applicationId: application._id,
        jobTitle: application.jobTitle,
        applicantName
      },
      relatedId: application._id,
      relatedType: 'application'
    });
  },

  async newMessageReceived(recipientId, message, sender, options = {}) {
    const { sendEmailNotification = true } = options;
    
    const notification = await this.create({
      userId: recipientId,
      type: 'message',
      title: 'New Message',
      message: `You have a new message from ${sender.name || 'a user'}: ${message.subject || 'No subject'}`,
      priority: 'normal',
      senderId: sender._id,
      senderType: sender.userType || 'user',
      messageDetails: {
        subject: message.subject,
        preview: message.body?.substring(0, 100) + (message.body?.length > 100 ? '...' : ''),
        messageId: message._id
      },
      relatedId: message._id,
      relatedType: 'message'
    });

    const User = require('../models/User');
    const recipient = await User.findById(recipientId);

    if (sendEmailNotification && recipient?.email) {
      try {
        await sendNewMessageEmail(recipient.email, {
          senderName: sender.name || 'A user',
          recipientName: recipient.name || 'there',
          subject: message.subject || 'No subject',
          preview: message.body?.substring(0, 200) + (message.body?.length > 200 ? '...' : '')
        });
        console.log(`New message email sent to ${recipient.email}`);
      } catch (emailError) {
        console.error('Failed to send new message email:', emailError.message);
      }
    }

    return notification;
  },

  async adminAnnouncement(userId, announcement, adminName) {
    return this.create({
      userId,
      type: 'announcement',
      title: announcement.title || 'System Announcement',
      message: announcement.message,
      priority: announcement.priority || 'normal',
      senderType: 'super_admin',
      announcementDetails: {
        priority: announcement.priority,
        category: announcement.category,
        expiresAt: announcement.expiresAt
      },
      relatedType: 'announcement'
    });
  },

  async adminNotify(companyUserId, notification) {
    return this.create({
      userId: companyUserId,
      type: 'admin_notify',
      title: notification.title,
      message: notification.message,
      priority: notification.priority || 'normal',
      senderType: 'admin',
      metadata: notification.metadata,
      relatedId: notification.relatedId,
      relatedType: notification.relatedType
    });
  },

  async problemReported(problemId, problem, reporter) {
    await this.create({
      userId: reporter._id,
      type: 'problem_report',
      title: 'Problem Reported',
      message: `Your problem report "${problem.category}" has been submitted. We will review it shortly.`,
      priority: 'normal',
      senderType: 'system',
      problemDetails: {
        category: problem.category,
        description: problem.description,
        status: 'pending'
      },
      relatedId: problemId,
      relatedType: 'problem'
    });

    const User = require('../models/User');
    const superAdmins = await User.find({ userType: 'super_admin', isActive: true });
    
    const notifications = superAdmins.map(admin => ({
      userId: admin._id,
      type: 'problem_report',
      title: 'New Problem Report',
      message: `${reporter.name || reporter.companyName || 'A company'} reported a problem: ${problem.category}`,
      priority: problem.priority === 'urgent' ? 'urgent' : 'high',
      senderId: reporter._id,
      senderType: 'company',
      problemDetails: {
        category: problem.category,
        description: problem.description,
        screenshots: problem.screenshots || [],
        status: 'in_review'
      },
      relatedId: problemId,
      relatedType: 'problem'
    }));

    if (notifications.length > 0) {
      await this.createMany(notifications);
    }

    return true;
  },

  async problemStatusUpdate(reporterId, problem, adminResponse) {
    let title, message;
    
    switch (problem.status) {
      case 'resolved':
        title = 'Problem Resolved';
        message = `Your problem report "${problem.category}" has been resolved. ${adminResponse ? `Response: ${adminResponse}` : ''}`;
        break;
      case 'rejected':
        title = 'Problem Report Update';
        message = `Your problem report "${problem.category}" could not be processed. ${adminResponse ? `Reason: ${adminResponse}` : 'Please contact support for more information.'}`;
        break;
      default:
        title = 'Problem Report Update';
        message = `Your problem report "${problem.category}" is being reviewed.`;
    }

    return this.create({
      userId: reporterId,
      type: 'problem_report',
      title,
      message,
      priority: problem.status === 'resolved' ? 'normal' : 'high',
      senderType: 'admin',
      problemDetails: {
        category: problem.category,
        description: problem.description,
        status: problem.status,
        adminResponse
      },
      relatedId: problem._id,
      relatedType: 'problem'
    });
  },

  async interviewScheduled(candidateId, interview, companyName, jobTitle, scheduledDate, meetingLink) {
    return this.create({
      userId: candidateId,
      type: 'interview',
      title: 'Interview Scheduled',
      message: `You have an interview on ${new Date(scheduledDate).toLocaleDateString()} at ${new Date(scheduledDate).toLocaleTimeString()} for ${jobTitle} at ${companyName}.`,
      priority: 'high',
      senderType: 'company',
      jobDetails: {
        title: jobTitle,
        company: companyName,
        status: 'interview_scheduled'
      },
      relatedId: interview._id,
      relatedType: 'interview'
    });
  },

  async interviewReminder(candidateId, interview, companyName, jobTitle) {
    return this.create({
      userId: candidateId,
      type: 'interview_reminder',
      title: 'Interview Reminder',
      message: `Reminder: Your interview for ${jobTitle} at ${companyName} is coming up!`,
      priority: 'high',
      senderType: 'company',
      jobDetails: {
        title: jobTitle,
        company: companyName,
        status: 'interview_scheduled'
      },
      relatedId: interview._id,
      relatedType: 'interview'
    });
  },

  async interviewCancelled(candidateId, interview, companyName, jobTitle) {
    return this.create({
      userId: candidateId,
      type: 'interview_cancelled',
      title: 'Interview Cancelled',
      message: `Your interview for ${jobTitle} at ${companyName} has been cancelled.`,
      priority: 'normal',
      senderType: 'company',
      jobDetails: {
        title: jobTitle,
        company: companyName,
        status: 'cancelled'
      },
      relatedId: interview._id,
      relatedType: 'interview'
    });
  },

  async interviewCompleted(candidateId, interview, companyName, jobTitle) {
    return this.create({
      userId: candidateId,
      type: 'interview_completed',
      title: 'Interview Completed',
      message: `Your interview for ${jobTitle} at ${companyName} has been completed. The company will be in touch soon.`,
      priority: 'normal',
      senderType: 'company',
      jobDetails: {
        title: jobTitle,
        company: companyName,
        status: 'completed'
      },
      relatedId: interview._id,
      relatedType: 'interview'
    });
  },

  async paymentNotification(userId, payment, amount, type) {
    return this.create({
      userId,
      type: 'payment',
      title: payment.status === 'completed' ? 'Payment Received' : 'Payment Update',
      message: `Your ${type} payment of ${amount.toLocaleString()} RWF has been ${payment.status}.`,
      priority: payment.status === 'completed' ? 'high' : 'normal',
      senderType: 'system',
      relatedId: payment._id,
      relatedType: 'payment'
    });
  },

  async systemNotification(userId, title, message, priority = 'normal') {
    return this.create({
      userId,
      type: 'system',
      title,
      message,
      priority,
      senderType: 'system'
    });
  },

  async aiJobMatch(userId, job, matchScore, matchingSkills, matchingExperience) {
    const title = matchScore >= 70 
      ? `Perfect Match: ${job.title}` 
      : `New Job Match: ${job.title}`;
    
    const message = this.buildAiJobMatchMessage(job, matchScore, matchingSkills, matchingExperience);
    const priority = matchScore >= 80 ? 'high' : matchScore >= 60 ? 'normal' : 'low';

    return this.create({
      userId,
      type: 'ai_job_match',
      title,
      message,
      priority,
      senderType: 'system',
      jobDetails: {
        jobId: job._id || job.jobId,
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        salary: job.salary,
        experience: job.experience,
        skills: job.skills,
        matchScore: matchScore,
        matchingSkills: matchingSkills,
        matchingExperience: matchingExperience
      },
      relatedId: job._id || job.jobId,
      relatedType: 'job'
    });
  },

  async aiCandidateMatch(companyUserId, candidate, job, matchScore, matchingSkills, matchingExperience) {
    const candidateName = candidate.name || candidate.candidateName || 'Anonymous Candidate';
    const title = matchScore >= 70 
      ? `Strong Candidate Match: ${candidateName}` 
      : `New Candidate Match for ${job.title}`;
    
    const message = this.buildAiCandidateMatchMessage(candidate, job, matchScore, matchingSkills, matchingExperience);
    const priority = matchScore >= 80 ? 'high' : matchScore >= 60 ? 'normal' : 'low';

    return this.create({
      userId: companyUserId,
      type: 'ai_candidate_match',
      title,
      message,
      priority,
      senderType: 'system',
      jobDetails: {
        jobId: job._id || job.jobId,
        title: job.title,
        matchScore: matchScore,
        matchingSkills: matchingSkills,
        matchingExperience: matchingExperience
      },
      applicationDetails: {
        candidateId: candidate._id || candidate.candidateId,
        candidateName: candidateName,
        candidateEmail: candidate.email || candidate.candidateEmail,
        candidateTitle: candidate.profile?.title || candidate.candidateTitle,
        candidateSkills: candidate.profile?.skills || candidate.candidateSkills,
        candidateExperience: candidate.profile?.experience || candidate.candidateExperience
      },
      relatedId: candidate._id || candidate.candidateId,
      relatedType: 'candidate'
    });
  },

  buildAiJobMatchMessage(job, matchScore, matchingSkills, matchingExperience) {
    let message = `Our AI found a ${matchScore}% match for you! `;
    
    if (matchingSkills && matchingSkills.length > 0) {
      message += `Your skills (${matchingSkills.slice(0, 3).join(', ')}) match this job. `;
    }
    
    if (matchingExperience) {
      message += `Your experience level aligns well. `;
    }
    
    message += job.company ? `This position is at ${job.company}. ` : '';
    message += job.location ? `Location: ${job.location}. ` : '';
    message += job.salary ? `Salary: ${job.salary}. ` : '';
    message += `Apply now to take advantage of this opportunity!`;
    
    return message;
  },

  buildAiCandidateMatchMessage(candidate, job, matchScore, matchingSkills, matchingExperience) {
    const candidateName = candidate.name || candidate.candidateName || 'This candidate';
    let message = `Our AI found a ${matchScore}% match for your job "${job.title}"! `;
    
    if (matchingSkills && matchingSkills.length > 0) {
      message += `This candidate has matching skills: ${matchingSkills.slice(0, 3).join(', ')}. `;
    }
    
    if (matchingExperience) {
      message += `Their experience level matches your requirements. `;
    }
    
    message += candidate.profile?.title || candidate.candidateTitle ? `Title: ${candidate.profile?.title || candidate.candidateTitle}. ` : '';
    message += candidate.profile?.yearsOfExperience || candidate.candidateExperience ? `Experience: ${candidate.profile?.yearsOfExperience || candidate.candidateExperience} years. ` : '';
    message += `Review their profile to learn more!`;
    
    return message;
  }
};

module.exports = NotificationService;
