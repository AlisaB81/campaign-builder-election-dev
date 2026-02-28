/**
 * Election Lists Service
 * 
 * Phase 4: Election Mode Features
 * Handles dynamic list building, segmentation, and saved views.
 */

const { query, isPostgresReady } = require('../db');
const { logger, createLogger } = require('../lib');
const fs = require('fs').promises;
const path = require('path');

const listLogger = createLogger('ELECTION_LISTS');

/**
 * Save an election list (saved view)
 * @param {Object} listData - List data
 * @returns {Promise<Object>} Created/updated list
 */
const saveList = async (listData) => {
  const {
    id,
    accountId,
    userId,
    name,
    description,
    filterConfig,
    contactIds, // Optional: for static lists with selected contacts
    isShared = false
  } = listData;

  // Generate ID if not provided
  const listId = id || `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Calculate contact count
  let contactCount = 0;
  if (contactIds && contactIds.length > 0) {
    // Static list with selected contacts
    contactCount = contactIds.length;
  } else {
    // Dynamic list based on filter config
    contactCount = await calculateListContactCount(accountId, filterConfig || {});
  }

  // IMPORTANT: use Postgres only when ready; otherwise fallback to JSON to avoid hanging /api/user
  if (isPostgresReady()) {
    try {
      // Include contactIds in filter_config if provided (for static lists)
      const configToStore = { ...(filterConfig || {}) };
      if (contactIds && contactIds.length > 0) {
        configToStore._staticContactIds = contactIds;
        configToStore._isStatic = true;
      }
      
      const result = await query(
        `INSERT INTO election_lists 
         (id, account_id, user_id, name, description, filter_config, is_shared, contact_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id)
         DO UPDATE SET 
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           filter_config = EXCLUDED.filter_config,
           is_shared = EXCLUDED.is_shared,
           contact_count = EXCLUDED.contact_count,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          listId,
          accountId,
          userId,
          name,
          description,
          JSON.stringify(configToStore),
          isShared,
          contactCount
        ]
      );

      listLogger.info('List saved to PostgreSQL', { listId, accountId, contactCount });
      return result.rows[0];
    } catch (error) {
      listLogger.warn('PostgreSQL save failed, falling back to JSON', error);
      // Fall through to JSON fallback
    }
  }

  // JSON fallback
  const listsPath = path.join(__dirname, '..', 'data', 'shared-data', accountId.toString(), 'election-lists.json');
  let lists = [];
  
  try {
    const data = await fs.readFile(listsPath, 'utf8');
    lists = JSON.parse(data);
  } catch (error) {
    // File doesn't exist, start with empty array
    lists = [];
  }

  const existingIndex = lists.findIndex(l => l.id === listId);
  
  // Include contactIds in filter_config if provided (for static lists)
  const configToStore = { ...(filterConfig || {}) };
  if (contactIds && contactIds.length > 0) {
    configToStore._staticContactIds = contactIds;
    configToStore._isStatic = true;
  }
  
  const newListData = {
    id: listId,
    account_id: accountId,
    user_id: userId,
    name,
    description: description || '',
    filter_config: configToStore,
    is_shared: isShared,
    contact_count: contactCount,
    created_at: existingIndex >= 0 ? lists[existingIndex].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };

  if (existingIndex >= 0) {
    lists[existingIndex] = newListData;
  } else {
    lists.push(newListData);
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(listsPath), { recursive: true });
  await fs.writeFile(listsPath, JSON.stringify(lists, null, 2));

  listLogger.info('List saved to JSON', { listId, accountId, contactCount });
  return newListData;
};

/**
 * Calculate contact count for a filter configuration
 * @param {string} accountId - Account ID
 * @param {Object} filterConfig - Filter configuration
 * @returns {Promise<number>} Contact count
 */
