/**
 * Scrutineering "Voted" tracking table
 *
 * Stores which contacts have been marked as voted for running tally and projected outcomes.
 * Separate from contact manager and from immutable election_vote_marks.
 * Cleared manually (e.g. before next election) via "Clear voted data" action.
 */

const { query } = require('../connection');
const { createLogger } = require('../../lib');

const migrationLogger = createLogger('MIGRATION_003');

const name = '003_scrutineering_voted';

const up = async () => {
  migrationLogger.info('Creating election_scrutineering_voted table...');

  await query(`
    CREATE TABLE IF NOT EXISTS election_scrutineering_voted (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL,
      contact_id VARCHAR(255) NOT NULL,
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      marked_by VARCHAR(255),
      UNIQUE(account_id, contact_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_election_scrutineering_voted_account_id
    ON election_scrutineering_voted(account_id);
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_election_scrutineering_voted_contact_id
    ON election_scrutineering_voted(contact_id);
  `);

  migrationLogger.info('election_scrutineering_voted table created');
};

const down = async () => {
  migrationLogger.info('Dropping election_scrutineering_voted table...');
  await query('DROP TABLE IF EXISTS election_scrutineering_voted CASCADE;');
  migrationLogger.info('election_scrutineering_voted table dropped');
};

module.exports = {
  name,
  up,
  down
};
