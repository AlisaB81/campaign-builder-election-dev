/**
 * Admin Dashboard Service
 * 
 * Provides overview statistics and analytics for election operations.
 */

const { query } = require('../db/connection');
const { logger, createLogger } = require('../lib');

const dashboardLogger = createLogger('ADMIN_DASHBOARD');

/**
 * Get comprehensive election dashboard data
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Dashboard data
 */
const getDashboardData = async (accountId, filters = {}) => {
  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = filters.endDate || new Date().toISOString();

  // Get vote marks summary
  const voteMarksResult = await query(
    `SELECT 
       COUNT(*) as total_vote_marks,
       COUNT(DISTINCT poll_number) as unique_polls,
       COUNT(DISTINCT riding) as unique_ridings,
       MAX(marked_at) as last_vote_marked
     FROM election_vote_marks
     WHERE account_id = $1
     AND marked_at >= $2 AND marked_at <= $3`,
    [accountId, startDate, endDate]
  );

  // Get interactions summary
  const interactionsResult = await query(
    `SELECT 
       COUNT(*) as total_interactions,
       COUNT(DISTINCT contact_id) as unique_contacts,
       COUNT(DISTINCT user_id) as active_users,
       AVG(support_likelihood)::INTEGER as avg_support_score,
       MAX(created_at) as last_interaction
     FROM election_interactions
     WHERE account_id = $1
     AND created_at >= $2 AND created_at <= $3`,
    [accountId, startDate, endDate]
  );

  // Get poll turnout summary
  const turnoutResult = await query(
    `SELECT 
       COUNT(*) as total_polls,
       SUM(total_voters) as total_voters,
       SUM(votes_cast) as total_votes_cast,
       CASE 
         WHEN SUM(total_voters) > 0 
         THEN ROUND((SUM(votes_cast)::DECIMAL / SUM(total_voters)) * 100, 2)
         ELSE 0
       END as overall_turnout
     FROM election_poll_turnout
     WHERE account_id = $1`,
    [accountId]
  );

  // Get canvassing summary
  const canvassingResult = await query(
    `SELECT 
       COUNT(*) as total_assignments,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_assignments,
       COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_assignments,
       COUNT(CASE WHEN due_date < CURRENT_TIMESTAMP AND status != 'completed' THEN 1 END) as overdue_assignments
     FROM canvass_assignments
     WHERE account_id = $1`,
    [accountId]
  );

  // Get canvass events count
  const eventsResult = await query(
    `SELECT COUNT(*) as total_events
     FROM canvass_events
     WHERE account_id = $1
     AND created_at >= $2 AND created_at <= $3`,
    [accountId, startDate, endDate]
  );

  // Get support score distribution
  const supportDistributionResult = await query(
    `SELECT 
       CASE
         WHEN AVG(ei.support_likelihood) >= 80 THEN 'strong_support'
         WHEN AVG(ei.support_likelihood) >= 60 THEN 'likely_support'
         WHEN AVG(ei.support_likelihood) >= 40 THEN 'undecided'
         WHEN AVG(ei.support_likelihood) >= 20 THEN 'likely_oppose'
         ELSE 'strong_oppose'
       END as category,
       COUNT(DISTINCT ei.contact_id) as contact_count
     FROM election_interactions ei
     WHERE ei.account_id = $1
     AND ei.support_likelihood IS NOT NULL
     AND ei.created_at >= $2 AND ei.created_at <= $3
     GROUP BY category`,
    [accountId, startDate, endDate]
  );

  // Get interaction type breakdown
  const interactionTypeResult = await query(
    `SELECT 
       interaction_type,
       interaction_method,
       COUNT(*) as count
     FROM election_interactions
     WHERE account_id = $1
     AND created_at >= $2 AND created_at <= $3
     GROUP BY interaction_type, interaction_method
     ORDER BY count DESC`,
    [accountId, startDate, endDate]
  );

  // Get daily activity (last 7 days)
  const dailyActivityResult = await query(
    `SELECT 
       DATE(created_at) as date,
       COUNT(*) as interaction_count
     FROM election_interactions
     WHERE account_id = $1
     AND created_at >= $2 AND created_at <= $3
     GROUP BY DATE(created_at)
     ORDER BY date DESC
     LIMIT 7`,
    [accountId, startDate, endDate]
  );

  // Get top performing polls
  const topPollsResult = await query(
    `SELECT 
       poll_number,
       riding,
       province,
       votes_cast,
       total_voters,
       CASE 
         WHEN total_voters > 0 
         THEN ROUND((votes_cast::DECIMAL / total_voters) * 100, 2)
         ELSE 0
       END as turnout_percentage
     FROM election_poll_turnout
     WHERE account_id = $1
     ORDER BY votes_cast DESC
     LIMIT 10`,
    [accountId]
  );

  return {
    summary: {
      voteMarks: {
        total: parseInt(voteMarksResult.rows[0]?.total_vote_marks || 0),
        uniquePolls: parseInt(voteMarksResult.rows[0]?.unique_polls || 0),
        uniqueRidings: parseInt(voteMarksResult.rows[0]?.unique_ridings || 0),
        lastMarked: voteMarksResult.rows[0]?.last_vote_marked
      },
      interactions: {
        total: parseInt(interactionsResult.rows[0]?.total_interactions || 0),
        uniqueContacts: parseInt(interactionsResult.rows[0]?.unique_contacts || 0),
        activeUsers: parseInt(interactionsResult.rows[0]?.active_users || 0),
        avgSupportScore: interactionsResult.rows[0]?.avg_support_score || null,
        lastInteraction: interactionsResult.rows[0]?.last_interaction
      },
      turnout: {
        totalPolls: parseInt(turnoutResult.rows[0]?.total_polls || 0),
        totalVoters: parseInt(turnoutResult.rows[0]?.total_voters || 0),
        totalVotesCast: parseInt(turnoutResult.rows[0]?.total_votes_cast || 0),
        overallTurnout: parseFloat(turnoutResult.rows[0]?.overall_turnout || 0)
      },
      canvassing: {
        totalAssignments: parseInt(canvassingResult.rows[0]?.total_assignments || 0),
        completed: parseInt(canvassingResult.rows[0]?.completed_assignments || 0),
        inProgress: parseInt(canvassingResult.rows[0]?.in_progress_assignments || 0),
        overdue: parseInt(canvassingResult.rows[0]?.overdue_assignments || 0),
        totalEvents: parseInt(eventsResult.rows[0]?.total_events || 0)
      }
    },
    supportDistribution: supportDistributionResult.rows.map(row => ({
      category: row.category,
      contactCount: parseInt(row.contact_count)
    })),
    interactionBreakdown: interactionTypeResult.rows.map(row => ({
      interactionType: row.interaction_type,
      interactionMethod: row.interaction_method,
      count: parseInt(row.count)
    })),
    dailyActivity: dailyActivityResult.rows.map(row => ({
      date: row.date,
      interactionCount: parseInt(row.interaction_count)
    })),
    topPolls: topPollsResult.rows.map(row => ({
      pollNumber: row.poll_number,
      riding: row.riding,
      province: row.province,
      votesCast: parseInt(row.votes_cast || 0),
      totalVoters: parseInt(row.total_voters || 0),
      turnoutPercentage: parseFloat(row.turnout_percentage || 0)
    })),
    dateRange: {
      startDate,
      endDate
    }
  };
};

module.exports = {
  getDashboardData
};
