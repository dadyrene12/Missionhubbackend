const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin';

const createSuperAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingAdmin = await User.findOne({ 
      $or: [
        { role: 'super_admin' },
        { userType: 'super_admin' }
      ]
    });
    
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Super admin account already exists'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const superAdmin = await User.create({
      name: name || 'Super Admin',
      email: email.toLowerCase(),
      password: hashedPassword,
      userType: 'super_admin',
      role: 'super_admin',
      isActive: true,
      isVerified: true,
      permissions: [
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
    });

    res.status(201).json({
      success: true,
      message: 'Super admin account created successfully',
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        userType: superAdmin.userType
      }
    });

  } catch (error) {
    console.error('Create super admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const admin = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (admin.userType !== 'super_admin' && admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin access required.'
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    const token = jwt.sign(
      { 
        id: admin._id,
        email: admin.email,
        userType: admin.userType,
        role: admin.role,
        permissions: admin.permissions || []
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    admin.lastLogin = new Date();
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        userType: admin.userType,
        role: admin.role,
        permissions: admin.permissions || [],
        lastLogin: admin.lastLogin
      }
    });

  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

const verifySuperAdmin = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.userType !== 'super_admin' && decoded.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.'
      });
    }

    const admin = await User.findById(decoded.id).select('-password');
    
    if (!admin || (admin.userType !== 'super_admin' && admin.role !== 'super_admin') || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive admin account'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        userType: admin.userType,
        role: admin.role,
        permissions: admin.permissions || []
      }
    });

  } catch (error) {
    console.error('Verify admin error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const superAdminLogout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const forceCreateSuperAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const superAdmin = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        name: name || 'Super Admin',
        email: email.toLowerCase(),
        password: hashedPassword,
        userType: 'super_admin',
        role: 'super_admin',
        isActive: true,
        isVerified: true,
        permissions: [
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
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Super admin account created/updated successfully',
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        userType: superAdmin.userType
      }
    });

  } catch (error) {
    console.error('Force create super admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

module.exports = {
  createSuperAdmin,
  superAdminLogin,
  verifySuperAdmin,
  superAdminLogout,
  forceCreateSuperAdmin
};
