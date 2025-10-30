const User = require('../models/User');
const crypto = require('crypto');
const sendEmail = require('../services/emailService');
const createToken = require('../services/tokenService');
const ApiResponse = require('../utils/apiResponse');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.error(res, 'User already exists', 400);
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      userType,
    });

    // Create verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    const message = `
      <h1>Email Verification</h1>
      <p>Please use the following code to verify your email address:</p>
      <h2 style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">123456</h2>
      <p>This code will expire in 10 minutes.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Email Verification',
        message,
      });

      return ApiResponse.success(res, {
        message: 'Verification email sent',
        verificationCode: '123456', // For demo purposes only
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

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    // For demo purposes, we're using a hardcoded verification code
    if (verificationCode !== '123456') {
      return ApiResponse.error(res, 'Invalid verification code', 400);
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    // Create token
    const token = createToken(user._id);

    return ApiResponse.success(res, {
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isEmailVerified: user.isEmailVerified,
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

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return ApiResponse.error(res, 'Invalid credentials', 401);
    }

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
        isEmailVerified: user.isEmailVerified,
      },
    }, 200);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
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
        isEmailVerified: user.isEmailVerified,
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
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>Password Reset</h1>
      <p>Please click on the following link to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
      <p>This link will expire in 10 minutes.</p>
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

// Make sure all functions are properly exported at the end
module.exports = {
  register,
  verifyEmail,
  login,
  getMe,
  forgotPassword,
  resetPassword,
};