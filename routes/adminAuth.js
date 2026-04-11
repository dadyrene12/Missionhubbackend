const express = require('express');
const router = express.Router();
const {
  createSuperAdmin,
  superAdminLogin,
  verifySuperAdmin,
  superAdminLogout,
  forceCreateSuperAdmin
} = require('../controllers/adminAuthController');

// @desc   Create Super Admin Account
// @route  POST /api/auth/admin/create-super-admin
// @access Public (only if no super admin exists)
router.post('/create-super-admin', createSuperAdmin);

// @desc   Force Create/Update Super Admin
// @route  POST /api/auth/admin/force-create
// @access Public
router.post('/force-create', forceCreateSuperAdmin);

// @desc   Super Admin Login
// @route  POST /api/auth/admin/login
// @access Public
router.post('/login', superAdminLogin);

// @desc   Verify Super Admin Token
// @route  GET /api/auth/admin/verify
// @access Private (Super Admin only)
router.get('/verify', verifySuperAdmin);

// @desc   Super Admin Logout
// @route  POST /api/auth/admin/logout
// @access Private (Super Admin only)
router.post('/logout', superAdminLogout);

module.exports = router;
