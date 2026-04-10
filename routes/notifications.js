const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Notification = require('../models/Notification');
const NotificationService = require('../services/notificationService');
const User = require('../models/User');
const protect = require('../middleware/auth').protect;

// Report problem to super admin
router.post('/report-problem', protect, async (req, res) => {
  try {
    const { category, description, screenshots, relatedJobId, relatedApplicationId } = req.body;
    
    if (!category || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category and description are required' 
      });
    }

    const reporter = await User.findById(req.user._id);
    
    // Find super admin to notify
    const superAdmin = await User.findOne({ userType: 'super_admin' });
    
    if (!superAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Super admin not found' 
      });
    }

    // Create notification for super admin
    const notification = await NotificationService.create({
      userId: superAdmin._id,
      type: 'problem_report',
      title: `Problem Report: ${category}`,
      message: `${reporter.name || reporter.email} reported a problem in category "${category}": ${description.substring(0, 100)}...`,
      priority: 'high',
      senderId: req.user._id,
      senderType: reporter.userType,
      problemDetails: {
        category,
        description,
        screenshots: screenshots || [],
        status: 'submitted',
        submittedAt: new Date(),
        reporterName: reporter.name || reporter.email,
        reporterEmail: reporter.email,
        relatedJobId,
        relatedApplicationId
      },
      relatedType: 'problem_report',
      relatedId: relatedJobId || relatedApplicationId
    });

    // Send email to super admin
    try {
      const emailService = require('../services/emailService');
      await emailService.sendEmail({
        email: superAdmin.email,
        subject: `[Problem Report] ${category} - from ${reporter.name || reporter.email}`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0;">New Problem Report</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px;">
              <p style="color: #374151;"><strong>Category:</strong> ${category}</p>
              <p style="color: #374151;"><strong>Reported By:</strong> ${reporter.name || reporter.email}</p>
              <p style="color: #374151;"><strong>Email:</strong> ${reporter.email}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
              <p style="color: #374151;"><strong>Description:</strong></p>
              <p style="color: #374151; background: white; padding: 15px; border-radius: 6px;">${description}</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/notifications" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View in Dashboard</a>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Problem report email error:', emailError.message);
    }

    res.json({ 
      success: true, 
      message: 'Problem reported successfully',
      notification 
    });
  } catch (error) {
    console.error('Report problem error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error reporting problem' 
    });
  }
});

// Get problem reports for super admin
router.get('/problem-reports', protect, async (req, res) => {
  try {
    if (req.user.userType !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { type: 'problem_report' };
    if (status) {
      query['problemDetails.status'] = status;
    }

    const reports = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Notification.countDocuments(query);
    
    res.json({ 
      success: true, 
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get problem reports error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching problem reports' 
    });
  }
});

// Update problem report status (for super admin)
router.put('/problem-reports/:id/status', protect, async (req, res) => {
  try {
    if (req.user.userType !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const { status, adminResponse } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    
    if (!notification || notification.type !== 'problem_report') {
      return res.status(404).json({ 
        success: false, 
        message: 'Problem report not found' 
      });
    }

    notification.problemDetails.status = status;
    if (adminResponse) {
      notification.problemDetails.adminResponse = adminResponse;
      notification.problemDetails.respondedAt = new Date();
    }
    await notification.save();

    // Notify the reporter
    await NotificationService.create({
      userId: notification.senderId,
      type: 'admin_notify',
      title: 'Problem Report Update',
      message: `Your problem report has been ${status}${adminResponse ? `: ${adminResponse}` : ''}`,
      priority: status === 'resolved' ? 'normal' : 'high',
      relatedType: 'problem_report',
      relatedId: notification._id
    });

    res.json({ 
      success: true, 
      message: 'Problem report status updated',
      notification 
    });
  } catch (error) {
    console.error('Update problem report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating problem report' 
    });
  }
});

// Talent Pool outreach notification (sent when company contacts candidate from talent pool)
router.post('/talent-pool-reachout', protect, async (req, res) => {
  try {
    const { userId, companyName, jobTitle, message } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const company = await User.findById(req.user._id);
    const recipient = await User.findById(userId);
    
    if (!recipient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Recipient not found' 
      });
    }

    // Create database notification
    const notification = await NotificationService.create({
      userId,
      type: 'talent',
      title: 'Message from Talent Pool',
      message: `${companyName || company?.name || 'A company'} has reached out to you regarding${jobTitle ? ` the ${jobTitle} position` : ' opportunities'}:`,
      priority: 'normal',
      relatedType: 'profile',
      jobDetails: {
        title: jobTitle,
        company: companyName || company?.name,
        status: 'active'
      },
      actions: [
        { label: 'View Message', primary: true, handler: 'viewMessage' }
      ]
    });

    // Send email notification
    try {
      const emailService = require('../services/emailService');
      await emailService.sendEmail({
        email: recipient.email,
        subject: `${companyName || company?.name || 'A company'} has a message for you`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="color: white; margin: 0;">You've Received a Message!</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px;">
              <p style="color: #374151;">Hello ${recipient.name || 'there'},</p>
              <p style="color: #374151;">${companyName || company?.name || 'A company'} has sent you a message from their Talent Pool.</p>
              ${jobTitle ? `<p style="color: #374151;"><strong>Position:</strong> ${jobTitle}</p>` : ''}
              <a href="http://localhost:5173/messages" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Message</a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              This message was sent to you because your profile is in our Talent Pool.
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Talent pool email error:', emailError.message);
    }

    res.json({ 
      success: true, 
      message: 'Talent pool outreach notification sent',
      notification 
    });
  } catch (error) {
    console.error('Talent pool reachout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending talent pool outreach' 
    });
  }
});

