/**
 * Campaign repository – PostgreSQL-backed storage for campaigns (replaces campaigns.json).
 * All queries are parameterized. Uses jsonb for flexible campaign payload.
 */

const { query } = require('./connection');
const { createLogger } = require('../lib');

const log = createLogger('CAMPAIGN_REPO');

/**
 * Map DB row to app-style campaign object (id, name, ...metadata).
 */
function rowToCampaign(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    ...meta,
    id: row.id,
    account_id: row.account_id,
    name: row.name != null ? row.name : meta.name || '',
  };
}

/**
 * Get all campaigns for an account (same shape as reading campaigns.json array).
 * @param {string} accountId
 * @returns {Promise<Array<Object>>}
 */
async function getCampaigns(accountId) {
  const res = await query(
    `SELECT id, account_id, name, metadata FROM campaigns WHERE account_id = $1 ORDER BY created_at ASC`,
    [String(accountId)]
  );
  return res.rows.map(rowToCampaign);
}

/**
 * Get a single campaign by id (scoped by account_id).
 * @param {string} accountId
 * @param {string} campaignId
 * @returns {Promise<Object|null>}
 */
async function getCampaignById(accountId, campaignId) {
  const res = await query(
    `SELECT id, account_id, name, metadata FROM campaigns WHERE account_id = $1 AND id = $2`,
    [String(accountId), String(campaignId)]
  );
  return res.rows[0] ? rowToCampaign(res.rows[0]) : null;
}

/**
 * Create a campaign. Stores id, account_id, name in columns; rest in metadata jsonb.
 * @param {string} accountId
 * @param {Object} data - campaign object (must include id and name for compatibility)
 * @returns {Promise<Object>} created campaign in app shape
 */
async function createCampaign(accountId, data) {
  const id = data.id || String(Date.now());
  const name = data.name != null ? String(data.name) : '';
  const { id: _id, account_id: _aid, name: _n, ...rest } = data;
  const metadata = { ...rest };

  await query(
    `INSERT INTO campaigns (id, account_id, name, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
    [id, String(accountId), name, JSON.stringify(metadata)]
  );
  return getCampaignById(accountId, id);
}

/**
 * Update a campaign by id (scoped by account_id). Merges into metadata; id/account_id/name can be updated explicitly.
 * @param {string} accountId
 * @param {string} campaignId
 * @param {Object} updates - partial campaign object
 * @returns {Promise<Object|null>}
 */
async function updateCampaign(accountId, campaignId, updates) {
  const existing = await getCampaignById(accountId, campaignId);
  if (!existing) return null;

  const name = updates.name != null ? String(updates.name) : existing.name;
  const metadata = { ...existing, ...updates };
  delete metadata.id;
  delete metadata.account_id;
  delete metadata.name;

  await query(
    `UPDATE campaigns SET name = $1, metadata = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE account_id = $3 AND id = $4`,
    [name, JSON.stringify(metadata), String(accountId), String(campaignId)]
  );
  return getCampaignById(accountId, campaignId);
}

/**
 * Delete a campaign by id (scoped by account_id).
 * @param {string} accountId
 * @param {string} campaignId
 * @returns {Promise<boolean>}
 */
async function deleteCampaign(accountId, campaignId) {
  const res = await query(`DELETE FROM campaigns WHERE account_id = $1 AND id = $2`, [String(accountId), String(campaignId)]);
  return (res.rowCount || 0) > 0;
}

module.exports = {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
};
