/**
 * Database Layer Index
 * 
 * Phase 2: PostgreSQL Foundation
 * Central export point for database utilities.
 */

module.exports = {
  ...require('./connection'),
  ...require('./migrations'),
  ...require('./adapters'),
  campaignRepo: require('./campaignRepo'),
  contactRepo: require('./contactRepo'),
};
