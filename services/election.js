/**
 * Election Service
 * 
 * Phase 3: Election Mode Foundation
 * Handles election-specific operations with append-only and immutable audit requirements.
 */

const { query } = require('../db/connection');
const { logger, createLogger } = require('../lib');

const electionLogger = createLogger('ELECTION_SERVICE');

/**
 * Record a voter interaction (append-only)
 * @deprecated Use voterInteractionsService.recordInteraction instead
 * @param {Object} interactionData - Interaction data
 * @returns {Promise<Object>} Created interaction
 */
const recordInteraction = async (interactionData) => {
  // Delegate to voter interactions service for consistency
  const voterInteractionsService = require('./voter-interactions');
  return await voterInteractionsService.recordInteraction(interactionData);
};

/**
 * Get interactions for a contact
 * @param {string} accountId - Account ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<Array>} Array of interactions
 */
const getContactInteractions = async (accountId, contactId) => {
  const result = await query(
    `SELECT * FROM election_interactions 
     WHERE account_id = $1 AND contact_id = $2 
     ORDER BY created_at DESC`,
    [accountId, contactId]
  );
  return result.rows;
};

/**
 * Mark a vote (immutable audit)
 * @deprecated Use scrutineeringService.markVote instead
 * @param {Object} voteMarkData - Vote mark data
 * @returns {Promise<Object>} Created vote mark
 */
const markVote = async (voteMarkData) => {
  // Delegate to scrutineering service for consistency
  const scrutineeringService = require('./scrutineering');
  return await scrutineeringService.markVote(voteMarkData);
};

/**
 * Update poll turnout count
 * @param {string} accountId - Account ID
 * @param {string} pollNumber - Poll number
 * @param {string} riding - Riding
 * @param {string} province - Province
 * @param {string} updatedBy - User ID who updated
 * @returns {Promise<Object>} Updated turnout record
 */
const updatePollTurnout = async (accountId, pollNumber, riding, province, updatedBy) => {
  // Get current count
  const currentResult = await query(
    `SELECT votes_cast FROM election_poll_turnout 
     WHERE account_id = $1 AND poll_number = $2 AND riding = $3 AND province = $4`,
    [accountId, pollNumber, riding, province]
  );

  const currentVotes = currentResult.rows[0]?.votes_cast || 0;
  const newVotes = currentVotes + 1;

  const result = await query(
    `INSERT INTO election_poll_turnout 
     (account_id, poll_number, riding, province, votes_cast, updated_by, last_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (account_id, poll_number, riding, province)
     DO UPDATE SET 
       votes_cast = EXCLUDED.votes_cast,
       updated_by = EXCLUDED.updated_by,
       last_updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [accountId, pollNumber, riding, province, newVotes, updatedBy]
  );

  return result.rows[0];
};

/**
 * Get poll turnout
 * @param {string} accountId - Account ID
 * @param {string} pollNumber - Poll number (optional)
 * @param {string} riding - Riding (optional)
 * @returns {Promise<Array>} Turnout records
 */
const getPollTurnout = async (accountId, pollNumber = null, riding = null) => {
  let sql = 'SELECT * FROM election_poll_turnout WHERE account_id = $1';
  const params = [accountId];

  if (pollNumber) {
    sql += ' AND poll_number = $2';
    params.push(pollNumber);
  }
  if (riding) {
    sql += ` AND riding = $${params.length + 1}`;
    params.push(riding);
  }

  sql += ' ORDER BY poll_number, riding';

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Create or update an election list
 * @deprecated Use electionListsService.saveList instead
 * @param {Object} listData - List data
 * @returns {Promise<Object>} Created/updated list
 */
const saveElectionList = async (listData) => {
  const electionListsService = require('./election-lists');
  return await electionListsService.saveList(listData);
};

/**
 * Get election lists for an account
 * @deprecated Use electionListsService.getLists instead
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID (optional, for filtering)
 * @returns {Promise<Array>} Array of lists
 */
const getElectionLists = async (accountId, userId = null) => {
  const electionListsService = require('./election-lists');
  return await electionListsService.getLists(accountId, userId);
};

/**
 * Create a canvass assignment
 * @deprecated Use canvassingService.createAssignment instead
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise<Object>} Created assignment
 */
const createCanvassAssignment = async (assignmentData) => {
  const canvassingService = require('./canvassing');
  return await canvassingService.createAssignment(assignmentData);
};

/**
 * Record a canvass event
 * @deprecated Use canvassingService.recordEvent instead
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
const recordCanvassEvent = async (eventData) => {
  const canvassingService = require('./canvassing');
  return await canvassingService.recordEvent(eventData);
};

module.exports = {
  recordInteraction,
  getContactInteractions,
  markVote,
  updatePollTurnout,
  getPollTurnout,
  saveElectionList,
  getElectionLists,
  createCanvassAssignment,
  recordCanvassEvent
};
