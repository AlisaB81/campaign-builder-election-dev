/**
 * Voter Interaction Service
 * 
 * Phase 4: Election Mode Features
 * Handles voter interaction tracking, support likelihood scoring, and interaction history.
 */

const { query } = require('../db/connection');
const { logger, createLogger } = require('../lib');

const interactionLogger = createLogger('VOTER_INTERACTIONS');

/**
 * Record a voter interaction (append-only)
 * @param {Object} interactionData - Interaction data
 * @returns {Promise<Object>} Created interaction
 */
const recordInteraction = async (interactionData) => {
  const {
    accountId,
    contactId,
    userId,
    interactionType,
    interactionMethod,
    supportLikelihood,
    notes,
    metadata = {}
  } = interactionData;

  const result = await query(
    `INSERT INTO election_interactions 
     (account_id, contact_id, user_id, interaction_type, interaction_method, 
      support_likelihood, notes, metadata, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      accountId,
      contactId,
      userId,
      interactionType,
      interactionMethod,
      supportLikelihood,
      notes,
      JSON.stringify(metadata),
      userId
    ]
  );

  // Update contact's support likelihood (average of all interactions)
  await updateContactSupportScore(accountId, contactId);

  interactionLogger.info('Interaction recorded', { 
    interactionId: result.rows[0].id, 
    accountId,
    contactId,
    supportLikelihood 
  });

  return result.rows[0];
};

/**
 * Calculate and update contact's support likelihood score
 * @param {string} accountId - Account ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<number>} Updated support score
 */
const updateContactSupportScore = async (accountId, contactId) => {
  // Get all interactions for this contact
  const result = await query(
    `SELECT support_likelihood 
     FROM election_interactions 
     WHERE account_id = $1 AND contact_id = $2 
     AND support_likelihood IS NOT NULL`,
    [accountId, contactId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Calculate average support likelihood
  const scores = result.rows.map(row => parseInt(row.support_likelihood));
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

  // Update contact record (if using PostgreSQL)
  // Note: This would need to be integrated with the contact update system
  // For now, we'll store it in metadata or calculate on-the-fly

  return average;
};

/**
 * Get contact's support likelihood score
 * @param {string} accountId - Account ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<Object>} Support score data
 */
const getContactSupportScore = async (accountId, contactId) => {
  const nullResult = {
    averageScore: null,
    interactionCount: 0,
    lastInteractionAt: null,
    highestScore: null,
    lowestScore: null,
    supportCategory: 'unknown'
  };

  let stats;
  try {
    const result = await query(
      `SELECT 
         AVG(support_likelihood)::INTEGER as average_score,
         COUNT(*) as interaction_count,
         MAX(created_at) as last_interaction_at,
         MAX(support_likelihood) as highest_score,
         MIN(support_likelihood) as lowest_score
       FROM election_interactions 
       WHERE account_id = $1 AND contact_id = $2 
       AND support_likelihood IS NOT NULL`,
      [accountId, contactId]
    );
    stats = result.rows[0];
  } catch (e) {
    // PostgreSQL not available in this environment; return neutral result.
    return nullResult;
  }

  if (!stats) return nullResult;

  let supportCategory = 'unknown';
  if (stats.average_score !== null) {
    const score = parseInt(stats.average_score);
    if (score >= 80) supportCategory = 'strong_support';
    else if (score >= 60) supportCategory = 'likely_support';
    else if (score >= 40) supportCategory = 'undecided';
    else if (score >= 20) supportCategory = 'likely_oppose';
    else supportCategory = 'strong_oppose';
  }

  return {
    averageScore: stats.average_score ? parseInt(stats.average_score) : null,
    interactionCount: parseInt(stats.interaction_count || 0),
    lastInteractionAt: stats.last_interaction_at,
    highestScore: stats.highest_score ? parseInt(stats.highest_score) : null,
    lowestScore: stats.lowest_score ? parseInt(stats.lowest_score) : null,
    supportCategory
  };
};

/**
 * Get interaction history for a contact
 * @param {string} accountId - Account ID
 * @param {string} contactId - Contact ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of interactions
 */
const getContactInteractionHistory = async (accountId, contactId, options = {}) => {
  let sql = `SELECT ei.*, 
             u.email as created_by_email,
             u.user_type as created_by_type
             FROM election_interactions ei
             LEFT JOIN users u ON ei.created_by = u.id
             WHERE ei.account_id = $1 AND ei.contact_id = $2`;
  const params = [accountId, contactId];

  if (options.interactionType) {
    sql += ` AND ei.interaction_type = $${params.length + 1}`;
    params.push(options.interactionType);
  }
  if (options.interactionMethod) {
    sql += ` AND ei.interaction_method = $${params.length + 1}`;
    params.push(options.interactionMethod);
  }
  if (options.startDate) {
    sql += ` AND ei.created_at >= $${params.length + 1}`;
    params.push(options.startDate);
  }
  if (options.endDate) {
    sql += ` AND ei.created_at <= $${params.length + 1}`;
    params.push(options.endDate);
  }

  sql += ' ORDER BY ei.created_at DESC';

  if (options.limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get last contact method and timestamp for a contact
 * @param {string} accountId - Account ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<Object|null>} Last contact information
 */
const getLastContactInfo = async (accountId, contactId) => {
  const result = await query(
    `SELECT interaction_method, created_at, interaction_type, support_likelihood
     FROM election_interactions 
     WHERE account_id = $1 AND contact_id = $2 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [accountId, contactId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    method: result.rows[0].interaction_method,
    timestamp: result.rows[0].created_at,
    type: result.rows[0].interaction_type,
    supportLikelihood: result.rows[0].support_likelihood
  };
};

/**
 * Get contacts by support score range
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of contacts with support scores
 */
const getContactsBySupportScore = async (accountId, filters = {}) => {
  let sql = `SELECT 
             c.id, c.first_name, c.last_name, c.name, c.email, c.phone,
             AVG(ei.support_likelihood)::INTEGER as support_score,
             COUNT(ei.id) as interaction_count,
             MAX(ei.created_at) as last_interaction_at
             FROM contacts c
             INNER JOIN election_interactions ei ON c.id = ei.contact_id
             WHERE c.account_id = $1 AND c.deleted_at IS NULL
             AND ei.support_likelihood IS NOT NULL`;
  const params = [accountId];

  if (filters.minScore !== undefined) {
    sql += ` AND AVG(ei.support_likelihood) >= $${params.length + 1}`;
    params.push(filters.minScore);
  }
  if (filters.maxScore !== undefined) {
    sql += ` AND AVG(ei.support_likelihood) <= $${params.length + 1}`;
    params.push(filters.maxScore);
  }
  if (filters.supportCategory) {
    const categoryRanges = {
      'strong_support': [80, 100],
      'likely_support': [60, 79],
      'undecided': [40, 59],
      'likely_oppose': [20, 39],
      'strong_oppose': [0, 19]
    };
    const range = categoryRanges[filters.supportCategory];
    if (range) {
      sql += ` AND AVG(ei.support_likelihood) >= $${params.length + 1} 
               AND AVG(ei.support_likelihood) <= $${params.length + 2}`;
      params.push(range[0], range[1]);
    }
  }

  sql += ` GROUP BY c.id, c.first_name, c.last_name, c.name, c.email, c.phone
           HAVING COUNT(ei.id) > 0`;

  if (filters.orderBy === 'score') {
    sql += ' ORDER BY support_score DESC';
  } else if (filters.orderBy === 'last_interaction') {
    sql += ' ORDER BY last_interaction_at DESC';
  } else {
    sql += ' ORDER BY support_score DESC';
  }

  if (filters.limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(filters.limit);
  }

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get interaction statistics for an account
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Interaction statistics
 */
const getInteractionStatistics = async (accountId, filters = {}) => {
  let sql = `SELECT 
             COUNT(*) as total_interactions,
             COUNT(DISTINCT contact_id) as unique_contacts,
             COUNT(DISTINCT user_id) as unique_users,
             AVG(support_likelihood)::INTEGER as average_support_score,
             interaction_type,
             interaction_method
             FROM election_interactions 
             WHERE account_id = $1`;
  const params = [accountId];

  if (filters.startDate) {
    sql += ` AND created_at >= $${params.length + 1}`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ` AND created_at <= $${params.length + 1}`;
    params.push(filters.endDate);
  }

  sql += ' GROUP BY interaction_type, interaction_method';

  const result = await query(sql, params);

  // Get overall stats
  const overallStats = await query(
    `SELECT 
       COUNT(*) as total,
       COUNT(DISTINCT contact_id) as unique_contacts,
       AVG(support_likelihood)::INTEGER as avg_score
     FROM election_interactions 
     WHERE account_id = $1
     ${filters.startDate ? 'AND created_at >= $2' : ''}
     ${filters.endDate ? `AND created_at <= $${filters.startDate ? 3 : 2}` : ''}`,
    [accountId, filters.startDate, filters.endDate].filter(Boolean)
  );

  return {
    overall: {
      totalInteractions: parseInt(overallStats.rows[0]?.total || 0),
      uniqueContacts: parseInt(overallStats.rows[0]?.unique_contacts || 0),
      averageSupportScore: overallStats.rows[0]?.avg_score ? parseInt(overallStats.rows[0].avg_score) : null
    },
    byType: result.rows.map(row => ({
      interactionType: row.interaction_type,
      interactionMethod: row.interaction_method,
      count: parseInt(row.total_interactions),
      uniqueContacts: parseInt(row.unique_contacts),
      uniqueUsers: parseInt(row.unique_users),
      averageSupportScore: row.average_support_score ? parseInt(row.average_support_score) : null
    }))
  };
};

/**
 * Get all interactions for an account with filters
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Interactions with pagination
 */
const getAllInteractions = async (accountId, filters = {}) => {
  let sql = `SELECT ei.*, 
             c.first_name, c.last_name, c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
             u.email as created_by_email
             FROM election_interactions ei
             LEFT JOIN contacts c ON ei.contact_id = c.id
             LEFT JOIN users u ON ei.created_by = u.id
             WHERE ei.account_id = $1`;
  const params = [accountId];

  if (filters.contactId) {
    sql += ` AND ei.contact_id = $${params.length + 1}`;
    params.push(filters.contactId);
  }
  if (filters.contactSearch) {
    sql += ` AND (
      c.name ILIKE $${params.length + 1} OR
      c.first_name ILIKE $${params.length + 1} OR
      c.last_name ILIKE $${params.length + 1} OR
      c.email ILIKE $${params.length + 1} OR
      c.phone ILIKE $${params.length + 1}
    )`;
    const searchTerm = `%${filters.contactSearch}%`;
    params.push(searchTerm);
  }
  if (filters.interactionType) {
    sql += ` AND ei.interaction_type = $${params.length + 1}`;
    params.push(filters.interactionType);
  }
  if (filters.interactionMethod) {
    sql += ` AND ei.interaction_method = $${params.length + 1}`;
    params.push(filters.interactionMethod);
  }
  if (filters.supportCategory) {
    const categoryRanges = {
      'strong': [80, 100],
      'leaning': [60, 79],
      'undecided': [40, 59],
      'opposed': [0, 39]
    };
    const range = categoryRanges[filters.supportCategory];
    if (range) {
      sql += ` AND ei.support_likelihood >= $${params.length + 1} AND ei.support_likelihood <= $${params.length + 2}`;
      params.push(range[0], range[1]);
    }
  }
  if (filters.startDate) {
    sql += ` AND ei.created_at >= $${params.length + 1}`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ` AND ei.created_at <= $${params.length + 1}`;
    params.push(filters.endDate);
  }

  sql += ' ORDER BY ei.created_at DESC';

  // Pagination
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);

  // Get total count
  let countSql = `SELECT COUNT(*) as total 
                  FROM election_interactions ei
                  LEFT JOIN contacts c ON ei.contact_id = c.id
                  WHERE ei.account_id = $1`;
  const countParams = [accountId];

  if (filters.contactId) {
    countSql += ` AND ei.contact_id = $${countParams.length + 1}`;
    countParams.push(filters.contactId);
  }
  if (filters.contactSearch) {
    countSql += ` AND (
      c.name ILIKE $${countParams.length + 1} OR
      c.first_name ILIKE $${countParams.length + 1} OR
      c.last_name ILIKE $${countParams.length + 1} OR
      c.email ILIKE $${countParams.length + 1} OR
      c.phone ILIKE $${countParams.length + 1}
    )`;
    const searchTerm = `%${filters.contactSearch}%`;
    countParams.push(searchTerm);
  }
  if (filters.interactionType) {
    countSql += ` AND ei.interaction_type = $${countParams.length + 1}`;
    countParams.push(filters.interactionType);
  }
  if (filters.interactionMethod) {
    countSql += ` AND ei.interaction_method = $${countParams.length + 1}`;
    countParams.push(filters.interactionMethod);
  }
  if (filters.supportCategory) {
    const categoryRanges = {
      'strong': [80, 100],
      'leaning': [60, 79],
      'undecided': [40, 59],
      'opposed': [0, 39]
    };
    const range = categoryRanges[filters.supportCategory];
    if (range) {
      countSql += ` AND ei.support_likelihood >= $${countParams.length + 1} AND ei.support_likelihood <= $${countParams.length + 2}`;
      countParams.push(range[0], range[1]);
    }
  }
  if (filters.startDate) {
    countSql += ` AND ei.created_at >= $${countParams.length + 1}`;
    countParams.push(filters.startDate);
  }
  if (filters.endDate) {
    countSql += ` AND ei.created_at <= $${countParams.length + 1}`;
    countParams.push(filters.endDate);
  }

  const countResult = await query(countSql, countParams);
  const total = parseInt(countResult.rows[0].total);

  return {
    interactions: result.rows,
    total,
    limit,
    offset,
    hasMore: offset + result.rows.length < total
  };
};

/**
 * Get the support category for each of a set of contacts, derived from their
 * average election_interactions support_likelihood score.
 *
 * @param {string} accountId
 * @param {string[]} contactIds
 * @returns {Promise<Map<string, string>>} Map from contactId → support category string
 */
const getSupportCategoriesForContacts = async (accountId, contactIds) => {
  const result = new Map();
  if (!contactIds || contactIds.length === 0) return result;

  let rows;
  try {
    const queryResult = await query(
      `SELECT contact_id, AVG(support_likelihood)::INTEGER AS avg_score
       FROM election_interactions
       WHERE account_id = $1
         AND contact_id = ANY($2::text[])
         AND support_likelihood IS NOT NULL
       GROUP BY contact_id`,
      [accountId, contactIds]
    );
    rows = queryResult.rows;
  } catch (e) {
    // PostgreSQL not available in this environment; caller falls back to contact categories.
    return result;
  }

  for (const row of rows) {
    const score = parseInt(row.avg_score);
    let category = 'unknown';
    if (!isNaN(score)) {
      if (score >= 80) category = 'strong_support';
      else if (score >= 60) category = 'likely_support';
      else if (score >= 40) category = 'undecided';
      else if (score >= 20) category = 'likely_oppose';
      else category = 'strong_oppose';
    }
    result.set(String(row.contact_id), category);
  }

  return result;
};

module.exports = {
  recordInteraction,
  updateContactSupportScore,
  getContactSupportScore,
  getSupportCategoriesForContacts,
  getContactInteractionHistory,
  getLastContactInfo,
  getContactsBySupportScore,
  getInteractionStatistics,
  getAllInteractions
};
