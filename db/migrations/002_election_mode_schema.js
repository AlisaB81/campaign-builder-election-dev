/**
 * Election Mode Schema Migration
 * 
 * Phase 3: Election Mode Foundation
 * Creates all election-specific tables with append-only and immutable audit requirements.
 */

const { query } = require('../connection');
const { logger, createLogger } = require('../../lib');

const migrationLogger = createLogger('MIGRATION_002');

const name = '002_election_mode_schema';

/**
 * Run the migration (create election tables)
 */
const up = async () => {
  migrationLogger.info('Creating election mode database schema...');

  // Election interactions table (append-only)
  // Tracks all voter interactions - no updates or deletes allowed
  await query(`
    CREATE TABLE IF NOT EXISTS election_interactions (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      contact_id VARCHAR(255) REFERENCES contacts(id) ON DELETE SET NULL,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      interaction_type VARCHAR(50) NOT NULL,
      interaction_method VARCHAR(50) NOT NULL,
      support_likelihood INTEGER CHECK (support_likelihood >= 0 AND support_likelihood <= 100),
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL
    );
    
    -- Prevent updates and deletes (append-only enforcement)
    CREATE OR REPLACE FUNCTION prevent_election_interactions_update_delete()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'election_interactions is append-only - updates and deletes are not allowed';
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER election_interactions_no_update
      BEFORE UPDATE ON election_interactions
      FOR EACH ROW
      EXECUTE FUNCTION prevent_election_interactions_update_delete();
    
    CREATE TRIGGER election_interactions_no_delete
      BEFORE DELETE ON election_interactions
      FOR EACH ROW
      EXECUTE FUNCTION prevent_election_interactions_update_delete();
  `);

  // Election lists / saved views table
  // Stores dynamic filter configurations for voter lists
  await query(`
    CREATE TABLE IF NOT EXISTS election_lists (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      filter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      contact_count INTEGER DEFAULT 0,
      is_shared BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `);

  // Election poll turnout table
  // Tracks voter turnout by poll
  await query(`
    CREATE TABLE IF NOT EXISTS election_poll_turnout (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      poll_number VARCHAR(50) NOT NULL,
      riding VARCHAR(255),
      province VARCHAR(50),
      total_voters INTEGER DEFAULT 0,
      votes_cast INTEGER DEFAULT 0,
      last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(account_id, poll_number, riding, province)
    );
  `);

  // Election vote marks table (immutable audit)
  // Records vote marking events - completely immutable, no updates or deletes
  await query(`
    CREATE TABLE IF NOT EXISTS election_vote_marks (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      contact_id VARCHAR(255) REFERENCES contacts(id) ON DELETE SET NULL,
      poll_number VARCHAR(50) NOT NULL,
      riding VARCHAR(255),
      province VARCHAR(50),
      marked_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      verification_code VARCHAR(50),
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      -- Prevent any modifications (immutable)
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Prevent updates and deletes (immutable enforcement)
    CREATE OR REPLACE FUNCTION prevent_vote_marks_update_delete()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'election_vote_marks is immutable - updates and deletes are not allowed';
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER vote_marks_no_update
      BEFORE UPDATE ON election_vote_marks
      FOR EACH ROW
      EXECUTE FUNCTION prevent_vote_marks_update_delete();
    
    CREATE TRIGGER vote_marks_no_delete
      BEFORE DELETE ON election_vote_marks
      FOR EACH ROW
      EXECUTE FUNCTION prevent_vote_marks_update_delete();
  `);

  // Canvass assignments table
  // Assigns canvassing areas to users/volunteers
  await query(`
    CREATE TABLE IF NOT EXISTS canvass_assignments (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      assigned_to VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      assigned_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      area_name VARCHAR(255) NOT NULL,
      area_description TEXT,
      area_boundaries JSONB DEFAULT '{}'::jsonb,
      contact_ids JSONB DEFAULT '[]'::jsonb,
      status VARCHAR(50) DEFAULT 'assigned',
      priority INTEGER DEFAULT 0,
      due_date TIMESTAMP,
      completed_at TIMESTAMP,
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Canvass events table
  // Tracks canvassing activities and results
  await query(`
    CREATE TABLE IF NOT EXISTS canvass_events (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      assignment_id VARCHAR(255) REFERENCES canvass_assignments(id) ON DELETE SET NULL,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      contact_id VARCHAR(255) REFERENCES contacts(id) ON DELETE SET NULL,
      event_type VARCHAR(50) NOT NULL,
      event_data JSONB DEFAULT '{}'::jsonb,
      location JSONB,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for performance
  await query(`
    CREATE INDEX IF NOT EXISTS idx_election_interactions_account_id ON election_interactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_election_interactions_contact_id ON election_interactions(contact_id);
    CREATE INDEX IF NOT EXISTS idx_election_interactions_created_at ON election_interactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_election_lists_account_id ON election_lists(account_id);
    CREATE INDEX IF NOT EXISTS idx_election_lists_user_id ON election_lists(user_id);
    CREATE INDEX IF NOT EXISTS idx_election_poll_turnout_account_id ON election_poll_turnout(account_id);
    CREATE INDEX IF NOT EXISTS idx_election_poll_turnout_poll ON election_poll_turnout(poll_number, riding, province);
    CREATE INDEX IF NOT EXISTS idx_election_vote_marks_account_id ON election_vote_marks(account_id);
    CREATE INDEX IF NOT EXISTS idx_election_vote_marks_poll ON election_vote_marks(poll_number, riding, province);
    CREATE INDEX IF NOT EXISTS idx_election_vote_marks_contact_id ON election_vote_marks(contact_id);
    CREATE INDEX IF NOT EXISTS idx_canvass_assignments_account_id ON canvass_assignments(account_id);
    CREATE INDEX IF NOT EXISTS idx_canvass_assignments_assigned_to ON canvass_assignments(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_canvass_assignments_status ON canvass_assignments(status);
    CREATE INDEX IF NOT EXISTS idx_canvass_events_account_id ON canvass_events(account_id);
    CREATE INDEX IF NOT EXISTS idx_canvass_events_assignment_id ON canvass_events(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_canvass_events_user_id ON canvass_events(user_id);
  `);

  migrationLogger.info('Election mode database schema created successfully');
};

/**
 * Rollback the migration (drop tables)
 */
const down = async () => {
  migrationLogger.info('Rolling back election mode database schema...');

  // Drop tables in reverse order
  await query('DROP TABLE IF EXISTS canvass_events CASCADE;');
  await query('DROP TABLE IF EXISTS canvass_assignments CASCADE;');
  await query('DROP TABLE IF EXISTS election_vote_marks CASCADE;');
  await query('DROP TABLE IF EXISTS election_poll_turnout CASCADE;');
  await query('DROP TABLE IF EXISTS election_lists CASCADE;');
  await query('DROP TABLE IF EXISTS election_interactions CASCADE;');
  
  // Drop functions
  await query('DROP FUNCTION IF EXISTS prevent_election_interactions_update_delete() CASCADE;');
  await query('DROP FUNCTION IF EXISTS prevent_vote_marks_update_delete() CASCADE;');

  migrationLogger.info('Election mode database schema rolled back');
};

module.exports = {
  name,
  up,
  down
};
