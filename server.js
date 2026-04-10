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
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mission_hub', 
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
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
      'http://127.0.0.1:4173'
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', 'resumes', filename);
    
    // Verify file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Resume file not found' });
    }
    
    // Set correct Content-Type for PDFs
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving resume:', error);
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
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
const createTransporter = () => {
  // Development mode - no email credentials
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('🔧 Development mode: Emails will be logged to console');
    
    return {
      sendMail: async (mailOptions) => {
        console.log('\n📧 DEVELOPMENT MODE - Email would be sent:');
        console.log('   From:', process.env.EMAIL_USER || 'noreply@missionhub.com');
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        
        // Extract verification/reset code from HTML
        const codeMatch = mailOptions.html?.match(/\d{6}/);
        if (codeMatch) {
          console.log('   🔑 CODE:', codeMatch[0]);
          console.log('   📝 Copy this code to verify or reset');
        }
        
        console.log('---\n');
        
        return {
          messageId: 'dev-mode-' + Date.now(),
          response: 'Development mode - email logged to console'
        };
      },
      verify: async () => true
    };
  }

  // Production email configuration with improved settings
  const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
  
  console.log('🔧 Initializing Gmail transporter...');
  console.log('   Email:', process.env.EMAIL_USER);
  console.log('   Password length:', cleanPassword.length, 'characters');
  
  // Create transporter with improved configuration
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: cleanPassword,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 5,
    rateDelta: 1000, // 1000ms between messages
    rateLimit: 5, // max 5 messages per second
  });

  // Add error handling for transporter
  transporter.on('idle', () => {
    console.log('📧 Email transporter is idle');
  });

  transporter.on('error', (err) => {
    console.error('❌ Email transporter error:', err);
  });

  return transporter;
};

// Initialize email transporter
const emailTransporter = createTransporter();
app.set('emailTransporter', emailTransporter);

