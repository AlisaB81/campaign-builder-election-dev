#!/usr/bin/env node
/*
 * One-time backfill:
 * Import contacts from live JSON shared-data into election_dev PostgreSQL contacts table.
 *
 * Source (read-only):
 *   /home/campaignbuilder.ca/public_html/data/shared-data/<accountId>/contacts.json
 *
 * Target:
 *   /home/campaignbuilder.ca/public_html_election_dev PostgreSQL (via contactRepo)
 */

const fs = require('fs');
const path = require('path');

const LIVE_SHARED_DATA_DIR = '/home/campaignbuilder.ca/public_html/data/shared-data';

async function main() {
  const { initializePool, runMigrations, contactRepo, query } = require('../db');

  if (!fs.existsSync(LIVE_SHARED_DATA_DIR)) {
    throw new Error(`Source directory not found: ${LIVE_SHARED_DATA_DIR}`);
  }

  await initializePool();
  await runMigrations();

  const accountDirs = fs
    .readdirSync(LIVE_SHARED_DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let accountsProcessed = 0;
  let contactsImported = 0;
  let accountsSkipped = 0;

  for (const accountId of accountDirs) {
    const contactsPath = path.join(LIVE_SHARED_DATA_DIR, accountId, 'contacts.json');
    if (!fs.existsSync(contactsPath)) {
      accountsSkipped += 1;
      continue;
    }

    let contacts = [];
    try {
      const raw = fs.readFileSync(contactsPath, 'utf8');
      const parsed = JSON.parse(raw);
      contacts = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn(`[BACKFILL] Skipping ${accountId} due to JSON parse error: ${err.message}`);
      accountsSkipped += 1;
      continue;
    }

    // Ensure account exists for foreign key constraint contacts.account_id -> accounts.id.
    await query(
      `INSERT INTO accounts (id, account_type, account_status, election_mode, created_at, updated_at)
       VALUES ($1, 'reg_client', 'active', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [String(accountId)]
    );

    // Normalize ids to strings; generate deterministic fallback id if missing.
    const normalized = contacts.map((c, idx) => {
      const contact = c && typeof c === 'object' ? { ...c } : {};
      contact.id = String(contact.id || `${accountId}-json-${idx + 1}`);
      return contact;
    });
    try {
      await contactRepo.updateAccountContacts(String(accountId), normalized);
      accountsProcessed += 1;
      contactsImported += normalized.length;
      console.log(`[BACKFILL] account ${accountId}: ${normalized.length} contacts`);
    } catch (err) {
      console.warn(`[BACKFILL] Skipping ${accountId} due to import error: ${err.message}`);
      accountsSkipped += 1;
    }
  }

  const pgCount = await query('SELECT COUNT(*)::int AS c FROM contacts WHERE deleted_at IS NULL');

  console.log('\n[BACKFILL] Completed');
  console.log(
    JSON.stringify(
      {
        sourceDir: LIVE_SHARED_DATA_DIR,
        accountsProcessed,
        accountsSkipped,
        contactsImported,
        pgContactsAfterImport: pgCount.rows[0].c
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[BACKFILL] Failed:', err.message);
    process.exit(1);
  });

