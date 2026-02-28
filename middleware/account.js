/**
 * Account Status Middleware
 * 
 * Neutral account status checking middleware that replaces subscription-based checks.
 * This is part of Phase 0 refactoring to move away from Stripe dependency.
 * 
 * Account Status Values:
 * - active: Account is active and can use the platform
 * - paused: Account is temporarily paused (billing issue, etc.)
 * - archived: Account is archived/deactivated
 */

/**
 * Account Status Constants
 */
const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived'
};

/**
 * Determines account status based on user data
 * 
 * For Phase 0: Maps existing subscription logic to account status
 * For Phase 1: Will use accountStatus field directly (no subscription dependency)
 * 
 * @param {Object} user - User object
 * @returns {string} Account status (active | paused | archived)
 */
const getAccountStatus = async (user) => {
  if (!user) {
    return ACCOUNT_STATUS.ARCHIVED;
  }

  // EDA and APP_OWNER accounts are always active
  if (user.accountType === 'eda' || user.accountType === 'app_owner') {
    return ACCOUNT_STATUS.ACTIVE;
  }

  // Legacy app_owner userType also always active
  if (user.userType === 'app_owner') {
    return ACCOUNT_STATUS.ACTIVE;
  }

  // If accountStatus field exists (Phase 1+), use it directly
  if (user.accountStatus) {
    return user.accountStatus;
  }

  // Phase 0: Map subscription status to account status
  // This maintains backward compatibility during transition
  if (user.subscriptionStatus === 'active') {
    return ACCOUNT_STATUS.ACTIVE;
  }

  if (user.subscriptionStatus === 'trial') {
    // Check if trial has expired
    if (user.trialEndsAt) {
      const trialEnd = new Date(user.trialEndsAt);
      if (new Date() < trialEnd) {
        return ACCOUNT_STATUS.ACTIVE;
      } else {
        return ACCOUNT_STATUS.PAUSED; // Trial expired
      }
    }
    return ACCOUNT_STATUS.ACTIVE; // Trial with no end date
  }

  if (user.subscriptionStatus === 'expired') {
    return ACCOUNT_STATUS.PAUSED;
  }

  // No subscription or subscription status is 'none'
  // For REG_CLIENT accounts, this means paused (needs subscription)
  if (user.accountType === 'reg_client') {
    return ACCOUNT_STATUS.PAUSED;
  }

  // Default to active for unknown cases (safety)
  return ACCOUNT_STATUS.ACTIVE;
};

/**
 * Checks if an account is active
 * 
 * @param {Object} user - User object
 * @returns {Promise<boolean>} True if account is active
 */
const isAccountActive = async (user) => {
  const status = await getAccountStatus(user);
  return status === ACCOUNT_STATUS.ACTIVE;
};

/**
 * Middleware to require active account
 * 
 * This replaces requireActiveSubscription but uses account status instead.
 * For team members, checks the account holder's status.
 * 
 * @param {Function} findUserById - Function to find user by ID (dependency injection)
 * @returns {Function} Express middleware function
 */
const requireActiveAccount = (findUserById, redirectToLogin) => {
  return async (req, res, next) => {
    const isPageRequest = req.accepts('html') || (req.method === 'GET' && !req.xhr && !req.path.startsWith('/api/'));
    const doRedirect = (src, code) => {
      if (typeof redirectToLogin === 'function') return redirectToLogin(res, req, src, code);
      return res.redirect('/login?loop=1');
    };
    try {
      if (!req.user || !req.user.id) {
        if (isPageRequest) return doRedirect('requireActiveAccount', 'NO_USER');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await findUserById(req.user.id);
      
      if (!user) {
        console.log('[AUTH_DEBUG] requireActiveAccount: user not found → /login', { path: req.path, userId: req.user.id });
        if (isPageRequest) return doRedirect('requireActiveAccount', 'USER_NOT_FOUND');
        return res.status(401).json({ error: 'User not found' });
      }

      // For team members, check account holder's status
      let accountUser = user;
      if (user.userType === 'team_member' && user.accountId) {
        try {
          const accountHolder = await findUserById(user.accountId);
          if (accountHolder) {
            accountUser = accountHolder;
          }
        } catch (error) {
          console.error('Error checking account holder:', error);
        }
      }

      const accountStatus = await getAccountStatus(accountUser);

      if (accountStatus !== ACCOUNT_STATUS.ACTIVE) {
        if (req.accepts('html')) {
          // Redirect based on status
          if (accountStatus === ACCOUNT_STATUS.PAUSED) {
            return res.redirect('/subscription?status=paused');
          } else {
            return res.redirect('/subscription?status=archived');
          }
        } else {
          return res.status(403).json({ 
            error: 'Active account required',
            accountStatus: accountStatus,
            redirectTo: '/subscription'
          });
        }
      }

      // Account is active, continue
      next();
    } catch (error) {
      console.error('Account status check failed:', error);
      if (isPageRequest) return doRedirect('requireActiveAccount', 'CATCH');
      res.status(500).json({ error: 'Account status check failed' });
    }
  };
};

module.exports = {
  ACCOUNT_STATUS,
  getAccountStatus,
  isAccountActive,
  requireActiveAccount
};
