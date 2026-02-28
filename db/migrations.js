/**
 * Database Migrations
 * 
 * Phase 2: PostgreSQL Foundation
 * Handles database schema creation and migrations.
 */

const { query, getPool } = require('./connection');
const { logger, createLogger } = require('../lib');

const migrationLogger = createLogger('MIGRATIONS');

/**
 * Check if migrations table exists
 * @returns {Promise<boolean>}
 */
const migrationsTableExists = async () => {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
};

/**
 * Create migrations table
 * @returns {Promise<void>}
 */
const createMigrationsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  migrationLogger.info('Migrations table created');
};

/**
 * Check if a migration has been executed
 * @param {string} migrationName - Name of the migration
 * @returns {Promise<boolean>}
 */
const isMigrationExecuted = async (migrationName) => {
  try {
    const result = await query(
      'SELECT EXISTS (SELECT 1 FROM migrations WHERE name = $1)',
      [migrationName]
    );
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
};

/**
 * Mark a migration as executed
 * @param {string} migrationName - Name of the migration
 * @returns {Promise<void>}
 */
const markMigrationExecuted = async (migrationName) => {
  await query(
    'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [migrationName]
  );
  migrationLogger.info(`Migration executed: ${migrationName}`);
};

/**
 * Run all pending migrations
 * @returns {Promise<void>}
 */
const runMigrations = async () => {
  const tableExists = await migrationsTableExists();
  if (!tableExists) {
    await createMigrationsTable();
  }

  // Import and run migrations in order
  // Note: Using dynamic require to handle cases where migrations don't exist yet
  const migrations = [];
  
  try {
    migrations.push(require('./migrations/001_initial_schema'));
  } catch (error) {
    migrationLogger.warn('Could not load migration 001_initial_schema', error);
  }
  
  try {
    migrations.push(require('./migrations/002_election_mode_schema'));
  } catch (error) {
    migrationLogger.warn('Could not load migration 002_election_mode_schema', error);
  }

  try {
    migrations.push(require('./migrations/003_scrutineering_voted'));
  } catch (error) {
    migrationLogger.warn('Could not load migration 003_scrutineering_voted', error);
  }

  try {
    migrations.push(require('./migrations/004_unique_account_id_id'));
  } catch (error) {
    migrationLogger.warn('Could not load migration 004_unique_account_id_id', error);
  }

  for (const migration of migrations) {
    const migrationName = migration.name;
    
    if (await isMigrationExecuted(migrationName)) {
      migrationLogger.debug(`Migration already executed: ${migrationName}`);
      continue;
    }

    migrationLogger.info(`Running migration: ${migrationName}`);
    
    try {
      await migration.up();
      await markMigrationExecuted(migrationName);
      migrationLogger.info(`Migration completed: ${migrationName}`);
    } catch (error) {
      migrationLogger.error(`Migration failed: ${migrationName}`, error);
      throw error;
    }
  }
};

module.exports = {
  runMigrations,
  isMigrationExecuted,
  markMigrationExecuted
};
