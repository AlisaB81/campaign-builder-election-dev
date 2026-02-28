#!/usr/bin/env node
/**
 * Email Queue Diagnostic Script
 * 
 * This script checks the status of email queues across all accounts
 * and can optionally trigger queue processing.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');

async function getEmailQueue(accountId) {
    const queuePath = path.join(SHARED_DATA_DIR, accountId.toString(), 'email-queue.json');
    try {
        if (fs.existsSync(queuePath)) {
            const data = await readFile(queuePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`[ERROR] Error reading email queue for account ${accountId}:`, error.message);
    }
    return [];
}

async function checkQueues() {
    console.log('='.repeat(60));
    console.log('EMAIL QUEUE DIAGNOSTIC REPORT');
    console.log('='.repeat(60));
    console.log(`Checking directory: ${SHARED_DATA_DIR}\n`);

    if (!fs.existsSync(SHARED_DATA_DIR)) {
        console.log('❌ Shared data directory does not exist!');
        return;
    }

    try {
        const accountDirs = await readdir(SHARED_DATA_DIR);
        const accountStats = [];
        let totalPending = 0;
        let totalProcessing = 0;
        let totalCompleted = 0;
        let totalFailed = 0;
        let totalRecipients = 0;

        for (const accountDir of accountDirs) {
            const accountPath = path.join(SHARED_DATA_DIR, accountDir);
            const stats = await stat(accountPath);
            
            if (!stats.isDirectory()) {
                continue;
            }

            const queue = await getEmailQueue(accountDir);
            
            if (queue.length === 0) {
                continue;
            }

            const pending = queue.filter(e => e.status === 'pending');
            const processing = queue.filter(e => e.status === 'processing');
            const completed = queue.filter(e => e.status === 'completed');
            const failed = queue.filter(e => e.status === 'failed');

            const pendingRecipients = pending.reduce((sum, e) => sum + (e.recipients?.length || 0), 0);
            const processingRecipients = processing.reduce((sum, e) => sum + (e.recipients?.length || 0), 0);

            totalPending += pending.length;
            totalProcessing += processing.length;
            totalCompleted += completed.length;
            totalFailed += failed.length;
            totalRecipients += pendingRecipients + processingRecipients;

            if (pending.length > 0 || processing.length > 0) {
                accountStats.push({
                    accountId: accountDir,
                    pending: pending.length,
                    processing: processing.length,
                    completed: completed.length,
                    failed: failed.length,
                    pendingRecipients,
                    processingRecipients,
                    pendingEntries: pending,
                    processingEntries: processing
                });
            }
        }

        console.log('SUMMARY:');
        console.log(`  Total Accounts with Queues: ${accountStats.length}`);
        console.log(`  Pending Entries: ${totalPending}`);
        console.log(`  Processing Entries: ${totalProcessing}`);
        console.log(`  Completed Entries: ${totalCompleted}`);
        console.log(`  Failed Entries: ${totalFailed}`);
        console.log(`  Total Pending/Processing Recipients: ${totalRecipients}`);
        console.log('');

        if (accountStats.length === 0) {
            console.log('✅ No pending or processing queue entries found.');
            console.log('   The queue processor should be running every 15 minutes.');
            console.log('   Check server logs for "[EMAIL-QUEUE]" messages to verify it\'s active.');
        } else {
            console.log('DETAILED BREAKDOWN:');
            console.log('');

            for (const stat of accountStats) {
                console.log(`Account: ${stat.accountId}`);
                console.log(`  Pending: ${stat.pending} entries (${stat.pendingRecipients} recipients)`);
                console.log(`  Processing: ${stat.processing} entries (${stat.processingRecipients} recipients)`);
                console.log(`  Completed: ${stat.completed} entries`);
                console.log(`  Failed: ${stat.failed} entries`);

                if (stat.pendingEntries.length > 0) {
                    console.log('\n  Pending Queue Entries:');
                    for (const entry of stat.pendingEntries) {
                        const queuedDate = new Date(entry.queuedAt);
                        const ageMinutes = Math.floor((Date.now() - queuedDate.getTime()) / 60000);
                        console.log(`    - ID: ${entry.id}`);
                        console.log(`      Domain: ${entry.domain}`);
                        console.log(`      Recipients: ${entry.recipients?.length || 0}`);
                        console.log(`      Queued: ${queuedDate.toISOString()} (${ageMinutes} minutes ago)`);
                        console.log(`      Priority: ${entry.priority || 'normal'}`);
                    }
                }

                if (stat.processingEntries.length > 0) {
                    console.log('\n  Processing Queue Entries:');
                    for (const entry of stat.processingEntries) {
                        const updatedDate = entry.updatedAt ? new Date(entry.updatedAt) : null;
                        const ageMinutes = updatedDate ? Math.floor((Date.now() - updatedDate.getTime()) / 60000) : 'unknown';
                        console.log(`    - ID: ${entry.id}`);
                        console.log(`      Domain: ${entry.domain}`);
                        console.log(`      Recipients: ${entry.recipients?.length || 0}`);
                        console.log(`      Last Updated: ${updatedDate ? updatedDate.toISOString() : 'unknown'} (${ageMinutes} minutes ago)`);
                    }
                }

                console.log('');
            }

            console.log('⚠️  ACTION REQUIRED:');
            console.log('   There are pending emails in the queue.');
            console.log('   The queue processor runs every 15 minutes automatically.');
            console.log('   If emails are not sending, check:');
            console.log('     1. Server logs for "[EMAIL-QUEUE]" messages');
            console.log('     2. Domain warm-up capacity limits');
            console.log('     3. Server is running and healthy');
            console.log('   You can manually trigger processing via:');
            console.log('     POST /api/email/queue/process (for your account)');
            console.log('     POST /api/admin/email/queues/process (admin, all accounts)');
        }

        console.log('='.repeat(60));
    } catch (error) {
        console.error('Error checking queues:', error);
        process.exit(1);
    }
}

// Run the check
checkQueues().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
