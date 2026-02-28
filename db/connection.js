/**
 * PostgreSQL Database Connection
 *
 * Phase 2: PostgreSQL Foundation
 * Manages database connection pool and provides connection utilities.
 *
 * Notes for Supabase on IPv4-only servers:
 * - Use the **Session Pooler** connection string in DATABASE_URL (recommended).
 * - Keep SSL enabled.
 * - The dns.lookup IPv4 forcing is kept as a harmless fallback, but pooler is the real fix.
 */

const dns = require('dns');
const { Pool } = require('pg');
const { env: config } = require('../config');
const { createLogger } = require('../lib');

const dbLogger = createLogger('DB');

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 * Uses DATABASE_URL if set (e.g. Supabase), otherwise DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.
 * @returns {Pool} PostgreSQL connection pool
 */
const initializePool = () => {
  if (pool) return pool;

  // Pooler-friendly defaults (good for Supabase Session Pooler and other managed DBs)
  const poolOptions = {
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: 0,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
    allowExitOnIdle: true,
  };

  const databaseUrl = config.DATABASE_URL;

  const baseConfig = databaseUrl
    ? {
        connectionString: databaseUrl,
        // Supabase requires SSL in most environments
        ssl: { rejectUnauthorized: false },
        ...poolOptions,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'campaignbuilder',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '',
        ...poolOptions,
      };

  // Fallback: force IPv4 DNS resolution (useful on IPv4-only servers when hostname returns IPv6 first)
  // If you're using Supabase Session Pooler, this usually isn't needed, but it's safe to keep.
  const finalConfig = databaseUrl
    ? {
        ...baseConfig,
        lookup: (hostname, _options, cb) => dns.lookup(hostname, { family: 4 }, cb),
      }
    : baseConfig;

  pool = new Pool(finalConfig);

  pool.on('error', (err) => {
    dbLogger.error('Unexpected error on idle client', err);
  });

  // Test connection (non-blocking)
  pool
    .query('SELECT NOW()')
    .then(() => dbLogger.info('Database connection established successfully'))
    .catch((err) => dbLogger.error('Database connection failed', err));

  return pool;
};

/**
 * Get database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
const getPool = () => {
  if (!pool) return initializePool();
  return pool;
};

/**
 * Execute a query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const p = getPool();
  const start = Date.now();

  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;

    dbLogger.debug('Executed query', {
      text: String(text).substring(0, 100),
      duration: `${duration}ms`,
      rows: res.rowCount,
    });

    return res;
  } catch (error) {
    const duration = Date.now() - start;
    dbLogger.error('Query error', error, {
      text: String(text).substring(0, 100),
      duration: `${duration}ms`,
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Client>} PostgreSQL client
 */
const getClient = async () => {
  const p = getPool();
  return p.connect();
};

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback function
 * @returns {Promise<any>} Transaction result
 */
const transaction = async (callback) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      dbLogger.error('Rollback failed', rollbackErr);
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Close the connection pool
 * @returns {Promise<void>}
 */
const close = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    dbLogger.info('Database connection pool closed');
  }
};

module.exports = {
  initializePool,
  getPool,
  query,
  getClient,
  transaction,
  close,
};