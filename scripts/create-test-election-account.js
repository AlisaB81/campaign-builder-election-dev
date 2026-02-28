/**
 * Create Test Election Account
 * 
 * Creates a test account with election mode enabled for testing.
 * Run with: node scripts/create-test-election-account.js
 */

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');
const INDIVIDUAL_DATA_DIR = path.join(__dirname, '..', 'data', 'individual-data');

// Test account credentials
const TEST_ACCOUNT = {
  accountId: 'test-election-account',
  email: 'election-tester@test.com',
  password: 'TestElection123!',
  name: 'Election Tester',
  accountType: 'election',
  electionMode: true
};

async function createTestAccount() {
  try {
    console.log('Creating test election account...');

    // Ensure directories exist
    await fs.mkdir(SHARED_DATA_DIR, { recursive: true });
    await fs.mkdir(INDIVIDUAL_DATA_DIR, { recursive: true });
    await fs.mkdir(path.join(SHARED_DATA_DIR, TEST_ACCOUNT.accountId), { recursive: true });
    await fs.mkdir(path.join(INDIVIDUAL_DATA_DIR, TEST_ACCOUNT.accountId), { recursive: true });

    // Create account file
    const accountPath = path.join(SHARED_DATA_DIR, TEST_ACCOUNT.accountId, 'account.json');
    const accountData = {
      id: TEST_ACCOUNT.accountId,
      electionMode: true,
      accountType: 'election',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
    console.log('✓ Account file created');

    // Create user file in individual-data directory (where login searches)
    const userId = TEST_ACCOUNT.accountId; // Use account ID as user ID for simplicity
    const userPath = path.join(INDIVIDUAL_DATA_DIR, userId, 'user.json');
    const passwordHash = await bcrypt.hash(TEST_ACCOUNT.password, 10);
    
    const userData = {
      id: userId,
      email: TEST_ACCOUNT.email,
      password: passwordHash,
      accountId: TEST_ACCOUNT.accountId,
      accountType: TEST_ACCOUNT.accountType,
      userType: 'user',
      isAdmin: false,
      isVerified: true,
      ndaAccepted: true,
      electionMode: true,
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      permissions: ['mark_votes', 'manage_canvassing', 'view_dashboard', 'manage_turnout']
    };
    
    await fs.writeFile(userPath, JSON.stringify(userData, null, 2));
    console.log('✓ User file created');

    // Create empty contacts file
    const contactsPath = path.join(SHARED_DATA_DIR, TEST_ACCOUNT.accountId, 'contacts.json');
    await fs.writeFile(contactsPath, JSON.stringify([], null, 2));
    console.log('✓ Contacts file created');

    // Create empty campaigns file
    const campaignsPath = path.join(SHARED_DATA_DIR, TEST_ACCOUNT.accountId, 'campaigns.json');
    await fs.writeFile(campaignsPath, JSON.stringify([], null, 2));
    console.log('✓ Campaigns file created');

    console.log('\n✅ Test election account created successfully!');
    console.log('\n📋 Test Account Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${TEST_ACCOUNT.email}`);
    console.log(`Password: ${TEST_ACCOUNT.password}`);
    console.log(`Account ID: ${TEST_ACCOUNT.accountId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔑 Permissions:');
    console.log('  - mark_votes');
    console.log('  - manage_canvassing');
    console.log('  - view_dashboard');
    console.log('  - manage_turnout');
    console.log('\n📝 Note: Election mode is enabled for this account.');
    console.log('   All election endpoints will be accessible.');

  } catch (error) {
    console.error('❌ Error creating test account:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createTestAccount();
}

module.exports = { createTestAccount, TEST_ACCOUNT };
