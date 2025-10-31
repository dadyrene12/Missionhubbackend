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
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mission_hub');

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

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for document uploads
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, resumesDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
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
const documentFilter = (req, file, cb) => {
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

// Configure multer for documents
const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: documentFilter
});

// ========================
// USER MODEL - ENHANCED
// ========================
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        if (!email || email.trim() === '') return false;
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
      },
      message: 'Please add a valid email'
    }
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  userType: {
    type: String,
    required: true,
    enum: ['jobSeeker', 'company'],
    default: 'jobSeeker'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Enhanced personalInfo section
  personalInfo: {
    phone: String,
    location: String,
    dateOfBirth: Date,
    gender: String,
    nationality: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  // Enhanced professionalInfo section
  professionalInfo: {
    title: String,
    industry: String,
    company: String,
    experience: String, // entry, junior, mid, senior, lead, principal
    educationLevel: String, // highschool, associate, bachelor, master, phd
    education: String,
    skills: [String],
    certifications: [String],
    languages: [String],
    preferredJobType: String, // full-time, part-time, contract, freelance, internship, remote
    preferredLocation: String,
    salaryExpectation: Number,
    availability: String, // immediate, 1week, 2weeks, 1month, 2months
    workAuthorization: String,
    relocation: Boolean,
    linkedin: String,
    github: String,
    portfolio: String,
    bio: String
  },
  // Privacy settings
  privacySettings: {
    profileVisibility: String, // public, private, connections
    showContactInfo: Boolean
  },
  // Notification preferences
  notificationPreferences: {
    emailNotifications: Boolean,
    pushNotifications: Boolean,
    jobAlerts: Boolean,
    applicationUpdates: Boolean
  },
  // Profile photo
  profilePhoto: String,
  // Documents array - FIXED: Properly defined as an array of objects
  documents: [{
    name: String,
    url: String,
    uploadDate: Date,
    size: String,
    type: String,
    isPrimary: Boolean
  }]
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  // Validate email before saving
  if (!this.email || this.email.trim() === '') {
    return next(new Error('Email is required and cannot be empty'));
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get signed JWT token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id }, 
    process.env.JWT_SECRET || 'fallback-secret-key-2024',
    { expiresIn: '30d' }
  );
};

const User = mongoose.model('User', userSchema);

// ========================
// JOB MODEL
// ========================
const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a job title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  company: {
    type: String,
    required: [true, 'Please add a company name'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Please add a location'],
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
    default: 'full-time'
  },
  category: {
    type: String,
    required: true,
    enum: ['technology', 'marketing', 'finance', 'healthcare', 'design', 'sales', 'education', 'other'],
    default: 'technology'
  },
  experience: {
    type: String,
    required: true,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'principal'],
    default: 'mid'
  },
  salary: {
    type: String,
    trim: true
  },
  salaryMin: {
    type: Number,
    default: 0
  },
  salaryMax: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    required: [true, 'Please add a job description']
  },
  responsibilities: [String],
  requirements: [String],
  benefits: [String],
  skills: [String],
  remote: {
    type: Boolean,
    default: false
  },
  urgent: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  applicants: {
    type: Number,
    default: 0
  },
  contactEmail: String,
  contactPhone: String,
  applicationUrl: String,
  companyLogo: String,
  companySize: String,
  workCulture: String,
  image: {
    type: String,
    default: ''
  },
  postedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Job = mongoose.model('Job', jobSchema);

// ========================
// APPLICATION MODEL - ENHANCED
// ========================
const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job',
    required: true
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  applicantName: {
    type: String,
    required: true
  },
  applicantEmail: {
    type: String,
    required: true
  },
  coverLetter: String,
  resume: {
    name: String,
    url: String,
    uploadDate: Date,
    size: String,
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  answers: [{
    question: String,
    answer: String
  }],
  // Add application date for frontend display
  applicationDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

applicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });

const Application = mongoose.model('Application', applicationSchema);

