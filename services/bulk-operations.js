/**
 * Bulk Operations Service
 * 
 * Handles bulk operations for election data (import, update, delete).
 */

const { query, transaction } = require('../db/connection');
const { logger, createLogger } = require('../lib');
const validation = require('../lib/validation');

const bulkLogger = createLogger('BULK_OPERATIONS');

/**
 * Bulk record interactions
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID
 * @param {Array} interactions - Array of interaction data
 * @returns {Promise<Object>} Results with success/failure counts
 */
const bulkRecordInteractions = async (accountId, userId, interactions) => {
  if (!Array.isArray(interactions) || interactions.length === 0) {
    throw new Error('Interactions array is required and must not be empty');
  }

  if (interactions.length > 1000) {
    throw new Error('Maximum 1000 interactions allowed per bulk operation');
  }

  const results = {
    total: interactions.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Validate all interactions first
  for (let i = 0; i < interactions.length; i++) {
    try {
      validation.validateInteraction(interactions[i]);
    } catch (error) {
      results.failed++;
      results.errors.push({
        index: i,
        error: error.message,
        data: interactions[i]
      });
    }
  }

  // If all failed validation, return early
  if (results.failed === results.total) {
    return results;
  }

  // Insert valid interactions
  const validInteractions = interactions.filter((_, index) => {
    return !results.errors.some(err => err.index === index);
  });

  try {
    await transaction(async (client) => {
      for (const interaction of validInteractions) {
        try {
          await client.query(
            `INSERT INTO election_interactions 
             (account_id, contact_id, user_id, interaction_type, interaction_method, 
              support_likelihood, notes, metadata, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              accountId,
              interaction.contactId,
              userId,
              interaction.interactionType,
              interaction.interactionMethod,
              interaction.supportLikelihood || null,
              interaction.notes || null,
              JSON.stringify(interaction.metadata || {}),
              userId
            ]
          );
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            index: interactions.indexOf(interaction),
            error: error.message,
            data: interaction
          });
        }
      }
    });
  } catch (error) {
    bulkLogger.error('Bulk interaction transaction failed', error);
    throw error;
  }

  bulkLogger.info('Bulk interactions recorded', {
    accountId,
    total: results.total,
    successful: results.successful,
    failed: results.failed
  });

  return results;
};

/**
 * Bulk update poll turnout
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID
 * @param {Array} turnoutData - Array of poll turnout data
 * @returns {Promise<Object>} Results with success/failure counts
 */
const bulkUpdatePollTurnout = async (accountId, userId, turnoutData) => {
  if (!Array.isArray(turnoutData) || turnoutData.length === 0) {
    throw new Error('Turnout data array is required and must not be empty');
  }

  if (turnoutData.length > 500) {
    throw new Error('Maximum 500 poll records allowed per bulk operation');
  }

  const results = {
    total: turnoutData.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  try {
    await transaction(async (client) => {
      for (let i = 0; i < turnoutData.length; i++) {
        const data = turnoutData[i];
        try {
          if (!data.pollNumber || !validation.isValidPollNumber(data.pollNumber)) {
            throw new Error('Valid poll number is required');
          }

          await client.query(
            `INSERT INTO election_poll_turnout 
             (account_id, poll_number, riding, province, total_voters, votes_cast, updated_by, last_updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             ON CONFLICT (account_id, poll_number, riding, province)
             DO UPDATE SET 
               total_voters = EXCLUDED.total_voters,
               votes_cast = EXCLUDED.votes_cast,
               updated_by = EXCLUDED.updated_by,
               last_updated_at = CURRENT_TIMESTAMP`,
            [
              accountId,
              data.pollNumber,
              data.riding || null,
              data.province || null,
              data.totalVoters || 0,
              data.votesCast || 0,
              userId
            ]
          );
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i,
            error: error.message,
            data: data
          });
        }
      }
    });
  } catch (error) {
    bulkLogger.error('Bulk poll turnout transaction failed', error);
    throw error;
  }

  bulkLogger.info('Bulk poll turnout updated', {
    accountId,
    total: results.total,
    successful: results.successful,
    failed: results.failed
  });

  return results;
};

/**
 * Bulk create canvass assignments
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID (assigned by)
 * @param {Array} assignments - Array of assignment data
 * @returns {Promise<Object>} Results with success/failure counts
 */
const bulkCreateAssignments = async (accountId, userId, assignments) => {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw new Error('Assignments array is required and must not be empty');
  }

  if (assignments.length > 200) {
    throw new Error('Maximum 200 assignments allowed per bulk operation');
  }

  const results = {
    total: assignments.length,
    successful: 0,
    failed: 0,
    errors: [],
    assignmentIds: []
  };

  // Validate all assignments first
  for (let i = 0; i < assignments.length; i++) {
    try {
      validation.validateAssignment(assignments[i]);
    } catch (error) {
      results.failed++;
      results.errors.push({
        index: i,
        error: error.message,
        data: assignments[i]
      });
    }
  }

  // If all failed validation, return early
  if (results.failed === results.total) {
    return results;
  }

  const validAssignments = assignments.filter((_, index) => {
    return !results.errors.some(err => err.index === index);
  });

  try {
    await transaction(async (client) => {
      for (const assignment of validAssignments) {
        try {
          const assignmentId = assignment.id || `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await client.query(
            `INSERT INTO canvass_assignments 
             (id, account_id, assigned_to, assigned_by, area_name, area_description, 
              area_boundaries, contact_ids, priority, due_date, notes, metadata, 
              status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'assigned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              assignmentId,
              accountId,
              assignment.assignedTo || null,
              userId,
              assignment.areaName,
              assignment.areaDescription || null,
              JSON.stringify(assignment.areaBoundaries || {}),
              JSON.stringify(assignment.contactIds || []),
              assignment.priority || 0,
              assignment.dueDate || null,
              assignment.notes || null,
              JSON.stringify(assignment.metadata || {})
            ]
          );
          results.successful++;
          results.assignmentIds.push(assignmentId);
        } catch (error) {
          results.failed++;
          results.errors.push({
            index: assignments.indexOf(assignment),
            error: error.message,
            data: assignment
          });
        }
      }
    });
  } catch (error) {
    bulkLogger.error('Bulk assignment transaction failed', error);
    throw error;
  }

  bulkLogger.info('Bulk assignments created', {
    accountId,
    total: results.total,
    successful: results.successful,
    failed: results.failed
  });

  return results;
};

module.exports = {
  bulkRecordInteractions,
  bulkUpdatePollTurnout,
  bulkCreateAssignments
};
