const User = require('../models/User');

// @desc    Get current logged in user
// @route   GET /api/users/profile
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

// Make sure the function is properly exported at the end
module.exports = {
  getMe,
};