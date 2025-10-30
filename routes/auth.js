const express = require('express');
const User = require('../models/User');
const router = express.Router();

// In-memory storage for verification codes
const verificationCodes = new Map();

// Generate random verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up existing null email users on startup
const cleanNullEmailUsers = async () => {
  try {
    const result = await User.deleteMany({ 
      $or: [
        { email: null },
        { email: { $exists: false } },
        { email: '' }
      ]
    });
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} users with invalid emails`);
    }
  } catch (error) {
    console.error('Error cleaning null email users:', error);
  }
};

cleanNullEmailUsers();

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

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
      userType
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
    let emailSent = true;
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@missionhub.com',
        to: cleanEmail,
        subject: 'Verify Your Email - Mission Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to Mission Hub!</h2>
            <p>Hello ${name},</p>
            <p>Please use the following verification code to complete your registration:</p>
            <div style="background: #f8fafc; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">${verificationCode}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      emailSent = false;
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification code.',
      emailSent,
      verificationCode: emailSent ? undefined : verificationCode
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

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
router.post('/verify-email', async (req, res) => {
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

    // Find and verify user (UPDATE existing user, don't create new one)
    const user = await User.findOneAndUpdate(
      { email: cleanEmail },
      { isVerified: true },
      { new: true, runValidators: true }
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
        isVerified: true
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

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
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
        isVerified: true
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

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
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
        from: process.env.EMAIL_USER || 'noreply@missionhub.com',
        to: cleanEmail,
        subject: 'Reset Your Password - Mission Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Reset Your Password</h2>
            <p>Hello ${user.name},</p>
            <p>Use the following code to reset your password:</p>
            <div style="background: #f8fafc; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">${resetCode}</h1>
            </div>
            <p>This code will expire in 30 minutes.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
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

module.exports = router;