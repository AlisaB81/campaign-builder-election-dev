/**
 * Validation Utilities
 * 
 * Provides validation functions for election data and common operations.
 */

const { AppError, createError } = require('./errors');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate phone number format (flexible)
 * @param {string} phone - Phone to validate
 * @returns {boolean} Is valid
 */
const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Check if it's all digits and reasonable length (7-15 digits)
  return /^\d{7,15}$/.test(cleaned);
};

/**
 * Validate support likelihood score (0-100)
 * @param {number} score - Score to validate
 * @returns {boolean} Is valid
 */
const isValidSupportScore = (score) => {
  const num = typeof score === 'string' ? parseInt(score) : score;
  return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Validate poll number format
 * @param {string} pollNumber - Poll number to validate
 * @returns {boolean} Is valid
 */
const isValidPollNumber = (pollNumber) => {
  if (!pollNumber || typeof pollNumber !== 'string') return false;
  // Poll numbers are typically alphanumeric, 1-20 characters
  return /^[A-Za-z0-9\-_]{1,20}$/.test(pollNumber.trim());
};

/**
 * Validate interaction type
 * @param {string} type - Interaction type
 * @returns {boolean} Is valid
 */
const isValidInteractionType = (type) => {
  const validTypes = [
    'door_knock',
    'phone_call',
    'text_message',
    'email',
    'event',
    'mailer',
    'social_media',
    'other'
  ];
  return validTypes.includes(type);
};

/**
 * Validate interaction method
 * @param {string} method - Interaction method
 * @returns {boolean} Is valid
 */
const isValidInteractionMethod = (method) => {
  const validMethods = [
    'in_person',
    'phone',
    'email',
    'text',
    'mail',
    'online',
    'other'
  ];
  return validMethods.includes(method);
};

/**
 * Validate event type
 * @param {string} type - Event type
 * @returns {boolean} Is valid
 */
const isValidEventType = (type) => {
  const validTypes = [
    'contact_attempted',
    'contact_made',
    'no_answer',
    'not_home',
    'refused',
    'support_confirmed',
    'opposition_confirmed',
    'undecided',
    'moved',
    'deceased',
    'other'
  ];
  return validTypes.includes(type);
};

/**
 * Validate assignment status
 * @param {string} status - Assignment status
 * @returns {boolean} Is valid
 */
const isValidAssignmentStatus = (status) => {
  const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
  return validStatuses.includes(status);
};

/**
 * Validate and sanitize filter configuration
 * @param {Object} filterConfig - Filter configuration
 * @returns {Object} Sanitized filter config
 */
const sanitizeFilterConfig = (filterConfig) => {
  if (!filterConfig || typeof filterConfig !== 'object') {
    return {};
  }

  const sanitized = {};

  if (filterConfig.pollNumber && isValidPollNumber(filterConfig.pollNumber)) {
    sanitized.pollNumber = filterConfig.pollNumber.trim();
  }

  if (filterConfig.riding && typeof filterConfig.riding === 'string') {
    sanitized.riding = filterConfig.riding.trim();
  }

  if (filterConfig.province && typeof filterConfig.province === 'string') {
    sanitized.province = filterConfig.province.trim().toUpperCase();
  }

  if (Array.isArray(filterConfig.categories)) {
    sanitized.categories = filterConfig.categories.filter(cat => 
      typeof cat === 'string' && cat.trim().length > 0
    ).map(cat => cat.trim());
  }

  if (filterConfig.minSupportScore !== undefined) {
    const min = typeof filterConfig.minSupportScore === 'string' 
      ? parseInt(filterConfig.minSupportScore) 
      : filterConfig.minSupportScore;
    if (isValidSupportScore(min)) {
      sanitized.minSupportScore = min;
    }
  }

  if (filterConfig.maxSupportScore !== undefined) {
    const max = typeof filterConfig.maxSupportScore === 'string' 
      ? parseInt(filterConfig.maxSupportScore) 
      : filterConfig.maxSupportScore;
    if (isValidSupportScore(max)) {
      sanitized.maxSupportScore = max;
    }
  }

  if (filterConfig.supportCategory && typeof filterConfig.supportCategory === 'string') {
    const validCategories = [
      'strong_support',
      'likely_support',
      'undecided',
      'likely_oppose',
      'strong_oppose'
    ];
    if (validCategories.includes(filterConfig.supportCategory)) {
      sanitized.supportCategory = filterConfig.supportCategory;
    }
  }

  if (typeof filterConfig.hasInteractions === 'boolean') {
    sanitized.hasInteractions = filterConfig.hasInteractions;
  }

  if (filterConfig.lastInteractionAfter) {
    const date = new Date(filterConfig.lastInteractionAfter);
    if (!isNaN(date.getTime())) {
      sanitized.lastInteractionAfter = date.toISOString();
    }
  }

  if (filterConfig.lastInteractionBefore) {
    const date = new Date(filterConfig.lastInteractionBefore);
    if (!isNaN(date.getTime())) {
      sanitized.lastInteractionBefore = date.toISOString();
    }
  }

  return sanitized;
};

/**
 * Validate vote mark data
 * @param {Object} data - Vote mark data
 * @throws {AppError} If validation fails
 */
const validateVoteMark = (data) => {
  if (!data.contactId || typeof data.contactId !== 'string') {
    throw createError('Contact ID is required', 400, 'INVALID_CONTACT_ID');
  }

  if (!data.pollNumber || !isValidPollNumber(data.pollNumber)) {
    throw createError('Valid poll number is required', 400, 'INVALID_POLL_NUMBER');
  }

  if (data.riding && typeof data.riding !== 'string') {
    throw createError('Riding must be a string', 400, 'INVALID_RIDING');
  }

  if (data.province && typeof data.province !== 'string') {
    throw createError('Province must be a string', 400, 'INVALID_PROVINCE');
  }
};

/**
 * Validate interaction data
 * @param {Object} data - Interaction data
 * @throws {AppError} If validation fails
 */
const validateInteraction = (data) => {
  if (!data.contactId || typeof data.contactId !== 'string') {
    throw createError('Contact ID is required', 400, 'INVALID_CONTACT_ID');
  }

  if (!data.interactionType || !isValidInteractionType(data.interactionType)) {
    throw createError('Valid interaction type is required', 400, 'INVALID_INTERACTION_TYPE');
  }

  if (!data.interactionMethod || !isValidInteractionMethod(data.interactionMethod)) {
    throw createError('Valid interaction method is required', 400, 'INVALID_INTERACTION_METHOD');
  }

  if (data.supportLikelihood !== undefined && data.supportLikelihood !== null) {
    if (!isValidSupportScore(data.supportLikelihood)) {
      throw createError('Support likelihood must be between 0 and 100', 400, 'INVALID_SUPPORT_SCORE');
    }
  }
};

/**
 * Validate assignment data
 * @param {Object} data - Assignment data
 * @throws {AppError} If validation fails
 */
const validateAssignment = (data) => {
  if (!data.areaName || typeof data.areaName !== 'string' || data.areaName.trim().length === 0) {
    throw createError('Area name is required', 400, 'INVALID_AREA_NAME');
  }

  if (data.assignedTo && typeof data.assignedTo !== 'string') {
    throw createError('Assigned to must be a valid user ID', 400, 'INVALID_ASSIGNED_TO');
  }

  if (data.priority !== undefined) {
    const priority = typeof data.priority === 'string' ? parseInt(data.priority) : data.priority;
    if (isNaN(priority) || priority < 0 || priority > 10) {
      throw createError('Priority must be between 0 and 10', 400, 'INVALID_PRIORITY');
    }
  }

  if (data.dueDate) {
    const date = new Date(data.dueDate);
    if (isNaN(date.getTime())) {
      throw createError('Invalid due date', 400, 'INVALID_DUE_DATE');
    }
  }
};

/**
 * Validate list data
 * @param {Object} data - List data
 * @throws {AppError} If validation fails
 */
const validateList = (data) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw createError('List name is required', 400, 'INVALID_LIST_NAME');
  }

  if (data.name.length > 255) {
    throw createError('List name must be 255 characters or less', 400, 'LIST_NAME_TOO_LONG');
  }

  if (data.filterConfig && typeof data.filterConfig !== 'object') {
    throw createError('Filter config must be an object', 400, 'INVALID_FILTER_CONFIG');
  }
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidSupportScore,
  isValidPollNumber,
  isValidInteractionType,
  isValidInteractionMethod,
  isValidEventType,
  isValidAssignmentStatus,
  sanitizeFilterConfig,
  validateVoteMark,
  validateInteraction,
  validateAssignment,
  validateList
};
