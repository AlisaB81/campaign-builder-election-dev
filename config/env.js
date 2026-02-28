/**
 * Environment Variable Validation and Configuration
 * 
 * Centralized environment variable validation and configuration.
 * This module validates required environment variables on startup
 * and provides a clean interface for accessing configuration.
 */

const path = require('path');
// Load .env from project root (same dir as server.js) so it works when PM2 cwd differs
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Validates required environment variables
 * Exits process if critical variables are missing
 */
const validateEnvironmentVariables = () => {
  const requiredVars = [
    'JWT_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'SMTP_USER',
    'STRIPE_SECRET_KEY',
    'OPENAI_API_KEY',
    'SYSTEM_2FA_PHONE_NUMBER'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  // SMTP_PASS or EMAIL_PASSWORD must be present (but not necessarily both)
  if (!process.env.SMTP_PASS && !process.env.EMAIL_PASSWORD) {
    missingVars.push('SMTP_PASS or EMAIL_PASSWORD');
  }
  
  if (missingVars.length > 0) {
    console.error('CRITICAL SECURITY ERROR: Missing required environment variables:', missingVars);
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  // Log environment status (without exposing secrets)
  console.log('[CONFIG] Environment variables validated successfully');
};

/**
 * Environment configuration object
 * Provides centralized access to environment variables
 */
const env = {
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  
  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  SYSTEM_2FA_PHONE_NUMBER: process.env.SYSTEM_2FA_PHONE_NUMBER,
  
  // Email/SMTP
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
  
  // Stripe (will be removed in Phase 1)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Other
  UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
  PHONE_NUMBER_PRICE_ID: process.env.PHONE_NUMBER_PRICE_ID,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

  // Paddle (phone number purchases)
  PADDLE_CLIENT_TOKEN: process.env.PADDLE_CLIENT_TOKEN,
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  
  // Feature flags
  IS_STAGING: process.env.IS_STAGING === 'true',
  IS_ELECTION_DEV: process.env.IS_ELECTION_DEV === 'true',
  
  // Data backend (for Phase 2)
  DATA_BACKEND: process.env.DATA_BACKEND || 'json',
  DUAL_WRITE: process.env.DUAL_WRITE === 'true',
  
  // Database configuration (for Phase 2; Supabase uses DATABASE_URL)
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
};

module.exports = {
  validateEnvironmentVariables,
  env
};
