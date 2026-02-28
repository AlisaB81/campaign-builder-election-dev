/**
 * Mapbox configuration for navigation / route optimization.
 * MAPBOX_ACCESS_TOKEN in .env is optional: server and navigation page still load;
 * map and route optimization will only work when the token is set.
 */
module.exports = {
  token: process.env.MAPBOX_ACCESS_TOKEN || '',
  profile: process.env.MAPBOX_PROFILE || 'driving',
  language: process.env.MAPBOX_LANGUAGE || 'en',
  country: process.env.MAPBOX_COUNTRY || 'CA',
  maxWaypoints: Number(process.env.MAPBOX_MAX_WAYPOINTS || 25),
  timeoutMs: Number(process.env.MAPBOX_OPTIMIZATION_TIMEOUT_MS || 8000)
};