// ========================
// MESSAGE MODEL - ENHANCED
// ========================
const messageSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job'
  },
  applicationId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Application'
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  // Add content field for compatibility
  content: {
    type: String
  },
  // Add type field for message categorization
  type: {
    type: String,
    enum: ['general', 'job_related', 'application_related'],
    default: 'general'
  },
  // Add priority field
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// Virtual to ensure content field is populated from body if not provided
messageSchema.virtual('contentVirtual').get(function() {
  return this.content || this.body;
});

// Pre-save middleware to populate content field from body if content is empty
messageSchema.pre('save', function(next) {
  if (!this.content && this.body) {
    this.content = this.body;
  }
  next();
});

const Message = mongoose.model('Message', messageSchema);

// ========================
// NOTIFICATION MODEL - ENHANCED
// ========================
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['job', 'application', 'profile', 'message', 'system', 'reply']
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  jobDetails: {
    title: String,
    company: String,
    status: String,
    salary: String,
    location: String
  },
  messageDetails: {
    subject: String,
    preview: String
  },
  actions: [{
    label: String,
    primary: Boolean,
    handler: String // Store as string since functions can't be stored in MongoDB
  }],
  // Add relatedId and relatedType for navigation
  relatedId: {
    type: mongoose.Schema.ObjectId
  },
  relatedType: {
    type: String,
    enum: ['message', 'job', 'application', 'profile']
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

// ========================
// MIDDLEWARE
// ========================

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,
});
app.use('/api/', limiter);

// Set security headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========================
// AUTH MIDDLEWARE
// ========================
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-2024');
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

// ========================
// ROUTES
// ========================

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
          <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #1b5ff1ff 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
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

