/**
 * Centralized Logging Utilities
 * 
 * Provides consistent logging across the application.
 * Supports different log levels and sanitization of sensitive data.
 */

/**
 * Sanitize sensitive information from log messages
 * @param {string} message - Message to sanitize
 * @returns {string} Sanitized message
 */
const sanitizeLogMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return String(message || '');
  }
  
  // Remove sensitive patterns
  return message
    .replace(/password|pass|auth|credential|user|username/gi, '[REDACTED]')
    .replace(/@[^\s]+/g, '@[REDACTED]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD-REDACTED]') // Credit card numbers
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
      // Keep email domain structure but redact local part
      const parts = match.split('@');
      return parts[0].substring(0, 2) + '***@' + parts[1];
    });
};

/**
 * Log levels
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Logger class for consistent logging
 */
class Logger {
  constructor(context = 'APP') {
    this.context = context;
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or additional data
   * @param {Object} metadata - Additional metadata
   */
  error(message, error = null, metadata = {}) {
    const sanitizedMessage = sanitizeLogMessage(message);
    const logData = {
      level: LOG_LEVELS.ERROR,
      context: this.context,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    if (error) {
      if (error instanceof Error) {
        logData.error = {
          message: sanitizeLogMessage(error.message),
          stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : undefined
        };
      } else {
        logData.error = error;
      }
    }

    console.error(`[${this.context}]`, logData);
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} metadata - Additional metadata
   */
  warn(message, metadata = {}) {
    const sanitizedMessage = sanitizeLogMessage(message);
    console.warn(`[${this.context}]`, {
      level: LOG_LEVELS.WARN,
      context: this.context,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object} metadata - Additional metadata
   */
  info(message, metadata = {}) {
    const sanitizedMessage = sanitizeLogMessage(message);
    console.log(`[${this.context}]`, {
      level: LOG_LEVELS.INFO,
      context: this.context,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Log a debug message (only in development)
   * @param {string} message - Debug message
   * @param {Object} metadata - Additional metadata
   */
  debug(message, metadata = {}) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      const sanitizedMessage = sanitizeLogMessage(message);
      console.log(`[${this.context}] [DEBUG]`, {
        level: LOG_LEVELS.DEBUG,
        context: this.context,
        message: sanitizedMessage,
        timestamp: new Date().toISOString(),
        ...metadata
      });
    }
  }
}

/**
 * Create a logger instance for a specific context
 * @param {string} context - Context name (e.g., 'EMAIL', 'AUTH', 'DB')
 * @returns {Logger} Logger instance
 */
const createLogger = (context) => {
  return new Logger(context);
};

/**
 * Default logger instance
 */
const logger = createLogger('APP');

module.exports = {
  Logger,
  createLogger,
  logger,
  LOG_LEVELS,
  sanitizeLogMessage
};
