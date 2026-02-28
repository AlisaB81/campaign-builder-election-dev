/**
 * Centralized Configuration Module
 * 
 * Exports all configuration for the application.
 * This is the single source of truth for configuration.
 */

const { validateEnvironmentVariables, env } = require('./env');

// Validate on module load
validateEnvironmentVariables();

// Mapbox (navigation/route optimization) - throws if MAPBOX_ACCESS_TOKEN is missing
const mapbox = require('./mapbox');

// Merge with existing config.legacy.js structure for backward compatibility
let existingConfig = {};
try {
  existingConfig = require('../config.legacy.js');
} catch (e) {
  // Legacy config not found, that's okay
  console.log('[CONFIG] Legacy config.js not found, using new structure only');
}

module.exports = {
  env,
  mapbox,
  validateEnvironmentVariables,
  // Backward compatibility with existing config.js
  ...existingConfig
};