// Resend verification code
app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      // Don't leak existence
      return res.json({ success: true, message: 'If the account exists, a code has been sent' });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account already verified' });
    }

    const verificationCode = generateVerificationCode();
    verificationCodes.set(cleanEmail, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

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
            <p style="color:#ef4444; text-align:center;">This code expires in 10 minutes.</p>
          </div>
        `
      });
    } catch (e) {
      // In dev mode, code is logged by transporter
    }

    return res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Resend code error:', error);
    return res.status(500).json({ success: false, message: 'Server error during resend' });
  }
});

// ========================
// AUTH ROUTES
// ========================

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
      profile: profile || {}
    });

    // Generate verification code
    const verificationCode = generateVerificationCode();
    verificationCodes.set(cleanEmail, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

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

    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Registration successful. Please check your email for verification code.' 
        : 'Registration successful, but email service is temporarily unavailable. Check console for verification code.',
      emailSent,
      verificationCode: emailSent ? undefined : verificationCode,
      error: emailError,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType
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
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check for user with password
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // Generate token
    const token = user.getSignedJwtToken();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: true,
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
      }
    });

  } catch (error) {
    console.error('Login error:', error);
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

// Reset password (needed by frontend)
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

// ========================
// USER ROUTES - ENHANCED
// ========================

// Get current user profile
app.get('/api/users/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user profile with all sections
app.get('/api/users/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update complete user profile - FIXED: Properly handle documents array
app.put('/api/users/profile', protect, async (req, res) => {
  try {
    const { personalInfo, professionalInfo, privacySettings, notificationPreferences, documents } = req.body;
    
    const updateData = {};
    
    if (personalInfo) updateData.personalInfo = personalInfo;
    if (professionalInfo) updateData.professionalInfo = professionalInfo;
    if (privacySettings) updateData.privacySettings = privacySettings;
    if (notificationPreferences) updateData.notificationPreferences = notificationPreferences;
    
    // FIXED: Handle documents array properly
    if (documents) {
      // If documents is a string, parse it first
      let parsedDocuments = documents;
      if (typeof documents === 'string') {
        try {
          parsedDocuments = JSON.parse(documents);
        } catch (e) {
          console.error('Error parsing documents:', e);
          return res.status(400).json({
            success: false,
            message: 'Invalid documents format'
          });
        }
      }
      
      // Validate that it's an array
      if (!Array.isArray(parsedDocuments)) {
        return res.status(400).json({
          success: false,
          message: 'Documents must be an array'
        });
      }
      
      updateData.documents = parsedDocuments;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// Update user profile
app.put('/api/users/me', protect, async (req, res) => {
  try {
    const { name, profile } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    
    if (profile) {
      // Handle profile update with backward compatibility
      const profileUpdate = { ...req.user.profile, ...profile };
      updateData.profile = profileUpdate;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
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
      'github', 'portfolio', 'profilePhoto', 'resume'
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
    } else if (field === 'resume') {
      // Special handling for resume field
      if (value && typeof value === 'object') {
        updateData[`profile.${field}`] = JSON.stringify(value);
      } else {
        updateData[`profile.${field}`] = value;
      }
    } else {
      updateData[`profile.${field}`] = value;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
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
        personalInfo: user.personalInfo || {},
        professionalInfo: user.professionalInfo || {},
        privacySettings: user.privacySettings || {},
        notificationPreferences: user.notificationPreferences || {},
        profilePhoto: user.profilePhoto,
        documents: user.documents || []
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

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().populate('postedBy', 'name email').sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching jobs'
    });
  }
});

// Create job
app.post('/api/jobs', protect, async (req, res) => {
  try {
    // Only companies can post jobs
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        success: false,
        message: 'Only company accounts can post jobs'
      });
    }

    const job = await Job.create({
      ...req.body,
      postedBy: req.user.id
    });

    const populatedJob = await Job.findById(job._id).populate('postedBy', 'name email');

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

// Get user's posted jobs
app.get('/api/jobs/my-jobs', protect, async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id }).populate('postedBy', 'name email').sort({ createdAt: -1 });
    
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

    const job = await Job.findById(req.params.id).populate('postedBy', 'name email');
    
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
app.put('/api/jobs/:id', protect, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('postedBy', 'name email');

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
app.delete('/api/jobs/:id', protect, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user owns the job
    if (job.postedBy.toString() !== req.user.id) {
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

// Upload profile photo
app.post('/api/upload/profile-photo', protect, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Update user profile with photo URL
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          profilePhoto: `/uploads/${req.file.filename}`
        } 
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      imageUrl: `/uploads/${req.file.filename}`
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
// DOCUMENT UPLOAD ROUTES - ENHANCED
// ========================

// Upload resume endpoint - FIXED
app.post('/api/upload/resume', protect, uploadDocument.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file provided'
      });
    }

    // Create resume data object
    const resumeData = {
      name: req.file.originalname,
      url: `/uploads/resumes/${req.file.filename}`,
      uploadDate: new Date(),
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: req.file.mimetype
    };

    // Add document to user's documents array
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $push: { 
          documents: resumeData
        } 
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully',
      resume: resumeData
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading resume'
    });
  }
});

// Upload document
app.post('/api/upload/document', protect, uploadDocument.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file provided'
      });
    }

    // Create document data object
    const documentData = {
      name: req.file.originalname,
      url: `/uploads/resumes/${req.file.filename}`,
      uploadDate: new Date(),
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: req.file.mimetype,
      isPrimary: false
    };

    // Add document to user's documents array
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $push: { 
          documents: documentData
        } 
      },
      { 
        new: true, 
        runValidators: true 
      }
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

// Delete document
app.delete('/api/documents/:documentId', protect, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Find user and remove document
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find document in user's documents array
    const documentIndex = user.documents.findIndex(doc => doc._id.toString() === documentId);
    
    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Get document URL for file deletion
    const documentUrl = user.documents[documentIndex].url;
    
    // Remove document from array
    user.documents.splice(documentIndex, 1);
    await user.save();
    
    // Delete file from filesystem
    if (documentUrl) {
      const filePath = path.join(__dirname, documentUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
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

// Set primary document
app.put('/api/documents/:documentId/set-primary', protect, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Find user and update documents
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Reset all documents to non-primary
    user.documents.forEach(doc => {
      doc.isPrimary = false;
    });
    
    // Set specified document as primary
    const document = user.documents.find(doc => doc._id.toString() === documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    document.isPrimary = true;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Primary document set successfully'
    });
  } catch (error) {
    console.error('Set primary document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while setting primary document'
    });
  }
});

// ========================
// APPLICATION ROUTES - ENHANCED
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
    const job = await Job.findById(jobId);
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
    if (!resumeData && req.user.documents && req.user.documents.length > 0) {
      // Find primary document or first document
      const primaryDoc = req.user.documents.find(doc => doc.isPrimary) || req.user.documents[0];
      if (primaryDoc) {
        resumeData = primaryDoc;
      }
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
      answers
    });

    // Increment applicant count
    await Job.findByIdAndUpdate(jobId, { $inc: { applicants: 1 } });

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
        }
      }
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
      .populate('jobId')
      .sort({ createdAt: -1 });

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
app.get('/api/applications/for-my-jobs', protect, async (req, res) => {
  try {
    // Only companies can access this
    if (req.user.userType !== 'company') {
      return res.status(403).json({
        success: false,
        message: 'Only company accounts can access job applications'
      });
    }

    // Get jobs posted by this user
    const jobs = await Job.find({ postedBy: req.user.id });
    const jobIds = jobs.map(job => job._id);

    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId')
      .populate('userId', 'name email personalInfo professionalInfo')
      .sort({ createdAt: -1 });

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

// Update application status
app.put('/api/applications/:id/status', protect, async (req, res) => {
  try {
    const { status, notes } = req.body;

    const application = await Application.findById(req.params.id).populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if user owns the job
    if (application.jobId.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application'
      });
    }

    const oldStatus = application.status;
    application.status = status;
    
    // Update notes if provided
    if (notes !== undefined) {
      application.notes = notes;
    }
    
    await application.save();

    // Create notification for the applicant
    await createNotification(
      application.userId,
      'application',
      `Application ${status}`,
      `Your application for ${application.jobTitle} at ${application.company} has been ${status}.`,
      {
        priority: status === 'approved' ? 'high' : 'normal',
        jobDetails: {
          title: application.jobTitle,
          company: application.company,
          status: status
        }
      }
    );

    // Send email notification to applicant with improved error handling
    try {
      const applicant = await User.findById(application.userId);
      
      let emailSubject, emailContent;
      
      if (status === 'approved') {
        emailSubject = `Congratulations! Your application for ${application.jobTitle} has been approved`;
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Application Approved</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${applicant.name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Great news! Your application for <strong>${application.jobTitle}</strong> at <strong>${application.company}</strong> has been approved.
              </p>
              
              ${notes ? `
              <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Note from the employer:</strong> ${notes}
                </p>
              </div>
              ` : ''}
              
              <p style="color: #666; line-height: 1.6;">
                The employer may contact you soon with next steps. Make sure to check your messages on Mission Hub regularly.
              </p>
            </div>
          </div>
        `;
      } else if (status === 'rejected') {
        emailSubject = `Update on your application for ${application.jobTitle}`;
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">Application Update</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your application has been reviewed</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${applicant.name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Thank you for your interest in the <strong>${application.jobTitle}</strong> position at <strong>${application.company}</strong>.
                After careful consideration, we've decided to move forward with other candidates at this time.
              </p>
              
              ${notes ? `
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #4b5563;">
                  <strong>Feedback from the employer:</strong> ${notes}
                </p>
              </div>
              ` : ''}
              
              <p style="color: #666; line-height: 1.6;">
                We encourage you to continue applying for other positions that match your skills and experience.
              </p>
            </div>
          </div>
        `;
      } else {
        // For other status changes
        emailSubject = `Update on your application for ${application.jobTitle}`;
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">Application Update</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your application status has changed</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${applicant.name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                The status of your application for <strong>${application.jobTitle}</strong> at <strong>${application.company}</strong> has been updated to: <strong>${status}</strong>.
              </p>
              
              ${notes ? `
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #075985;">
                  <strong>Note from the employer:</strong> ${notes}
                </p>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }
      
      // Use the email queue system to send the email
      queueEmail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: applicant.email,
        subject: emailSubject,
        html: emailContent
      }, (error, result) => {
        if (error) {
          console.error('❌ Failed to send application status email:', error.message);
          // Don't fail the request if email fails, just log it
        } else {
          console.log(`✅ Application status email sent to: ${applicant.email}`);
        }
      });
      
    } catch (emailError) {
      console.error('❌ Failed to send application status email:', emailError.message);
      // Don't fail the request if email fails, just log it
    }

    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      application
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating application status'
    });
  }
});

