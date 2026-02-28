#!/usr/bin/env node

/**
 * Test script to check email queue status and manually trigger processing
 * Usage: node test-queue.js [command]
 * Commands:
 *   - status: Check queue status for all accounts
 *   - process: Manually trigger queue processing
 *   - check: Check for queue files
 */

const fs = require('fs');
const path = require('path');

const SHARED_DATA_DIR = path.join(__dirname, 'data', 'shared-data');

async function checkQueueFiles() {
    console.log('=== Checking for queue files ===\n');
    
    if (!fs.existsSync(SHARED_DATA_DIR)) {
        console.log('Shared data directory does not exist');
        return;
    }
    
    const accountDirs = fs.readdirSync(SHARED_DATA_DIR).filter(f => {
        const accountPath = path.join(SHARED_DATA_DIR, f);
        return fs.statSync(accountPath).isDirectory();
    });
    
    let foundQueues = 0;
    
    for (const accountDir of accountDirs) {
        const queuePath = path.join(SHARED_DATA_DIR, accountDir, 'email-queue.json');
        if (fs.existsSync(queuePath)) {
            foundQueues++;
            try {
                const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
                const pending = queueData.filter(e => e.status === 'pending');
                const processing = queueData.filter(e => e.status === 'processing');
                const completed = queueData.filter(e => e.status === 'completed');
                const failed = queueData.filter(e => e.status === 'failed');
                
                console.log(`Account: ${accountDir}`);
                console.log(`  Total entries: ${queueData.length}`);
                console.log(`  Pending: ${pending.length}`);
                console.log(`  Processing: ${processing.length}`);
                console.log(`  Completed: ${completed.length}`);
                console.log(`  Failed: ${failed.length}`);
                
                if (pending.length > 0) {
                    const totalRecipients = pending.reduce((sum, e) => sum + (e.recipients?.length || 0), 0);
                    console.log(`  Total pending recipients: ${totalRecipients}`);
                    
                    // Group by domain
                    const byDomain = {};
                    pending.forEach(e => {
                        if (!byDomain[e.domain]) {
                            byDomain[e.domain] = { count: 0, recipients: 0 };
                        }
                        byDomain[e.domain].count++;
                        byDomain[e.domain].recipients += e.recipients?.length || 0;
                    });
                    
                    console.log(`  By domain:`);
                    Object.entries(byDomain).forEach(([domain, info]) => {
                        console.log(`    ${domain}: ${info.count} entries, ${info.recipients} recipients`);
                    });
                    
                    // Show oldest entry
                    const oldest = pending.sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt))[0];
                    if (oldest) {
                        const queuedDate = new Date(oldest.queuedAt);
                        const hoursAgo = (Date.now() - queuedDate.getTime()) / (1000 * 60 * 60);
                        console.log(`  Oldest entry: Queued ${hoursAgo.toFixed(1)} hours ago (${oldest.queuedAt})`);
                    }
                }
                console.log('');
            } catch (error) {
                console.log(`  Error reading queue: ${error.message}`);
                console.log('');
            }
        }
    }
    
    if (foundQueues === 0) {
        console.log('No queue files found');
    } else {
        console.log(`Found ${foundQueues} account(s) with queue files`);
    }
}

async function main() {
    const command = process.argv[2] || 'check';
    
    switch (command) {
        case 'check':
        case 'status':
            await checkQueueFiles();
            break;
        case 'process':
            console.log('To manually trigger queue processing, use the API endpoint:');
            console.log('POST /api/admin/email/queues/process');
            console.log('(Requires admin authentication)');
            break;
        default:
            console.log('Usage: node test-queue.js [check|status|process]');
    }
}

main().catch(console.error);

