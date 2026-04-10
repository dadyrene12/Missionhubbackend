const express = require('express');
const router = express.Router();
const websocketService = require('../services/websocketService');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

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

// Get WebSocket connection info
router.get('/connection-info', protect, (req, res) => {
  const userId = req.user._id.toString();
  const isOnline = websocketService.isUserOnline(userId);
  
  res.json({
    success: true,
    isOnline,
    onlineUsersCount: websocketService.getOnlineUsersCount(),
    timestamp: new Date().toISOString()
  });
});

// Send real-time notification to specific user
router.post('/notify/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, title, message, priority, options } = req.body;

    // Verify sender has permission to send notifications
    if (req.user.userType !== 'admin' && req.user.userType !== 'super_admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send notifications to this user'
      });
    }

    const notification = await websocketService.createNotification(userId, type, title, message, {
      priority,
      ...options
    });

    res.json({
      success: true,
      notification,
      delivered: websocketService.isUserOnline(userId)
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending notification'
    });
  }
});

// Send system-wide notification (admin only)
router.post('/system-notify', protect, async (req, res) => {
  try {
    // Only admins can send system notifications
    if (req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { title, message, priority } = req.body;

    await websocketService.sendSystemNotification(title, message, { priority });

    res.json({
      success: true,
      message: 'System notification sent',
      deliveredTo: websocketService.getOnlineUsersCount()
    });

  } catch (error) {
    console.error('Send system notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending system notification'
    });
  }
});

// Get online users list (admin only)
router.get('/online-users', protect, async (req, res) => {
  try {
    // Only admins can see online users
    if (req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = websocketService.getStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching online users'
    });
  }
});

// Create chat room for job application
router.post('/create-room/:jobId/:applicationId', protect, async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    const userId = req.user._id;

    // Verify user is part of this application (either applicant or company)
    const Application = require('../models/Application');
    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user is authorized
    const isApplicant = application.userId.toString() === userId.toString();
    const isCompany = application.postedBy.toString() === userId.toString();

    if (!isApplicant && !isCompany) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this chat'
      });
    }

    const roomId = `job_${jobId}_app_${applicationId}`;

    res.json({
      success: true,
      roomId,
      participants: {
        applicant: application.userId,
        company: application.postedBy
      }
    });

  } catch (error) {
    console.error('Create chat room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating chat room'
    });
  }
});

// Get chat history
router.get('/chat-history/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;

    // Parse room ID to get job and application IDs
    const match = roomId.match(/^job_(.+)_app_(.+)$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID format'
      });
    }

    const [, jobId, applicationId] = match;

    // Verify user is part of this application
    const Application = require('../models/Application');
    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const isApplicant = application.userId.toString() === userId.toString();
    const isCompany = application.postedBy.toString() === userId.toString();

    if (!isApplicant && !isCompany) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this chat'
      });
    }

    // Get chat history
    const messages = await Message.find({
      $or: [
        { fromUserId: userId, toUserId: isApplicant ? application.postedBy : application.userId },
        { fromUserId: isApplicant ? application.postedBy : application.userId, toUserId: userId }
      ],
      jobId,
      applicationId
    })
    .populate('fromUserId', 'name email profile.profilePhoto')
    .populate('toUserId', 'name email profile.profilePhoto')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      $or: [
        { fromUserId: userId, toUserId: isApplicant ? application.postedBy : application.userId },
        { fromUserId: isApplicant ? application.postedBy : application.userId, toUserId: userId }
      ],
      jobId,
      applicationId
    });

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching chat history'
    });
  }
});

// Mark messages as read
router.put('/mark-read/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only recipient can mark as read
    if (message.toUserId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read'
      });
    }

    message.read = true;
    await message.save();

    // Notify sender via WebSocket
    websocketService.sendToClient(message.fromUserId.toString(), {
      type: 'message_read',
      data: {
        messageId: message._id,
        readBy: userId,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking message as read'
    });
  }
});

// Get unread notifications count
router.get('/unread-notifications', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false
    });

    res.json({
      success: true,
      unreadCount
    });

  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread notifications'
    });
  }
});

// Mark notifications as read
router.put('/notifications/read', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationIds } = req.body;

    const filter = { userId, read: false };
    if (notificationIds && notificationIds.length > 0) {
      filter._id = { $in: notificationIds };
    }

    const result = await Notification.updateMany(filter, { read: true });

    res.json({
      success: true,
      updatedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notifications as read'
    });
  }
});

// Get recent notifications
router.get('/notifications', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;

    const filter = { userId };
    if (type) {
      filter.type = type;
    }

    const notifications = await Notification.find(filter)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

module.exports = router;
