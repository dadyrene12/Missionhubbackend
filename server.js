const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import models
const Application = require('./models/Application');
const User = require('./models/User');
const Job = require('./models/Job');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// ========================
// DATABASE CONNECTION
// ========================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mission_hub'
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Clean up any existing users with invalid emails
    try {
      const userCollection = mongoose.connection.collection('users');
      const cleanupResult = await userCollection.deleteMany({
        $or: [
          { email: null },
          { email: { $exists: false } },
          { email: "" }
        ]
      });
      
      if (cleanupResult.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanupResult.deletedCount} users with invalid emails`);
      }
    } catch (cleanupError) {
      console.log('ℹ️  Cleanup not necessary');
    }
    
    console.log('🚀 Starting AI Matching Scheduler...');
    const aiMatchingScheduler = require('./services/aiMatchingScheduler');
    aiMatchingScheduler.start();
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// ========================
// FILE UPLOAD CONFIGURATION
// ========================
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create resumes directory if it doesn't exist
const resumesDir = path.join(__dirname, 'uploads', 'resumes');
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

// Create company logos directory if it doesn't exist
const logosDir = path.join(__dirname, 'uploads', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'job-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for resume uploads
const resumeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, resumesDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for company logo uploads
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, logosDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to only accept images
const imageFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// File filter to only accept documents (PDF, DOC, DOCX)
const resumeFilter = (req, file, cb) => {
  // Accept only document files
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, or DOCX files are allowed'), false);
  }
};

// Configure multer for images
const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFilter
});

// Configure multer for resumes
const uploadResume = multer({
  storage: resumeStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: resumeFilter
});

// Configure multer for company logos
const uploadLogo = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFilter
});

// ========================
// USER MODEL
// ========================
// User model is now in models/User.js

// ========================
// JOB MODEL
// ========================
// Job model is now in models/Job.js

// ========================
// APPLICATION MODEL
// ========================
// NOTE: Application model is now in models/Application.js
// It's required by the routes and properly handles the resume field

// ========================
// COMPANY PROFILE MODEL
// ========================
const companyProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: true
  },
  companyEmail: String,
  companyPhone: String,
  website: String,
  industry: String,
  companySize: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    default: '1-10'
  },
  foundedYear: Number,
  headquarters: String,
  description: String,
  mission: String,
  vision: String,
  values: [String],
  benefits: [String],
  logo: String,
  coverImage: String,
  socialMedia: {
    linkedin: String,
    twitter: String,
    facebook: String,
    instagram: String
  },
  verified: {
    type: Boolean,
    default: false
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active'
    }
  },
  stats: {
    totalJobsPosted: { type: Number, default: 0 },
    activeJobs: { type: Number, default: 0 },
    totalApplications: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const CompanyProfile = mongoose.model('CompanyProfile', companyProfileSchema);

// ========================
// COMPANY ACTIVITY MODEL
// ========================
const companyActivitySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['job_posted', 'job_updated', 'job_closed', 'application_reviewed', 
           'application_approved', 'application_rejected', 'message_sent', 
           'profile_updated', 'subscription_changed'],
    required: true
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const CompanyActivity = mongoose.model('CompanyActivity', companyActivitySchema);

// ========================
// TALENT POOL MODEL
// ========================
const talentPoolSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  source: {
    type: String,
    enum: ['application', 'search', 'referral', 'manual'],
    default: 'application'
  },
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job'
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'interviewing', 'offered', 'hired', 'archived'],
    default: 'new'
  },
  notes: String,
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  tags: [String],
  lastContacted: Date,
  nextFollowUp: Date
}, {
  timestamps: true
});

talentPoolSchema.index({ companyId: 1, candidateId: 1 }, { unique: true });

const TalentPool = mongoose.model('TalentPool', talentPoolSchema);

// ========================
// INTERVIEW MODEL (use from models/Interview.js to avoid duplicates)
// ========================
// Interview model is now in models/Interview.js
const Interview = require('./models/Interview');

// ========================
// PAYMENT MODEL (use from models/Payment.js to avoid duplicates)
// ========================
const Payment = require('./models/Payment');

// ========================
// MESSAGE MODEL (use from models/Message.js to avoid duplicates)
// ========================
const Message = require('./models/Message');

// ========================
// NOTIFICATION MODEL (use from models/Notification.js to avoid duplicates)
// ========================
const Notification = require('./models/Notification');

// ========================
// EXAM MODEL (use from models/Exam.js to avoid duplicates)
// ========================
const Exam = require('./models/Exam');

// ========================
// ADVERTISEMENT MODEL (use from models/Advertisement.js to avoid duplicates)
// ========================
const Advertisement = require('./models/Advertisement');

// ========================
// MIDDLEWARE
// ========================

// Enable CORS FIRST - before rate limiting
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      'https://mission-hub.vercel.app'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type']
};
app.use(cors(corsOptions));

// Rate limiting - AFTER CORS
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 500, // 500 requests per minute (increased for development)
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Set security headers
app.use(helmet());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve resume files directly via API for production
app.get('/api/file/:type/:filename', async (req, res) => {
  try {
    // Check authentication
    let token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) {
      // For development, allow without token
      if (process.env.NODE_ENV === "development" || process.env.NODE_ENV !== "production") {
        token = 'dev';
      } else {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
    }
    
    // Verify token (skip for dev)
    if (token !== 'dev') {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    }
    
    const { type, filename } = req.params;
    const dir = type === 'resume' ? 'resumes' : (type === 'logo' ? 'logos' : '');
    const filePath = path.join(__dirname, 'uploads', dir, filename);
    
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${type}/${filename}`);
      return res.status(404).json({ 
        success: false, 
        message: 'The document file could not be found. It may have been removed or was not uploaded successfully. Please ask the applicant to re-upload their resume.'
      });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token. Please refresh and try again.' });
  }
});

// Serve resume files with correct Content-Type headers
app.get('/api/resume/:filename', async (req, res) => {
  try {
    // Check authentication - allow Bearer token or query param token
    let token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    // Verify token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token. Please refresh and try again.' });
    }
    
    const filename = req.params.filename;
    console.log('Resume request for file:', filename);
    
    // Check if it's a Cloudflare R2 URL (external URL)
    if (filename.includes('dblivpykh') || filename.includes('workers.dev') || filename.startsWith('https://')) {
      // Redirect to the R2 bucket URL
      return res.redirect(filename);
    }
    
    // Otherwise serve from local filesystem
    const filePath = path.join(__dirname, 'uploads', 'resumes', filename);
    
    // Verify file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.log('Resume file not found:', filePath);
      return res.status(404).json({ 
        success: false, 
        message: 'The resume file could not be found. It may have been removed or was not uploaded successfully. Please ask the applicant to re-upload their resume.'
      });
    }
    
    // Set correct Content-Type for PDFs
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving resume:', error);
    res.status(500).json({ success: false, message: 'An error occurred while loading the resume. Please try again later.' });
  }
});

// ========================
// AUTH MIDDLEWARE
// ========================
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.log('🔒 No token provided in request');
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    console.log('Token decoded, user ID:', decoded.id);
    
    const user = await User.findById(decoded.id);
    console.log('User found:', user ? `yes (${user.email})` : 'no');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Company only middleware
const companyOnly = (req, res, next) => {
  if (req.user.userType !== 'company') {
    return res.status(403).json({
      success: false,
      message: 'This route is only accessible to company accounts'
    });
  }
  next();
};

// ========================
// EMAIL CONFIGURATION
// ========================
let transporter = null;

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 Email: Development mode - emails will be logged to console');
    return {
      sendMail: async (mailOptions) => {
        console.log('\n📧 Email would be sent:');
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        const codeMatch = mailOptions.html?.match(/\d{6}/);
        if (codeMatch) {
          console.log('   🔑 CODE:', codeMatch[0]);
        }
        console.log('---\n');
        return { messageId: 'dev-' + Date.now() };
      },
      verify: async () => true
    };
  }

  const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: cleanPassword,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 5,
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

