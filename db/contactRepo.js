/**
 * Contact repository – PostgreSQL-backed storage for contacts (replaces contacts.json).
 * All queries are parameterized. Uses jsonb for categories, notes, communication_preferences.
 */

const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('./connection');
const { createLogger } = require('../lib');

const log = createLogger('CONTACT_REPO');

/**
 * Map DB row to app-style contact object (camelCase, notes array, communicationPreferences).
 */
function rowToContact(row) {
  if (!row) return null;
  const cf = row.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {};
  const categories = Array.isArray(row.categories) ? row.categories : (row.categories ? [].concat(row.categories) : []);
  return {
    ...cf,
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    city: row.city ?? '',
    province: row.province ?? '',
    postalCode: row.postal_code ?? '',
    pollNumber: row.poll_number ?? '',
    riding: row.riding ?? '',
    role: row.role ?? '',
    categories,
    notes: cf.notes ?? [],
    communicationPreferences: cf.communicationPreferences ?? null,
    createdBy: cf.createdBy ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (cf.createdAt ?? null),
  };
}

/**
 * Contact payload to DB row (for insert/update).
 */
function contactToRow(accountId, c) {
  const customFields = {};
  if (c.notes != null) customFields.notes = Array.isArray(c.notes) ? c.notes : [];
  if (c.communicationPreferences != null) customFields.communicationPreferences = c.communicationPreferences;
  if (c.createdBy != null) customFields.createdBy = c.createdBy;
  if (c.createdAt != null) customFields.createdAt = c.createdAt;
  return {
    id: String(c.id),
    account_id: String(accountId),
    first_name: c.firstName ?? c.first_name ?? null,
    last_name: c.lastName ?? c.last_name ?? null,
    name: c.name ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    province: c.province ?? null,
    postal_code: c.postalCode ?? c.postal_code ?? null,
    poll_number: c.pollNumber ?? c.poll_number ?? null,
    riding: c.riding ?? null,
    role: c.role ?? null,
    categories: Array.isArray(c.categories) ? c.categories : (c.category != null ? [c.category] : []),
    custom_fields: customFields,
  };
}

/**
 * Get all contacts for an account (non-deleted). Same shape as contacts.json array.
 * @param {string} accountId
 * @returns {Promise<Array<Object>>}
 */
async function getContacts(accountId) {
  const res = await query(
    `SELECT id, account_id, first_name, last_name, name, email, phone, address, city, province, postal_code, poll_number, riding, role, categories, custom_fields, created_at
     FROM contacts WHERE account_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
    [String(accountId)]
  );
  return res.rows.map(rowToContact);
}

/**
 * Get one contact by id (scoped by account_id).
 * @param {string} accountId
 * @param {string} contactId
 * @returns {Promise<Object|null>}
 */
async function getContactById(accountId, contactId) {
  const res = await query(
    `SELECT id, account_id, first_name, last_name, name, email, phone, address, city, province, postal_code, poll_number, riding, role, categories, custom_fields, created_at
     FROM contacts WHERE account_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [String(accountId), String(contactId)]
  );
  return res.rows[0] ? rowToContact(res.rows[0]) : null;
}

/**
 * Create a single contact.
 * @param {string} accountId
 * @param {Object} data - contact object (id will be generated if missing)
 * @returns {Promise<Object>}
 */
async function createContact(accountId, data) {
  const id = data.id || uuidv4();
  const contact = { ...data, id };
  const r = contactToRow(accountId, contact);
  await query(
    `INSERT INTO contacts (id, account_id, first_name, last_name, name, email, phone, address, city, province, postal_code, poll_number, riding, role, categories, custom_fields)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)`,
    [
      r.id,
      r.account_id,
      r.first_name,
      r.last_name,
      r.name,
      r.email,
      r.phone,
      r.address,
      r.city,
      r.province,
      r.postal_code,
      r.poll_number,
      r.riding,
      r.role,
      JSON.stringify(r.categories),
      JSON.stringify(r.custom_fields),
    ]
  );
  return getContactById(accountId, r.id);
}

/**
 * Replace all contacts for an account with the given array (sync). Used for updateAccountContacts.
 * Preserves contact ids; inserts new rows, updates existing, removes rows not in the list.
 * @param {string} accountId
 * @param {Array<Object>} contacts - full array of contact objects
 * @returns {Promise<void>}
 */
async function updateAccountContacts(accountId, contacts) {
  if (!Array.isArray(contacts)) {
    log.warn('updateAccountContacts called with non-array');
    return;
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const existingIds = await client.query(
      `SELECT id FROM contacts WHERE account_id = $1 AND deleted_at IS NULL`,
      [String(accountId)]
    );
    const existingSet = new Set(existingIds.rows.map((r) => r.id));
    const incomingIds = new Set(contacts.map((c) => String(c.id)));

    for (const c of contacts) {
      const id = String(c.id);
      const r = contactToRow(accountId, c);
      await client.query(
        `INSERT INTO contacts (id, account_id, first_name, last_name, name, email, phone, address, city, province, postal_code, poll_number, riding, role, categories, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)
         ON CONFLICT (account_id, id) DO UPDATE SET
           account_id = EXCLUDED.account_id,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           city = EXCLUDED.city,
           province = EXCLUDED.province,
           postal_code = EXCLUDED.postal_code,
           poll_number = EXCLUDED.poll_number,
           riding = EXCLUDED.riding,
           role = EXCLUDED.role,
           categories = EXCLUDED.categories,
           custom_fields = EXCLUDED.custom_fields,
           updated_at = CURRENT_TIMESTAMP,
           deleted_at = NULL`,
        [
          r.id,
          r.account_id,
          r.first_name,
          r.last_name,
          r.name,
          r.email,
          r.phone,
          r.address,
          r.city,
          r.province,
          r.postal_code,
          r.poll_number,
          r.riding,
          r.role,
          JSON.stringify(r.categories),
          JSON.stringify(r.custom_fields),
        ]
      );
    }
    for (const id of existingSet) {
      if (!incomingIds.has(id)) {
        await client.query(`UPDATE contacts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND account_id = $2`, [id, String(accountId)]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateAccountContacts,
};
