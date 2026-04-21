const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const documentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  url: { type: String, default: '' },
  uploadDate: { type: Date, default: null },
  size: { type: String, default: '' },
  type: { type: String, default: '' },
  category: { type: String, default: 'general' }
}, { _id: true });

const experienceDetailSchema = new mongoose.Schema({
  company: { type: String, default: '' },
  title: { type: String, default: '' },
  location: { type: String, default: '' },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  current: { type: Boolean, default: false },
  description: { type: String, default: '' }
}, { _id: true });

const educationDetailSchema = new mongoose.Schema({
  institution: { type: String, default: '' },
  degree: { type: String, default: '' },
  field: { type: String, default: '' },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null }
}, { _id: true });

const userProfileSchema = new mongoose.Schema({
  resume: {
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    uploadDate: { type: Date, default: null },
    size: { type: String, default: '' },
    type: { type: String, default: '' }
  },
  cv: {
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    uploadDate: { type: Date, default: null },
    size: { type: String, default: '' },
    type: { type: String, default: '' }
  },
  documents: [documentSchema],
  
  title: { type: String, default: '', trim: true },
  bio: { type: String, default: '', maxlength: 2000 },
  phone: { type: String, default: '', trim: true },
  location: { type: String, default: '', trim: true },
  
  linkedin: { type: String, default: '', trim: true },
  github: { type: String, default: '', trim: true },
  portfolio: { type: String, default: '', trim: true },
  
  skills: [{ type: String, trim: true }],
  yearsOfExperience: { type: Number, default: 0, min: 0, max: 50 },
  desiredSalary: { type: String, default: '', trim: true },
  workAuthorization: { type: String, default: '', trim: true },
  relocation: { type: Boolean, default: false },
  preferredJobType: { 
    type: String, 
    default: 'full-time',
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote', 'freelance', '']
  },
  
  experience: { type: String, default: '', maxlength: 5000 },
  education: { type: String, default: '', maxlength: 5000 },
  
  experienceDetails: [experienceDetailSchema],
  educationDetails: [educationDetailSchema],
  
  profilePhoto: { type: String, default: '' },
  logo: { type: String, default: '' },
  
  companyName: { type: String, default: '', trim: true },
  companyWebsite: { type: String, default: '', trim: true },
  industry: { type: String, default: '', trim: true },
  companySize: { type: String, default: '', trim: true },
  headquarters: { type: String, default: '', trim: true },
  description: { type: String, default: '', maxlength: 2000 },
  
  currentSalary: { type: String, default: '', trim: true },
  availability: { type: String, default: '', enum: ['immediately', '2weeks', '1month', '3months', ''] },
  preferredLocation: { type: String, default: '', trim: true },
  remoteWork: { type: Boolean, default: false },
  
  languages: [{ type: String, trim: true }],
  certifications: [{ type: String, trim: true }],
  
  linkedinUrl: { type: String, default: '', trim: true },
  githubUrl: { type: String, default: '', trim: true },
  websiteUrl: { type: String, default: '', trim: true },
  
  coverLetter: { type: String, default: '', maxlength: 2000 },
  
  socialLinks: {
    twitter: { type: String, default: '' },
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    tiktok: { type: String, default: '' }
  },
  
  availabilityForInterview: {
    type: String,
    default: '',
    enum: ['', 'weekdays', 'weekends', 'evenings', 'flexible']
  },
  
  preferredStartDate: { type: Date, default: null },
  
  expectedSalary: { type: Number, default: null, min: 0 },
  salaryCurrency: { type: String, default: 'USD', enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', ''] },
  
  nationality: { type: String, default: '', trim: true },
  dateOfBirth: { type: Date, default: null },
  
  gender: { type: String, default: '', enum: ['', 'male', 'female', 'other', 'prefer-not-to-say'] },
  disability: { type: String, default: '' },
  
  isProfileComplete: { type: Boolean, default: false },
  profileCompletionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  
  lastProfileUpdate: { type: Date, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        if (!email) return false;
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
    enum: ['jobSeeker', 'company', 'super_admin'],
    default: 'jobSeeker'
  },
  role: {
    type: String,
    enum: ['jobSeeker', 'company', 'admin', 'super_admin'],
    default: function() {
      return this.userType === 'company' ? 'company' : 'jobSeeker';
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  loginRestricted: {
    type: Boolean,
    default: false
  },
  restrictedAt: {
    type: Date
  },
  restrictedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  restrictionReason: {
    type: String
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  pendingEmail: {
    type: String
  },
  pendingEmailVerificationCode: {
    type: String
  },
  pendingEmailVerificationExpire: {
    type: Date
  },
  pendingVerificationData: {
    type: mongoose.Schema.Types.Mixed
  },
  permissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_companies', 
      'manage_jobs',
      'manage_applications',
      'manage_exams',
      'manage_activities',
      'manage_payments',
      'system_settings',
      'view_analytics'
    ]
  }],
  lastLogin: {
    type: Date
  },
  profileImage: {
    type: String
  },
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ip: String,
    userAgent: String,
    success: { type: Boolean, default: true }
  }],
  activityLog: [{
    action: String,
    timestamp: { type: Date, default: Date.now },
    details: String,
    ip: String
  }],
  profile: {
    type: userProfileSchema,
    default: () => ({})
  },
  aiNotifications: {
    enabled: { type: Boolean, default: true },
    emailAlerts: { type: Boolean, default: true },
    minMatchScore: { type: Number, default: 50, min: 0, max: 100 },
    matchedSkillsOnly: { type: Boolean, default: false },
    matchedExperienceOnly: { type: Boolean, default: false },
    frequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'immediate' },
    lastNotifiedAt: { type: Date, default: null }
  },
  companyAiNotifications: {
    enabled: { type: Boolean, default: true },
    emailAlerts: { type: Boolean, default: true },
    minMatchScore: { type: Number, default: 50, min: 0, max: 100 },
    notifyOnNewCandidate: { type: Boolean, default: true },
    frequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'immediate' },
    lastNotifiedAt: { type: Date, default: null }
  },
  lastAiMatchCheck: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});


