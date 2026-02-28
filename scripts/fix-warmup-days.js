#!/usr/bin/env node

/**
 * Script to fix warm-up currentDay values that are stuck
 * Updates all domains to use the actual elapsed days since firstSendDate
 */

const fs = require('fs');
const path = require('path');

const SHARED_DATA_DIR = path.join(__dirname, 'data', 'shared-data');

async function fixWarmupDays() {
    console.log('=== Fixing warm-up currentDay values ===\n');
    
    if (!fs.existsSync(SHARED_DATA_DIR)) {
        console.log('Shared data directory does not exist');
        return;
    }
    
    const accountDirs = fs.readdirSync(SHARED_DATA_DIR).filter(f => {
        const accountPath = path.join(SHARED_DATA_DIR, f);
        return fs.statSync(accountPath).isDirectory();
    });
    
    let fixed = 0;
    
    for (const accountDir of accountDirs) {
        const warmupPath = path.join(SHARED_DATA_DIR, accountDir, 'domain-warmup.json');
        if (!fs.existsSync(warmupPath)) {
            continue;
        }
        
        try {
            const warmupData = JSON.parse(fs.readFileSync(warmupPath, 'utf8'));
            let updated = false;
            
            for (const [domain, data] of Object.entries(warmupData)) {
                if (data.firstSendDate) {
                    const firstSendDate = new Date(data.firstSendDate);
                    const today = new Date();
                    const daysSinceFirst = Math.floor((today - firstSendDate) / (1000 * 60 * 60 * 24)) + 1;
                    
                    if (data.currentDay !== daysSinceFirst) {
                        console.log(`Account ${accountDir}, Domain ${domain}:`);
                        console.log(`  Old currentDay: ${data.currentDay}`);
                        console.log(`  New currentDay: ${daysSinceFirst} (${daysSinceFirst} days since ${firstSendDate.toISOString().split('T')[0]})`);
                        data.currentDay = daysSinceFirst;
                        updated = true;
                        fixed++;
                    }
                }
            }
            
            if (updated) {
                fs.writeFileSync(warmupPath, JSON.stringify(warmupData, null, 2), 'utf8');
                console.log(`  ✓ Updated\n`);
            }
        } catch (error) {
            console.error(`Error processing ${accountDir}:`, error.message);
        }
    }
    
    console.log(`\n=== Fixed ${fixed} domain(s) ===`);
}

fixWarmupDays().catch(console.error);

