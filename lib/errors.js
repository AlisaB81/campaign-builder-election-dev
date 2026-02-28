/**
 * Error Handling Utilities
 * 
 * Provides standardized error handling and error response formatting.
 */

const { logger } = require('./logger');

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response formatter
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Options for error handling
 */
const formatErrorResponse = (err, req, res, options = {}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = err.statusCode || err.status || 500;
  const message = isDevelopment ? err.message : (err.message || 'An error occurred');

  // Log error
  logger.error('Request error', err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Format response based on accept header
  if (statusCode === 401) {
    const isApi = req.originalUrl?.startsWith('/api/') || req.path?.startsWith('/api/');
    const wantsJson = (req.get('accept') || '').includes('application/json');
    if (isApi || wantsJson) {
      return res.status(401).json({
        ok: false,
        error: 'AUTH_REQUIRED',
        message: 'Authentication required'
      });
    }
    return res.redirect(`/login?loop=1`);
  }

  if (req.accepts('html')) {
    
    // Render error page if available, otherwise send simple response
    if (res.render && options.errorView) {
      return res.status(statusCode).render(options.errorView, {
        message: message,
        error: isDevelopment ? err : {},
        statusCode: statusCode
      });
    }
    
    return res.status(statusCode).send(`
      <html>
        <head><title>Error ${statusCode}</title></head>
        <body>
          <h1>Error ${statusCode}</h1>
          <p>${message}</p>
          ${isDevelopment && err.stack ? `<pre>${err.stack}</pre>` : ''}
        </body>
      </html>
    `);
  } else {
    // JSON response
    const response = {
      error: message,
      statusCode: statusCode
    };

    if (err.code) {
      response.code = err.code;
    }

    if (isDevelopment) {
      response.details = err.details || {};
      if (err.stack) {
        response.stack = err.stack.split('\n').slice(0, 10);
      }
    }

    return res.status(statusCode).json(response);
  }
};

/**
 * Express error handling middleware
 * @param {Object} options - Options for error handling
 * @returns {Function} Express middleware
 */
const errorHandler = (options = {}) => {
  return (err, req, res, next) => {
    // Use custom error handler if available
    if (options.customHandler) {
      return options.customHandler(err, req, res, next);
    }

    // Default error handling
    return formatErrorResponse(err, req, res, options);
  };
};

/**
 * Async route wrapper to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped route handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {Object} details - Additional details
 * @returns {AppError} Error object
 */
const createError = (message, statusCode = 500, code = null, details = {}) => {
  return new AppError(message, statusCode, code, details);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  formatErrorResponse,
  createError
};