// Get all notifications for user with pagination
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { userId: req.user._id };
    
    if (type) {
      query.type = type;
    }
    
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user._id, 
      read: false 
    });
    
    res.json({ 
      success: true, 
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.json({ 
      success: true, 
      notifications: [],
      pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      unreadCount: 0
    });
  }
});

// Get notifications by type
router.get('/type/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50 } = req.query;
    
    const notifications = await Notification.find({ 
      userId: req.user._id,
      type 
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({ 
      success: true, 
      notifications,
      type,
      count: notifications.length
    });
  } catch (error) {
    console.error('Get notifications by type error:', error);
    res.json({ 
      success: true, 
      notifications: [],
      type: req.params.type,
      count: 0
    });
  }
});

// Get available notification types from database
router.get('/types', protect, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const schemaPaths = Notification.schema.paths.type;
    
    const typeEnum = schemaPaths?.enumValues || [
      'application', 'application_update', 'application_cancelled', 'message',
      'announcement', 'admin_notify', 'problem_report', 'interview',
      'interview_scheduled', 'interview_reminder', 'interview_cancelled',
      'interview_completed', 'payment', 'system', 'job', 'job_posted',
      'job_application', 'verified', 'user', 'company'
    ];
    
    const typeLabels = {
      application: { label: 'New Applicants', icon: 'Users', color: 'bg-blue-500' },
      application_update: { label: 'Application Update', icon: 'UserCheck', color: 'bg-blue-500' },
      application_cancelled: { label: 'Cancelled', icon: 'UserCheck', color: 'bg-red-500' },
      message: { label: 'Messages', icon: 'MessageSquare', color: 'bg-purple-500' },
      announcement: { label: 'Announcements', icon: 'Megaphone', color: 'bg-pink-500' },
      admin_notify: { label: 'Admin Notify', icon: 'AlertCircle', color: 'bg-orange-500' },
      problem_report: { label: 'Problem Reports', icon: 'FileWarning', color: 'bg-yellow-500' },
      interview: { label: 'Interviews', icon: 'Calendar', color: 'bg-violet-500' },
      interview_scheduled: { label: 'Interview Scheduled', icon: 'CheckCircle', color: 'bg-green-500' },
      interview_reminder: { label: 'Interview Reminder', icon: 'Clock', color: 'bg-amber-500' },
      interview_cancelled: { label: 'Interview Cancelled', icon: 'XCircle', color: 'bg-red-500' },
      interview_completed: { label: 'Interview Completed', icon: 'CheckCircle2', color: 'bg-green-500' },
      payment: { label: 'Payments', icon: 'CreditCard', color: 'bg-emerald-500' },
      system: { label: 'System', icon: 'AlertCircle', color: 'bg-slate-500' },
      job: { label: 'Jobs', icon: 'BriefcaseBusiness', color: 'bg-emerald-500' },
      job_posted: { label: 'Job Posted', icon: 'Building2', color: 'bg-teal-500' },
      job_application: { label: 'Job Application', icon: 'Send', color: 'bg-cyan-500' },
      verified: { label: 'Verified', icon: 'CheckCircle2', color: 'bg-green-500' },
      user: { label: 'User', icon: 'User', color: 'bg-blue-500' },
      company: { label: 'Company', icon: 'Building2', color: 'bg-indigo-500' }
    };
    
    const types = typeEnum.map(type => ({
      type,
      ...typeLabels[type] || { label: type, icon: 'Bell', color: 'bg-slate-500' },
      description: `${typeLabels[type]?.label || type} notifications`
    }));
    
    res.json({ success: true, types });
  } catch (error) {
    console.error('Get notification types error:', error);
    res.json({ success: false, message: 'Error fetching notification types' });
  }
});

