#!/usr/bin/env node

/**
 * Script to check email status (suppression list, unsubscribed, etc.)
 * Usage: node scripts/check-email-status.js <email>
 */

const fs = require('fs');
const path = require('path');

const emailToCheck = process.argv[2];

if (!emailToCheck) {
  console.error('Usage: node scripts/check-email-status.js <email>');
  console.error('Example: node scripts/check-email-status.js alisa2019brown@gmail.com');
  process.exit(1);
}

const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');

async function checkEmailStatus(email) {
  const normalizedEmail = email.toLowerCase();
  const results = {
    email: email,
    foundInSuppression: false,
    suppressionReason: null,
    suppressionAccount: null,
    foundInUnsubscribed: false,
    unsubscribedAccount: null,
    unsubscribedDetails: null
  };

  // Check suppression lists
  if (fs.existsSync(SHARED_DATA_DIR)) {
    const accountDirs = fs.readdirSync(SHARED_DATA_DIR).filter(f => {
      const accountPath = path.join(SHARED_DATA_DIR, f);
      return fs.statSync(accountPath).isDirectory();
    });

    for (const accountDir of accountDirs) {
      // Check suppression list
      const suppressionPath = path.join(SHARED_DATA_DIR, accountDir, 'suppression-list.json');
      if (fs.existsSync(suppressionPath)) {
        try {
          const data = fs.readFileSync(suppressionPath, 'utf8');
          const suppressionList = JSON.parse(data);
          const found = suppressionList.find(s => s.email.toLowerCase() === normalizedEmail);
          if (found) {
            results.foundInSuppression = true;
            results.suppressionReason = found.reason || 'unknown';
            results.suppressionAccount = accountDir;
            break;
          }
        } catch (error) {
          // Skip if file is invalid
        }
      }

      // Check contacts for unsubscribed status
      const contactsPath = path.join(SHARED_DATA_DIR, accountDir, 'contacts.json');
      if (fs.existsSync(contactsPath)) {
        try {
          const data = fs.readFileSync(contactsPath, 'utf8');
          const contacts = JSON.parse(data);
          const found = contacts.find(c => c.email && c.email.toLowerCase() === normalizedEmail);
          if (found) {
            const prefs = found.communicationPreferences;
            if (prefs && prefs.email && prefs.email.subscribed === false) {
              results.foundInUnsubscribed = true;
              results.unsubscribedAccount = accountDir;
              results.unsubscribedDetails = {
                unsubscribedAt: prefs.email.unsubscribedAt || null,
                unsubscribeReason: prefs.email.unsubscribeReason || null,
                unsubscribeMethod: prefs.email.unsubscribeMethod || null
              };
              break;
            }
          }
        } catch (error) {
          // Skip if file is invalid
        }
      }
    }
  }

  return results;
}

async function main() {
  console.log(`Checking status for: ${emailToCheck}\n`);
  
  const results = await checkEmailStatus(emailToCheck);
  
  console.log('Results:');
  console.log('─'.repeat(50));
  
  if (results.foundInSuppression) {
    console.log(`❌ FOUND IN SUPPRESSION LIST`);
    console.log(`   Account: ${results.suppressionAccount}`);
    console.log(`   Reason: ${results.suppressionReason}`);
    console.log(`   Action: Email will be blocked from sending`);
  } else {
    console.log(`✅ NOT in suppression list`);
  }
  
  console.log('');
  
  if (results.foundInUnsubscribed) {
    console.log(`❌ FOUND AS UNSUBSCRIBED`);
    console.log(`   Account: ${results.unsubscribedAccount}`);
    if (results.unsubscribedDetails) {
      if (results.unsubscribedDetails.unsubscribedAt) {
        console.log(`   Unsubscribed at: ${results.unsubscribedDetails.unsubscribedAt}`);
      }
      if (results.unsubscribedDetails.unsubscribeReason) {
        console.log(`   Reason: ${results.unsubscribedDetails.unsubscribeReason}`);
      }
      if (results.unsubscribedDetails.unsubscribeMethod) {
        console.log(`   Method: ${results.unsubscribedDetails.unsubscribeMethod}`);
      }
    }
    console.log(`   Action: Email will be filtered out before sending`);
  } else {
    console.log(`✅ NOT unsubscribed`);
  }
  
  console.log('');
  console.log('─'.repeat(50));
  
  if (results.foundInSuppression || results.foundInUnsubscribed) {
    console.log('\n⚠️  This email will NOT receive emails from Campaign Builder');
    if (results.foundInSuppression) {
      console.log(`   To remove from suppression list, run:`);
      console.log(`   node scripts/remove-from-suppression.js ${emailToCheck}`);
    }
  } else {
    console.log('\n✅ This email should receive emails normally');
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

