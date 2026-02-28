#!/usr/bin/env node

/**
 * Script to remove an email from suppression list
 * Usage: node scripts/remove-from-suppression.js <email> [accountId]
 */

const fs = require('fs');
const path = require('path');

const emailToRemove = process.argv[2];
const accountIdArg = process.argv[3];

if (!emailToRemove) {
  console.error('Usage: node scripts/remove-from-suppression.js <email> [accountId]');
  console.error('Example: node scripts/remove-from-suppression.js matt@swiftmedia.ca');
  process.exit(1);
}

const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');

async function removeFromSuppressionList(accountId, email) {
  const suppressionPath = path.join(SHARED_DATA_DIR, accountId.toString(), 'suppression-list.json');
  
  if (!fs.existsSync(suppressionPath)) {
    return { success: false, message: 'Suppression list file not found' };
  }
  
  try {
    const data = fs.readFileSync(suppressionPath, 'utf8');
    let suppressionList = JSON.parse(data);
    const initialLength = suppressionList.length;
    
    // Remove the email (case-insensitive)
    suppressionList = suppressionList.filter(s => s.email.toLowerCase() !== email.toLowerCase());
    
    if (suppressionList.length < initialLength) {
      fs.writeFileSync(suppressionPath, JSON.stringify(suppressionList, null, 2), 'utf8');
      return { success: true, message: `Email ${email} removed from suppression list for account ${accountId}`, removed: initialLength - suppressionList.length };
    } else {
      return { success: false, message: `Email ${email} not found in suppression list for account ${accountId}` };
    }
  } catch (error) {
    return { success: false, message: `Error: ${error.message}` };
  }
}

async function main() {
  console.log(`Searching for ${emailToRemove} in suppression lists...\n`);
  
  if (accountIdArg) {
    // Remove from specific account
    const result = await removeFromSuppressionList(accountIdArg, emailToRemove);
    console.log(result.message);
    if (result.success) {
      console.log(`✓ Successfully removed from account ${accountIdArg}`);
    }
  } else {
    // Search all accounts
    if (!fs.existsSync(SHARED_DATA_DIR)) {
      console.error('Shared data directory not found');
      process.exit(1);
    }
    
    const accountDirs = fs.readdirSync(SHARED_DATA_DIR).filter(f => {
      const accountPath = path.join(SHARED_DATA_DIR, f);
      return fs.statSync(accountPath).isDirectory();
    });
    
    let found = false;
    for (const accountDir of accountDirs) {
      const result = await removeFromSuppressionList(accountDir, emailToRemove);
      if (result.success) {
        found = true;
        console.log(`✓ ${result.message}`);
      }
    }
    
    if (!found) {
      console.log(`✗ Email ${emailToRemove} not found in any suppression list`);
    }
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