const sendEmail = async (options) => {
  const { to, subject, html } = options;
  
  const transport = getTransporter();
  
  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: Array.isArray(to) ? to : to,
      subject,
      html,
    });
    console.log(`✅ Email sent: ${info.messageId}`);
    return { messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    throw error;
  }
};

app.set('emailTransporter', { sendMail: (opts) => sendEmail(opts) });
app.set('sendEmail', sendEmail);

// ========================
// IN-MEMORY STORAGE (for verification/reset codes)
// ========================
const verificationCodes = new Map();

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to create a notification
const createNotification = async (userId, type, title, message, options = {}) => {
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
    
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Helper function to create company activity
const createCompanyActivity = async (companyId, type, description, metadata = {}) => {
  try {
    const activity = await CompanyActivity.create({
      companyId,
      type,
      description,
      metadata
    });
    return activity;
  } catch (error) {
    console.error('Create company activity error:', error);
    return null;
  }
};

// ========================
// ROUTES
// ========================

// Import routes
const adminAuthController = require('./controllers/adminAuthController');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const aiMatchingRoutes = require('./routes/ai-matching');
const realtimeRoutes = require('./routes/realtime');
const subscriptionRoutes = require('./routes/subscription');
const interviewRoutes = require('./routes/interview');
const gamificationRoutes = require('./routes/gamification');
const companyRoutes = require('./routes/company');
const dashboardRoutes = require('./routes/dashboard');
const examsRoutes = require('./routes/exams');
const activitiesRoutes = require('./routes/activities');
const paymentsRoutes = require('./routes/payments');
const talentPoolRoutes = require('./routes/talent-pool');
const settingsRoutes = require('./routes/settings');
const advertisingRoutes = require('./routes/advertising');
const aiNotificationsRoutes = require('./routes/ai-notifications');

// Mount admin auth routes (before other routes to avoid conflicts)
app.post('/api/auth/admin/create-super-admin', adminAuthController.createSuperAdmin);
app.post('/api/auth/admin/login', adminAuthController.superAdminLogin);
app.get('/api/auth/admin/verify', adminAuthController.verifySuperAdmin);
app.post('/api/auth/admin/logout', adminAuthController.superAdminLogout);

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
// Auth routes are inline in server.js (lines 884-1318)
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai-matching', aiMatchingRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/talent-pool', talentPoolRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/advertising', advertisingRoutes);
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/ai-notifications', aiNotificationsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// Email test endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const testEmail = email || process.env.EMAIL_USER;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address required for test'
      });
    }

    const sendEmail = req.app.get('sendEmail');
    
    const result = await sendEmail({
      to: testEmail,
      subject: 'Email Configuration Test — MissionHub',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F9FAFB;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #020617 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
              <table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
              <div style="width: 48px; height: 48px; background: white; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#020617"/><path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              </td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px; color: #1e293b;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #020617; text-align: center;">Email Configuration Working</h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px; text-align: center;">Your MissionHub email is configured correctly</p>
              
              <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #1e293b; font-size: 14px;">
                  <strong>Server Time:</strong> ${new Date().toString()}<br><br>
                  <strong>Recipient:</strong> ${testEmail}<br><br>
                  <strong>Status:</strong> <span style="color: #059669; font-weight: bold;">Active</span>
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 24px;">
                You can now receive verification codes and other notifications.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">MissionHub — Connecting Talent with Opportunity</p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.id
    });
    
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email: ' + error.message
    });
  }
});

// ========================
// HEALTH CHECK (early, before any complex routes)
// ========================
app.get('/api/quick-test', (req, res) => {
  console.log('[QUICK_TEST] Endpoint hit!');
  res.json({ success: true, message: 'Quick test works!' });
});

// ========================
// AUTH ROUTES
// ========================
console.log('[DEBUG] Registering auth routes at lines 842+...');

// Debug test endpoint
app.post('/api/auth/test', (req, res) => {
  console.log('[TEST] /api/auth/test endpoint hit');
  res.json({ success: true, message: 'Test endpoint works' });
});

// Resend verification code
app.post('/api/auth/resend-code', async (req, res) => {
  console.log('[AUTH] /api/auth/resend-code hit');
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();

    const existingPending = verificationCodes.get(cleanEmail);
    if (!existingPending || Date.now() > existingPending.expiresAt) {
      return res.status(404).json({ success: false, message: 'No pending verification found for this email. Please start a new registration.' });
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = Date.now() + 13 * 60 * 60 * 1000;
    verificationCodes.set(cleanEmail, { code: verificationCode, expiresAt });

    const sendEmail = req.app.get('sendEmail');
    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'Your Verification Code — MissionHub',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #020617 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
              <table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
              <div style="width: 48px; height: 48px; background: white; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#020617"/><path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              </td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: #020617;"></td>
          </tr>
          <tr>
            <td style="padding: 40px; color: #1e293b;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #020617;">Email Verification</h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px;">Verify your email address</p>
              
              <p style="color: #334155; line-height: 1.6;">Use the verification code below to verify your email address:</p>
              
              <div style="background: #f8fafc; border: 2px dashed #020617; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Your Verification Code</p>
                <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #020617; font-family: 'Courier New', monospace;">${verificationCode}</p>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">This code will expire in <strong>13 hours</strong>.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">MissionHub ��� Connecting Talent with Opportunity</p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      });
    } catch (e) {
      console.log('Email send failed:', e.message);
    }

    return res.json({ success: true, message: 'New verification code sent to your email', expiresIn: 13 });
  } catch (error) {
    console.error('Resend code error:', error);
    return res.status(500).json({ success: false, message: 'Server error during resend' });
  }
});

// Send verification code (start registration)
app.post('/api/auth/send-code', async (req, res) => {
  console.log('[AUTH] /api/auth/send-code hit, body:', req.body);
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const existingPending = verificationCodes.get(cleanEmail);
    let verificationCode;
    let expiresAt;

    if (existingPending && Date.now() < existingPending.expiresAt) {
      verificationCode = existingPending.code;
      expiresAt = existingPending.expiresAt;
    } else {
      verificationCode = generateVerificationCode();
      expiresAt = Date.now() + 13 * 60 * 60 * 1000;
      verificationCodes.set(cleanEmail, { code: verificationCode, expiresAt });
    }

    const sendEmail = req.app.get('sendEmail');
    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'Your Verification Code — MissionHub',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F9FAFB;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #020617 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
              <table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
              <div style="width: 48px; height: 48px; background: white; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#020617"/><path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              </td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: #020617;"></td>
          </tr>
          <tr>
            <td style="padding: 40px; color: #1e293b;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #020617;">Email Verification</h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px;">Verify your email address</p>
              
              <p style="color: #334155; line-height: 1.6;">Use the verification code below to verify your email address:</p>
              
              <div style="background: #f8fafc; border: 2px dashed #020617; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Your Verification Code</p>
                <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #020617; font-family: 'Courier New', monospace;">${verificationCode}</p>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">This code will expire in <strong>13 hours</strong>.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">MissionHub ��� Connecting Talent with Opportunity</p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      });
    } catch (e) {
      console.log('Email send failed:', e.message);
    }

    return res.json({ 
      success: true, 
      message: 'Verification code sent to your email',
      expiresIn: 13
    });
  } catch (error) {
    console.error('Send code error:', error);
    return res.status(500).json({ success: false, message: 'Server error during send code' });
  }
});

