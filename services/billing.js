/**
 * Billing Service
 * 
 * Phase 1: Stripe Removal
 * This service handles billing operations that were previously done via Stripe.
 * Billing is now handled off-platform (service + invoices).
 * 
 * This module provides stubs and helpers for invoice management
 * while Stripe functionality is removed.
 */

const { logger, createLogger, createError } = require('../lib');

const billingLogger = createLogger('BILLING');

/**
 * Billing status - indicates that billing is handled off-platform
 */
const BILLING_STATUS = {
  OFF_PLATFORM: 'off_platform',
  DISABLED: 'disabled'
};

/**
 * Check if billing features are enabled
 * In Phase 1, billing is disabled (handled off-platform)
 */
const isBillingEnabled = () => {
  return false; // Billing handled off-platform
};

/**
 * Create a billing disabled error response
 * @param {string} feature - Feature name that requires billing
 * @returns {Error} AppError instance
 */
const createBillingDisabledError = (feature = 'This feature') => {
  return createError(
    `${feature} requires billing setup. Billing is handled off-platform. Please contact support for invoice-based billing.`,
    402,
    'BILLING_DISABLED'
  );
};

/**
 * Stub for creating payment intent (previously Stripe)
 * Returns error indicating billing is off-platform
 */
const createPaymentIntent = async (params) => {
  billingLogger.warn('Payment intent creation attempted (billing disabled)', { params: { amount: params.amount, currency: params.currency } });
  throw createBillingDisabledError('Payment processing');
};

/**
 * Stub for creating subscription (previously Stripe)
 * Returns error indicating billing is off-platform
 */
const createSubscription = async (params) => {
  billingLogger.warn('Subscription creation attempted (billing disabled)', { params: { customerId: params.customer } });
  throw createBillingDisabledError('Subscription creation');
};

/**
 * Stub for creating customer (previously Stripe)
 * Returns error indicating billing is off-platform
 */
const createCustomer = async (params) => {
  billingLogger.warn('Customer creation attempted (billing disabled)', { params: { email: params.email } });
  throw createBillingDisabledError('Customer setup');
};

/**
 * Invoice management (preserved from plan requirements)
 * These functions handle manual invoice records for bookkeeping
 */

/**
 * Create or update an invoice record
 * @param {string} userId - User ID
 * @param {Object} purchase - Purchase details
 * @returns {Promise<Object>} Invoice object
 */
const createOrUpdateInvoice = async (userId, purchase) => {
  // This function should be implemented to save invoice records
  // For now, return a stub invoice
  const invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    ...purchase,
    createdAt: new Date().toISOString(),
    status: 'pending', // Will be updated when payment is confirmed off-platform
    billingMethod: 'off_platform'
  };
  
  billingLogger.info('Invoice created (off-platform billing)', { invoiceId: invoice.id, userId });
  return invoice;
};

/**
 * Get invoice history for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of invoices
 */
const getInvoiceHistory = async (userId) => {
  // This should read from invoice storage
  // For now, return empty array
  return [];
};

module.exports = {
  BILLING_STATUS,
  isBillingEnabled,
  createBillingDisabledError,
  createPaymentIntent,
  createSubscription,
  createCustomer,
  createOrUpdateInvoice,
  getInvoiceHistory
};