const calculateListContactCount = async (accountId, filterConfig) => {
  // Check if PostgreSQL is enabled
  if (isPostgresReady()) {
    try {
      // Build SQL query based on filter config
      let sql = `SELECT COUNT(DISTINCT c.id) as count
                 FROM contacts c
                 WHERE c.account_id = $1 AND c.deleted_at IS NULL`;
      const params = [accountId];

  // Apply filters
  if (filterConfig.pollNumber) {
    sql += ` AND c.poll_number = $${params.length + 1}`;
    params.push(filterConfig.pollNumber);
  }
  if (filterConfig.riding) {
    sql += ` AND c.riding = $${params.length + 1}`;
    params.push(filterConfig.riding);
  }
  if (filterConfig.province) {
    sql += ` AND c.province = $${params.length + 1}`;
    params.push(filterConfig.province);
  }
  if (filterConfig.city) {
    sql += ` AND c.city = $${params.length + 1}`;
    params.push(filterConfig.city);
  }
  if (filterConfig.categories && filterConfig.categories.length > 0) {
    sql += ` AND c.categories && $${params.length + 1}::jsonb`;
    params.push(JSON.stringify(filterConfig.categories));
  }
  if (filterConfig.category) {
    // Single category filter - check if category is in categories array or matches single category field
    sql += ` AND (
      c.categories @> $${params.length + 1}::jsonb
      OR c.category = $${params.length + 2}
    )`;
    params.push(JSON.stringify([filterConfig.category]), filterConfig.category);
  }
  if (filterConfig.minSupportScore !== undefined) {
    // Join with interactions to filter by support score
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei
               WHERE ei.contact_id = c.id 
               AND ei.account_id = $1
               GROUP BY ei.contact_id
               HAVING AVG(ei.support_likelihood) >= $${params.length + 1}
             )`;
    params.push(filterConfig.minSupportScore);
  }
  if (filterConfig.maxSupportScore !== undefined) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei
               WHERE ei.contact_id = c.id 
               AND ei.account_id = $1
               GROUP BY ei.contact_id
               HAVING AVG(ei.support_likelihood) <= $${params.length + 1}
             )`;
    params.push(filterConfig.maxSupportScore);
  }
  if (filterConfig.supportCategory) {
    const categoryRanges = {
      'strong_support': [80, 100],
      'likely_support': [60, 79],
      'undecided': [40, 59],
      'likely_oppose': [20, 39],
      'strong_oppose': [0, 19]
    };
    const range = categoryRanges[filterConfig.supportCategory];
    if (range) {
      sql += ` AND EXISTS (
                 SELECT 1 FROM election_interactions ei
                 WHERE ei.contact_id = c.id 
                 AND ei.account_id = $1
                 GROUP BY ei.contact_id
                 HAVING AVG(ei.support_likelihood) >= $${params.length + 1}
                 AND AVG(ei.support_likelihood) <= $${params.length + 2}
               )`;
      params.push(range[0], range[1]);
    }
  }
  if (filterConfig.hasInteractions === true) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei
               WHERE ei.contact_id = c.id AND ei.account_id = $1
             )`;
  }
  if (filterConfig.lastInteractionAfter) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei
               WHERE ei.contact_id = c.id 
               AND ei.account_id = $1
               AND ei.created_at >= $${params.length + 1}
             )`;
    params.push(filterConfig.lastInteractionAfter);
  }
  if (filterConfig.lastInteractionBefore) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei
               WHERE ei.contact_id = c.id 
               AND ei.account_id = $1
               AND ei.created_at <= $${params.length + 1}
             )`;
    params.push(filterConfig.lastInteractionBefore);
  }

      const result = await query(sql, params);
      return parseInt(result.rows[0].count || 0);
    } catch (error) {
      listLogger.warn('PostgreSQL count query failed, falling back to JSON', error);
      // Fall through to JSON fallback
    }
  }

  // JSON fallback - load contacts and filter
  try {
    const contactsPath = path.join(__dirname, '..', 'data', 'shared-data', accountId.toString(), 'contacts.json');
    let contacts = [];
    try {
      const data = await fs.readFile(contactsPath, 'utf8');
      contacts = JSON.parse(data);
      if (!Array.isArray(contacts)) {
        contacts = [];
      }
    } catch (error) {
      // File doesn't exist
      contacts = [];
    }

    let filteredContacts = contacts.filter(c => !c.deleted);

    // Apply filters
    if (filterConfig.pollNumber) {
      filteredContacts = filteredContacts.filter(c => c.pollNumber === filterConfig.pollNumber);
    }
    if (filterConfig.province) {
      filteredContacts = filteredContacts.filter(c => c.province === filterConfig.province);
    }
    if (filterConfig.city) {
      filteredContacts = filteredContacts.filter(c => 
        c.city && c.city.toLowerCase() === filterConfig.city.toLowerCase()
      );
    }
    if (filterConfig.category) {
      filteredContacts = filteredContacts.filter(c => {
        if (Array.isArray(c.categories)) {
          return c.categories.includes(filterConfig.category);
        } else if (c.category) {
          return c.category === filterConfig.category;
        }
        return false;
      });
    }
    if (filterConfig.supportCategory) {
      // For JSON, we can't easily calculate support scores without interactions
      // Return all contacts for now if support category is requested
    }

    return filteredContacts.length;
  } catch (error) {
    listLogger.error('Error calculating contact count from JSON', error);
    return 0;
  }
};

/**
 * Get contacts matching a filter configuration
 * @param {string} accountId - Account ID
 * @param {Object} filterConfig - Filter configuration
 * @param {Object} options - Query options (limit, offset, orderBy)
 * @returns {Promise<Object>} Contacts with pagination
 */
const getContactsByFilters = async (accountId, filterConfig, options = {}) => {
  // Check if PostgreSQL is enabled
  if (isPostgresReady()) {
    try {
      // Handle static list with specific contact IDs
      if (filterConfig._staticContactIds && Array.isArray(filterConfig._staticContactIds) && filterConfig._staticContactIds.length > 0) {
        const placeholders = filterConfig._staticContactIds.map((_, i) => `$${i + 2}`).join(', ');
        const sql = `SELECT DISTINCT c.*,
                     AVG(ei.support_likelihood)::INTEGER as support_score,
                     COUNT(ei.id) as interaction_count,
                     MAX(ei.created_at) as last_interaction_at
                     FROM contacts c
                     LEFT JOIN election_interactions ei ON c.id = ei.contact_id AND ei.account_id = $1
                     WHERE c.account_id = $1 AND c.deleted_at IS NULL
                     AND c.id = ANY(ARRAY[${placeholders}]::text[])
                     GROUP BY c.id
                     ORDER BY ${options.orderBy || 'support_score'} DESC NULLS LAST
                     LIMIT $${filterConfig._staticContactIds.length + 2} OFFSET $${filterConfig._staticContactIds.length + 3}`;
        
        const params = [accountId, ...filterConfig._staticContactIds, options.limit || 100, options.offset || 0];
        const result = await query(sql, params);
        
        // Get total count for static list
        const countSql = `SELECT COUNT(*) as total
                          FROM contacts c
                          WHERE c.account_id = $1 AND c.deleted_at IS NULL
                          AND c.id = ANY(ARRAY[${placeholders}]::text[])`;
        const countParams = [accountId, ...filterConfig._staticContactIds];
        const countResult = await query(countSql, countParams);
        const total = parseInt(countResult.rows[0].total) || 0;
        
        return {
          contacts: result.rows,
          total,
          limit: options.limit || 100,
          offset: options.offset || 0,
          hasMore: (options.offset || 0) + (options.limit || 100) < total
        };
      }
      
      let sql = `SELECT DISTINCT c.*,
                 AVG(ei.support_likelihood)::INTEGER as support_score,
                 COUNT(ei.id) as interaction_count,
                 MAX(ei.created_at) as last_interaction_at
                 FROM contacts c
                 LEFT JOIN election_interactions ei ON c.id = ei.contact_id AND ei.account_id = $1
                 WHERE c.account_id = $1 AND c.deleted_at IS NULL`;
      const params = [accountId];

  // Apply same filters as calculateListContactCount
  if (filterConfig.pollNumber) {
    sql += ` AND c.poll_number = $${params.length + 1}`;
    params.push(filterConfig.pollNumber);
  }
  if (filterConfig.riding) {
    sql += ` AND c.riding = $${params.length + 1}`;
    params.push(filterConfig.riding);
  }
  if (filterConfig.province) {
    sql += ` AND c.province = $${params.length + 1}`;
    params.push(filterConfig.province);
  }
  if (filterConfig.city) {
    sql += ` AND c.city = $${params.length + 1}`;
    params.push(filterConfig.city);
  }
  if (filterConfig.categories && filterConfig.categories.length > 0) {
    sql += ` AND c.categories && $${params.length + 1}::jsonb`;
    params.push(JSON.stringify(filterConfig.categories));
  }
  if (filterConfig.category) {
    // Single category filter - check if category is in categories array or matches single category field
    sql += ` AND (
      c.categories @> $${params.length + 1}::jsonb
      OR c.category = $${params.length + 2}
    )`;
    params.push(JSON.stringify([filterConfig.category]), filterConfig.category);
  }
  if (filterConfig.minSupportScore !== undefined) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei2
               WHERE ei2.contact_id = c.id 
               AND ei2.account_id = $1
               GROUP BY ei2.contact_id
               HAVING AVG(ei2.support_likelihood) >= $${params.length + 1}
             )`;
    params.push(filterConfig.minSupportScore);
  }
  if (filterConfig.maxSupportScore !== undefined) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei3
               WHERE ei3.contact_id = c.id 
               AND ei3.account_id = $1
               GROUP BY ei3.contact_id
               HAVING AVG(ei3.support_likelihood) <= $${params.length + 1}
             )`;
    params.push(filterConfig.maxSupportScore);
  }
  if (filterConfig.supportCategory) {
    const categoryRanges = {
      'strong_support': [80, 100],
      'likely_support': [60, 79],
      'undecided': [40, 59],
      'likely_oppose': [20, 39],
      'strong_oppose': [0, 19]
    };
    const range = categoryRanges[filterConfig.supportCategory];
    if (range) {
      sql += ` AND EXISTS (
                 SELECT 1 FROM election_interactions ei4
                 WHERE ei4.contact_id = c.id 
                 AND ei4.account_id = $1
                 GROUP BY ei4.contact_id
                 HAVING AVG(ei4.support_likelihood) >= $${params.length + 1}
                 AND AVG(ei4.support_likelihood) <= $${params.length + 2}
               )`;
      params.push(range[0], range[1]);
    }
  }
  if (filterConfig.hasInteractions === true) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei5
               WHERE ei5.contact_id = c.id AND ei5.account_id = $1
             )`;
  }
  if (filterConfig.lastInteractionAfter) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei6
               WHERE ei6.contact_id = c.id 
               AND ei6.account_id = $1
               AND ei6.created_at >= $${params.length + 1}
             )`;
    params.push(filterConfig.lastInteractionAfter);
  }
  if (filterConfig.lastInteractionBefore) {
    sql += ` AND EXISTS (
               SELECT 1 FROM election_interactions ei7
               WHERE ei7.contact_id = c.id 
               AND ei7.account_id = $1
               AND ei7.created_at <= $${params.length + 1}
             )`;
    params.push(filterConfig.lastInteractionBefore);
  }

  sql += ` GROUP BY c.id`;

  // Ordering
  if (options.orderBy === 'support_score') {
    sql += ' ORDER BY support_score DESC NULLS LAST';
  } else if (options.orderBy === 'last_interaction') {
    sql += ' ORDER BY last_interaction_at DESC NULLS LAST';
  } else if (options.orderBy === 'name') {
    sql += ' ORDER BY COALESCE(c.name, c.first_name || \' \' || c.last_name) ASC';
  } else {
    sql += ' ORDER BY c.created_at DESC';
  }

  // Pagination
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);

  // Get total count - rebuild query for count
  let countSql = `SELECT COUNT(DISTINCT c.id) as total
                  FROM contacts c
                  LEFT JOIN election_interactions ei ON c.id = ei.contact_id AND ei.account_id = $1
                  WHERE c.account_id = $1 AND c.deleted_at IS NULL`;
  const countParams = [accountId];

  // Apply same filters
  if (filterConfig.pollNumber) {
    countSql += ` AND c.poll_number = $${countParams.length + 1}`;
    countParams.push(filterConfig.pollNumber);
  }
  if (filterConfig.riding) {
    countSql += ` AND c.riding = $${countParams.length + 1}`;
    countParams.push(filterConfig.riding);
  }
  if (filterConfig.province) {
    countSql += ` AND c.province = $${countParams.length + 1}`;
    countParams.push(filterConfig.province);
  }
  if (filterConfig.city) {
    countSql += ` AND c.city = $${countParams.length + 1}`;
    countParams.push(filterConfig.city);
  }
  if (filterConfig.categories && filterConfig.categories.length > 0) {
    countSql += ` AND c.categories && $${countParams.length + 1}::jsonb`;
    countParams.push(JSON.stringify(filterConfig.categories));
  }
  if (filterConfig.category) {
    // Single category filter
    countSql += ` AND (
      c.categories @> $${countParams.length + 1}::jsonb
      OR c.category = $${countParams.length + 2}
    )`;
    countParams.push(JSON.stringify([filterConfig.category]), filterConfig.category);
  }
  if (filterConfig.minSupportScore !== undefined) {
    countSql += ` AND EXISTS (
                   SELECT 1 FROM election_interactions ei2
                   WHERE ei2.contact_id = c.id 
                   AND ei2.account_id = $1
                   GROUP BY ei2.contact_id
                   HAVING AVG(ei2.support_likelihood) >= $${countParams.length + 1}
                 )`;
    countParams.push(filterConfig.minSupportScore);
  }
  if (filterConfig.maxSupportScore !== undefined) {
    countSql += ` AND EXISTS (
                   SELECT 1 FROM election_interactions ei3
                   WHERE ei3.contact_id = c.id 
                   AND ei3.account_id = $1
                   GROUP BY ei3.contact_id
                   HAVING AVG(ei3.support_likelihood) <= $${countParams.length + 1}
                 )`;
    countParams.push(filterConfig.maxSupportScore);
  }
  if (filterConfig.supportCategory) {
    const categoryRanges = {
      'strong_support': [80, 100],
      'likely_support': [60, 79],
      'undecided': [40, 59],
      'likely_oppose': [20, 39],
      'strong_oppose': [0, 19]
    };
    const range = categoryRanges[filterConfig.supportCategory];
    if (range) {
      countSql += ` AND EXISTS (
                     SELECT 1 FROM election_interactions ei4
                     WHERE ei4.contact_id = c.id 
                     AND ei4.account_id = $1
                     GROUP BY ei4.contact_id
                     HAVING AVG(ei4.support_likelihood) >= $${countParams.length + 1}
                     AND AVG(ei4.support_likelihood) <= $${countParams.length + 2}
                   )`;
      countParams.push(range[0], range[1]);
    }
  }
  if (filterConfig.hasInteractions === true) {
    countSql += ` AND EXISTS (
                   SELECT 1 FROM election_interactions ei5
                   WHERE ei5.contact_id = c.id AND ei5.account_id = $1
                 )`;
  }
  if (filterConfig.lastInteractionAfter) {
    countSql += ` AND EXISTS (
                   SELECT 1 FROM election_interactions ei6
                   WHERE ei6.contact_id = c.id 
                   AND ei6.account_id = $1
                   AND ei6.created_at >= $${countParams.length + 1}
                 )`;
    countParams.push(filterConfig.lastInteractionAfter);
  }
  if (filterConfig.lastInteractionBefore) {
    countSql += ` AND EXISTS (
                   SELECT 1 FROM election_interactions ei7
                   WHERE ei7.contact_id = c.id 
                   AND ei7.account_id = $1
                   AND ei7.created_at <= $${countParams.length + 1}
                 )`;
    countParams.push(filterConfig.lastInteractionBefore);
  }

      const countResult = await query(countSql, countParams);
      const total = parseInt(countResult.rows[0]?.total || 0);

      return {
        contacts: result.rows,
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
      };
    } catch (error) {
      listLogger.warn('PostgreSQL contacts query failed, falling back to JSON', error);
      // Fall through to JSON fallback - server endpoint will handle this
      throw error; // Let server endpoint handle JSON fallback
    }
  }

  // If PostgreSQL not enabled, throw error to let server handle JSON fallback
  throw new Error('PostgreSQL not enabled - use server endpoint for JSON fallback');
};

/**
 * Get election lists for an account
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID (optional, for filtering)
 * @returns {Promise<Array>} Array of lists
 */
const getLists = async (accountId, userId = null) => {
  // Check if PostgreSQL is enabled
  if (isPostgresReady()) {
    try {
      let sql = `SELECT * FROM election_lists 
                 WHERE account_id = $1 AND deleted_at IS NULL`;
      const params = [accountId];

      if (userId) {
        sql += ' AND (user_id = $2 OR is_shared = true)';
        params.push(userId);
      } else {
        sql += ' AND is_shared = true';
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      listLogger.warn('PostgreSQL query failed, falling back to JSON', error);
      // Fall through to JSON fallback
    }
  }

  // JSON fallback - read from file
  try {
    const listsPath = path.join(__dirname, '..', 'data', 'shared-data', accountId.toString(), 'election-lists.json');
    const lists = await fs.readFile(listsPath, 'utf8').then(JSON.parse).catch(() => []);
    
    // Filter by userId if provided
    if (userId) {
      return lists.filter(list => !list.deleted_at && (list.user_id === userId || list.is_shared === true));
    } else {
      return lists.filter(list => !list.deleted_at && list.is_shared === true);
    }
  } catch (error) {
    // File doesn't exist or error reading - return empty array
    return [];
  }
};

/**
 * Get a specific election list
 * @param {string} listId - List ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object|null>} List object
 */
const getList = async (listId, accountId) => {
  // Check if PostgreSQL is enabled
  if (isPostgresReady()) {
    try {
      const result = await query(
        `SELECT * FROM election_lists 
         WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL`,
        [listId, accountId]
      );
      return result.rows[0] || null;
    } catch (error) {
      listLogger.warn('PostgreSQL query failed, falling back to JSON', error);
      // Fall through to JSON fallback
    }
  }
  
  // JSON fallback
  try {
    const listsPath = path.join(__dirname, '..', 'data', 'shared-data', accountId.toString(), 'election-lists.json');
    const lists = await fs.readFile(listsPath, 'utf8').then(JSON.parse).catch(() => []);
    return lists.find(list => list.id === listId && !list.deleted_at) || null;
  } catch (error) {
    return null;
  }
};

/**
 * Delete an election list (soft delete)
 * @param {string} listId - List ID
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} Success
 */
const deleteList = async (listId, accountId) => {
  // Check if PostgreSQL is enabled
  if (isPostgresReady()) {
    try {
      await query(
        `UPDATE election_lists 
         SET deleted_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND account_id = $2`,
        [listId, accountId]
      );
      listLogger.info('List deleted from PostgreSQL', { listId, accountId });
      return true;
    } catch (error) {
      listLogger.warn('PostgreSQL delete failed, falling back to JSON', error);
      // Fall through to JSON fallback
    }
  }
  
  // JSON fallback
  try {
    const listsPath = path.join(__dirname, '..', 'data', 'shared-data', accountId.toString(), 'election-lists.json');
    let lists = [];
    try {
      const data = await fs.readFile(listsPath, 'utf8');
      lists = JSON.parse(data);
    } catch (error) {
      return false;
    }
    
    const listIndex = lists.findIndex(list => list.id === listId && !list.deleted_at);
    if (listIndex >= 0) {
      lists[listIndex].deleted_at = new Date().toISOString();
      await fs.writeFile(listsPath, JSON.stringify(lists, null, 2));
      listLogger.info('List deleted from JSON', { listId, accountId });
      return true;
    }
    return false;
  } catch (error) {
    listLogger.error('Error deleting list from JSON', error);
    return false;
  }
};

/**
 * Refresh list contact count
 * @param {string} listId - List ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object>} Updated list
 */
const refreshListCount = async (listId, accountId) => {
  const list = await getList(listId, accountId);
  if (!list) {
    throw new Error('List not found');
  }

  // Check if it's a static list
  let contactCount = 0;
  if (list.filter_config && list.filter_config._isStatic && list.filter_config._staticContactIds) {
    contactCount = list.filter_config._staticContactIds.length;
  } else {
    contactCount = await calculateListContactCount(accountId, list.filter_config || {});
  }

  // Check if PostgreSQL is enabled
  if (isPostgresReady()) {
    try {
      const result = await query(
        `UPDATE election_lists 
         SET contact_count = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND account_id = $3
         RETURNING *`,
        [contactCount, listId, accountId]
      );
      return result.rows[0];
    } catch (error) {
      listLogger.warn('PostgreSQL refresh failed, falling back to JSON', error);
      // Fall through to JSON fallback
    }
  }
  
  // JSON fallback
  try {
    const listsPath = path.join(__dirname, '..', 'data', 'shared-data', accountId.toString(), 'election-lists.json');
    let lists = [];
    try {
      const data = await fs.readFile(listsPath, 'utf8');
      lists = JSON.parse(data);
    } catch (error) {
      throw new Error('List not found');
    }
    
    const listIndex = lists.findIndex(l => l.id === listId && !l.deleted_at);
    if (listIndex >= 0) {
      lists[listIndex].contact_count = contactCount;
      lists[listIndex].updated_at = new Date().toISOString();
      await fs.writeFile(listsPath, JSON.stringify(lists, null, 2));
      return lists[listIndex];
    }
    throw new Error('List not found');
  } catch (error) {
    listLogger.error('Error refreshing list count from JSON', error);
    throw error;
  }
};

module.exports = {
  saveList,
  calculateListContactCount,
  getContactsByFilters,
  getLists,
  getList,
  deleteList,
  refreshListCount
};