// Verify code and complete registration
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, verificationCode, name, password, userType } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const storedCode = verificationCodes.get(cleanEmail);
    
    if (!storedCode || Date.now() > storedCode.expiresAt) {
      verificationCodes.delete(cleanEmail);
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please start a new registration.' });
    }

    if (storedCode.code !== verificationCode) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const finalUserType = userType || 'jobSeeker';
    const user = await User.create({
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      password: password,
      userType: finalUserType,
      isVerified: true,
      isActive: true,
      emailVerified: true
    });

    verificationCodes.delete(cleanEmail);

    const token = user.getSignedJwtToken();

    // Create welcome notifications for new job seeker users
    if (user.userType === 'jobSeeker') {
      try {
        const Notification = require('./models/Notification');
        
        const welcomeNotifications = [
          {
            type: 'system',
            title: "Welcome to MissionHub! 🚀",
            message: "We are excited to help you bridge the gap between your unique talents and the world's leading companies. Our platform is more than just a job board—it is an AI-powered career agent designed to work for you 24/7.",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "🎯 How the System Works for You",
            message: "Precision Talent Matching: We don't just look at job titles. Our system analyzes your specific skills and 'Company DNA' to ensure that every connection made is a perfect fit for both your career goals and the employer's culture.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "🤖 Your Personal AI Scout",
            message: "You don't need to spend hours searching. Our built-in AI constantly monitors new opportunities. The moment a job is posted that matches your unique profile, the system notifies you instantly so you can be first in line.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "📈 Personalized Career Feed",
            message: "Stay ahead of the curve with a custom dashboard. Beyond job alerts, you'll receive related content, industry trends, and professional insights tailored specifically to your expertise.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Your First Step: Fill Your Profile 📝",
            message: "To let the AI start hunting for you, we need to know who you are. Your profile is your Digital DNA—the more detail you provide, the more accurately our AI can advocate for you.\n\nClick 'Edit Profile' on your dashboard to:\n• Highlight your Talents: Add your core skills, certifications, and project history\n• Set your Preferences: Tell the AI exactly what kind of companies and roles you are looking for",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Ready to find your next big move?",
            message: "Complete your profile now and let our AI find the perfect opportunities for you!",
            priority: 'normal',
            senderType: 'system'
          }
        ];
        
        for (const notif of welcomeNotifications) {
          await Notification.create({
            userId: user._id,
            ...notif,
            read: false
          });
        }
        console.log('✅ Welcome notifications created for new user:', user.email);
      } catch (notifError) {
        console.error('Failed to create welcome notifications:', notifError.message);
      }
    }

    // Create welcome notifications for new company users
    if (user.userType === 'company') {
      try {
        const Notification = require('./models/Notification');
        
        const companyWelcomeNotifications = [
          {
            type: 'system',
            title: "Welcome to MissionHub – Meet Your Next Great Hire 🤝",
            message: "We are excited to help your company streamline its hiring process. Our platform isn't just a database; it's an intelligent talent ecosystem designed to match your specific requirements with the best professionals in the industry.",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "✨ Direct Talent Access",
            message: "Skip the endless searching. Our system houses a pool of verified talent and employees whose skills are mapped to meet modern company standards.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "🤖 AI-Powered Shortlisting",
            message: "Our AI works as your first-round recruiter. It analyzes your job postings and instantly notifies you when it finds a candidate whose profile is a perfect match for your requirements.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "📊 Industry Insights",
            message: "Stay informed with related content and data-driven insights. From salary trends to skill availability, we provide the context you need to make competitive offers.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Your First Step: Set Up Your Company Profile 🏢",
            message: "To find the perfect match, our AI needs to understand your company's mission and needs. A complete profile ensures that the highest-quality talent is attracted to your brand.\n\nTo get started:\n• Fill Your Company Profile: Add your mission, culture, and what makes your workplace unique\n• Post Your First Requirement: Be specific about the talents you are looking for\n• Enable AI Notifications: Get pinged the second a matching talent enters the system",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Ready to build your dream team?",
            message: "Set up your company profile now and let our AI find the perfect candidates for you!",
            priority: 'normal',
            senderType: 'system'
          }
        ];
        
        for (const notif of companyWelcomeNotifications) {
          await Notification.create({
            userId: user._id,
            ...notif,
            read: false
          });
        }
        console.log('✅ Company welcome notifications created for:', user.email);
      } catch (notifError) {
        console.error('Failed to create company welcome notifications:', notifError.message);
      }
    }

    res.json({
      success: true,
      message: 'Registration completed successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: true,
        isActive: true,
        emailVerified: true,
        loginRestricted: false,
        profile: user.profile || {}
      }
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during verification' });
  }
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, userType, profile } = req.body;

    // Validate required fields
    if (!name || !email || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and user type'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check for existing user
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'USER_EXISTS'
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      userType,
      profile: profile || {},
      isVerified: true, // Auto-verify all users (removed verification requirement)
      emailVerified: true // Also set emailVerified field
    });

    // Skip verification code generation - users are auto-verified

    // Get sendEmail function
    const sendEmail = req.app.get('sendEmail');

    // Send verification email
    let emailSent = false;
    let emailError = null;

    try {
      const mailResult = await sendEmail({
        to: cleanEmail,
        subject: 'Verify Your Email — MissionHub',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #020617 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
              <table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
              <div style="width: 48px; height: 48px; background: white; border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#020617"/><path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              </td></tr></table>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: #020617;"></td>
          </tr>
          <tr>
            <td style="padding: 40px; color: #1e293b;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #020617;">Verify Your Email</h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px;">Complete your registration</p>
              
              <p style="color: #334155; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
              <p style="color: #334155; line-height: 1.6; margin-bottom: 24px;">Welcome to MissionHub! Thank you for joining us. Please use the verification code below to complete your registration:</p>
              
              <div style="background: #f8fafc; border: 2px dashed #020617; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Your Verification Code</p>
                <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #020617; font-family: 'Courier New', monospace;">${verificationCode}</p>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">This code will expire in <strong>10 minutes</strong>. Please verify your email soon.</p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                If you didn't create an account with MissionHub, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">MissionHub ��� Connecting Talent with Opportunity</p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      });

      emailSent = true;
      console.log(`✅ Verification email sent to: ${cleanEmail}`);
      console.log(`   Message ID: ${mailResult.id}`);
      
    } catch (error) {
      emailError = error.message;
      console.error('❌ Email sending failed:', error.message);
      emailSent = false;
    }

    // If user is a company, create a company profile
    if (userType === 'company') {
      await CompanyProfile.create({
        userId: user._id,
        companyName: name.trim(),
        companyEmail: cleanEmail
      });
    }

    // Generate token and auto-login
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      message: 'Registration successful! You are now logged in.',
      emailSent: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: true,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Verify email
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and verification code'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check verification code
    const storedCode = verificationCodes.get(cleanEmail);
    
    if (!storedCode) {
      return res.status(400).json({
        success: false,
        message: 'Verification code not found or expired'
      });
    }

    if (Date.now() > storedCode.expiresAt) {
      verificationCodes.delete(cleanEmail);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired'
      });
    }

    if (storedCode.code !== verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Find and verify user
    const user = await User.findOneAndUpdate(
      { email: cleanEmail },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clean up verification code
    verificationCodes.delete(cleanEmail);

    // Generate token
    const token = user.getSignedJwtToken();

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: true,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', req.body.email);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Login failed: Missing credentials');
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check for user with password
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      console.log('❌ Login failed: User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // ⛔ CHECK LOGIN RESTRICTION - Block restricted users
    console.log('Checking restriction for:', cleanEmail, '| loginRestricted:', user.loginRestricted);
    if (user.loginRestricted === true) {
      console.log('⛔ LOGIN BLOCKED - User is restricted:', user.email);
      return res.status(403).json({
        success: false,
        message: 'Your account has been restricted. Please contact support at reneniyi@gmail.com for assistance.',
        code: 'ACCOUNT_RESTRICTED',
        restricted: true
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      console.log('❌ Login blocked - Account deactivated:', user.email);
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('❌ Login failed: Wrong password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Auto-verify user if not verified
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate token
    const token = user.getSignedJwtToken();
    console.log('✅ Login success:', user.email, '| Type:', user.userType);

    // Create welcome notifications for new users
    if (user.userType === 'jobSeeker' && !user.lastLogin) {
      try {
        const Notification = require('./models/Notification');
        
        const welcomeNotifications = [
          {
            type: 'system',
            title: "Welcome to MissionHub! 🚀",
            message: "We are excited to help you bridge the gap between your unique talents and the world's leading companies. Our platform is more than just a job board—it is an AI-powered career agent designed to work for you 24/7.",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "🎯 How the System Works for You",
            message: "Precision Talent Matching: We don't just look at job titles. Our system analyzes your specific skills and 'Company DNA' to ensure that every connection made is a perfect fit for both your career goals and the employer's culture.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "🤖 Your Personal AI Scout",
            message: "You don't need to spend hours searching. Our built-in AI constantly monitors new opportunities. The moment a job is posted that matches your unique profile, the system notifies you instantly so you can be first in line.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "📈 Personalized Career Feed",
            message: "Stay ahead of the curve with a custom dashboard. Beyond job alerts, you'll receive related content, industry trends, and professional insights tailored specifically to your expertise.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Your First Step: Fill Your Profile 📝",
            message: "To let the AI start hunting for you, we need to know who you are. Your profile is your Digital DNA—the more detail you provide, the more accurately our AI can advocate for you.\n\nClick 'Edit Profile' on your dashboard to:\n• Highlight your Talents: Add your core skills, certifications, and project history\n• Set your Preferences: Tell the AI exactly what kind of companies and roles you are looking for",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Ready to find your next big move?",
            message: "Complete your profile now and let our AI find the perfect opportunities for you!",
            priority: 'normal',
            senderType: 'system'
          }
        ];
        
        for (const notif of welcomeNotifications) {
          await Notification.create({
            userId: user._id,
            ...notif,
            read: false
          });
        }
        console.log('✅ Welcome notifications created for new user:', user.email);
      } catch (notifError) {
        console.error('Failed to create welcome notifications:', notifError.message);
      }
    }

    // Create welcome notifications for new company users
    if (user.userType === 'company' && !user.lastLogin) {
      try {
        const Notification = require('./models/Notification');
        
        const companyWelcomeNotifications = [
          {
            type: 'system',
            title: "Welcome to MissionHub – Meet Your Next Great Hire 🤝",
            message: "We are excited to help your company streamline its hiring process. Our platform isn't just a database; it's an intelligent talent ecosystem designed to match your specific requirements with the best professionals in the industry.",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "✨ Direct Talent Access",
            message: "Skip the endless searching. Our system houses a pool of verified talent and employees whose skills are mapped to meet modern company standards.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "🤖 AI-Powered Shortlisting",
            message: "Our AI works as your first-round recruiter. It analyzes your job postings and instantly notifies you when it finds a candidate whose profile is a perfect match for your requirements.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "📊 Industry Insights",
            message: "Stay informed with related content and data-driven insights. From salary trends to skill availability, we provide the context you need to make competitive offers.",
            priority: 'normal',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Your First Step: Set Up Your Company Profile 🏢",
            message: "To find the perfect match, our AI needs to understand your company's mission and needs. A complete profile ensures that the highest-quality talent is attracted to your brand.\n\nTo get started:\n• Fill Your Company Profile: Add your mission, culture, and what makes your workplace unique\n• Post Your First Requirement: Be specific about the talents you are looking for\n• Enable AI Notifications: Get pinged the second a matching talent enters the system",
            priority: 'high',
            senderType: 'system'
          },
          {
            type: 'system',
            title: "Ready to build your dream team?",
            message: "Set up your company profile now and let our AI find the perfect candidates for you!",
            priority: 'normal',
            senderType: 'system'
          }
        ];
        
        for (const notif of companyWelcomeNotifications) {
          await Notification.create({
            userId: user._id,
            ...notif,
            read: false
          });
        }
        console.log('✅ Company welcome notifications created for:', user.email);
      } catch (notifError) {
        console.error('Failed to create company welcome notifications:', notifError.message);
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified === true,
        isActive: user.isActive === true,
        emailVerified: user.emailVerified === true,
        loginRestricted: user.loginRestricted || false,
        profile: user.profile || {}
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Logout (stateless JWT, this is just for client convenience)
app.post('/api/auth/logout', protect, async (req, res) => {
  try {
    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during logout' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Don't reveal whether email exists
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a reset code has been sent'
      });
    }

    // Generate reset code
    const resetCode = generateVerificationCode();
    verificationCodes.set(cleanEmail + '_reset', {
      code: resetCode,
      expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes
    });

    // Get sendEmail function
    const sendEmail = req.app.get('sendEmail');

    // Send reset email
    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'Reset Your Password — MissionHub',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MissionHub</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F9FAFB;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.03); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 32px 40px; text-align: center;">
              <img src="https://i.imgur.com/MissionHubLogo.png" alt="MissionHub" width="180" height="45" style="display: inline-block; margin-bottom: 16px; filter: brightness(0) invert(1);">
              <div style="width: 60px; height: 3px; background-color: rgba(255,255,255,0.5); margin: 0 auto; border-radius: 2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #DC2626, #991B1B);"></td>
          </tr>
          <tr>
            <td style="padding: 40px; color: #1F2937;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #1F2937;">Reset Your Password</h1>
              <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 14px;">We received a password reset request</p>
              
              <p style="color: #1F2937; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
              <p style="color: #1F2937; line-height: 1.6; margin-bottom: 24px;">We received a request to reset your MissionHub password. Use the code below to complete the process:</p>
              
              <div style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0%, rgba(153, 27, 27, 0.08) 100%); border: 2px dashed #DC2626; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">Your Password Reset Code</p>
                <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #DC2626; font-family: 'Courier New', monospace;">${resetCode}</p>
              </div>
              
              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; color: #92400E; font-size: 14px;">This code will expire in <strong>30 minutes</strong>. If you didn't request this, please ignore this email.</p>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                For your security, never share this code with anyone. MissionHub staff will never ask for your verification code.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F3F4F6; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6B7280;">MissionHub — Connecting Talent with Opportunity</p>
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">&copy; ${new Date().getFullYear()} MissionHub. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      });
      console.log(`✅ Password reset email sent to: ${cleanEmail}`);
    } catch (emailError) {
      console.error('❌ Password reset email failed:', emailError.message);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a reset code has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;

    if (!email || !verificationCode || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, code and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const key = cleanEmail + '_reset';
    const stored = verificationCodes.get(key);

    if (!stored) {
      return res.status(400).json({ success: false, message: 'Reset code not found or expired' });
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(key);
      return res.status(400).json({ success: false, message: 'Reset code has expired' });
    }

    if (stored.code !== verificationCode) {
      return res.status(400).json({ success: false, message: 'Invalid reset code' });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();

    verificationCodes.delete(key);

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// Change password (authenticated user)
app.post('/api/auth/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    // Check email verification
    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required. Please verify your email address.'
      });
    }

    // Find user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if current password is correct
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password change' });
  }
});

// ========================
// USER ROUTES
// ========================

// Get current user profile
app.get('/api/users/me', protect, async (req, res) => {
  try {
    const decoded = req.headers.authorization?.split(' ')[1] ? 
      jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin') : null;
    
    const userId = decoded?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }
    
    const userDoc = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
    
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const profileData = userDoc.profile || {};
    
    // Return top-level name and email, plus profile object with all fields
    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        name: userDoc.name || '',
        email: userDoc.email || '',
        profile: {
          name: userDoc.name || '',
          email: userDoc.email || '',
          phone: profileData.phone || '',
          location: profileData.location || '',
          title: profileData.title || '',
          bio: profileData.bio || '',
          skills: profileData.skills || [],
          experience: profileData.experience || '',
          education: profileData.education || '',
          linkedin: profileData.linkedin || '',
          github: profileData.github || '',
          portfolio: profileData.portfolio || '',
          resume: profileData.resume || null,
          cv: profileData.cv || null,
          documents: profileData.documents || [],
          profilePhoto: profileData.profilePhoto || null
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user profile - step by step
app.put('/api/users/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    const userId = decoded.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    const { step, name, email, profile } = req.body;
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }
    
    const updateObj = {};
    
    // Handle different steps
    if (step === 'personal') {
      // Step 1: Basic info (name, email)
      if (name !== undefined && name !== null && name !== '') {
        updateObj.name = name;
      }
      if (email !== undefined && email !== null && email !== '') {
        updateObj.email = email.toLowerCase().trim();
      }
    }
    else if (step === 'contact') {
      // Step 2: Contact details
      if (profile && profile.phone !== undefined) updateObj['profile.phone'] = profile.phone || '';
      if (profile && profile.location !== undefined) updateObj['profile.location'] = profile.location || '';
    }
    else if (step === 'professional') {
      // Step 3: Professional info
      if (profile) {
        if (profile.title !== undefined) updateObj['profile.title'] = profile.title || '';
        if (profile.bio !== undefined) updateObj['profile.bio'] = profile.bio || '';
        if (profile.experience !== undefined) updateObj['profile.experience'] = profile.experience || '';
        if (profile.education !== undefined) updateObj['profile.education'] = profile.education || '';
        
        // Skills as array
        if (profile.skills !== undefined) {
          if (typeof profile.skills === 'string') {
            updateObj['profile.skills'] = profile.skills.split(',').map(s => s.trim()).filter(Boolean);
          } else if (Array.isArray(profile.skills)) {
            updateObj['profile.skills'] = profile.skills;
          }
        }
      }
    }
    else if (step === 'links') {
      // Step 4: Links
      if (profile) {
        if (profile.linkedin !== undefined) updateObj['profile.linkedin'] = profile.linkedin || '';
        if (profile.github !== undefined) updateObj['profile.github'] = profile.github || '';
        if (profile.portfolio !== undefined) updateObj['profile.portfolio'] = profile.portfolio || '';
      }
    }
    else if (step === 'documents') {
      // Step 5: Documents (resume, cv, documents)
      if (profile) {
        if (profile.resume !== undefined) updateObj['profile.resume'] = profile.resume;
        if (profile.cv !== undefined) updateObj['profile.cv'] = profile.cv;
        if (profile.documents !== undefined) updateObj['profile.documents'] = profile.documents;
      }
    }
    else {
      // No step specified - update everything
      if (name !== undefined && name !== null && name !== '') updateObj.name = name;
      if (email !== undefined && email !== null && email !== '') updateObj.email = email.toLowerCase().trim();
      
      if (profile) {
        if (profile.phone !== undefined) updateObj['profile.phone'] = profile.phone || '';
        if (profile.location !== undefined) updateObj['profile.location'] = profile.location || '';
        if (profile.title !== undefined) updateObj['profile.title'] = profile.title || '';
        if (profile.bio !== undefined) updateObj['profile.bio'] = profile.bio || '';
        if (profile.experience !== undefined) updateObj['profile.experience'] = profile.experience || '';
        if (profile.education !== undefined) updateObj['profile.education'] = profile.education || '';
        if (profile.linkedin !== undefined) updateObj['profile.linkedin'] = profile.linkedin || '';
        if (profile.github !== undefined) updateObj['profile.github'] = profile.github || '';
        if (profile.portfolio !== undefined) updateObj['profile.portfolio'] = profile.portfolio || '';
        
        if (profile.skills !== undefined) {
          if (typeof profile.skills === 'string') {
            updateObj['profile.skills'] = profile.skills.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            updateObj['profile.skills'] = profile.skills;
          }
        }
        
        if (profile.resume !== undefined) updateObj['profile.resume'] = profile.resume;
        if (profile.cv !== undefined) updateObj['profile.cv'] = profile.cv;
        if (profile.documents !== undefined) updateObj['profile.documents'] = profile.documents;
      }
    }
    
    console.log('Step:', step || 'all');
    console.log('Update fields:', JSON.stringify(updateObj));
    
    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: updateObj }
    );
    
    const userDoc = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
    
    console.log('Updated successfully');
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: userDoc
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error during profile update' });
  }
});

// Update single profile field
app.put('/api/users/profile/:field', protect, async (req, res) => {
  try {
    const { field } = req.params;
    const { value } = req.body;
    
    // Validate field name
    const allowedFields = [
      'name', 'phone', 'location', 'bio', 'skills', 'experience', 
      'education', 'preferredJobType', 'salaryExpectation', 'linkedin',
      'github', 'portfolio', 'profilePhoto', 'resume', 'companyName',
      'companyWebsite', 'companySize', 'foundedYear', 'headquarters',
      'description', 'logo'
    ];
    
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field name'
      });
    }
    
    // Create update object
    const updateData = {};
    if (field === 'name') {
      updateData.name = value;
    } else {
      updateData[`profile.${field}`] = value;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `${field} updated successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Update profile field error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// ========================
// JOB ROUTES
// ========================

// Get all jobs - handled by routes/jobs.js

// Create job
app.post('/api/jobs', protect, companyOnly, async (req, res) => {
  try {
    const job = await Job.create({
      ...req.body,
      postedBy: req.user.id,
      company: req.user.profile.companyName || req.body.company
    });

    // Update company stats
    await CompanyProfile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $inc: { 
          'stats.totalJobsPosted': 1,
          'stats.activeJobs': 1 
        } 
      }
    );

    // Create activity
    await createCompanyActivity(
      req.user.id,
      'job_posted',
      `Posted new job: ${job.title}`,
      { jobId: job._id, jobTitle: job.title }
    );

    const populatedJob = await Job.findById(job._id).populate('postedBy', 'name email profile').lean();

    res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      job: populatedJob
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating job'
    });
  }
});

// Get jobs posted by company
app.get('/api/jobs/company', protect, companyOnly, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id })
      .populate('postedBy', 'name email profile')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get application counts in one query
    const jobIds = jobs.map(j => j._id);
    const applications = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: '$jobId', count: { $sum: 1 }, screened: { $sum: { $cond: ['$aiScreening', 1, 0] } } } }
    ]);
    
    const appCounts = {};
    applications.forEach(a => {
      appCounts[a._id.toString()] = { total: a.count, screened: a.screened };
    });
    
    const jobsWithCounts = jobs.map(job => ({
      ...job,
      totalApplicants: appCounts[job._id.toString()]?.total || 0,
      screenedCount: appCounts[job._id.toString()]?.screened || 0
    }));
    
    res.status(200).json({
      success: true,
      data: jobsWithCounts
    });
  } catch (error) {
    console.error('Get company jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching company jobs'
    });
  }
});

// Get user's posted jobs (alias for /jobs/company for backward compatibility)
app.get('/api/jobs/my-jobs', protect, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id })
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    const jobIds = jobs.map(j => j._id);
    const applications = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: '$jobId', count: { $sum: 1 } } }
    ]);
    
    const appCounts = {};
    applications.forEach(a => {
      appCounts[a._id.toString()] = a.count;
    });
    
    const jobsWithCounts = jobs.map(job => ({
      ...job,
      totalApplicants: appCounts[job._id.toString()] || 0
    }));
    
    res.status(200).json({
      success: true,
      count: jobsWithCounts.length,
      jobs: jobsWithCounts
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your jobs'
    });
  }
});

// Get single job
app.get('/api/jobs/:id', async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    const job = await Job.findById(req.params.id).populate('postedBy', 'name email profile').lean();
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching job'
    });
  }
});

// Update job
app.put('/api/jobs/:id', protect, companyOnly, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    let job = await Job.findById(req.params.id).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job (allow if no owner set)
    if (job.postedBy && job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: false
    }).populate('postedBy', 'name email').lean();

    // Create activity
    await createCompanyActivity(
      req.user.id,
      'job_updated',
      `Updated job: ${job.title}`,
      { jobId: job._id, jobTitle: job.title }
    );

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      job
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating job'
    });
  }
});

// Delete job
app.delete('/api/jobs/:id', protect, companyOnly, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    const job = await Job.findById(req.params.id).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job (allow if no owner set)
    if (job.postedBy && job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }

    // Delete associated image if exists
    if (job.image) {
      const imagePath = path.join(__dirname, job.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Job.findByIdAndDelete(req.params.id);

    // Update company stats
    await CompanyProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { 'stats.activeJobs': -1 } }
    );

    // Create activity
    await createCompanyActivity(
      req.user.id,
      'job_closed',
      `Closed job: ${job.title}`,
      { jobId: job._id, jobTitle: job.title }
    );

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting job'
    });
  }
});

// ========================
// IMAGE UPLOAD ROUTE
// ========================

// Upload image endpoint
app.post('/api/upload', protect, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Return the image URL
    const imageUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading image'
    });
  }
});

// ========================
// COMPANY LOGO UPLOAD ROUTE
// ========================

// Upload company logo endpoint
app.post('/api/upload/logo', protect, companyOnly, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No logo file provided'
      });
    }

    // Return the logo URL
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    // Update user profile with logo
    await User.findByIdAndUpdate(
      req.user.id,
      { 'profile.logo': logoUrl }
    );

    // Update company profile with logo
    await CompanyProfile.findOneAndUpdate(
      { userId: req.user.id },
      { logo: logoUrl }
    );

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading logo'
    });
  }
});

// ========================
// PROFILE PHOTO UPLOAD ROUTE
// ========================

// Upload profile photo endpoint
app.post('/api/upload/profile-photo', protect, uploadImage.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    await User.findByIdAndUpdate(
      req.user.id,
      { 'profile.profilePhoto': photoUrl }
    );

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      photoUrl
    });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading profile photo'
    });
  }
});

// ========================
// RESUME UPLOAD ROUTE
// ========================

// Upload resume endpoint
app.post('/api/upload/resume', protect, uploadResume.single('resume'), async (req, res) => {
  try {
    const decoded = req.headers.authorization?.split(' ')[1] ? 
      jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin') : null;
    
    const userId = decoded?.id;
    console.log('Resume upload - userId:', userId);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file provided'
      });
    }

    const resumeData = {
      name: req.file.originalname,
      url: `/uploads/resumes/${req.file.filename}`,
      uploadDate: new Date(),
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: req.file.mimetype
    };
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }
    
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { 'profile.resume': resumeData } }
    );

    res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: { resume: resumeData }
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading resume'
    });
  }
});

// Upload CV endpoint
app.post('/api/upload/cv', protect, uploadResume.single('cv'), async (req, res) => {
  try {
    const decoded = req.headers.authorization?.split(' ')[1] ? 
      jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin') : null;
    
    const userId = decoded?.id;
    console.log('CV upload - userId:', userId);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CV file provided'
      });
    }

    const cvData = {
      name: req.file.originalname,
      url: `/uploads/resumes/${req.file.filename}`,
      uploadDate: new Date(),
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: req.file.mimetype
    };
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }
    
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { 'profile.cv': cvData } }
    );

    res.status(200).json({
      success: true,
      message: 'CV uploaded successfully',
      data: { cv: cvData }
    });
  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading CV'
    });
  }
});

// Upload document endpoint
app.post('/api/upload/document', protect, uploadResume.single('document'), async (req, res) => {
  try {
    console.log('Document upload called for user:', req.user?.id);
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file provided'
      });
    }

    const { category } = req.body;
    
    const documentData = {
      _id: new mongoose.Types.ObjectId(),
      name: req.file.originalname,
      url: `/uploads/resumes/${req.file.filename}`,
      uploadDate: new Date(),
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: req.file.mimetype,
      category: category || 'other'
    };
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }
    
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { $push: { 'profile.documents': documentData } }
    );

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      document: documentData
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading document'
    });
  }
});

// Get all documents endpoint
app.get('/api/user/documents', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('profile.resume profile.cv profile.documents');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      documents: {
        resume: user.profile?.resume || null,
        cv: user.profile?.cv || null,
        additionalDocuments: user.profile?.documents || []
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching documents'
    });
  }
});

// Delete document endpoint
app.delete('/api/user/documents/:documentId', protect, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { type } = req.query;
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }

    let updateQuery;
    if (type === 'resume') {
      updateQuery = { $unset: { 'profile.resume': '' } };
    } else if (type === 'cv') {
      updateQuery = { $unset: { 'profile.cv': '' } };
    } else {
      updateQuery = { $pull: { 'profile.documents': { _id: new mongoose.Types.ObjectId(documentId) } } };
    }

    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      updateQuery
    );

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting document'
    });
  }
});

// Update document endpoint
app.put('/api/user/documents/:documentId', protect, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { name, category } = req.body;
    
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }

    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.id), 'profile.documents._id': new mongoose.Types.ObjectId(documentId) },
      { $set: { 'profile.documents.$.name': name, 'profile.documents.$.category': category } }
    );

    res.status(200).json({
      success: true,
      message: 'Document updated successfully'
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating document'
    });
  }
});

// ========================
// COMPANY PROFILE ROUTES
// ========================
// NOTE: /api/company/profile routes are now handled by routes/company.js
// See line ~742: app.use('/api/company', companyRoutes);

// ========================
// COMPANY DASHBOARD ROUTES (Frontend Compatible)
// ========================

// Get company dashboard stats (mapped from /api/company/stats)
app.get('/api/company/dashboard/stats', protect, companyOnly, async (req, res) => {
  try {
    const companyId = req.user.id;

    // Get company profile
    const companyProfile = await CompanyProfile.findOne({ userId: companyId });

    // Get jobs count
    const totalJobs = await Job.countDocuments({ postedBy: companyId });
    const activeJobs = await Job.countDocuments({ postedBy: companyId, status: 'active' });

    // Get applications count
    const jobs = await Job.find({ postedBy: companyId }).select('_id').lean();
    const jobIds = jobs.map(job => job._id);
    
    const totalApplications = await Application.countDocuments({ jobId: { $in: jobIds } });
    const pendingApplications = await Application.countDocuments({ 
      jobId: { $in: jobIds }, 
      status: 'pending' 
    });

    // Get views count (simulated for now)
    const totalViews = Math.floor(Math.random() * 1000) + 500;

    // Get recent activities
    const recentActivities = await CompanyActivity.find({ companyId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        profile: companyProfile || {},
        jobs: {
          total: totalJobs,
          active: activeJobs
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications
        },
        views: totalViews,
        recentActivities
      }
    });
  } catch (error) {
    console.error('Get company dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching company stats'
    });
  }
});

// Get company jobs (mapped for frontend compatibility)
app.get('/api/company/jobs', protect, companyOnly, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('Get company jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching jobs'
    });
  }
});

// Get company applications (mapped for frontend compatibility)
app.get('/api/company/applications', protect, companyOnly, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id }).select('_id').lean();
    const jobIds = jobs.map(job => job._id);
    
    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('userId', 'name email')
      .populate('jobId', 'title company')
      .sort({ createdAt: -1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get company applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
});

// Get company exams
app.get('/api/company/exams', protect, companyOnly, async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: exams
    });
  } catch (error) {
    console.error('Get company exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching exams'
    });
  }
});

// Get company notifications
app.get('/api/company/notifications', protect, companyOnly, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Get company notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// Get company advertisements
app.get('/api/company/advertisements', protect, companyOnly, async (req, res) => {
  try {
    const ads = await Advertisement.find({ companyId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: ads
    });
  } catch (error) {
    console.error('Get company advertisements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching advertisements'
    });
  }
});

// Get company activities (mapped to /api/company/activities)
app.get('/api/company/activities', protect, companyOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const activities = await CompanyActivity.find({ companyId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await CompanyActivity.countDocuments({ companyId: req.user.id });

    res.status(200).json({
      success: true,
      data: activities,
      count: activities.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get company activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activities'
    });
  }
});

// ========================
// COMPANY STATS ROUTES (Legacy)
// ========================

// Get company dashboard stats
app.get('/api/company/stats', protect, companyOnly, async (req, res) => {
  try {
    const companyId = req.user.id;

    // Get company profile
    const companyProfile = await CompanyProfile.findOne({ userId: companyId });

    // Get jobs count
    const totalJobs = await Job.countDocuments({ postedBy: companyId });
    const activeJobs = await Job.countDocuments({ postedBy: companyId, status: 'active' });

    // Get applications count
    const jobs = await Job.find({ postedBy: companyId }).select('_id');
    const jobIds = jobs.map(job => job._id);
    
    const totalApplications = await Application.countDocuments({ jobId: { $in: jobIds } });
    const pendingApplications = await Application.countDocuments({ 
      jobId: { $in: jobIds }, 
      status: 'pending' 
    });

    // Get views count (simulated for now)
    const totalViews = Math.floor(Math.random() * 1000) + 500;

    // Get recent activities
    const recentActivities = await CompanyActivity.find({ companyId })
      .sort({ timestamp: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      stats: {
        profile: companyProfile || {},
        jobs: {
          total: totalJobs,
          active: activeJobs
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications
        },
        views: totalViews,
        recentActivities
      }
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching company stats'
    });
  }
});

// ========================
// COMPANY ACTIVITIES ROUTES
// ========================

// Get company activities
app.get('/api/activities/company', protect, companyOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const activities = await CompanyActivity.find({ companyId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await CompanyActivity.countDocuments({ companyId: req.user.id });

    res.status(200).json({
      success: true,
      count: activities.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      activities
    });
  } catch (error) {
    console.error('Get company activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activities'
    });
  }
});

// ========================
// TALENT POOL ROUTES
// ========================

// Get talent pool
app.get('/api/talent-pool/company', protect, companyOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    const filter = { companyId: req.user.id };
    if (status) filter.status = status;
    
    let talentPool = await TalentPool.find(filter)
      .populate('candidateId', 'name email profile')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await TalentPool.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: talentPool.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      talentPool
    });
  } catch (error) {
    console.error('Get talent pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching talent pool'
    });
  }
});

// Add candidate to talent pool
app.post('/api/talent-pool', protect, companyOnly, async (req, res) => {
  try {
    const { candidateId, jobId, source, notes } = req.body;
    
    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required'
      });
    }

    // Check if candidate exists
    const candidate = await User.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Check if already in talent pool
    const existing = await TalentPool.findOne({
      companyId: req.user.id,
      candidateId
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Candidate already in talent pool'
      });
    }

    const talentPoolEntry = await TalentPool.create({
      companyId: req.user.id,
      candidateId,
      jobId,
      source: source || 'manual',
      notes
    });

    const populatedEntry = await TalentPool.findById(talentPoolEntry._id)
      .populate('candidateId', 'name email profile')
      .populate('jobId', 'title');

    res.status(201).json({
      success: true,
      message: 'Candidate added to talent pool',
      talentPool: populatedEntry
    });
  } catch (error) {
    console.error('Add to talent pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding to talent pool'
    });
  }
});

// Update talent pool entry
app.put('/api/talent-pool/:id', protect, companyOnly, async (req, res) => {
  try {
    const { status, notes, rating, tags, nextFollowUp } = req.body;
    
    const talentPoolEntry = await TalentPool.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.id },
      { status, notes, rating, tags, nextFollowUp },
      { new: true, runValidators: true }
    );

    if (!talentPoolEntry) {
      return res.status(404).json({
        success: false,
        message: 'Talent pool entry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Talent pool entry updated',
      talentPool: talentPoolEntry
    });
  } catch (error) {
    console.error('Update talent pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating talent pool'
    });
  }
});

// Delete talent pool entry
app.delete('/api/talent-pool/:id', protect, companyOnly, async (req, res) => {
  try {
    const talentPoolEntry = await TalentPool.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user.id
    });

    if (!talentPoolEntry) {
      return res.status(404).json({
        success: false,
        message: 'Talent pool entry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Candidate removed from talent pool'
    });
  } catch (error) {
    console.error('Delete talent pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing from talent pool'
    });
  }
});

// NOTE: Application routes are now handled by the router at /api/applications
// See backend/routes/applications.js for the complete implementation
// Including: POST /api/applications, GET /api/applications/my-applications, 
//           GET /api/applications/company, GET /api/applications/for-my-jobs,
//           GET /api/applications/:id, PUT /api/applications/:id/status,
//           DELETE /api/applications/:id

// ========================
// INTERVIEW ROUTES
// ========================
// APPLICATION ROUTES
// ========================

// Apply for job
app.post('/api/applications', protect, async (req, res) => {
  try {
    const { jobId, coverLetter, resume, answers } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    // Check if job exists
    const job = await Job.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if job is closed
    if (job.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer accepting applications'
      });
    }

    // Check if user has already applied
    const existingApplication = await Application.findOne({
      jobId,
      userId: req.user.id
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Get user's resume from profile if not provided
    let resumeData = resume;
    if (!resumeData && req.user.profile && req.user.profile.resume) {
      resumeData = req.user.profile.resume;
    }

    // Create application
    const application = await Application.create({
      jobId,
      userId: req.user.id,
      jobTitle: job.title,
      company: job.company,
      applicantName: req.user.name,
      applicantEmail: req.user.email,
      coverLetter,
      resume: resumeData,
      answers,
      companyId: job.postedBy
    });

    // Increment applicant count
    await Job.findByIdAndUpdate(jobId, { $inc: { applicants: 1 } });

    // Update company stats
    await CompanyProfile.findOneAndUpdate(
      { userId: job.postedBy },
      { $inc: { 'stats.totalApplications': 1 } }
    );

    // Create notification for the job poster
    await createNotification(
      job.postedBy,
      'application',
      'New Application',
      `${req.user.name} has applied for your job: ${job.title}`,
      {
        priority: 'normal',
        jobDetails: {
          title: job.title,
          company: job.company,
          status: 'pending'
        },
        relatedId: application._id,
        relatedType: 'application'
      }
    );

    // Create activity for the company
    await createCompanyActivity(
      job.postedBy,
      'application_reviewed',
      `New application received for ${job.title}`,
      { jobId, applicationId: application._id }
    );

    // Add to talent pool automatically
    await TalentPool.findOneAndUpdate(
      { companyId: job.postedBy, candidateId: req.user.id },
      {
        companyId: job.postedBy,
        candidateId: req.user.id,
        jobId,
        source: 'application',
        status: 'new'
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting application'
    });
  }
});

// Get user's applications
app.get('/api/applications/my-applications', protect, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user.id })
      .populate('jobId', 'title company location type salary')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
});

// Get applications for user's jobs (for companies)
app.get('/api/applications/company', protect, companyOnly, async (req, res) => {
  try {
    // Get jobs posted by this user (use lean to avoid validation issues)
    const jobs = await Job.find({ postedBy: req.user.id }).lean();
    const jobIds = jobs.map(job => job._id);

    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId')
      .populate('userId', 'name email profile')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    console.error('Get applications for my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
});

// Get applications for user's jobs (alias for /applications/company for backward compatibility)
app.get('/api/applications/for-my-jobs', protect, async (req, res) => {
  try {
    // Only companies can access this
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        success: false,
        message: 'Only company accounts can access job applications'
      });
    }

    // Get jobs posted by this user (use lean to avoid validation issues)
    const jobs = await Job.find({ postedBy: req.user.id }).lean();
    const jobIds = jobs.map(job => job._id);

    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId')
      .populate('userId', 'name email profile')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get applications for my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
});

// Update application status - NOW HANDLED BY routes/applications.js router
// See routes/applications.js for the actual implementation

// Cancel application
app.delete('/api/applications/:id', protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user owns the application
    if (application.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this application'
      });
    }

    // Delete the application
    await Application.findByIdAndDelete(req.params.id);

    // Decrement applicant count
    await Job.findByIdAndUpdate(application.jobId, { $inc: { applicants: -1 } });

    res.status(200).json({
      success: true,
      message: 'Application cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling application'
    });
  }
});

// ========================
// INTERVIEW ROUTES
// ========================

// Interview routes are now handled by routes/interview.js (mounted at /api/interview)
// Notifications routes are handled by notificationRoutes
// (including /api/notifications, /api/notifications/:id/read, /api/notifications/read-all, etc.)

// Mark notification as read
app.put('/api/notifications/:id/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if user owns the notification
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification'
      });
    }
    
    notification.read = true;
    await notification.save();
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications'
    });
  }
});

// Delete notification
app.delete('/api/notifications/:id', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Check if user owns the notification
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification'
      });
    }
    
    await Notification.findByIdAndDelete(notificationId);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification'
    });
  }
});

// Get unread notification count
app.get('/api/notifications/unread-count', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const unreadCount = await Notification.countDocuments({
      userId: userId,
      read: false
    });

    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching unread count'
    });
  }
});

// Send email to applicant (company only)
app.post('/api/notifications/send-email', protect, companyOnly, async (req, res) => {
  try {
    const { toEmail, toName, subject, body, type, applicationId, jobTitle } = req.body;
    
    if (!toEmail || !subject || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, subject and body are required' 
      });
    }

    let emailHtml = body;
    
    if (type === 'approval') {
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Congratulations!</h2>
          <p>Dear ${toName || 'Candidate'},</p>
          <p>We are pleased to inform you that your application for the position of <strong>${jobTitle || 'the position'}</strong> has been <strong>approved</strong>.</p>
          <p>${body}</p>
          <p>Please check your dashboard for next steps.</p>
          <br/>
          <p>Best regards,<br/>Mission Hub Team</p>
        </div>
      `;
    } else if (type === 'rejection') {
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Application Update</h2>
          <p>Dear ${toName || 'Candidate'},</p>
          <p>Thank you for your interest in the <strong>${jobTitle || 'position'}</strong> at our company.</p>
          <p>After careful consideration, we regret to inform you that we have decided to move forward with other candidates.</p>
          <p>${body}</p>
          <p>We wish you the best in your future endeavors.</p>
          <br/>
          <p>Best regards,<br/>Mission Hub Team</p>
        </div>
      `;
    } else if (type === 'interview') {
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #020617;">Interview Invitation</h2>
          <p>Dear ${toName || 'Candidate'},</p>
          <p>Great news! You have been selected for an interview for the position of <strong>${jobTitle || 'the position'}</strong>.</p>
          <p>${body}</p>
          <p>Please log in to your dashboard to view interview details and confirm your availability.</p>
          <br/>
          <p>Best regards,<br/>Mission Hub Team</p>
        </div>
      `;
    } else {
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4b5563;">Message from Employer</h2>
          <p>Dear ${toName || 'Candidate'},</p>
          <p>${body}</p>
          <br/>
          <p>Best regards,<br/>Mission Hub Team</p>
        </div>
      `;
    }

    try {
      const sendEmail = req.app.get('sendEmail');
      const info = await sendEmail({
        to: toEmail,
        subject: subject,
        html: emailHtml
      });
      console.log('Email sent:', info.id);
    } catch (emailError) {
      console.log('Email service not available:', emailError.message);
    }

    // Also create a system notification for the user
    try {
      // Find user by email to get their ID
      const user = await User.findOne({ email: toEmail });
      if (user) {
        await createNotification(
          user._id,
          'message',
          subject,
          body,
          {
            priority: type === 'interview' ? 'high' : 'normal',
            messageDetails: {
              subject: subject,
              preview: body.substring(0, 100)
            },
            relatedType: 'message'
          }
        );
        console.log('System notification created for user:', user.name);
      }
    } catch (notifError) {
      console.log('Could not create notification:', notifError.message);
    }

    res.json({ 
      success: true, 
      message: 'Email sent successfully' 
    });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email: ' + error.message 
    });
  }
});

// ========================
// ERROR HANDLING
// ========================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found` 
  });
});

