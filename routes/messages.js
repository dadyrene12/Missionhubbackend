const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const Message = require('../models/Message');
const User = require('../models/User');
const Application = require('../models/Application');

// Import email service
const emailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');

// Helper function to send email notification
const sendMessageEmailNotification = async (message, recipient, sender) => {
  try {
    await emailService.sendNewMessageEmail(recipient.email, {
      senderName: sender.name || 'A user',
      recipientName: recipient.name || 'there',
      subject: message.subject || 'No subject',
      preview: message.body?.substring(0, 200) + (message.body?.length > 200 ? '...' : '')
    });
    console.log(`Email notification sent to ${recipient.email}`);
  } catch (error) {
    console.error('Error sending email notification:', error.message);
  }
};

// Import auth middleware
const { protect } = require('../middleware/auth');

// Get all messages for current user
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { filter } = req.query; // 'all', 'sent', 'received'
    
    let query = {};
    if (filter === 'sent') {
      query = { fromUserId: userId };
    } else if (filter === 'received') {
      query = { toUserId: userId };
    } else {
      query = {
        $or: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      };
    }
    
    const messages = await Message.find(query)
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('jobId', 'title company')
    .populate('applicationId', 'jobTitle status')
    .sort({ sentAt: -1 });

    res.json({ 
      success: true, 
      message: 'Messages retrieved successfully',
      data: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve messages',
      error: error.message
    });
  }
});

// Get sent messages only
router.get('/sent', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const messages = await Message.find({ fromUserId: userId })
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('jobId', 'title company')
    .populate('applicationId', 'jobTitle status')
    .sort({ sentAt: -1 });

    res.json({ 
      success: true, 
      message: 'Sent messages retrieved successfully',
      data: messages
    });
  } catch (error) {
    console.error('Get sent messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve sent messages',
      error: error.message
    });
  }
});

// Get received messages only
router.get('/received', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const messages = await Message.find({ toUserId: userId })
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('jobId', 'title company')
    .populate('applicationId', 'jobTitle status')
    .sort({ sentAt: -1 });

    res.json({ 
      success: true, 
      message: 'Received messages retrieved successfully',
      data: messages
    });
  } catch (error) {
    console.error('Get received messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve received messages',
      error: error.message
    });
  }
});

// Delete a message
router.delete('/:id', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    // Only allow delete if user is sender or receiver
    if (message.fromUserId.toString() !== userId && message.toUserId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }
    
    await Message.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// Edit a message
router.put('/:id', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { body } = req.body;
    
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    // Only allow edit if user is the sender
    if (message.fromUserId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this message' });
    }
    
    message.body = body;
    message.editedAt = new Date();
    await message.save();
    
    const updatedMessage = await Message.findById(req.params.id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email');
    
    res.json({ 
      success: true, 
      message: 'Message updated successfully',
      data: updatedMessage
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to edit message',
      error: error.message
    });
  }
});

// Get all conversations for current user
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Get unique conversation partners
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { fromUserId: new mongoose.Types.ObjectId(userId) },
            { toUserId: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $addFields: {
          otherUser: {
            $cond: {
              if: { $eq: ['$fromUserId', new mongoose.Types.ObjectId(userId)] },
              then: '$toUserId',
              else: '$fromUserId'
            }
          }
        }
      },
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$toUserId', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 1,
          user: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email'
          },
          lastMessage: 1,
          unreadCount: 1
        }
      },
      { $sort: { 'lastMessage.sentAt': -1 } }
    ]);

    res.json({ 
      success: true, 
      message: 'Conversations retrieved successfully',
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve conversations',
      error: error.message
    });
  }
});

// Get messages for a conversation with a specific user (alternative route)
router.get('/conversation/:userId', protect, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    const otherUserId = req.params.userId;
    
    const messages = await Message.find({
      $or: [
        { fromUserId: currentUserId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: currentUserId }
      ]
    })
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('jobId', 'title company')
    .populate('applicationId', 'jobTitle status')
    .sort({ sentAt: 1 });

    await Message.updateMany(
      { 
        fromUserId: otherUserId, 
        toUserId: currentUserId, 
        read: false 
      },
      { read: true }
    );

    res.json({ 
      success: true, 
      message: 'Conversation messages retrieved successfully',
      data: messages,
      messages: messages
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve conversation messages',
      error: error.message
    });
  }
});

