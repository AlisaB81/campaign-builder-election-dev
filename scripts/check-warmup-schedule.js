#!/usr/bin/env node

/**
 * Script to check domain warm-up schedule and queue processing times
 * Usage: node scripts/check-warmup-schedule.js [accountId] [domain]
 */

const fs = require('fs');
const path = require('path');

const accountId = process.argv[2] || '1740039702547';
const domain = process.argv[3] || 'kootenayconservative.ca';

const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');
const warmupPath = path.join(SHARED_DATA_DIR, accountId, 'domain-warmup.json');
const queuePath = path.join(SHARED_DATA_DIR, accountId, 'email-queue.json');

function getDomainWarmupLimit(day) {
    const limits = {
        1: 100,
        2: 150,
        3: 400,
        4: 800,
        5: 1500,
        6: 3000,
        7: 5000
    };
    
    if (day <= 7) {
        return limits[day] || 100;
    }
    
    return 10000;
}

function getNextMidnightUTC() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
}

function formatTimeUntil(targetDate) {
    const now = new Date();
    const diff = targetDate - now;
    
    if (diff <= 0) {
        return 'Now (already passed)';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

async function main() {
    console.log('═'.repeat(70));
    console.log('Domain Warm-up Schedule & Queue Status');
    console.log('═'.repeat(70));
    console.log(`Account: ${accountId}`);
    console.log(`Domain: ${domain}`);
    console.log('');
    
    // Check warm-up data
    if (!fs.existsSync(warmupPath)) {
        console.log('❌ No warm-up data found for this account/domain');
        return;
    }
    
    const warmupData = JSON.parse(fs.readFileSync(warmupPath, 'utf8'));
    const domainData = warmupData[domain];
    
    if (!domainData) {
        console.log(`❌ No warm-up data found for domain: ${domain}`);
        return;
    }
    
    const firstSendDate = new Date(domainData.firstSendDate);
    const now = new Date();
    const daysSinceFirst = Math.floor((now - firstSendDate) / (1000 * 60 * 60 * 24)) + 1;
    const currentDay = Math.min(daysSinceFirst, domainData.currentDay || 1);
    
    const todayKey = now.toISOString().split('T')[0];
    const sentToday = domainData.dailySentCount?.[todayKey] || 0;
    const dailyLimit = getDomainWarmupLimit(currentDay);
    
    console.log('📊 Current Status:');
    console.log(`   First Send Date: ${firstSendDate.toISOString()}`);
    console.log(`   Current Day: ${currentDay} (${daysSinceFirst} days since first send)`);
    console.log(`   Daily Limit (Day ${currentDay}): ${dailyLimit} emails`);
    console.log(`   Sent Today (${todayKey}): ${sentToday} emails`);
    console.log(`   Remaining Today: ${Math.max(0, dailyLimit - sentToday)} emails`);
    console.log('');
    
    // Calculate next day
    const nextDay = currentDay + 1;
    const nextDayLimit = getDomainWarmupLimit(nextDay);
    const nextMidnight = getNextMidnightUTC();
    
    console.log('⏰ Schedule Information:');
    console.log(`   Next Day (Day ${nextDay}) Limit: ${nextDayLimit} emails`);
    console.log(`   Day Resets At: ${nextMidnight.toISOString()} (Midnight UTC)`);
    console.log(`   Time Until Reset: ${formatTimeUntil(nextMidnight)}`);
    console.log('');
    
    // Warm-up schedule
    console.log('📅 Warm-up Schedule:');
    for (let day = 1; day <= 7; day++) {
        const limit = getDomainWarmupLimit(day);
        const marker = day === currentDay ? ' ← Current' : day === nextDay ? ' ← Next' : '';
        console.log(`   Day ${day}: ${limit.toLocaleString()} emails/day${marker}`);
    }
    console.log(`   Day 8+: 10,000 emails/day`);
    console.log('');
    
    // Check queue
    if (fs.existsSync(queuePath)) {
        const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        const pending = queue.filter(e => e.status === 'pending' && e.domain === domain);
        
        if (pending.length > 0) {
            const totalQueued = pending.reduce((sum, e) => sum + (e.recipients?.length || 0), 0);
            console.log('📬 Queue Status:');
            console.log(`   Pending Entries: ${pending.length}`);
            console.log(`   Queued Recipients: ${totalQueued} emails`);
            console.log(`   Will Process: After midnight UTC (${nextMidnight.toISOString()})`);
            console.log(`   Or: When you send new emails (triggers automatic processing)`);
            console.log(`   Or: Manually via API: POST /api/email/queue/process`);
            console.log('');
        } else {
            console.log('📬 Queue Status: No pending emails in queue');
            console.log('');
        }
    } else {
        console.log('📬 Queue Status: No queue file found (no emails queued)');
        console.log('');
    }
    
    // Answer user's questions
    console.log('💡 Answers to Your Questions:');
    console.log('');
    console.log('1. When will the clock rollover and emails be sent in queue?');
    console.log(`   → The day resets at: ${nextMidnight.toISOString()} (Midnight UTC)`);
    console.log(`   → Time until reset: ${formatTimeUntil(nextMidnight)}`);
    console.log(`   → Queued emails will be processed:`);
    console.log(`     • Automatically when you send new emails (triggers queue processing)`);
    console.log(`     • Automatically every hour (scheduled background job)`);
    console.log(`     • Manually via API: POST /api/email/queue/process`);
    console.log('');
    console.log('2. When will the account be able to send 200 emails?');
    console.log(`   → Day 2 limit is actually ${getDomainWarmupLimit(2)} emails (not 200)`);
    console.log(`   → Day 2 begins at: ${nextMidnight.toISOString()} (Midnight UTC)`);
    console.log(`   → Time until Day 2: ${formatTimeUntil(nextMidnight)}`);
    console.log(`   → Day 3 limit is ${getDomainWarmupLimit(3)} emails (first day with 200+ capacity)`);
    console.log('');
    
    console.log('═'.repeat(70));
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

