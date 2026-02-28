/**
 * Election Utility Functions
 * 
 * Common utility functions for election operations.
 */

/**
 * Calculate turnout percentage
 * @param {number} votesCast - Number of votes cast
 * @param {number} totalVoters - Total number of voters
 * @returns {number} Turnout percentage (0-100)
 */
const calculateTurnoutPercentage = (votesCast, totalVoters) => {
  if (!totalVoters || totalVoters === 0) return 0;
  return Math.round((votesCast / totalVoters) * 100 * 100) / 100; // Round to 2 decimal places
};

/**
 * Get support category from score
 * @param {number} score - Support likelihood score (0-100)
 * @returns {string} Support category
 */
const getSupportCategory = (score) => {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 80) return 'strong_support';
  if (score >= 60) return 'likely_support';
  if (score >= 40) return 'undecided';
  if (score >= 20) return 'likely_oppose';
  return 'strong_oppose';
};

/**
 * Get support category label
 * @param {string} category - Support category
 * @returns {string} Human-readable label
 */
const getSupportCategoryLabel = (category) => {
  const labels = {
    'strong_support': 'Strong Support',
    'likely_support': 'Likely Support',
    'undecided': 'Undecided',
    'likely_oppose': 'Likely Oppose',
    'strong_oppose': 'Strong Oppose',
    'unknown': 'Unknown'
  };
  return labels[category] || 'Unknown';
};

/**
 * Format verification code for display
 * @param {string} code - Verification code
 * @returns {string} Formatted code
 */
const formatVerificationCode = (code) => {
  if (!code) return '';
  // Add dashes for readability: V1234567890ABCD -> V1234-5678-90AB-CD
  if (code.length > 4) {
    return code.match(/.{1,4}/g).join('-');
  }
  return code;
};

/**
 * Generate a unique ID for election resources
 * @param {string} prefix - Resource prefix (e.g., 'list', 'assignment')
 * @returns {string} Unique ID
 */
const generateElectionId = (prefix = 'resource') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Parse area boundaries from various formats
 * @param {Object|string} boundaries - Area boundaries
 * @returns {Object} Normalized boundaries object
 */
const parseAreaBoundaries = (boundaries) => {
  if (!boundaries) return {};

  if (typeof boundaries === 'string') {
    try {
      return JSON.parse(boundaries);
    } catch (error) {
      return { raw: boundaries };
    }
  }

  if (typeof boundaries === 'object') {
    return boundaries;
  }

  return {};
};

/**
 * Calculate assignment completion percentage
 * @param {number} completed - Number of completed assignments
 * @param {number} total - Total number of assignments
 * @returns {number} Completion percentage (0-100)
 */
const calculateCompletionPercentage = (completed, total) => {
  if (!total || total === 0) return 0;
  return Math.round((completed / total) * 100 * 100) / 100;
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format string (default: 'YYYY-MM-DD HH:mm')
 * @returns {string} Formatted date
 */
const formatElectionDate = (date, format = 'YYYY-MM-DD HH:mm') => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * Get priority label
 * @param {number} priority - Priority number (0-10)
 * @returns {string} Priority label
 */
const getPriorityLabel = (priority) => {
  if (priority >= 9) return 'Critical';
  if (priority >= 7) return 'High';
  if (priority >= 5) return 'Medium';
  if (priority >= 3) return 'Low';
  return 'Very Low';
};

/**
 * Check if assignment is overdue
 * @param {Date|string} dueDate - Due date
 * @param {string} status - Assignment status
 * @returns {boolean} Is overdue
 */
const isAssignmentOverdue = (dueDate, status) => {
  if (!dueDate || status === 'completed') return false;
  
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  
  return due < new Date();
};

/**
 * Aggregate support scores from interactions
 * @param {Array} interactions - Array of interactions with support_likelihood
 * @returns {Object} Aggregated statistics
 */
const aggregateSupportScores = (interactions) => {
  const scores = interactions
    .filter(i => i.support_likelihood !== null && i.support_likelihood !== undefined)
    .map(i => parseInt(i.support_likelihood));

  if (scores.length === 0) {
    return {
      average: null,
      min: null,
      max: null,
      count: 0,
      category: 'unknown'
    };
  }

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return {
    average,
    min,
    max,
    count: scores.length,
    category: getSupportCategory(average)
  };
};

/**
 * Validate and normalize poll number
 * @param {string} pollNumber - Poll number to normalize
 * @returns {string} Normalized poll number
 */
const normalizePollNumber = (pollNumber) => {
  if (!pollNumber || typeof pollNumber !== 'string') return '';
  return pollNumber.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
};

/**
 * Validate and normalize riding name
 * @param {string} riding - Riding name to normalize
 * @returns {string} Normalized riding name
 */
const normalizeRiding = (riding) => {
  if (!riding || typeof riding !== 'string') return '';
  return riding.trim();
};

/**
 * Validate and normalize province code
 * @param {string} province - Province code to normalize
 * @returns {string} Normalized province code (2-letter uppercase)
 */
const normalizeProvince = (province) => {
  if (!province || typeof province !== 'string') return '';
  const normalized = province.trim().toUpperCase();
  // Canadian province codes
  const validCodes = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
  if (validCodes.includes(normalized)) {
    return normalized;
  }
  return normalized.substring(0, 2); // Take first 2 characters
};

module.exports = {
  calculateTurnoutPercentage,
  getSupportCategory,
  getSupportCategoryLabel,
  formatVerificationCode,
  generateElectionId,
  parseAreaBoundaries,
  calculateCompletionPercentage,
  formatElectionDate,
  getPriorityLabel,
  isAssignmentOverdue,
  aggregateSupportScores,
  normalizePollNumber,
  normalizeRiding,
  normalizeProvince
};
