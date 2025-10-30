const validator = require('validator');
const ApiResponse = require('../utils/apiResponse');

exports.validateRegister = (req, res, next) => {
  const { name, email, password, userType } = req.body;

  // Validate name
  if (!name || name.trim() === '') {
    return ApiResponse.error(res, 'Name is required', 400);
  }

  // Validate email
  if (!email || !validator.isEmail(email)) {
    return ApiResponse.error(res, 'Please provide a valid email', 400);
  }

  // Validate password
  if (!password || password.length < 8) {
    return ApiResponse.error(res, 'Password must be at least 8 characters', 400);
  }

  // Validate password strength
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return ApiResponse.error(res, 'Password must contain at least one uppercase letter, one lowercase letter, and one number', 400);
  }

  // Validate user type
  if (!userType || (userType !== 'jobSeeker' && userType !== 'company')) {
    return ApiResponse.error(res, 'User type must be either jobSeeker or company', 400);
  }

  next();
};

exports.validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  // Validate email
  if (!email || !validator.isEmail(email)) {
    return ApiResponse.error(res, 'Please provide a valid email', 400);
  }

  // Validate password
  if (!password) {
    return ApiResponse.error(res, 'Password is required', 400);
  }

  next();
};

exports.validateEmailVerification = (req, res, next) => {
  const { email, verificationCode } = req.body;

  // Validate email
  if (!email || !validator.isEmail(email)) {
    return ApiResponse.error(res, 'Please provide a valid email', 400);
  }

  // Validate verification code
  if (!verificationCode || verificationCode.length !== 6) {
    return ApiResponse.error(res, 'Verification code must be 6 digits', 400);
  }

  next();
};

exports.validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  // Validate email
  if (!email || !validator.isEmail(email)) {
    return ApiResponse.error(res, 'Please provide a valid email', 400);
  }

  next();
};

exports.validateResetPassword = (req, res, next) => {
  const { resetToken, password } = req.body;

  // Validate reset token
  if (!resetToken) {
    return ApiResponse.error(res, 'Reset token is required', 400);
  }

  // Validate password
  if (!password || password.length < 8) {
    return ApiResponse.error(res, 'Password must be at least 8 characters', 400);
  }

  // Validate password strength
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return ApiResponse.error(res, 'Password must contain at least one uppercase letter, one lowercase letter, and one number', 400);
  }

  next();
};