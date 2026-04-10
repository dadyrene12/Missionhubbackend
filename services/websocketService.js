const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> WebSocket connection
    this.rooms = new Map(); // roomId -> Set of userIds
    this.messageQueue = new Map(); // userId -> Array of queued messages
  }

  // Initialize WebSocket server
  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('🔌 WebSocket server initialized');
  }

  // Handle new WebSocket connection
  async handleConnection(ws, request) {
    try {
      // Extract token from query parameters or headers
      const token = this.extractToken(request);
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
      const user = await User.findById(decoded.id);

      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }

      // Store connection
      this.clients.set(user._id.toString(), ws);
      ws.userId = user._id.toString();
      ws.userData = user;

      console.log(`👤 User ${user.email} connected via WebSocket`);

      // Send queued messages
      this.sendQueuedMessages(user._id.toString());

      // Handle messages from client
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Handle connection close
      ws.on('close', () => {
        this.handleDisconnection(user._id.toString());
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${user._id}:`, error);
      });

      // Send welcome message
      this.sendToClient(user._id.toString(), {
        type: 'connection',
        data: {
          status: 'connected',
          userId: user._id,
          message: 'Connected to real-time service'
        }
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  // Extract JWT token from request
  extractToken(request) {
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');
    
    if (token) return token;
    
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return null;
  }

  // Handle incoming messages from clients
  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join_room':
          this.joinRoom(ws.userId, message.data.roomId);
          break;
          
        case 'leave_room':
          this.leaveRoom(ws.userId, message.data.roomId);
          break;
          
        case 'chat_message':
          await this.handleChatMessage(ws.userId, message.data);
          break;
          
        case 'typing':
          this.handleTyping(ws.userId, message.data);
          break;
          
        case 'mark_read':
          await this.markAsRead(ws.userId, message.data);
          break;
          
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Handle chat messages
  async handleChatMessage(senderId, data) {
    try {
      const { toUserId, content, jobId, applicationId } = data;

      // Create message in database
      const message = await Message.create({
        fromUserId: senderId,
        toUserId,
        content,
        jobId,
        applicationId,
        type: 'general',
        read: false
      });

      // Populate message details
      const populatedMessage = await Message.findById(message._id)
        .populate('fromUserId', 'name email profile.profilePhoto')
        .populate('toUserId', 'name email profile.profilePhoto');

      // Send to recipient if online
      this.sendToClient(toUserId, {
        type: 'new_message',
        data: populatedMessage
      });

      // Send confirmation to sender
      this.sendToClient(senderId, {
        type: 'message_sent',
        data: populatedMessage
      });

      // Create notification for recipient
      await this.createNotification(toUserId, 'message', 'New Message', 
        `You have a new message from ${populatedMessage.fromUserId.name}`, {
          relatedId: message._id,
          relatedType: 'message',
          messageDetails: {
            subject: 'New Message',
            preview: content.substring(0, 100)
          }
        });

    } catch (error) {
      console.error('Error handling chat message:', error);
      this.sendToClient(senderId, {
        type: 'error',
        data: { message: 'Failed to send message' }
      });
    }
  }

  // Handle typing indicators
  handleTyping(senderId, data) {
    const { toUserId, isTyping, roomId } = data;

    if (toUserId) {
      // Send typing indicator to specific user
      this.sendToClient(toUserId, {
        type: 'typing_indicator',
        data: { userId: senderId, isTyping }
      });
    } else if (roomId) {
      // Send typing indicator to room
      this.sendToRoom(roomId, {
        type: 'typing_indicator',
        data: { userId: senderId, isTyping }
      }, senderId);
    }
  }

  // Mark messages as read
  async markAsRead(userId, data) {
    try {
      const { messageId, senderId } = data;

      await Message.findByIdAndUpdate(messageId, { read: true });

      // Notify sender that message was read
      this.sendToClient(senderId, {
        type: 'message_read',
        data: { messageId, readBy: userId }
      });

    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  // Join a room
  joinRoom(userId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    this.rooms.get(roomId).add(userId);
    
    // Notify other room members
    this.sendToRoom(roomId, {
      type: 'user_joined',
      data: { userId, roomId }
    }, userId);

    console.log(`👥 User ${userId} joined room ${roomId}`);
  }

  // Leave a room
  leaveRoom(userId, roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      
      // Remove room if empty
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      } else {
        // Notify other room members
        this.sendToRoom(roomId, {
          type: 'user_left',
          data: { userId, roomId }
        }, userId);
      }
    }

    console.log(`👤 User ${userId} left room ${roomId}`);
  }

  // Send message to specific client
  sendToClient(userId, message) {
    const client = this.clients.get(userId);
    
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      return true;
    } else {
      // Queue message for when client comes online
      this.queueMessage(userId, message);
      return false;
    }
  }

  // Send message to all users in a room
  sendToRoom(roomId, message, excludeUserId = null) {
    const roomMembers = this.rooms.get(roomId);
    
    if (roomMembers) {
      roomMembers.forEach(userId => {
        if (userId !== excludeUserId) {
          this.sendToClient(userId, message);
        }
      });
    }
  }

  // Send message to all connected users
  broadcast(message, excludeUserId = null) {
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId) {
        this.sendToClient(userId, message);
      }
    });
  }

  // Queue message for offline user
  queueMessage(userId, message) {
    if (!this.messageQueue.has(userId)) {
      this.messageQueue.set(userId, []);
    }
    
    this.messageQueue.get(userId).push({
      ...message,
      timestamp: new Date().toISOString()
    });

    // Limit queue size
    const queue = this.messageQueue.get(userId);
    if (queue.length > 50) {
      queue.shift(); // Remove oldest message
    }
  }

  // Send queued messages when user comes online
  sendQueuedMessages(userId) {
    const queue = this.messageQueue.get(userId);
    
    if (queue && queue.length > 0) {
      queue.forEach(message => {
        this.sendToClient(userId, message);
      });
      
      // Clear queue
      this.messageQueue.delete(userId);
      
      console.log(`📨 Sent ${queue.length} queued messages to user ${userId}`);
    }
  }

  // Handle disconnection
  handleDisconnection(userId) {
    this.clients.delete(userId);
    
    // Remove user from all rooms
    this.rooms.forEach((members, roomId) => {
      if (members.has(userId)) {
        members.delete(userId);
        
        // Notify other room members
        this.sendToRoom(roomId, {
          type: 'user_disconnected',
          data: { userId, roomId }
        });
        
        // Remove empty room
        if (members.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    });

    console.log(`👋 User ${userId} disconnected`);
  }

  // Create and send notification
  async createNotification(userId, type, title, message, options = {}) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        priority: options.priority || 'normal',
        jobDetails: options.jobDetails || {},
        messageDetails: options.messageDetails || {},
        actions: options.actions || [],
        relatedId: options.relatedId,
        relatedType: options.relatedType
      });

      // Send real-time notification
      this.sendToClient(userId, {
        type: 'notification',
        data: notification
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  // Send system-wide notification
  async sendSystemNotification(title, message, options = {}) {
    const broadcastMessage = {
      type: 'system_notification',
      data: {
        title,
        message,
        priority: options.priority || 'normal',
        timestamp: new Date().toISOString()
      }
    };

    this.broadcast(broadcastMessage);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.clients.size;
  }

  // Get room members count
  getRoomMembersCount(roomId) {
    return this.rooms.get(roomId)?.size || 0;
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.clients.has(userId);
  }

  // Get connection statistics
  getStats() {
    return {
      onlineUsers: this.clients.size,
      activeRooms: this.rooms.size,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((total, queue) => total + queue.length, 0)
    };
  }
}

module.exports = new WebSocketService();
