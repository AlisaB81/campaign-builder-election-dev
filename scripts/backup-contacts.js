const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);
const mkdir = promisify(fs.mkdir);

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const SHARED_DATA_DIR = path.join(DATA_DIR, 'shared-data');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
const BACKUP_DATE = '2025-12-01'; // Today's date

/**
 * Safely read JSON file with error handling
 */
async function safeReadJsonFile(filePath, defaultValue = null) {
  try {
    await access(filePath, fs.constants.F_OK);
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Safely write JSON file with error handling
 */
async function safeWriteJsonFile(filePath, data) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    
    // Write file with proper formatting
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Get all account IDs from accounts directory
 */
async function getAllAccountIds() {
  try {
    const files = fs.readdirSync(ACCOUNTS_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(id => /^\d+$/.test(id)); // Only numeric IDs
  } catch (error) {
    console.error('Error reading accounts directory:', error.message);
    return [];
  }
}

/**
 * Backup contacts for a single account
 */
async function backupAccountContacts(accountId) {
  const contactsPath = path.join(SHARED_DATA_DIR, accountId, 'contacts.json');
  const backupDir = path.join(SHARED_DATA_DIR, accountId, 'backups');
  const backupFileName = `contacts-backup-${BACKUP_DATE}.json`;
  const backupPath = path.join(backupDir, backupFileName);
  
  try {
    // Check if contacts file exists
    try {
      await access(contactsPath, fs.constants.F_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // No contacts file, skip this account
        return { accountId, status: 'skipped', reason: 'No contacts file found' };
      }
      throw error;
    }
    
    // Read contacts
    const contacts = await safeReadJsonFile(contactsPath, []);
    
    if (!Array.isArray(contacts)) {
      return { accountId, status: 'error', reason: 'Contacts file is not a valid array' };
    }
    
    if (contacts.length === 0) {
      return { accountId, status: 'skipped', reason: 'No contacts to backup' };
    }
    
    // Create backup metadata
    const backupData = {
      backupDate: BACKUP_DATE,
      backupTimestamp: new Date().toISOString(),
      accountId: accountId,
      contactCount: contacts.length,
      sourceFile: 'contacts.json',
      contacts: contacts
    };
    
    // Write backup file
    const success = await safeWriteJsonFile(backupPath, backupData);
    
    if (success) {
      return {
        accountId,
        status: 'success',
        contactCount: contacts.length,
        backupPath: backupPath
      };
    } else {
      return { accountId, status: 'error', reason: 'Failed to write backup file' };
    }
  } catch (error) {
    return { accountId, status: 'error', reason: error.message };
  }
}

/**
 * Main backup function
 */
async function backupAllContacts() {
  console.log('🔄 Starting Contact Backup Process');
  console.log(`📅 Backup Date: ${BACKUP_DATE}\n`);
  
  // Get all account IDs
  const accountIds = await getAllAccountIds();
  console.log(`📋 Found ${accountIds.length} accounts to process\n`);
  
  if (accountIds.length === 0) {
    console.log('⚠️  No accounts found. Exiting.');
    return;
  }
  
  const results = {
    success: [],
    skipped: [],
    errors: []
  };
  
  let totalContactsBackedUp = 0;
  
  // Process each account
  for (const accountId of accountIds) {
    const result = await backupAccountContacts(accountId);
    
    if (result.status === 'success') {
      results.success.push(result);
      totalContactsBackedUp += result.contactCount;
      console.log(`✅ Account ${accountId}: Backed up ${result.contactCount} contacts`);
    } else if (result.status === 'skipped') {
      results.skipped.push(result);
      console.log(`⏭️  Account ${accountId}: ${result.reason}`);
    } else {
      results.errors.push(result);
      console.log(`❌ Account ${accountId}: ${result.reason}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backup Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful backups: ${results.success.length}`);
  console.log(`⏭️  Skipped accounts: ${results.skipped.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);
  console.log(`📦 Total contacts backed up: ${totalContactsBackedUp}`);
  console.log('='.repeat(60) + '\n');
  
  // Save backup report
  const reportPath = path.join(DATA_DIR, `backup-report-${BACKUP_DATE}.json`);
  const report = {
    backupDate: BACKUP_DATE,
    backupTimestamp: new Date().toISOString(),
    totalAccounts: accountIds.length,
    successful: results.success.length,
    skipped: results.skipped.length,
    errors: results.errors.length,
    totalContactsBackedUp: totalContactsBackedUp,
    results: {
      success: results.success.map(r => ({ accountId: r.accountId, contactCount: r.contactCount })),
      skipped: results.skipped.map(r => ({ accountId: r.accountId, reason: r.reason })),
      errors: results.errors.map(r => ({ accountId: r.accountId, reason: r.reason }))
    }
  };
  
  await safeWriteJsonFile(reportPath, report);
  console.log(`📄 Backup report saved: ${path.basename(reportPath)}\n`);
  
  return report;
}

// Run backup if executed directly
if (require.main === module) {
  backupAllContacts()
    .then(() => {
      console.log('✅ Backup process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Backup process failed:', error);
      process.exit(1);
    });
}

module.exports = { backupAllContacts, backupAccountContacts };