// Cancel application with confirmation
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

    // Create notification for the user
    await createNotification(
      req.user.id,
      'application',
      'Application Cancelled',
      `You have cancelled your application for ${application.jobTitle} at ${application.company}`,
      {
        priority: 'normal',
        jobDetails: {
          title: application.jobTitle,
          company: application.company,
          status: 'cancelled'
        }
      }
    );

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
// MESSAGE ROUTES - ENHANCED
// ========================

// Send message
app.post('/api/messages', protect, async (req, res) => {
  try {
    const { toUserId, jobId, applicationId, subject, body } = req.body;

    if (!toUserId || !body) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and message body are required'
      });
    }

    // Determine message type based on context
    let messageType = 'general';
    if (jobId) {
      messageType = 'job_related';
    } else if (applicationId) {
      messageType = 'application_related';
    }

    // Create message with both body and content fields
    const message = await Message.create({
      fromUserId: req.user.id,
      toUserId,
      jobId,
      applicationId,
      subject: subject || 'Message from Mission Hub',
      body,
      content: body, // Ensure both fields are populated
      type: messageType,
      sentAt: new Date()
    });

    // Populate message details for response
    const populatedMessage = await Message.findById(message._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('jobId', 'title company')
      .populate('applicationId', 'jobTitle company');

    // Create notification for the recipient
    await createNotification(
      toUserId,
      'message',
      'New Message',
      `You have a new message from ${req.user.name}: ${subject}`,
      {
        priority: 'normal',
        relatedId: message._id,
        relatedType: 'message',
        messageDetails: {
          subject: subject || 'No subject',
          preview: body.substring(0, 100)
        }
      }
    );

    // Send email notification for new message with improved error handling
    try {
      const recipient = await User.findById(toUserId);
      
      // Use the email queue system to send the email
      queueEmail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: recipient.email,
        subject: `New message from ${req.user.name} on Mission Hub`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">💬 New Message</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You have a new message on Mission Hub</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipient.name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                You have received a new message from <strong>${req.user.name}</strong>:
              </p>
              
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #075985;">
                  <strong>Subject:</strong> ${subject || 'No subject'}<br>
                  <strong>Message:</strong> ${body}
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6;">
                Please log in to your Mission Hub account to reply to this message.
              </p>
            </div>
          </div>
        `
      }, (error, result) => {
        if (error) {
          console.error('❌ Failed to send new message email:', error.message);
          // Don't fail the request if email fails, just log it
        } else {
          console.log(`✅ New message email sent to: ${recipient.email}`);
        }
      });
      
    } catch (emailError) {
      console.error('❌ Failed to send new message email:', emailError.message);
      // Don't fail the request if email fails, just log it
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      message: populatedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending message'
    });
  }
});

// Get messages for user - ENHANCED
app.get('/api/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get messages sent to user
    const inboxMessages = await Message.find({ toUserId: userId })
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('jobId', 'title company')
      .populate('applicationId', 'jobTitle company')
      .sort({ sentAt: -1 });

    // Get messages sent by user
    const sentMessages = await Message.find({ fromUserId: userId })
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('jobId', 'title company')
      .populate('applicationId', 'jobTitle company')
      .sort({ sentAt: -1 });

    res.status(200).json({
      success: true,
      inbox: inboxMessages,
      sent: sentMessages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching messages'
    });
  }
});

// Get unread message count
app.get('/api/messages/unread-count', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const unreadCount = await Message.countDocuments({
      toUserId: userId,
      read: false
    });
    
    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
});

// Get conversation with a specific user - ENHANCED
app.get('/api/messages/conversation/:userId', protect, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    const messages = await Message.find({
      $or: [
        { fromUserId: currentUserId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: currentUserId }
      ]
    })
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('jobId', 'title company')
    .sort({ sentAt: 1 });
    
    // Mark messages as read
    await Message.updateMany(
      { fromUserId: otherUserId, toUserId: currentUserId, read: false },
      { read: true }
    );
    
    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching conversation'
    });
  }
});

// Reply to a message - NEW ENDPOINT
app.post('/api/messages/reply/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { body } = req.body;
    
    if (!body) {
      return res.status(400).json({
        success: false,
        message: 'Reply body is required'
      });
    }
    
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }
    
    // Find the original message
    const originalMessage = await Message.findById(messageId);
    
    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: 'Original message not found'
      });
    }
    
    // Check if user is part of this conversation
    if (
      originalMessage.fromUserId.toString() !== req.user.id && 
      originalMessage.toUserId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reply to this message'
      });
    }
    
    // Determine recipient (the other person in the conversation)
    const recipientId = originalMessage.fromUserId.toString() === req.user.id 
      ? originalMessage.toUserId 
      : originalMessage.fromUserId;
    
    // Create reply message
    const replyMessage = await Message.create({
      fromUserId: req.user.id,
      toUserId: recipientId,
      subject: `Re: ${originalMessage.subject}`,
      body,
      content: body, // Ensure both fields are populated
      jobId: originalMessage.jobId,
      applicationId: originalMessage.applicationId,
      type: originalMessage.type,
      sentAt: new Date()
    });
    
    // Populate message details for response
    const populatedReply = await Message.findById(replyMessage._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('jobId', 'title company')
      .populate('applicationId', 'jobTitle company');
    
    // Create notification for the recipient
    await createNotification(
      recipientId,
      'reply',
      'New Reply',
      `You have a new reply from ${req.user.name} to your message: ${originalMessage.subject}`,
      {
        priority: 'normal',
        relatedId: replyMessage._id,
        relatedType: 'message',
        messageDetails: {
          subject: `Re: ${originalMessage.subject}`,
          preview: body.substring(0, 100)
        }
      }
    );
    
    // Send email notification for reply
    try {
      const recipient = await User.findById(recipientId);
      
      queueEmail({
        from: process.env.EMAIL_USER || 'Mission Hub <noreply@missionhub.com>',
        to: recipient.email,
        subject: `New reply from ${req.user.name} on Mission Hub`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px;">💬 New Reply</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You have a new reply on Mission Hub</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipient.name},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                You have received a new reply from <strong>${req.user.name}</strong> to your message:
              </p>
              
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #075985;">
                  <strong>Subject:</strong> Re: ${originalMessage.subject}<br>
                  <strong>Reply:</strong> ${body}
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6;">
                Please log in to your Mission Hub account to continue the conversation.
              </p>
            </div>
          </div>
        `
      }, (error, result) => {
        if (error) {
          console.error('❌ Failed to send reply email:', error.message);
        } else {
          console.log(`✅ Reply email sent to: ${recipient.email}`);
        }
      });
      
    } catch (emailError) {
      console.error('❌ Failed to send reply email:', emailError.message);
    }
    
    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      message: populatedReply
    });
  } catch (error) {
    console.error('Reply to message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending reply'
    });
  }
});

