/**
 * Election Mode Middleware
 * 
 * Phase 3: Election Mode Foundation
 * Middleware to check if election mode is enabled for an account.
 */

const { logger, createLogger } = require('../lib');

const electionLogger = createLogger('ELECTION');

/**
 * Check if election mode is enabled for an account
 * @param {Function} findUserById - Function to find user by ID
 * @param {Object} options - Options object with fs and path utilities
 * @returns {Function} Express middleware function
 */
const requireElectionMode = (findUserById, options = {}) => {
  const fs = options.fs || require('fs').promises;
  const path = options.path || require('path');
  const SHARED_DATA_DIR = options.SHARED_DATA_DIR || path.join(__dirname, '..', 'data', 'shared-data');
  const { isPostgresReady, getAdapter } = options.dbHelpers || {};

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await findUserById(req.user.id);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Get account ID
      const accountId = user.accountId || user.id;
      
      // Check if account has election mode enabled
      let electionMode = false;

      // IMPORTANT: use Postgres only when ready; otherwise fallback to JSON to avoid hanging /api/user
      if (isPostgresReady && isPostgresReady()) {
        try {
          const adapter = getAdapter();
          if (adapter && adapter.getAccount) {
            const account = await adapter.getAccount(accountId);
            electionMode = account?.election_mode || false;
          }
        } catch (error) {
          electionLogger.warn('Could not check election mode in PostgreSQL', error);
        }
      }

      // Fallback to JSON file check
      if (!electionMode) {
        const accountPath = path.join(SHARED_DATA_DIR, accountId, 'account.json');
        try {
          const accountFile = await fs.readFile(accountPath, 'utf8');
          const accountData = JSON.parse(accountFile);
          electionMode = accountData.electionMode || false;
        } catch (error) {
          // Account file doesn't exist, election mode is false
          electionMode = false;
        }
      }

      // Also check user-level flag as fallback
      if (!electionMode && (user.electionMode || user.accountType === 'election')) {
        electionMode = true;
      }

      if (electionMode) {
        return next();
      }

      // Election mode not enabled
      if (req.accepts('html')) {
        return res.redirect('/dashboard');
      }
      return res.status(403).json({
        error: 'Election Mode is not enabled for this account',
        electionModeRequired: true
      });
    } catch (error) {
      electionLogger.error('Election mode check failed', error);
      if (req.accepts('html')) {
        return res.redirect('/dashboard');
      }
      return res.status(500).json({ error: 'Election mode check failed' });
    }
  };
};

/**
 * Check if user has election permissions
 * @param {string} permission - Required permission
 * @param {Function} findUserById - Function to find user by ID
 * @returns {Function} Express middleware function
 */
const requireElectionPermission = (permission, findUserById) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await findUserById(req.user.id);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check user permissions
      const userPermissions = user.permissions || [];
      const hasPermission = userPermissions.includes(permission) || 
                           userPermissions.includes('*') ||
                           user.isAdmin === true ||
                           user.userType === 'app_owner';

      if (!hasPermission) {
        return res.status(403).json({ 
          error: `Permission required: ${permission}`,
          permissionRequired: permission
        });
      }

      next();
    } catch (error) {
      electionLogger.error('Election permission check failed', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

module.exports = {
  requireElectionMode,
  requireElectionPermission
};