// Get messages for a conversation with a specific user
router.get('/:userId', protect, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    const otherUserId = req.params.userId;
    
    const messages = await Message.find({
      $or: [
        { fromUserId: currentUserId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: currentUserId }
      ]
    })
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('jobId', 'title company')
    .populate('applicationId', 'jobTitle status')
    .sort({ sentAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { 
        fromUserId: otherUserId, 
        toUserId: currentUserId, 
        read: false 
      },
      { read: true }
    );

    res.json({ 
      success: true, 
      message: 'Messages retrieved successfully',
      data: messages
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve conversation messages',
      error: error.message
    });
  }
});

// Send a message
router.post('/', protect, async (req, res) => {
  try {
    const { toUserId, subject, body, jobId, applicationId, type, priority, sendEmail: shouldSendEmail, sendInApp: shouldSendInApp } = req.body;
    const fromUserId = req.user?._id || req.user?.id;

    // Validate required fields
    if (!toUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient user ID is required'
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message body is required'
      });
    }

    // Check if recipient exists
    let recipient;
    try {
      recipient = await User.findById(toUserId);
    } catch (userError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid recipient user ID'
      });
    }
    
    if (!recipient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Recipient not found'
      });
    }

    // Check sender exists
    if (!fromUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Sender not found - please login again'
      });
    }

    const sender = await User.findById(fromUserId);

    // Create message
    const messageData = {
      fromUserId,
      toUserId,
      subject: subject || 'No Subject',
      body: body.trim(),
      jobId: jobId || undefined,
      applicationId: applicationId || undefined,
      type: type || 'general',
      priority: priority || 'normal',
      read: false
    };
    
    const message = new Message(messageData);

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('jobId', 'title company')
      .populate('applicationId', 'jobTitle status');

    // Send in-app notification (default true)
    if (shouldSendInApp !== false) {
      try {
        if (sender && recipient) {
          await NotificationService.newMessageReceived(toUserId, message, sender);
        }
      } catch (notifyError) {
        console.error('Notification error (non-critical):', notifyError.message);
      }
    }

    // Send email notification (default true)
    if (shouldSendEmail !== false) {
      try {
        if (sender && recipient && recipient.email) {
          await sendMessageEmailNotification(message, recipient, sender);
        }
      } catch (emailError) {
        console.error('Email error (non-critical):', emailError.message);
      }
    }

    res.status(201).json({ 
      success: true, 
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message: ' + error.message,
      error: error.message
    });
  }
});

// Company send message to applicant
router.post('/company', protect, async (req, res) => {
  try {
    const { userId, message: messageBody, subject, sendEmail: shouldSendEmail, sendInApp: shouldSendInApp } = req.body;
    const fromUserId = req.user?._id || req.user?.id;

    // Validate required fields
    if (!userId || !messageBody) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and message are required'
      });
    }

    if (!messageBody.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message body cannot be empty'
      });
    }

    // Check sender
    if (!fromUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Sender not found - please login again'
      });
    }

    const sender = await User.findById(fromUserId);
    const recipient = await User.findById(userId);

    // Create message
    const message = new Message({
      fromUserId,
      toUserId: userId,
      subject: subject || 'Message from Company',
      body: messageBody.trim(),
      type: 'application_related',
      priority: 'normal',
      read: false
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email');

    // Send in-app notification (default true)
    if (shouldSendInApp !== false) {
      try {
        if (sender && recipient) {
          await NotificationService.newMessageReceived(userId, message, sender);
        }
      } catch (notifyError) {
        console.error('Notification error (non-critical):', notifyError.message);
      }
    }

    // Send email notification (default true)
    if (shouldSendEmail !== false) {
      try {
        if (sender && recipient && recipient.email) {
          await sendMessageEmailNotification(message, recipient, sender);
        }
      } catch (emailError) {
        console.error('Email error (non-critical):', emailError.message);
      }
    }

    res.status(201).json({ 
      success: true, 
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Company send message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message: ' + error.message,
      error: error.message
    });
  }
});

// Mark message as read
router.put('/:messageId/read', protect, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { read: true },
      { new: true }
    ).populate('fromUserId', 'name email')
     .populate('toUserId', 'name email');

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found'
      });
    }

    res.json({ 
      success: true, 
      message: 'Message marked as read',
      data: message
    });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
});