// ========================
// EMAIL TEST FUNCTION
// ========================
const testEmailConfig = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('🎯 Development mode activated');
    console.log('   Verification codes will be shown in console');
    console.log('   No actual emails will be sent');
    return;
  }

  try {
    console.log('🧪 Testing email configuration...');
    await emailTransporter.verify();
    console.log('✅ Email server is ready to send messages');
    
    // Test sending a simple email
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Mission Hub - Email Test ✅',
        text: 'This is a test email from Mission Hub server. If you receive this, email configuration is working correctly!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #2563eb; text-align: center;">✅ Email Test Successful!</h2>
            <p>This is a test email from Mission Hub server.</p>
            <p>If you receive this, your email configuration is working correctly!</p>
            <p><strong>Server Time:</strong> ${new Date().toString()}</p>
          </div>
        `
      });
      console.log('✅ Test email sent successfully');
      console.log('📨 Check your inbox for the test email');
    } catch (testError) {
      console.log('⚠️  Test email failed:', testError.message);
    }
    
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
    console.log('\n🔧 REQUIRED FIXES:');
    console.log('   1. Enable 2-Step Verification in Google Account');
    console.log('   2. Generate App Password at: https://myaccount.google.com/apppasswords');
    console.log('   3. Use 16-character App Password (no spaces) in .env file');
    console.log('   4. Ensure EMAIL_USER is your full Gmail address');
    console.log('\n💡 QUICK FIX: Remove EMAIL_USER & EMAIL_PASS from .env to use development mode');
  }
};

// Call email test
testEmailConfig();

// ========================
// IN-MEMORY STORAGE (for verification/reset codes)
// ========================
const verificationCodes = new Map();

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========================
// EMAIL QUEUE SYSTEM
// ========================
const emailQueue = [];
let isProcessingEmails = false;

// Add email to queue
const queueEmail = (mailOptions, callback) => {
  emailQueue.push({ mailOptions, callback });
  processEmailQueue();
};

// Process email queue with rate limiting
const processEmailQueue = async () => {
  if (isProcessingEmails || emailQueue.length === 0) return;
  
  isProcessingEmails = true;
  
  while (emailQueue.length > 0) {
    const { mailOptions, callback } = emailQueue.shift();
    
    try {
      // Add delay between emails to avoid rate limiting
      if (emailQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await emailTransporter.sendMail(mailOptions);
      callback(null, result);
    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      callback(error);
    }
  }
  
  isProcessingEmails = false;
};

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

    const emailTransporter = req.app.get('emailTransporter');
    
    const result = await emailTransporter.sendMail({
      from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
      to: testEmail,
      subject: 'Mission Hub - Test Email ✅',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; padding: 30px; border-radius: 10px 10px 0 0; color: white;">
            <h1 style="margin: 0; font-size: 28px;"> Mission Hub</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Test Successful</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #059669; text-align: center;">✅ Email Configuration Working!</h2>
            <p>If you're reading this, your Mission Hub email configuration is working correctly.</p>
            
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46;">
                <strong>Server Time:</strong> ${new Date().toString()}<br>
                <strong>Recipient:</strong> ${testEmail}<br>
                <strong>Status:</strong> <span style="color: #059669;">Active</span>
              </p>
            </div>
            
            <p style="text-align: center; color: #666;">
              You can now receive verification codes for user registration.
            </p>
          </div>
        </div>
      `
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId
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

    const emailTransporter = req.app.get('emailTransporter');
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: cleanEmail,
        subject: 'Your Verification Code - Mission Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #2563eb; text-align: center;">Email Verification</h2>
            <p>Use the verification code below to verify your email address:</p>
            <div style="text-align:center; font-size: 28px; letter-spacing: 6px; font-weight: bold;">${verificationCode}</div>
            <p style="color:#ef4444; text-align:center;">This code expires in 13 hours.</p>
          </div>
        `
      });
    } catch (e) {
      console.log('Email send failed (dev mode):', e.message);
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

    const emailTransporter = req.app.get('emailTransporter');
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: cleanEmail,
        subject: 'Your Verification Code - Mission Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #2563eb; text-align: center;">Email Verification</h2>
            <p>Use the verification code below to verify your email address:</p>
            <div style="text-align:center; font-size: 28px; letter-spacing: 6px; font-weight: bold;">${verificationCode}</div>
            <p style="color:#ef4444; text-align:center;">This code expires in 13 hours.</p>
          </div>
        `
      });
    } catch (e) {
      console.log('Email send failed (dev mode):', e.message);
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

    // Get email transporter
    const emailTransporter = req.app.get('emailTransporter');

    // Send verification email
    let emailSent = false;
    let emailError = null;

    try {
      const mailResult = await emailTransporter.sendMail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: cleanEmail,
        subject: 'Verify Your Email - Mission Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #1b5ff1ff 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">Mission Hub</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Verification</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Welcome to Mission Hub! Use the verification code below to complete your registration:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background: #f8fafc; padding: 20px 40px; border: 2px dashed #cbd5e1; border-radius: 10px;">
                  <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; font-family: 'Courier New', monospace;">
                    ${verificationCode}
                  </div>
                </div>
              </div>
              
              <p style="color: #ef4444; line-height: 1.6; margin-bottom: 10px; text-align: center;">
                <strong>⚠️ This code will expire in 10 minutes</strong>
              </p>
              
              <p style="color: #999; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                If you didn't create an account with Mission Hub, please ignore this email.
              </p>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                &copy; ${new Date().getFullYear()} Mission Hub. All rights reserved.
              </p>
            </div>
          </div>
        `
      });

      emailSent = true;
      console.log(`✅ Verification email sent to: ${cleanEmail}`);
      console.log(`   Message ID: ${mailResult.messageId}`);
      
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

    // Get email transporter
    const emailTransporter = req.app.get('emailTransporter');

    // Send reset email
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: cleanEmail,
        subject: 'Reset Your Password - Mission Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">🔐 Mission Hub</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Password Reset</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                We received a request to reset your password. Use the code below to reset it:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background: #fef2f2; padding: 20px 40px; border: 2px dashed #fecaca; border-radius: 10px;">
                  <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626; font-family: 'Courier New', monospace;">
                    ${resetCode}
                  </div>
                </div>
              </div>
              
              <p style="color: #ef4444; line-height: 1.6; margin-bottom: 10px; text-align: center;">
                <strong>⚠️ This code will expire in 30 minutes</strong>
              </p>
              
              <p style="color: #999; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                If you didn't request a password reset, please ignore this email.
              </p>
            </div>
          </div>
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
          documents: profileData.documents || []
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
    
    res.status(200).json({
      success: true,
      data: jobs
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
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs
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

// Update application status
app.put('/api/applications/:id/status', protect, companyOnly, async (req, res) => {
  try {
    const { status, notes, sendEmail: shouldSendEmail = true, sendInApp: shouldSendInApp = true, customMessage, subject } = req.body;

    if (!status || !['pending', 'reviewed', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status is required' });
    }

    const application = await Application.findById(req.params.id).populate('jobId').populate('userId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.jobId && application.jobId.postedBy && application.jobId.postedBy.toString() !== req.user.id && application.companyId?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this application' });
    }

    const previousStatus = application.status;
    application.status = status;
    if (notes !== undefined) application.notes = notes;
    await application.save();

    const applicant = await User.findById(application.userId?._id || application.userId);
    const jobTitle = application.jobId?.title || application.jobTitle || 'the position';
    const companyName = application.company || 'the company';
    const applicantName = applicant?.name || 'Applicant';

    const result = {
      applicationUpdated: true,
      inAppNotificationSent: false,
      emailSent: false,
      inAppNotificationError: null,
      emailError: null
    };

    if (shouldSendInApp !== false && applicant) {
      try {
        const Notification = require('./models/Notification');
        let notificationTitle = '';
        let notificationMessage = customMessage || '';
        let priority = 'normal';

        switch (status) {
          case 'reviewed':
            notificationTitle = 'Application Under Review';
            if (!notificationMessage) notificationMessage = `Your application for ${jobTitle} at ${companyName} is being reviewed.`;
            break;
          case 'approved':
            notificationTitle = 'Application Approved!';
            if (!notificationMessage) notificationMessage = `Great news! Your application for ${jobTitle} at ${companyName} has been approved. Contact will be made shortly.`;
            priority = 'high';
            break;
          case 'rejected':
            notificationTitle = 'Application Update';
            if (!notificationMessage) notificationMessage = `Your application for ${jobTitle} at ${companyName} has been updated.`;
            break;
          default:
            notificationTitle = 'Application Status Updated';
            if (!notificationMessage) notificationMessage = `Your application for ${jobTitle} has been updated to ${status}.`;
        }

        await Notification.create({
          userId: applicant._id,
          type: 'application_update',
          title: notificationTitle,
          message: notificationMessage,
          priority,
          senderType: 'company',
          read: false,
          applicationDetails: { applicationId: application._id, jobTitle, companyName, previousStatus, newStatus: status },
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

    if (shouldSendEmail !== false && applicant?.email) {
      try {
        const emailService = require('./services/emailService');
        let emailSubject = subject || '';
        let emailHtml = '';

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
                <p style="color: #666;">Best regards,<br/>${companyName} Team</p>
              </div>
            </div>
          `;
        } else {
          switch (status) {
            case 'approved':
              emailSubject = `Congratulations! Your Application for ${jobTitle} Has Been Approved!`;
              emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="color: white; margin: 0;">Congratulations!</h2>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                    <p style="color: #333;">Dear ${applicantName},</p>
                    <p style="color: #333;">We are thrilled to inform you that your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been <strong style="color: #10B981;">APPROVED</strong>!</p>
                    <p style="color: #666;">The company will reach out to you shortly with next steps.</p>
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
                    <p style="color: #333;">Thank you for your interest in <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
                    <p style="color: #666;">After careful consideration, we have decided to proceed with other candidates.</p>
                    <p style="color: #666;">Best regards,<br/>The ${companyName} Team</p>
                  </div>
                </div>
              `;
              break;
            default:
              emailSubject = `Your Application for ${jobTitle} is Under Review`;
              emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="color: white; margin: 0;">Application Under Review</h2>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
                    <p style="color: #333;">Dear ${applicantName},</p>
                    <p style="color: #333;">Your application for <strong>${jobTitle}</strong> is now being reviewed.</p>
                    <p style="color: #666;">Best regards,<br/>The ${companyName} Team</p>
                  </div>
                </div>
              `;
          }
        }

        if (emailSubject && emailHtml) {
          const emailResult = await emailService.sendEmail({ email: applicant.email, subject: emailSubject, message: emailHtml });
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

    let message = `Application ${status}`;
    if (result.inAppNotificationSent) message += ', In-app notification sent';
    if (result.emailSent) message += ', Email sent';

    console.log(`\n📋 Application Status: ${previousStatus} → ${status}`);
    console.log(`   Applicant: ${applicantName}`);
    console.log(`   In-App: ${result.inAppNotificationSent ? '✅' : '❌'}`);
    console.log(`   Email: ${result.emailSent ? '✅' : '❌'}`);

    res.json({ success: true, message, data: application, notificationResult: result });
  } catch (error) {
    console.error('❌ Update application status error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

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
    if (application.userId.toString() !== req.user.id) {
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
      message: 'Server error while fetching unread count'
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
          <h2 style="color: #3b82f6;">Interview Invitation</h2>
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
      const info = await emailTransporter.sendMail({
        from: `"Mission Hub" <${process.env.EMAIL_USER || 'noreply@missionhub.com'}>`,
        to: toEmail,
        subject: subject,
        html: emailHtml
      });
      console.log('Email sent:', info.messageId);
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
console.log('[DEBUG] About to connect to database...');
connectDB().then(() => {
  console.log('[DEBUG] Database connected, checking Application model...');
  const AppModel = mongoose.models.Application;
  console.log('[DEBUG] mongoose.models.Application:', typeof AppModel);
  if (AppModel) {
    console.log('[DEBUG] Application schema paths:', Object.keys(AppModel.schema.paths));
    console.log('[DEBUG] resume path:', AppModel.schema.paths.resume);
    console.log('[DEBUG] companyId path:', AppModel.schema.paths.companyId);
  }
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