// Error Handler Middleware
app.use((err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err);

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    // Handle null email duplicates specifically
    if (value === null || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Registration error: Please provide a valid email address'
      });
    }
    
    const message = `${field} '${value}' already exists`;
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', ')
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Multer error for file uploads
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 5MB.'
    });
  }

  if (err.message && err.message.includes('Only image files are allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for upload.'
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error'
  });
});

// ========================
// SEED SYSTEM NOTIFICATIONS (for all job seekers)
// ========================
app.post('/api/notifications/seed-welcome', async (req, res) => {
  try {
    const Notification = require('./models/Notification');
    
    const welcomeNotifications = [
      {
        type: 'system',
        title: "Welcome to MissionHub! 🚀",
        message: "We are excited to help you bridge the gap between your unique talents and the world's leading companies. Our platform is more than just a job board—it is an AI-powered career agent designed to work for you 24/7.",
        priority: 'high',
        senderType: 'system'
      },
      {
        type: 'system',
        title: "🎯 How the System Works for You",
        message: "Precision Talent Matching: We don't just look at job titles. Our system analyzes your specific skills and 'Company DNA' to ensure that every connection made is a perfect fit for both your career goals and the employer's culture.",
        priority: 'normal',
        senderType: 'system'
      },
      {
        type: 'system',
        title: "🤖 Your Personal AI Scout",
        message: "You don't need to spend hours searching. Our built-in AI constantly monitors new opportunities. The moment a job is posted that matches your unique profile, the system notifies you instantly so you can be first in line.",
        priority: 'normal',
        senderType: 'system'
      },
      {
        type: 'system',
        title: "📈 Personalized Career Feed",
        message: "Stay ahead of the curve with a custom dashboard. Beyond job alerts, you'll receive related content, industry trends, and professional insights tailored specifically to your expertise.",
        priority: 'normal',
        senderType: 'system'
      },
      {
        type: 'system',
        title: "Your First Step: Fill Your Profile 📝",
        message: "To let the AI start hunting for you, we need to know who you are. Your profile is your Digital DNA—the more detail you provide, the more accurately our AI can advocate for you.\n\nClick 'Edit Profile' on your dashboard to:\n• Highlight your Talents: Add your core skills, certifications, and project history\n• Set your Preferences: Tell the AI exactly what kind of companies and roles you are looking for",
        priority: 'high',
        senderType: 'system'
      },
      {
        type: 'system',
        title: "Ready to find your next big move?",
        message: "Complete your profile now and let our AI find the perfect opportunities for you!",
        priority: 'normal',
        senderType: 'system'
      }
    ];
    
    // If userId provided, create for specific user, otherwise create sample for demo
    const { userId } = req.body;
    
    if (userId) {
      // Create notifications for specific user
      for (const notif of welcomeNotifications) {
        await Notification.create({
          userId,
          ...notif,
          read: false
        });
      }
      return res.json({ success: true, message: 'Welcome notifications created for user' });
    } else {
      return res.json({ success: true, message: 'Welcome notifications defined. Use with userId to create.' });
    }
  } catch (error) {
    console.error('Seed notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 5000;

// Connect to database and start server
connectDB().then(() => {
  const server = app.listen(
    PORT,
    () => console.log(`🚀 Server running on port ${PORT}`)
  );

  // Initialize WebSocket service
  const websocketService = require('./services/websocketService');
  websocketService.initialize(server);

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    server.close(() => process.exit(1));
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('🔌 Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('🔌 Process terminated');
      process.exit(0);
    });
  });
});