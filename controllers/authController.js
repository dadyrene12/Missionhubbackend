const User = require('../models/User');
const Notification = require('../models/Notification');
const crypto = require('crypto');
const sendEmail = require('../services/emailService');
const { createToken } = require('../services/tokenService');
const ApiResponse = require('../utils/apiResponse');

const VERIFICATION_EXPIRE_HOURS = 13;
const VERIFICATION_EXPIRE_MS = VERIFICATION_EXPIRE_HOURS * 60 * 60 * 1000;

// @desc    Generate random 6-digit verification code
// @route   (internal)
// @access  Private
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Send verification email
// @route   (internal)
// @access  Private
const sendVerificationEmail = async (email, code) => {
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #4f46e5; text-align: center;">MissionHub Email Verification</h1>
      
      <div style="background-color: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p style="color: #0ea5e9; font-size: 18px; text-align: center; margin: 0;">Your verification code is:</p>
        <h2 style="background-color: #ffffff; padding: 15px 30px; text-align: center; font-size: 36px; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; border: 2px solid #e0e7ff; color: #4f46e5;">${code}</h2>
      </div>
      
      <p style="color: #6b7280; text-align: center;">This code will expire in ${VERIFICATION_EXPIRE_HOURS} hours.</p>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Note:</strong> If you didn't request this code, please ignore this email.</p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} MissionHub. All rights reserved.
      </p>
    </div>
  `;

  await sendEmail({
    email,
    subject: 'MissionHub - Email Verification Code',
    message,
  });
};

// @desc    Send verification code (start registration)
// @route   POST /api/auth/send-code
// @access  Public
const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return ApiResponse.error(res, 'Email is required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ApiResponse.error(res, 'Please enter a valid email address', 400);
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.error(res, 'An account with this email already exists', 400);
    }

    const existingPending = await User.findOne({
      pendingEmail: email,
      pendingEmailVerificationExpire: { $gt: Date.now() }
    });

    let verificationCode;
    let user;

    if (existingPending) {
      if (existingPending.pendingEmailVerificationCode === existingPending.pendingEmailVerificationCode) {
        verificationCode = existingPending.pendingEmailVerificationCode;
        user = existingPending;
      }
    } else {
      verificationCode = generateVerificationCode();
      
      user = await User.create({
        name: 'Pending User',
        email: email + '_pending',
        password: crypto.randomBytes(20).toString('hex'),
        userType: 'jobSeeker',
        isActive: false,
        pendingEmail: email,
        pendingEmailVerificationCode: verificationCode,
        pendingEmailVerificationExpire: Date.now() + VERIFICATION_EXPIRE_MS,
        pendingVerificationData: {
          name: '',
          password: '',
          userType: 'jobSeeker',
        }
      });
    }

    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      return ApiResponse.error(res, 'Failed to send verification email. Please try again.', 500);
    }

    return ApiResponse.success(res, {
      message: 'Verification code sent to your email',
      expiresIn: VERIFICATION_EXPIRE_HOURS,
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Resend verification code
// @route   POST /api/auth/resend-code
// @access  Public
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return ApiResponse.error(res, 'Email is required', 400);
    }

    const user = await User.findOne({
      pendingEmail: email,
      pendingEmailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return ApiResponse.error(res, 'No pending verification found for this email. Please start a new registration.', 404);
    }

    const verificationCode = generateVerificationCode();
    user.pendingEmailVerificationCode = verificationCode;
    user.pendingEmailVerificationExpire = Date.now() + VERIFICATION_EXPIRE_MS;
    await user.save({ validateBeforeSave: false });

    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (err) {
      console.error('Failed to resend verification email:', err);
      return ApiResponse.error(res, 'Failed to resend verification email. Please try again.', 500);
    }

    return ApiResponse.success(res, {
      message: 'New verification code sent to your email',
      expiresIn: VERIFICATION_EXPIRE_HOURS,
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Verify code and complete registration
// @route   POST /api/auth/verify-code
// @access  Public
const verifyCode = async (req, res) => {
  try {
    const { email, verificationCode, name, password, userType, newsletter } = req.body;

    if (!email || !verificationCode) {
      return ApiResponse.error(res, 'Email and verification code are required', 400);
    }

    const user = await User.findOne({
      pendingEmail: email,
      pendingEmailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return ApiResponse.error(res, 'Verification code expired or not found. Please start a new registration.', 400);
    }

    if (user.pendingEmailVerificationCode !== verificationCode) {
      return ApiResponse.error(res, 'Invalid verification code', 400);
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.error(res, 'An account with this email already exists', 400);
    }

    const pendingData = user.pendingVerificationData || {};
    const finalName = name || pendingData.name || email.split('@')[0];
    const finalUserType = userType || pendingData.userType || 'jobSeeker';

    user.name = finalName;
    user.email = email;
    user.password = password || pendingData.password || crypto.randomBytes(20).toString('hex');
    user.userType = finalUserType;
    user.isActive = true;
    user.emailVerified = true;
    user.newsletter = newsletter || false;
    user.pendingEmail = undefined;
    user.pendingEmailVerificationCode = undefined;
    user.pendingEmailVerificationExpire = undefined;
    user.pendingVerificationData = undefined;

    await user.save({ validateBeforeSave: false });

    const token = createToken(user._id);

    try {
      await Notification.create({
        userId: user._id,
        type: 'welcome',
        title: 'Welcome to MissionHub!',
        message: 'Your account has been successfully created. Complete your profile to get started!',
        priority: 'high',
        relatedType: 'welcome'
      });
    } catch (notifError) {
      console.error('Failed to create welcome notification:', notifError);
    }

    return ApiResponse.success(res, {
      message: 'Registration completed successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        emailVerified: user.emailVerified,
      },
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Register user (legacy - for backward compatibility)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.error(res, 'User already exists', 400);
    }

    const user = await User.create({
      name,
      email,
      password,
      userType,
    });

    const verificationToken = crypto.randomBytes(20).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpire = Date.now() + VERIFICATION_EXPIRE_MS;

    await user.save({ validateBeforeSave: false });

    const message = `
      <h1>Email Verification</h1>
      <p>Please use the following code to verify your email address:</p>
      <h2 style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">123456</h2>
      <p>This code will expire in ${VERIFICATION_EXPIRE_HOURS} hours.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Email Verification',
        message,
      });

      return ApiResponse.success(res, {
        message: 'Verification email sent',
        verificationCode: '123456',
      }, 200);
    } catch (err) {
      console.error(err);
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return ApiResponse.error(res, 'Email could not be sent', 500);
    }
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Verify email (legacy - for backward compatibility)
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (verificationCode !== '123456') {
      return ApiResponse.error(res, 'Invalid verification code', 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    const token = createToken(user._id);

    try {
      await Notification.create({
        userId: user._id,
        type: 'welcome',
        title: 'Welcome to MissionHub!',
        message: 'Your email has been verified. Complete your profile to get started!',
        priority: 'high',
        relatedType: 'welcome'
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    return ApiResponse.success(res, {
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        emailVerified: user.emailVerified,
      },
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return ApiResponse.error(res, 'Please provide an email and password', 400);
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return ApiResponse.error(res, 'Invalid credentials', 401);
    }

    // Check if user is restricted - BLOCK LOGIN IF RESTRICTED
    // Double check the value to ensure it's properly saved
    const isRestricted = Boolean(user.loginRestricted);
    console.log('=== LOGIN CHECK ===');
    console.log('Email:', email);
    console.log('user.loginRestricted:', user.loginRestricted);
    console.log('typeof:', typeof user.loginRestricted);
    console.log('isRestricted:', isRestricted);
    
    if (isRestricted) {
      console.log('*** LOGIN BLOCKED - User is restricted:', user.email);
      return res.status(403).json({
        success: false,
        message: 'Your account has been restricted. Please contact support at reneniyi@gmail.com for assistance.',
        code: 'ACCOUNT_RESTRICTED',
        restricted: true
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      return ApiResponse.error(res, 'Your account has been deactivated. Please contact support for assistance.', 403);
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return ApiResponse.error(res, 'Invalid credentials', 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create token
    const token = createToken(user._id);

    return ApiResponse.success(res, {
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        emailVerified: user.emailVerified,
      },
    }, 200);
  } catch (error) {
    console.error('Login error:', error);
    return ApiResponse.error(res, error.message || 'An error occurred during login', 500);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    return ApiResponse.success(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        emailVerified: user.emailVerified,
      },
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + VERIFICATION_EXPIRE_MS;

    await user.save({ validateBeforeSave: false });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>Password Reset</h1>
      <p>Please click on the following link to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
      <p>This link will expire in ${VERIFICATION_EXPIRE_HOURS} hours.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset',
        message,
      });

      return ApiResponse.success(res, {
        message: 'Password reset email sent',
      }, 200);
    } catch (err) {
      console.error(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return ApiResponse.error(res, 'Email could not be sent', 500);
    }
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { resetToken, password } = req.body;

    // Hash token and compare to database
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Find user by token
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return ApiResponse.error(res, 'Invalid or expired reset token', 400);
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Create token
    const token = createToken(user._id);

    return ApiResponse.success(res, {
      message: 'Password reset successful',
      token,
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Change password (authenticated user)
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return ApiResponse.error(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      return ApiResponse.error(res, 'New password must be at least 8 characters', 400);
    }

    // Find user by id with password selected (set by auth middleware)
    const user = await User.findByIdWithPassword(req.user.id || req.user._id);

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Check if current password is correct
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return ApiResponse.error(res, 'Current password is incorrect', 401);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return ApiResponse.success(res, {
      message: 'Password changed successfully',
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

// Make sure all functions are properly exported at the end
module.exports = {
  register,
  verifyEmail,
  verifyCode,
  sendVerificationCode,
  resendVerificationCode,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
};