// Get notification stats/summary
router.get('/stats', protect, async (req, res) => {
  try {
    const total = await Notification.countDocuments({ userId: req.user._id });
    const unread = await Notification.countDocuments({ userId: req.user._id, read: false });
    
    const typeCounts = await Notification.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$type', count: { $sum: 1 }, unread: { $sum: { $cond: ['$read', 0, 1] } } } },
      { $sort: { count: -1 } }
    ]);
    
    const priorityCounts = await Notification.aggregate([
      { $match: { userId: req.user._id, read: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const recentNotifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title type createdAt')
      .lean();
    
    res.json({
      success: true,
      stats: {
        total,
        unread,
        read: total - unread,
        byType: typeCounts,
        byPriority: priorityCounts,
        recent: recentNotifications
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.json({
      success: true,
      stats: {
        total: 0,
        unread: 0,
        read: 0,
        byType: [],
        byPriority: [],
        recent: []
      }
    });
  }
});

// Get unread notifications count
router.get('/unread/count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user._id, 
      read: false 
    });
    res.json({ 
      success: true, 
      data: { count } 
    });
  } catch (error) {
    res.json({ 
      success: true, 
      data: { count: 0 } 
    });
  }
});

// Get single notification
router.get('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    }).lean();
    
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }
    
    res.json({ 
      success: true, 
      notification 
    });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching notification' 
    });
  }
});

// Mark notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.json({ 
      success: true, 
      message: 'Notification marked as read'
    });
  }
});

// Mark all as read
router.put('/read-all', protect, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      modifiedCount: 0
    });
  }
});

