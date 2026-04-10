const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Use the same JWT secret as tokenService.js
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin';

// Enhanced authentication middleware with role management

// Protect routes - Basic authentication
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded, user ID:', decoded.id);

    // Get user from the token
    const user = await User.findById(decoded.id);
    console.log('User found:', user ? `yes (${user.email})` : 'no');

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is active (only if isActive field exists and is false)
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account deactivated',
      });
    }

    // Check if user login is restricted
    if (user.loginRestricted === true) {
      return res.status(403).json({
        success: false,
        message: 'Login access restricted. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Role-based access control
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user has required role
    const hasRole = roles.includes(req.user.role) || roles.includes(req.user.userType);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

// Permission-based access control
exports.authorizePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Super admins have all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has required permissions
    const hasPermission = permissions.some(permission => 
      req.user.permissions && req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

// Super Admin Protection
exports.superAdminProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from the token
    const user = await User.findById(decoded.id);

    // Check if user exists and is super admin
    if (!user || user.role !== 'super_admin' || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Company Admin Protection
exports.companyAdminProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from the token
    const user = await User.findById(decoded.id);

    // Check if user exists and is company admin
    if (!user || 
        (user.userType !== 'company' && user.role !== 'company_admin') || 
        !user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company admin required.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Resource ownership check
exports.checkOwnership = (resourceType, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user._id;
      
      let resource;
      
      switch (resourceType) {
        case 'job':
          resource = await require('../models/Job').findById(resourceId);
          if (!resource || resource.postedBy.toString() !== userId.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied. You can only access your own resources.',
            });
          }
          break;
          
        case 'application':
          resource = await require('../models/Application').findById(resourceId);
          if (!resource || resource.userId.toString() !== userId.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied. You can only access your own applications.',
            });
          }
          break;
          
        case 'message':
          resource = await require('../models/Message').findById(resourceId);
          if (!resource || 
              (resource.fromUserId.toString() !== userId.toString() && 
               resource.toUserId.toString() !== userId.toString())) {
            return res.status(403).json({
              success: false,
              message: 'Access denied. You can only access your own messages.',
            });
          }
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type',
          });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
      });
    }
  };
};

// Rate limiting middleware
exports.rateLimit = (maxRequests = 500, windowMs = 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart);
      requests.set(key, userRequests);
    } else {
      requests.set(key, []);
    }
    
    // Check current requests
    const currentRequests = requests.get(key);
    
    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }
    
    // Add current request
    currentRequests.push(now);
    next();
  };
};

// Email verification check
exports.checkEmailVerification = (req, res, next) => {
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required. Please verify your email address.',
    });
  }
  next();
};

// Account status check
exports.checkAccountStatus = (req, res, next) => {
  if (!req.user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Account deactivated. Please contact support.',
    });
  }
  
  if (req.user.suspended) {
    return res.status(403).json({
      success: false,
      message: 'Account suspended. Please contact support.',
    });
  }
  
  next();
};

// API Key authentication for external integrations
exports.authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required',
    });
  }
  
  try {
    // Find user by API key
    const user = await User.findOne({ 'profile.apiKey': apiKey, isActive: true });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
      });
    }
    
    req.user = user;
    req.isApiKeyAuth = true;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error authenticating API key',
    });
  }
};