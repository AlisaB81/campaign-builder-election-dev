/**
 * Database Adapters
 * 
 * Phase 2: PostgreSQL Foundation
 * Provides abstraction layer for switching between JSON and PostgreSQL backends.
 */

const { env: config } = require('../config');
const { logger, createLogger } = require('../lib');
const { query } = require('./connection');

const dbLogger = createLogger('DB_ADAPTER');

/**
 * Get the current data backend
 * @returns {string} 'json' or 'pg'
 */
const getBackend = () => {
  return config.DATA_BACKEND || 'json';
};

/**
 * Check if PostgreSQL backend is enabled
 * @returns {boolean}
 */
const isPostgresEnabled = () => {
  return getBackend() === 'pg';
};

/** Set when pool + migrations are ready; prevents requests hanging if DB isn't connected yet */
let pgReady = false;
const setPgReady = (value) => { pgReady = !!value; };

/** Use Postgres only when env is set AND pool/migrations are ready (avoids hang on first request) */
const isPostgresReady = () =>
  process.env.DATA_BACKEND === 'pg' && !!process.env.DATABASE_URL && pgReady;

/**
 * Check if dual write mode is enabled
 * @returns {boolean}
 */
const isDualWriteEnabled = () => {
  return config.DUAL_WRITE === true;
};

/**
 * Database adapter interface
 * All adapters must implement these methods
 */
class DatabaseAdapter {
  // Account operations
  async createAccount(accountData) { throw new Error('Not implemented'); }
  async getAccount(accountId) { throw new Error('Not implemented'); }
  async updateAccount(accountId, updates) { throw new Error('Not implemented'); }
  
  // User operations
  async createUser(userData) { throw new Error('Not implemented'); }
  async getUser(userId) { throw new Error('Not implemented'); }
  async getUserByEmail(email) { throw new Error('Not implemented'); }
  async updateUser(userId, updates) { throw new Error('Not implemented'); }
  async getAllUserIds() { throw new Error('Not implemented'); }
  
  // Contact operations
  async createContact(contactData) { throw new Error('Not implemented'); }
  async getContact(contactId) { throw new Error('Not implemented'); }
  async getContactsByAccount(accountId, filters) { throw new Error('Not implemented'); }
  async updateContact(contactId, updates) { throw new Error('Not implemented'); }
  async deleteContact(contactId) { throw new Error('Not implemented'); }
  
  // Template operations
  async createTemplate(templateData) { throw new Error('Not implemented'); }
  async getTemplate(templateId) { throw new Error('Not implemented'); }
  async getTemplatesByAccount(accountId) { throw new Error('Not implemented'); }
  async updateTemplate(templateId, updates) { throw new Error('Not implemented'); }
  async deleteTemplate(templateId) { throw new Error('Not implemented'); }
  
  // Campaign operations
  async createCampaign(campaignData) { throw new Error('Not implemented'); }
  async getCampaign(campaignId) { throw new Error('Not implemented'); }
  async getCampaignsByAccount(accountId) { throw new Error('Not implemented'); }
  async updateCampaign(campaignId, updates) { throw new Error('Not implemented'); }
  
  // Message operations
  async createMessage(messageData) { throw new Error('Not implemented'); }
  async getMessage(messageId) { throw new Error('Not implemented'); }
  async getMessagesByCampaign(campaignId) { throw new Error('Not implemented'); }
  async updateMessage(messageId, updates) { throw new Error('Not implemented'); }
}

/**
 * PostgreSQL adapter implementation
 */
