/**
 * Canvassing Service
 * 
 * Phase 4: Election Mode Features
 * Handles canvass assignments, area management, and canvassing event tracking.
 */

const { query } = require('../db/connection');
const { logger, createLogger } = require('../lib');

const canvassingLogger = createLogger('CANVASSING');

/**
 * Create a canvass assignment
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise<Object>} Created assignment
 */
const createAssignment = async (assignmentData) => {
  const {
    id,
    accountId,
    assignedTo,
    assignedBy,
    areaName,
    areaDescription,
    areaBoundaries,
    contactIds,
    priority = 0,
    dueDate,
    notes,
    metadata = {}
  } = assignmentData;

  const result = await query(
    `INSERT INTO canvass_assignments 
     (id, account_id, assigned_to, assigned_by, area_name, area_description, 
      area_boundaries, contact_ids, priority, due_date, notes, metadata, 
      status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'assigned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      id,
      accountId,
      assignedTo,
      assignedBy,
      areaName,
      areaDescription,
      JSON.stringify(areaBoundaries || {}),
      JSON.stringify(contactIds || []),
      priority,
      dueDate,
      notes,
      JSON.stringify(metadata)
    ]
  );

  canvassingLogger.info('Canvass assignment created', { assignmentId: id, accountId, assignedTo });
  return result.rows[0];
};

/**
 * Get assignments for a user
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of assignments
 */
const getUserAssignments = async (accountId, userId, filters = {}) => {
  let sql = `SELECT ca.*,
             u.email as assigned_to_email,
             u2.email as assigned_by_email,
             COUNT(ce.id) as event_count
             FROM canvass_assignments ca
             LEFT JOIN users u ON ca.assigned_to = u.id
             LEFT JOIN users u2 ON ca.assigned_by = u2.id
             LEFT JOIN canvass_events ce ON ca.id = ce.assignment_id
             WHERE ca.account_id = $1 AND ca.assigned_to = $2`;
  const params = [accountId, userId];

  if (filters.status) {
    sql += ` AND ca.status = $${params.length + 1}`;
    params.push(filters.status);
  }

  sql += ` GROUP BY ca.id, u.email, u2.email
           ORDER BY ca.priority DESC, ca.due_date ASC, ca.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get all assignments for an account (admin view)
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of assignments
 */
const getAllAssignments = async (accountId, filters = {}) => {
  let sql = `SELECT ca.*,
             u.email as assigned_to_email,
             u2.email as assigned_by_email,
             COUNT(ce.id) as event_count
             FROM canvass_assignments ca
             LEFT JOIN users u ON ca.assigned_to = u.id
             LEFT JOIN users u2 ON ca.assigned_by = u2.id
             LEFT JOIN canvass_events ce ON ca.id = ce.assignment_id
             WHERE ca.account_id = $1`;
  const params = [accountId];

  if (filters.status) {
    sql += ` AND ca.status = $${params.length + 1}`;
    params.push(filters.status);
  }
  if (filters.assignedTo) {
    sql += ` AND ca.assigned_to = $${params.length + 1}`;
    params.push(filters.assignedTo);
  }

  sql += ` GROUP BY ca.id, u.email, u2.email
           ORDER BY ca.priority DESC, ca.due_date ASC, ca.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get a specific assignment
 * @param {string} assignmentId - Assignment ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object|null>} Assignment object
 */
const getAssignment = async (assignmentId, accountId) => {
  const result = await query(
    `SELECT ca.*,
     u.email as assigned_to_email,
     u2.email as assigned_by_email
     FROM canvass_assignments ca
     LEFT JOIN users u ON ca.assigned_to = u.id
     LEFT JOIN users u2 ON ca.assigned_by = u2.id
     WHERE ca.id = $1 AND ca.account_id = $2`,
    [assignmentId, accountId]
  );

  return result.rows[0] || null;
};

/**
 * Update assignment status
 * @param {string} assignmentId - Assignment ID
 * @param {string} accountId - Account ID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated assignment
 */
const updateAssignment = async (assignmentId, accountId, updates) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.keys(updates).forEach(key => {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (key === 'areaBoundaries' || key === 'contactIds' || key === 'metadata') {
      fields.push(`${dbKey} = $${paramIndex}`);
      values.push(JSON.stringify(updates[key]));
    } else {
      fields.push(`${dbKey} = $${paramIndex}`);
      values.push(updates[key]);
    }
    paramIndex++;
  });

  if (fields.length === 0) {
    return await getAssignment(assignmentId, accountId);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(assignmentId, accountId);

  const result = await query(
    `UPDATE canvass_assignments 
     SET ${fields.join(', ')} 
     WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

/**
 * Complete an assignment
 * @param {string} assignmentId - Assignment ID
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID completing the assignment
 * @returns {Promise<Object>} Updated assignment
 */
const completeAssignment = async (assignmentId, accountId, userId) => {
  const result = await query(
    `UPDATE canvass_assignments 
     SET status = 'completed', 
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND account_id = $2 AND assigned_to = $3
     RETURNING *`,
    [assignmentId, accountId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Assignment not found or not assigned to user');
  }

  canvassingLogger.info('Assignment completed', { assignmentId, accountId, userId });
  return result.rows[0];
};

/**
 * Record a canvass event
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
const recordEvent = async (eventData) => {
  const {
    accountId,
    assignmentId,
    userId,
    contactId,
    eventType,
    eventData: eventDataPayload,
    location,
    notes
  } = eventData;

  const result = await query(
    `INSERT INTO canvass_events 
     (account_id, assignment_id, user_id, contact_id, event_type, event_data, location, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      accountId,
      assignmentId,
      userId,
      contactId,
      eventType,
      JSON.stringify(eventDataPayload || {}),
      JSON.stringify(location || {}),
      notes
    ]
  );

  canvassingLogger.info('Canvass event recorded', { 
    eventId: result.rows[0].id, 
    accountId,
    assignmentId,
    eventType 
  });

  return result.rows[0];
};

/**
 * Get events for an assignment
 * @param {string} assignmentId - Assignment ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Array>} Array of events
 */
const getAssignmentEvents = async (assignmentId, accountId) => {
  const result = await query(
    `SELECT ce.*,
     u.email as user_email,
     c.first_name, c.last_name, c.name as contact_name
     FROM canvass_events ce
     LEFT JOIN users u ON ce.user_id = u.id
     LEFT JOIN contacts c ON ce.contact_id = c.id
     WHERE ce.assignment_id = $1 AND ce.account_id = $2
     ORDER BY ce.created_at DESC`,
    [assignmentId, accountId]
  );

  return result.rows;
};

/**
 * Get assignment completion statistics
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Completion statistics
 */
const getCompletionStatistics = async (accountId, filters = {}) => {
  let sql = `SELECT 
             COUNT(*) as total_assignments,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
             COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_count,
             COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
             COUNT(CASE WHEN due_date < CURRENT_TIMESTAMP AND status != 'completed' THEN 1 END) as overdue_count
             FROM canvass_assignments
             WHERE account_id = $1`;
  const params = [accountId];

  if (filters.assignedTo) {
    sql += ` AND assigned_to = $${params.length + 1}`;
    params.push(filters.assignedTo);
  }

  const result = await query(sql, params);
  const stats = result.rows[0];

  const completionRate = stats.total_assignments > 0
    ? ((parseInt(stats.completed_count) / parseInt(stats.total_assignments)) * 100).toFixed(2)
    : 0;

  return {
    totalAssignments: parseInt(stats.total_assignments || 0),
    completedCount: parseInt(stats.completed_count || 0),
    assignedCount: parseInt(stats.assigned_count || 0),
    inProgressCount: parseInt(stats.in_progress_count || 0),
    overdueCount: parseInt(stats.overdue_count || 0),
    completionRate: parseFloat(completionRate)
  };
};

module.exports = {
  createAssignment,
  getUserAssignments,
  getAllAssignments,
  getAssignment,
  updateAssignment,
  completeAssignment,
  recordEvent,
  getAssignmentEvents,
  getCompletionStatistics
};