// Mark message as read
app.put('/api/messages/:id/read', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the recipient
    if (message.toUserId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read'
      });
    }

    message.read = true;
    await message.save();

    res.status(200).json({
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

// Delete message
app.delete('/api/messages/:id', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender or recipient
    if (
      message.fromUserId.toString() !== req.user.id && 
      message.toUserId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    await Message.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting message'
    });
  }
});

// ========================
// NOTIFICATION ROUTES - ENHANCED
// ========================

// Get notifications for user
app.get('/api/notifications', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const notifications = await Notification.find({ userId })
      .sort({ date: -1 })
      .limit(50); // Limit to most recent 50 notifications
    
    res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

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

// Helper function to create a notification - ENHANCED
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

// ========================
// ERROR HANDLING - ENHANCED
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
      message: 'File size too large. Maximum size is 5MB for images and 10MB for documents.'
    });
  }

  if (err.message && err.message.includes('Only image files are allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for profile photos.'
    });
  }

  if (err.message && err.message.includes('Only PDF, DOC, or DOCX files are allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Only PDF, DOC, or DOCX files are allowed for documents.'
    });
  }

  // FIXED: Handle CastError for documents array
  if (err.name === 'CastError' && err.path && err.path.includes('documents')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid document format. Please ensure documents are properly formatted.'
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error'
  });
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

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.log(`❌ Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
});