const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    documents: [{
      _id: mongoose.Schema.Types.ObjectId,
      name: { type: String, default: '' },
      url: { type: String, default: '' },
      uploadDate: { type: Date, default: null },
      size: { type: String, default: '' },
      type: { type: String, default: '' },
      category: { type: String, default: '' }
    }],
    title: String,
    bio: String,
    phone: String,
    location: String,
    linkedin: String,
    github: String,
    portfolio: String,
    skills: [String],
    yearsOfExperience: Number,
    desiredSalary: String,
    workAuthorization: String,
    relocation: Boolean,
    preferredJobType: String,
    experience: String,
    education: String,
    experienceDetails: [{
      company: String,
      title: String,
      location: String,
      startDate: Date,
      endDate: Date,
      current: Boolean,
      description: String
    }],
    educationDetails: [{
      institution: String,
      degree: String,
      field: String,
      startDate: Date,
      endDate: Date
    }],
    companyName: String,
    companyWebsite: String,
    industry: String,
    companySize: String,
    headquarters: String,
    description: String,
    profilePhoto: String
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ loginRestricted: 1 });

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

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