class PostgresAdapter extends DatabaseAdapter {
  // Account operations
  async createAccount(accountData) {
    const result = await query(
      `INSERT INTO accounts (id, account_type, account_status, election_mode, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [accountData.id, accountData.accountType || 'reg_client', accountData.accountStatus || 'active', accountData.electionMode || false]
    );
    return result.rows[0];
  }

  async getAccount(accountId) {
    const result = await query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    return result.rows[0] || null;
  }

  async updateAccount(accountId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    });

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(accountId);

    const result = await query(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  // User operations
  async createUser(userData) {
    const result = await query(
      `INSERT INTO users (id, account_id, email, password_hash, user_type, account_type, 
                          subscription_status, is_verified, nda_accepted, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        userData.id,
        userData.accountId,
        userData.email,
        userData.passwordHash || userData.password,
        userData.userType || 'user',
        userData.accountType,
        userData.subscriptionStatus,
        userData.isVerified || false,
        userData.ndaAccepted || false
      ]
    );
    return result.rows[0];
  }

  async getUser(userId) {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  async updateUser(userId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      // Map camelCase to snake_case for database
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    });

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async getAllUserIds() {
    const result = await query('SELECT id FROM users');
    return result.rows.map(row => row.id);
  }

  // Contact operations (stub - full implementation needed)
  async createContact(contactData) {
    dbLogger.warn('PostgresAdapter.createContact not fully implemented');
    // TODO: Implement full contact creation
    return contactData;
  }

  async getContact(contactId) {
    const result = await query('SELECT * FROM contacts WHERE id = $1 AND deleted_at IS NULL', [contactId]);
    return result.rows[0] || null;
  }

  async getContactsByAccount(accountId, filters = {}) {
    let sql = 'SELECT * FROM contacts WHERE account_id = $1 AND deleted_at IS NULL';
    const params = [accountId];
    
    if (filters.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }
    
    const result = await query(sql, params);
    return result.rows;
  }

  async updateContact(contactId, updates) {
    // TODO: Implement full contact update
    return null;
  }

  async deleteContact(contactId) {
    await query('UPDATE contacts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [contactId]);
    return true;
  }

  // Template, Campaign, Message operations (stubs - full implementation needed)
  async createTemplate(templateData) { return templateData; }
  async getTemplate(templateId) {
    const result = await query('SELECT * FROM templates WHERE id = $1 AND deleted_at IS NULL', [templateId]);
    return result.rows[0] || null;
  }
  async getTemplatesByAccount(accountId) {
    const result = await query('SELECT * FROM templates WHERE account_id = $1 AND deleted_at IS NULL', [accountId]);
    return result.rows;
  }
  async updateTemplate(templateId, updates) { return null; }
  async deleteTemplate(templateId) {
    await query('UPDATE templates SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [templateId]);
    return true;
  }

  async createCampaign(campaignData) { return campaignData; }
  async getCampaign(campaignId) {
    const result = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    return result.rows[0] || null;
  }
  async getCampaignsByAccount(accountId) {
    const result = await query('SELECT * FROM campaigns WHERE account_id = $1', [accountId]);
    return result.rows;
  }
  async updateCampaign(campaignId, updates) { return null; }

  async createMessage(messageData) { return messageData; }
  async getMessage(messageId) {
    const result = await query('SELECT * FROM messages WHERE id = $1', [messageId]);
    return result.rows[0] || null;
  }
  async getMessagesByCampaign(campaignId) {
    const result = await query('SELECT * FROM messages WHERE campaign_id = $1', [campaignId]);
    return result.rows;
  }
  async updateMessage(messageId, updates) { return null; }
}

/**
 * JSON adapter (stub - uses existing file-based system)
 * This is a placeholder that indicates JSON backend is still the default
 */
class JsonAdapter extends DatabaseAdapter {
  // All methods return null/empty to indicate JSON backend is used
  // The existing file-based functions in server.js handle JSON operations
}

/**
 * Get the appropriate database adapter
 * @returns {DatabaseAdapter} Database adapter instance
 */
const getAdapter = () => {
  const backend = getBackend();
  
  if (backend === 'pg') {
    return new PostgresAdapter();
  } else {
    return new JsonAdapter(); // JSON backend uses existing file system
  }
};

module.exports = {
  DatabaseAdapter,
  PostgresAdapter,
  JsonAdapter,
  getAdapter,
  getBackend,
  isPostgresEnabled,
  isPostgresReady,
  setPgReady,
  isDualWriteEnabled
};
