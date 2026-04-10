const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  verifyCode,
  sendVerificationCode,
  resendVerificationCode,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword
} = require('../controllers/authController');
const { protect, checkEmailVerification } = require('../middleware/auth');

// Auth routes connected to real controllers ✅ FIXED
router.post('/send-code', sendVerificationCode);
router.post('/resend-code', resendVerificationCode);
router.post('/verify-code', verifyCode);
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', protect, checkEmailVerification, changePassword);

// 2FA placeholder (not implemented yet)
router.post('/verify-2fa', (req, res) => {
  res.status(400).json({ success: false, message: '2FA is not configured' });
});

// Logout (handled client-side)
router.post('/logout', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Logout successful'
  });
});

module.exports = router;