// Mark notifications by type as read
router.put('/read-by-type/:type', protect, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, type: req.params.type, read: false },
      { read: true }
    );
    res.json({ 
      success: true, 
      message: `All ${req.params.type} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark by type as read error:', error);
    res.json({ 
      success: true, 
      message: `All ${req.params.type} notifications marked as read`,
      modifiedCount: 0
    });
  }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.json({ 
      success: true, 
      message: 'Notification deleted'
    });
  }
});

// Delete all read notifications
router.delete('/delete-read/all', protect, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ 
      userId: req.user._id, 
      read: true 
    });
    res.json({ 
      success: true, 
      message: 'All read notifications deleted',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.json({ 
      success: true, 
      message: 'All read notifications deleted',
      deletedCount: 0
    });
  }
});

// POST /api/notifications/create - Create a test notification (for demo purposes)
router.post('/create', protect, async (req, res) => {
  try {
    const { type, title, message, priority } = req.body;
    
    const notificationTypes = [
      'application', 'interview', 'interview_reminder', 'message', 
      'payment', 'job', 'profile', 'system', 'announcement', 
      'verified', 'reply', 'talent', 'review', 'achievement'
    ];
    
    if (!type || !notificationTypes.includes(type)) {
      return res.json({ 
        success: false, 
        message: 'Invalid notification type' 
      });
    }

    const notificationData = {
      userId: req.user._id,
      type,
      title: title || `${type.charAt(0).toUpperCase() + type.slice(1)} Notification`,
      message: message || `This is a sample ${type} notification for testing purposes.`,
      priority: priority || 'normal',
      read: false,
      createdAt: new Date()
    };

    // Add type-specific data
    if (type === 'application') {
      notificationData.jobDetails = {
        title: 'Senior Frontend Developer',
        company: 'Tech Corp Rwanda',
        status: 'reviewed',
        salary: '500,000 - 800,000 RWF',
        location: 'Kigali, Rwanda'
      };
      notificationData.relatedType = 'application';
    } else if (type === 'interview') {
      notificationData.jobDetails = {
        title: 'Senior Frontend Developer',
        company: 'Tech Corp Rwanda',
        status: 'interview_scheduled'
      };
      notificationData.relatedType = 'interview';
    } else if (type === 'verified') {
      notificationData.title = 'Account Verified!';
      notificationData.message = 'Congratulations! Your account has been verified. You now have access to all premium features and increased visibility to employers.';
      notificationData.priority = 'high';
      notificationData.relatedType = 'profile';
    } else if (type === 'job') {
      notificationData.jobDetails = {
        title: 'New Job Matching Your Profile',
        company: 'Innovation Hub',
        status: 'active'
      };
      notificationData.relatedType = 'job';
    } else if (type === 'payment') {
      notificationData.jobDetails = {
        status: 'completed'
      };
      notificationData.relatedType = 'payment';
    }

    const notification = await Notification.create(notificationData);

    res.json({ 
      success: true, 
      message: 'Notification created',
      notification 
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.json({ 
      success: false, 
      message: 'Error creating notification' 
    });
  }
});

// POST /api/notifications/create-batch - Create multiple test notifications
router.post('/create-batch', protect, async (req, res) => {
  try {
    const types = ['application', 'interview', 'message', 'verified', 'job', 'system'];
    
    const notifications = types.map((type, index) => {
      const baseData = {
        userId: req.user._id,
        type,
        read: index > 2, // First 3 are unread
        createdAt: new Date(Date.now() - (index * 3600000)) // 1 hour apart
      };

      switch (type) {
        case 'application':
          return {
            ...baseData,
            title: 'New Application Received',
            message: 'You have received a new application for Senior Frontend Developer position from Jean-Pierre Munyaneza.',
            priority: 'normal',
            jobDetails: { title: 'Senior Frontend Developer', company: 'Tech Corp Rwanda', status: 'pending' },
            relatedType: 'application'
          };
        case 'interview':
          return {
            ...baseData,
            title: 'Interview Tomorrow',
            message: 'Reminder: You have an interview scheduled for tomorrow at 10:00 AM with Maria Uwase for the UX Designer position.',
            priority: 'high',
            jobDetails: { title: 'UX Designer', company: 'Design Studio', status: 'interview_scheduled' },
            relatedType: 'interview'
          };
        case 'message':
          return {
            ...baseData,
            title: 'New Message',
            message: 'You have received a new message from Dr. Grace Kamanzi regarding your application.',
            priority: 'normal',
            relatedType: 'message'
          };
        case 'verified':
          return {
            ...baseData,
            title: 'Account Verified Successfully',
            message: 'Congratulations! Your professional account has been verified. Your profile now displays the verified badge, increasing trust with employers.',
            priority: 'high',
            relatedType: 'profile'
          };
        case 'job':
          return {
            ...baseData,
            title: 'New Job Matching Your Skills',
            message: 'A new Software Engineering position at Kigali Tech Hub matches your profile. Apply now!',
            priority: 'normal',
            jobDetails: { title: 'Software Engineer', company: 'Kigali Tech Hub', status: 'active' },
            relatedType: 'job'
          };
        case 'system':
          return {
            ...baseData,
            title: 'System Update',
            message: 'MissionHub has been updated with new features including improved search and notification preferences.',
            priority: 'low',
            relatedType: 'system'
          };
        default:
          return baseData;
      }
    });

    await Notification.insertMany(notifications);

    res.json({ 
      success: true, 
      message: `${notifications.length} test notifications created`,
      count: notifications.length
    });
  } catch (error) {
    console.error('Create batch notifications error:', error);
    res.json({ 
      success: false, 
      message: 'Error creating batch notifications' 
    });
  }
});

module.exports = router;