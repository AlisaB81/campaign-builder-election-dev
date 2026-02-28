/**
 * Add unique (account_id, id) for ON CONFLICT (account_id, id) in campaign and contact repos.
 */

const { query } = require('../connection');
const { createLogger } = require('../../lib');

const migrationLogger = createLogger('MIGRATION_004');

const name = '004_unique_account_id_id';

const up = async () => {
  migrationLogger.info('Adding unique (account_id, id) constraints...');
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS campaigns_account_id_id_key ON campaigns (account_id, id);
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS contacts_account_id_id_key ON contacts (account_id, id);
  `);
  migrationLogger.info('Unique constraints added');
};

const down = async () => {
  await query(`DROP INDEX IF EXISTS campaigns_account_id_id_key;`);
  await query(`DROP INDEX IF EXISTS contacts_account_id_id_key;`);
};

module.exports = { name, up, down };
