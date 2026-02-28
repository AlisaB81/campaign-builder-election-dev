/**
 * Initial Database Schema Migration
 * 
 * Phase 2: PostgreSQL Foundation
 * Creates all core tables for the application.
 */

const { query } = require('../connection');
const { logger, createLogger } = require('../../lib');

const migrationLogger = createLogger('MIGRATION_001');

const name = '001_initial_schema';

/**
 * Run the migration (create tables)
 */
const up = async () => {
  migrationLogger.info('Creating initial database schema...');

  // Accounts table
  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR(255) PRIMARY KEY,
      account_type VARCHAR(50) NOT NULL DEFAULT 'reg_client',
      account_status VARCHAR(50) NOT NULL DEFAULT 'active',
      election_mode BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      user_type VARCHAR(50) NOT NULL DEFAULT 'user',
      account_type VARCHAR(50),
      subscription_status VARCHAR(50),
      subscription_id VARCHAR(255),
      trial_ends_at TIMESTAMP,
      is_verified BOOLEAN DEFAULT FALSE,
      is_2fa_enabled BOOLEAN DEFAULT FALSE,
      two_fa_method VARCHAR(50),
      two_fa_phone VARCHAR(50),
      nda_accepted BOOLEAN DEFAULT FALSE,
      nda_accepted_at TIMESTAMP,
      nda_accepted_ip VARCHAR(50),
      is_admin BOOLEAN DEFAULT FALSE,
      permissions JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP
    );
  `);

  // Contacts table
  await query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      city VARCHAR(255),
      province VARCHAR(50),
      postal_code VARCHAR(20),
      poll_number VARCHAR(50),
      riding VARCHAR(255),
      role VARCHAR(255),
      categories JSONB DEFAULT '[]'::jsonb,
      custom_fields JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `);

  // Templates table
  await query(`
    CREATE TABLE IF NOT EXISTS templates (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      body_html TEXT,
      body_text TEXT,
      header_image VARCHAR(500),
      header_text VARCHAR(255),
      footer_text TEXT,
      template_type VARCHAR(50) DEFAULT 'email',
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `);

  // Campaigns table
  await query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      template_id VARCHAR(255) REFERENCES templates(id) ON DELETE SET NULL,
      subject VARCHAR(500),
      message_type VARCHAR(50) DEFAULT 'email',
      status VARCHAR(50) DEFAULT 'draft',
      scheduled_at TIMESTAMP,
      sent_at TIMESTAMP,
      total_recipients INTEGER DEFAULT 0,
      successful_sends INTEGER DEFAULT 0,
      failed_sends INTEGER DEFAULT 0,
      opens INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Messages table
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      campaign_id VARCHAR(255) REFERENCES campaigns(id) ON DELETE SET NULL,
      recipient_email VARCHAR(255),
      recipient_phone VARCHAR(50),
      recipient_name VARCHAR(255),
      subject VARCHAR(500),
      body_html TEXT,
      body_text TEXT,
      message_type VARCHAR(50) DEFAULT 'email',
      status VARCHAR(50) DEFAULT 'pending',
      sent_at TIMESTAMP,
      delivered_at TIMESTAMP,
      opened_at TIMESTAMP,
      clicked_at TIMESTAMP,
      error_message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Analytics table
  await query(`
    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      campaign_id VARCHAR(255) REFERENCES campaigns(id) ON DELETE CASCADE,
      message_id VARCHAR(255) REFERENCES messages(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      event_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Audit logs table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      details JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for performance
  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_templates_account_id ON templates(account_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
    CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
    CREATE INDEX IF NOT EXISTS idx_analytics_account_id ON analytics(account_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_campaign_id ON analytics(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_account_id ON audit_logs(account_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `);

  migrationLogger.info('Initial database schema created successfully');
};

/**
 * Rollback the migration (drop tables)
 */
const down = async () => {
  migrationLogger.info('Rolling back initial database schema...');

  // Drop tables in reverse order (respecting foreign keys)
  await query('DROP TABLE IF EXISTS audit_logs CASCADE;');
  await query('DROP TABLE IF EXISTS analytics CASCADE;');
  await query('DROP TABLE IF EXISTS messages CASCADE;');
  await query('DROP TABLE IF EXISTS campaigns CASCADE;');
  await query('DROP TABLE IF EXISTS templates CASCADE;');
  await query('DROP TABLE IF EXISTS contacts CASCADE;');
  await query('DROP TABLE IF EXISTS users CASCADE;');
  await query('DROP TABLE IF EXISTS accounts CASCADE;');

  migrationLogger.info('Initial database schema rolled back');
};

module.exports = {
  name,
  up,
  down
};