userSchema.index({ userType: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ loginRestricted: 1 });
userSchema.index({ 'profile.skills': 1 });
userSchema.index({ 'profile.location': 1 });
userSchema.index({ 'profile.yearsOfExperience': 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  if (!this.email || this.email.trim() === '') {
    return next(new Error('Email is required'));
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.statics.findByIdWithPassword = async function(id) {
  const user = await this.findById(id).select('+password');
  return user;
};

userSchema.methods.getSignedJwtToken = function() {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin';
  return jwt.sign(
    { id: this._id }, 
    JWT_SECRET,
    { expiresIn: '365d' }
  );
};

userSchema.methods.calculateProfileCompletion = function() {
  let completed = 0;
  let total = 12;
  
  if (this.name) completed++;
  if (this.email) completed++;
  if (this.profile?.phone) completed++;
  if (this.profile?.location) completed++;
  if (this.profile?.title) completed++;
  if (this.profile?.bio) completed++;
  if (this.profile?.skills?.length > 0) completed++;
  if (this.profile?.experience) completed++;
  if (this.profile?.education) completed++;
  if (this.profile?.resume?.url) completed++;
  if (this.profile?.linkedin) completed++;
  if (this.profile?.github) completed++;
  
  return Math.round((completed / total) * 100);
};

userSchema.methods.toProfileJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginHistory;
  delete obj.activityLog;
  delete obj.pendingEmailVerificationCode;
  delete obj.pendingEmailVerificationExpire;
  delete obj.pendingVerificationData;
  
  obj.profileCompletionPercentage = this.calculateProfileCompletion();
  obj.isProfileComplete = obj.profileCompletionPercentage >= 80;
  obj.lastProfileUpdate = this.updatedAt;
  
  // Add profile fields to root level for easier access
  obj.profilePhoto = this.profile?.profilePhoto || '';
  obj.resume = this.profile?.resume?.url || this.profile?.resume || '';
  
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
