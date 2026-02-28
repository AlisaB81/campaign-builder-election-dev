/**
 * Export Service
 * 
 * Handles exporting election data to various formats (CSV, JSON, Excel).
 */

const { query } = require('../db/connection');
const { logger, createLogger } = require('../lib');
// Simple date formatter (avoiding external dependency)
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const exportLogger = createLogger('EXPORT');

/**
 * Export vote marks to CSV
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<string>} CSV string
 */
const exportVoteMarksToCSV = async (accountId, filters = {}) => {
  let sql = `SELECT 
             vm.verification_code,
             vm.poll_number,
             vm.riding,
             vm.province,
             vm.marked_at,
             u.email as marked_by_email,
             c.first_name,
             c.last_name,
             c.name as contact_name,
             c.email as contact_email,
             c.phone as contact_phone,
             vm.notes
             FROM election_vote_marks vm
             LEFT JOIN users u ON vm.marked_by = u.id
             LEFT JOIN contacts c ON vm.contact_id = c.id
             WHERE vm.account_id = $1`;
  const params = [accountId];

  if (filters.pollNumber) {
    sql += ` AND vm.poll_number = $${params.length + 1}`;
    params.push(filters.pollNumber);
  }
  if (filters.riding) {
    sql += ` AND vm.riding = $${params.length + 1}`;
    params.push(filters.riding);
  }
  if (filters.province) {
    sql += ` AND vm.province = $${params.length + 1}`;
    params.push(filters.province);
  }
  if (filters.startDate) {
    sql += ` AND vm.marked_at >= $${params.length + 1}`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ` AND vm.marked_at <= $${params.length + 1}`;
    params.push(filters.endDate);
  }

  sql += ' ORDER BY vm.marked_at DESC';

  const result = await query(sql, params);

  // Build CSV
  const headers = [
    'Verification Code',
    'Poll Number',
    'Riding',
    'Province',
    'Marked At',
    'Marked By',
    'Contact Name',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Notes'
  ];

  const rows = result.rows.map(row => [
    row.verification_code || '',
    row.poll_number || '',
    row.riding || '',
    row.province || '',
    row.marked_at ? formatDate(row.marked_at) : '',
    row.marked_by_email || '',
    row.contact_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '',
    row.first_name || '',
    row.last_name || '',
    row.contact_email || '',
    row.contact_phone || '',
    (row.notes || '').replace(/"/g, '""') // Escape quotes
  ]);

  // Escape CSV values
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ];

  return csvRows.join('\n');
};

/**
 * Export interactions to CSV
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<string>} CSV string
 */
const exportInteractionsToCSV = async (accountId, filters = {}) => {
  let sql = `SELECT 
             ei.interaction_type,
             ei.interaction_method,
             ei.support_likelihood,
             ei.created_at,
             u.email as created_by_email,
             c.first_name,
             c.last_name,
             c.name as contact_name,
             c.email as contact_email,
             c.phone as contact_phone,
             ei.notes
             FROM election_interactions ei
             LEFT JOIN users u ON ei.created_by = u.id
             LEFT JOIN contacts c ON ei.contact_id = c.id
             WHERE ei.account_id = $1`;
  const params = [accountId];

  if (filters.contactId) {
    sql += ` AND ei.contact_id = $${params.length + 1}`;
    params.push(filters.contactId);
  }
  if (filters.interactionType) {
    sql += ` AND ei.interaction_type = $${params.length + 1}`;
    params.push(filters.interactionType);
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

  const result = await query(sql, params);

  const headers = [
    'Interaction Type',
    'Interaction Method',
    'Support Likelihood',
    'Date',
    'Created By',
    'Contact Name',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Notes'
  ];

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = result.rows.map(row => [
    row.interaction_type || '',
    row.interaction_method || '',
    row.support_likelihood || '',
    row.created_at ? formatDate(row.created_at) : '',
    row.created_by_email || '',
    row.contact_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '',
    row.first_name || '',
    row.last_name || '',
    row.contact_email || '',
    row.contact_phone || '',
    (row.notes || '').replace(/"/g, '""')
  ]);

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ];

  return csvRows.join('\n');
};

/**
 * Export poll turnout to CSV
 * @param {string} accountId - Account ID
 * @param {Object} filters - Filter options
 * @returns {Promise<string>} CSV string
 */
const exportPollTurnoutToCSV = async (accountId, filters = {}) => {
  let sql = `SELECT 
             poll_number,
             riding,
             province,
             total_voters,
             votes_cast,
             CASE 
               WHEN total_voters > 0 
               THEN ROUND((votes_cast::DECIMAL / total_voters) * 100, 2)
               ELSE 0
             END as turnout_percentage,
             last_updated_at,
             u.email as updated_by_email
             FROM election_poll_turnout pt
             LEFT JOIN users u ON pt.updated_by = u.id
             WHERE pt.account_id = $1`;
  const params = [accountId];

  if (filters.riding) {
    sql += ` AND pt.riding = $${params.length + 1}`;
    params.push(filters.riding);
  }
  if (filters.province) {
    sql += ` AND pt.province = $${params.length + 1}`;
    params.push(filters.province);
  }

  sql += ' ORDER BY pt.poll_number, pt.riding';

  const result = await query(sql, params);

  const headers = [
    'Poll Number',
    'Riding',
    'Province',
    'Total Voters',
    'Votes Cast',
    'Turnout Percentage',
    'Last Updated',
    'Updated By'
  ];

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = result.rows.map(row => [
    row.poll_number || '',
    row.riding || '',
    row.province || '',
    row.total_voters || 0,
    row.votes_cast || 0,
    row.turnout_percentage || '0.00',
    row.last_updated_at ? formatDate(row.last_updated_at) : '',
    row.updated_by_email || ''
  ]);

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ];

  return csvRows.join('\n');
};

module.exports = {
  exportVoteMarksToCSV,
  exportInteractionsToCSV,
  exportPollTurnoutToCSV
};
