const ErrorResponse = require('../utils/errorResponse');

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

exports.admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    return next();
  }
  
  return next(
    new ErrorResponse('Not authorized to access this route', 401)
  );
};

exports.superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return next(
      new ErrorResponse('Not authorized to access this route', 401)
    );
  }
  
  if (req.user.role !== 'super_admin' && req.user.userType !== 'super_admin') {
    return next(
      new ErrorResponse('Super admin access required', 403)
    );
  }
  
  next();
};

exports.canManage = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ErrorResponse('Not authorized to access this route', 401)
      );
    }
    
    if (req.user.role === 'super_admin' || req.user.userType === 'super_admin') {
      return next();
    }
    
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(perm => userPermissions.includes(perm));
    
    if (!hasPermission) {
      return next(
        new ErrorResponse('You do not have permission to perform this action', 403)
      );
    }
    
    next();
  };
};