// Delete message
router.delete('/:messageId', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    const messageId = req.params.messageId;
    
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found'
      });
    }

    // Check if user owns the message
    const fromUserId = message.fromUserId?.toString();
    const toUserId = message.toUserId?.toString();
    
    if (fromUserId !== userId && toUserId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own messages'
      });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ 
      success: true, 
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// Edit message
router.put('/:messageId', protect, async (req, res) => {
  try {
    const { body } = req.body;
    const userId = req.user?.id;
    const messageId = req.params.messageId;
    
    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message body is required'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found'
      });
    }

    // Check if user owns the message
    const fromUserId = message.fromUserId?.toString();
    
    if (fromUserId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only edit your own messages'
      });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { body, editedAt: new Date() },
      { new: true }
    ).populate('fromUserId', 'name email')
     .populate('toUserId', 'name email');

    res.json({ 
      success: true, 
      message: 'Message updated successfully',
      data: updatedMessage
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to edit message',
      error: error.message
    });
  }
});

// Reply to message
router.post('/reply', protect, async (req, res) => {
  try {
    const { toUserId, body, replyToMessageId } = req.body;
    const fromUserId = req.user?._id || req.user?.id;

    if (!toUserId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient is required'
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message body is required'
      });
    }

    const message = await Message.create({
      fromUserId,
      toUserId,
      body,
      replyTo: replyToMessageId,
      subject: 'Re: Message'
    });

    const populated = await Message.findById(message._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('replyTo', 'body fromUserId');

    res.json({ 
      success: true, 
      message: 'Reply sent successfully',
      data: populated
    });
  } catch (error) {
    console.error('Reply message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send reply',
      error: error.message
    });
  }
});

// Get unread message count
router.get('/unread/count', protect, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const unreadCount = await Message.countDocuments({
      toUserId: userId,
      read: false
    });

    res.json({ 
      success: true, 
      message: 'Unread count retrieved successfully',
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get unread count',
      error: error.message
    });
  }
});

// Bulk send messages to multiple recipients
router.post('/bulk', protect, async (req, res) => {
  try {
    const { userIds, subject, body, sendEmail: shouldSendEmail } = req.body;
    const fromUserId = req.user?._id || req.user?.id;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one recipient is required'
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message body is required'
      });
    }

    if (!fromUserId) {
      return res.status(400).json({
        success: false,
        message: 'Sender not found - please login again'
      });
    }

    const sender = await User.findById(fromUserId);
    if (!sender) {
      return res.status(400).json({
        success: false,
        message: 'Sender not found'
      });
    }

    const results = { success: 0, failed: 0, sent: [] };
    const emailPromises = [];

    for (const toUserId of userIds) {
      try {
        // Check if recipient exists
        const recipient = await User.findById(toUserId);
        if (!recipient) {
          results.failed++;
          continue;
        }

        // Create message
        const message = new Message({
          fromUserId,
          toUserId,
          subject: subject || 'Message from Company',
          body: body.trim(),
          type: 'bulk',
          priority: 'normal',
          read: false
        });

        await message.save();

        // Create notification
        try {
          await NotificationService.newMessageReceived(toUserId, message, sender);
        } catch (notifyError) {
          console.error('Notification error (non-critical):', notifyError.message);
        }

        // Send email if requested
        if (shouldSendEmail && recipient.email) {
          emailPromises.push(
            emailService.sendEmail({
              email: recipient.email,
              subject: subject || 'Message from Company',
              message: body.trim()
            }).catch(err => console.error('Bulk email error:', err.message))
          );
        }

        results.success++;
        results.sent.push({ userId: toUserId, messageId: message._id });
      } catch (err) {
        console.error('Error sending to user:', toUserId, err.message);
        results.failed++;
      }
    }

    // Wait for all emails to be sent
    if (emailPromises.length > 0) {
      await Promise.all(emailPromises);
    }

    res.json({
      success: true,
      message: `Messages sent: ${results.success}, Failed: ${results.failed}`,
      data: results
    });
  } catch (error) {
    console.error('Bulk send messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk messages: ' + error.message,
      error: error.message
    });
  }
});

module.exports = router;