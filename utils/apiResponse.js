class ApiResponse {
  /**
   * Send success response
   * @param {Object} res - Express response object
   * @param {Object} data - Response data
   * @param {Number} statusCode - HTTP status code
   */
  static success(res, data = {}, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      ...data,
    });
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {String|Object} message - Error message or object with message and additional data
   * @param {Number} statusCode - HTTP status code
   * @param {Object} errors - Additional error details
   */
  static error(res, message = 'Internal Server Error', statusCode = 500, errors = {}) {
    // Handle object with message and additional properties
    if (typeof message === 'object' && message !== null) {
      return res.status(statusCode).json({
        success: false,
        ...message,
      });
    }
    
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }
}

module.exports = ApiResponse;