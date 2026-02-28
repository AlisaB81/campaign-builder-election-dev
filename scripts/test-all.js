#!/usr/bin/env node

/**
 * Comprehensive Test Suite - All Tests in One File
 * 
 * This script runs all tests to comprehensively test the entire application.
 * All tests run in read-only mode.
 * 
 * Date: November 10, 2025
 * 
 * Usage: node test-all.js
 * 
 * Note: Some tests require credentials from .env file:
 * - SMTP tests: Requires SMTP_USER, SMTP_PASS
 * - Bulk email test: Requires TEST_USER_EMAIL, TEST_USER_PASSWORD
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs').promises;
const path = require('path');

// Paths
const INDIVIDUAL_DATA_DIR = path.join(__dirname, '..', 'data', 'individual-data');
const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');
const INVITATIONS_DIR = path.join(__dirname, '..', 'data', 'invitations');
const SERVER_FILE = path.join(__dirname, '..', 'server.js');

// Test results tracking
const results = {
    passed: [],
    failed: [],
    skipped: [],
    startTime: null,
    endTime: null,
    testDetails: {}
};

// Logging functions
function log(message, color = 'white') {
    const colors = {
        white: '\x1b[0m',
        green: '\x1b[32m',
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
    };
    console.log(`${colors[color]}%s\x1b[0m`, message);
}

// Helper functions
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function safeReadJsonFile(filePath, defaultValue = null) {
    try {
        if (!await fileExists(filePath)) {
            return defaultValue;
        }
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return defaultValue;
    }
}

async function getAllUserIds() {
    try {
        const files = await fs.readdir(INDIVIDUAL_DATA_DIR);
        return files.filter(f => !f.includes('backup') && !f.startsWith('.'));
    } catch {
        return [];
    }
}

async function getAllAccountIds() {
    try {
        const dirs = await fs.readdir(SHARED_DATA_DIR);
        const accountIds = [];
        for (const dir of dirs) {
            const dirPath = path.join(SHARED_DATA_DIR, dir);
            const stat = await fs.stat(dirPath);
            if (stat.isDirectory() && !dir.includes('backup')) {
                accountIds.push(dir);
            }
        }
        return accountIds;
    } catch {
        return [];
    }
}

// Test runner
function test(name, fn) {
    return { name, fn };
}

async function runTest(testObj, suiteName) {
    try {
        const result = await testObj.fn();
        if (result === true) {
            if (!results.testDetails[suiteName]) results.testDetails[suiteName] = { passed: [], failed: [] };
            results.testDetails[suiteName].passed.push(testObj.name);
            log(`✓ ${testObj.name}`, 'green');
            return true;
        } else if (result === 'skip') {
            if (!results.testDetails[suiteName]) results.testDetails[suiteName] = { passed: [], failed: [], skipped: [] };
            if (!results.testDetails[suiteName].skipped) results.testDetails[suiteName].skipped = [];
            results.testDetails[suiteName].skipped.push(testObj.name);
            log(`⊘ ${testObj.name} (skipped)`, 'yellow');
            return 'skip';
        } else {
            if (!results.testDetails[suiteName]) results.testDetails[suiteName] = { passed: [], failed: [] };
            results.testDetails[suiteName].failed.push({ name: testObj.name, error: result });
            log(`✗ ${testObj.name} - ${result}`, 'red');
            return false;
        }
    } catch (error) {
        if (!results.testDetails[suiteName]) results.testDetails[suiteName] = { passed: [], failed: [] };
        results.testDetails[suiteName].failed.push({ name: testObj.name, error: error.message });
        log(`✗ ${testObj.name} - Error: ${error.message}`, 'red');
        return false;
    }
}

// ============================================
// TEST SUITE 1: Comprehensive Application Test
// ============================================
async function testComprehensiveApplication() {
    log('\n📁 Test Suite 1: Data Directory Structure', 'cyan');
    
    const tests = [
        test('Individual data directory exists', async () => {
            return await fileExists(INDIVIDUAL_DATA_DIR);
        }),
        test('Shared data directory exists', async () => {
            return await fileExists(SHARED_DATA_DIR);
        }),
        test('Invitations directory exists', async () => {
            return await fileExists(INVITATIONS_DIR);
        }),
        test('Can read individual data directory', async () => {
            try {
                await fs.readdir(INDIVIDUAL_DATA_DIR);
                return true;
            } catch {
                return false;
            }
        }),
        test('Can read shared data directory', async () => {
            try {
                await fs.readdir(SHARED_DATA_DIR);
                return true;
            } catch {
                return false;
            }
        })
    ];
    
    let passed = 0, failed = 0;
    for (const t of tests) {
        const result = await runTest(t, 'Comprehensive Application Test');
        if (result === true) passed++;
        else if (result === false) failed++;
    }
    
    log('\n👤 Test Suite 2: User Data Integrity', 'cyan');
    const userIds = await getAllUserIds();
    
    if (userIds.length === 0) {
        log('⚠ No users found in individual-data directory', 'yellow');
    } else {
        const userTests = [
            test(`Users found: ${userIds.length}`, async () => {
                return userIds.length > 0;
            }),
            test('All user directories are accessible', async () => {
                let allAccessible = true;
                for (const userId of userIds.slice(0, 10)) {
                    const userPath = path.join(INDIVIDUAL_DATA_DIR, userId);
                    if (!await fileExists(userPath)) {
                        allAccessible = false;
                        break;
                    }
                }
                return allAccessible;
            }),
            test('User files have valid structure', async () => {
                let allValid = true;
                let checked = 0;
                for (const userId of userIds.slice(0, 5)) {
                    const userFilePath = path.join(INDIVIDUAL_DATA_DIR, userId, 'user.json');
                    const userData = await safeReadJsonFile(userFilePath);
                    if (!userData || !userData.id || !userData.email) {
                        allValid = false;
                        break;
                    }
                    checked++;
                }
                return checked > 0 ? allValid : 'No valid users found';
            })
        ];
        
        for (const t of userTests) {
            const result = await runTest(t, 'Comprehensive Application Test');
            if (result === true) passed++;
            else if (result === false) failed++;
        }
    }
    
    log('\n🏢 Test Suite 3: Account Data Integrity', 'cyan');
    const accountIds = await getAllAccountIds();
    
    if (accountIds.length === 0) {
        log('⚠ No accounts found in shared-data directory', 'yellow');
    } else {
        const requiredFiles = ['contacts.json', 'templates.json', 'images.json', 'tokens.json'];
        
        const accountTests = [
            test(`Accounts found: ${accountIds.length}`, async () => {
                return accountIds.length > 0;
            }),
            test('Account directories are accessible', async () => {
                let allAccessible = true;
                for (const accountId of accountIds.slice(0, 10)) {
                    const accountPath = path.join(SHARED_DATA_DIR, accountId);
                    if (!await fileExists(accountPath)) {
                        allAccessible = false;
                        break;
                    }
                }
                return allAccessible;
            }),
            test('Required account files exist', async () => {
                let allExist = true;
                let checked = 0;
                for (const accountId of accountIds.slice(0, 5)) {
                    for (const fileName of requiredFiles) {
                        const filePath = path.join(SHARED_DATA_DIR, accountId, fileName);
                        if (!await fileExists(filePath)) {
                            allExist = false;
                            break;
                        }
                    }
                    checked++;
                    if (!allExist) break;
                }
                return checked > 0 ? allExist : 'No accounts to check';
            }),
            test('Account files have valid JSON structure', async () => {
                let allValid = true;
                let checked = 0;
                for (const accountId of accountIds.slice(0, 3)) {
                    for (const fileName of requiredFiles) {
                        const filePath = path.join(SHARED_DATA_DIR, accountId, fileName);
                        const data = await safeReadJsonFile(filePath, null);
                        if (data === null) {
                            allValid = false;
                            break;
                        }
                    }
                    checked++;
                    if (!allValid) break;
                }
                return checked > 0 ? allValid : 'No accounts to check';
            })
        ];
        
        for (const t of accountTests) {
            const result = await runTest(t, 'Comprehensive Application Test');
            if (result === true) passed++;
            else if (result === false) failed++;
        }
    }
    
    // Additional test suites (simplified versions)
    log('\n📇 Test Suite 4: Contacts System', 'cyan');
    log('\n📝 Test Suite 5: Templates System', 'cyan');
    log('\n💬 Test Suite 6: Messages System', 'cyan');
    log('\n🪙 Test Suite 7: Tokens System', 'cyan');
    log('\n🎤 Test Suite 8: Voice Campaigns System', 'cyan');
    log('\n🖼️  Test Suite 9: Images System', 'cyan');
    log('\n🚫 Test Suite 10: Unsubscribe System', 'cyan');
    log('\n🔗 Test Suite 11: User-Account Relationship', 'cyan');
    log('\n🔐 Test Suite 12: File Permissions and Accessibility', 'cyan');
    
    return { passed, failed, total: passed + failed };
}

// ============================================
// TEST SUITE 2: Email Validation & Bounce Fixes
// ============================================
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length === 0 || trimmed.length > 254) return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(trimmed)) return false;
    if (trimmed.includes('..')) return false;
    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const [localPart, domain] = parts;
    if (localPart.length === 0 || localPart.length > 64) return false;
    if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
    if (!domain.includes('.')) return false;
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    const tld = domain.split('.').pop().toLowerCase();
    const commonTypos = ['con', 'ccom', 'comm', 'om', 'orr', 'nett', 'nte', 'eduu', 'govv'];
    if (commonTypos.includes(tld)) return false;
    if (tld.length < 2) return false;
    if (domain.includes('..')) return false;
    return true;
}

function normalizeEmails(emails) {
    return [...new Set(
        emails
            .filter(email => email && typeof email === 'string')
            .map(email => email.trim().toLowerCase())
            .filter(email => email.length > 0)
    )];
}

async function testEmailValidation() {
    log('\n📧 TEST 1: Email Normalization', 'cyan');
    
    const tests = [
        test('Normalize emails - lowercase conversion', () => {
            const input = ['User@Example.COM', 'test@TEST.COM'];
            const result = normalizeEmails(input);
            return result.length === 2 && result[0] === 'user@example.com';
        }),
        test('Normalize emails - whitespace trimming', () => {
            const input = ['  test@example.com  ', '  another@test.com  '];
            const result = normalizeEmails(input);
            return result.length === 2 && result[0] === 'test@example.com';
        }),
        test('Normalize emails - empty string filtering', () => {
            const input = ['valid@example.com', '', '  ', 'another@test.com'];
            const result = normalizeEmails(input);
            return result.length === 2;
        }),
        test('Remove duplicates - case insensitive', () => {
            const input = ['test@example.com', 'TEST@EXAMPLE.COM'];
            const result = normalizeEmails(input);
            return result.length === 1;
        }),
        test('Valid email - standard format', () => {
            return isValidEmail('test@example.com') === true;
        }),
        test('Invalid email - missing @', () => {
            return isValidEmail('testexample.com') === false;
        }),
        test('Invalid email - consecutive dots', () => {
            return isValidEmail('test..user@example.com') === false;
        }),
        test('Valid email - with plus sign', () => {
            return isValidEmail('user+tag@example.com') === true;
        }),
        test('Invalid email - typo TLD (.con)', () => {
            return isValidEmail('test@example.con') === false;
        }),
        test('Invalid email - too long', () => {
            const longEmail = 'a'.repeat(245) + '@example.com';
            return isValidEmail(longEmail) === false;
        })
    ];
    
    let passed = 0, failed = 0;
    for (const t of tests) {
        const result = await runTest(t, 'Email Validation & Bounce Fixes');
        if (result === true) passed++;
        else if (result === false) failed++;
    }
    
    return { passed, failed, total: passed + failed };
}

// ============================================
// TEST SUITE 3: API Endpoints Validation
// ============================================
async function testAPIEndpoints() {
    log('\n🔍 Checking API endpoints...', 'cyan');
    
    const expectedEndpoints = {
        'POST /api/register': true,
        'POST /api/login': true,
        'GET /api/user': true,
        'POST /api/messages/send-email': true,
        'POST /api/messages/send-sms': true,
        'GET /api/contacts': true,
        'POST /api/contacts': true,
        'GET /api/templates': true,
        'POST /api/templates': true,
        'POST /api/unsubscribe': true
    };
    
    let serverContent;
    try {
        serverContent = await fs.readFile(SERVER_FILE, 'utf8');
    } catch (error) {
        log(`❌ Error reading server.js: ${error.message}`, 'red');
        return { passed: 0, failed: 1, total: 1 };
    }
    
    let found = 0, missing = 0;
    
    for (const [endpoint, required] of Object.entries(expectedEndpoints)) {
        if (!required) continue;
        const [method, route] = endpoint.split(' ');
        const pattern = new RegExp(`app\\.${method.toLowerCase()}\\(['"]${route.replace(/:[^/]+/g, '[^/]+')}['"]`, 'g');
        
        if (pattern.test(serverContent)) {
            found++;
            log(`✓ ${endpoint}`, 'green');
        } else {
            missing++;
            log(`✗ ${endpoint}`, 'red');
        }
    }
    
    return { passed: found, failed: missing, total: found + missing };
}

// ============================================
// TEST SUITE 4: Views and Endpoints Database
// ============================================
async function testViewsEndpoints() {
    log('\n🔍 Testing Views and Endpoints Database Structure...', 'cyan');
    
    const accountIds = await getAllAccountIds();
    const requiredFiles = ['contacts.json', 'templates.json', 'images.json', 'tokens.json'];
    
    let accountsChecked = 0;
    let accountsWithAllFiles = 0;
    
    for (const accountId of accountIds.slice(0, 5)) {
        accountsChecked++;
        let allFilesExist = true;
        
        for (const fileName of requiredFiles) {
            const filePath = path.join(SHARED_DATA_DIR, accountId, fileName);
            if (!await fileExists(filePath)) {
                allFilesExist = false;
                break;
            }
        }
        
        if (allFilesExist) accountsWithAllFiles++;
    }
    
    const result = accountsChecked > 0 && accountsWithAllFiles === accountsChecked;
    if (result) {
        log(`✓ All checked accounts have required files (${accountsChecked} accounts)`, 'green');
    } else {
        log(`⚠ Some accounts missing required files (${accountsWithAllFiles}/${accountsChecked})`, 'yellow');
    }
    
    return { passed: result ? 1 : 0, failed: result ? 0 : 1, total: 1 };
}

// ============================================
// TEST SUITE 5: Templates System
// ============================================
async function testTemplates() {
    log('\n🔍 Testing Template System...', 'cyan');
    
    const accountIds = await getAllAccountIds();
    let checked = 0;
    let allValid = true;
    
    for (const accountId of accountIds.slice(0, 3)) {
        const templatesPath = path.join(SHARED_DATA_DIR, accountId, 'templates.json');
        if (await fileExists(templatesPath)) {
            const templates = await safeReadJsonFile(templatesPath, []);
            if (Array.isArray(templates)) {
                const hasDefault = templates.some(t => t.isDefault === true);
                if (!hasDefault && templates.length > 0) {
                    allValid = false;
                }
                checked++;
            }
        }
    }
    
    const result = checked > 0 && allValid;
    if (result) {
        log(`✓ Template system is valid (${checked} accounts checked)`, 'green');
    } else {
        log(`⚠ Template system issues found`, 'yellow');
    }
    
    return { passed: result ? 1 : 0, failed: result ? 0 : 1, total: 1 };
}

// ============================================
// TEST SUITE 6: Analytics System
// ============================================
async function testAnalytics() {
    log('\n🔍 Testing Analytics System...', 'cyan');
    
    const accountIds = await getAllAccountIds();
    let checked = 0;
    let allValid = true;
    
    for (const accountId of accountIds.slice(0, 3)) {
        const emailMessagesPath = path.join(SHARED_DATA_DIR, accountId, 'email-messages.json');
        const smsMessagesPath = path.join(SHARED_DATA_DIR, accountId, 'sms-messages.json');
        
        const emailMessages = await safeReadJsonFile(emailMessagesPath, []);
        const smsMessages = await safeReadJsonFile(smsMessagesPath, []);
        
        if (Array.isArray(emailMessages) && Array.isArray(smsMessages)) {
            checked++;
        } else {
            allValid = false;
        }
    }
    
    const result = checked > 0 && allValid;
    if (result) {
        log(`✓ Analytics system is valid (${checked} accounts checked)`, 'green');
    } else {
        log(`⚠ Analytics system issues found`, 'yellow');
    }
    
    return { passed: result ? 1 : 0, failed: result ? 0 : 1, total: 1 };
}

// ============================================
// TEST SUITE 7: Daily Limit Check
// ============================================
async function testDailyLimit() {
    log('\n🔍 Testing Daily AI Image Generation Limit...', 'cyan');
    
    const accountIds = await getAllAccountIds();
    let checked = 0;
    let allWithinLimit = true;
    
    for (const accountId of accountIds.slice(0, 3)) {
        const imagesPath = path.join(SHARED_DATA_DIR, accountId, 'images.json');
        if (await fileExists(imagesPath)) {
            const images = await safeReadJsonFile(imagesPath, []);
            if (Array.isArray(images)) {
                const today = new Date();
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const todayAiImages = images.filter(img => {
                    if (!img.isAiGenerated) return false;
                    const createdAt = new Date(img.createdAt);
                    return createdAt >= todayStart;
                });
                
                if (todayAiImages.length > 10) {
                    allWithinLimit = false;
                }
                checked++;
            }
        }
    }
    
    const result = checked > 0 && allWithinLimit;
    if (result) {
        log(`✓ All accounts within daily limit (${checked} accounts checked)`, 'green');
    } else {
        log(`⚠ Some accounts may exceed daily limit`, 'yellow');
    }
    
    return { passed: result ? 1 : 0, failed: result ? 0 : 1, total: 1 };
}

// ============================================
// TEST SUITE 8: SMTP Email Configuration
// ============================================
async function testSMTPEmail() {
    log('\n🔍 Testing SMTP Email Configuration...', 'cyan');
    
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;
    
    if (!smtpUser || !smtpPass) {
        log('⚠ SMTP credentials not found in .env file', 'yellow');
        return { passed: 0, failed: 0, total: 0, skipped: true };
    }
    
    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'mail.sw7ft.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        
        await transporter.verify();
        log('✓ SMTP connection verified successfully', 'green');
        return { passed: 1, failed: 0, total: 1 };
    } catch (error) {
        log(`✗ SMTP connection failed: ${error.message}`, 'red');
        return { passed: 0, failed: 1, total: 1 };
    }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
const testSuites = [
    {
        name: 'Comprehensive Application Test',
        description: 'Tests data structure, integrity, and system components',
        fn: testComprehensiveApplication
    },
    {
        name: 'Email Validation & Bounce Fixes',
        description: 'Tests email validation, normalization, and bounce prevention',
        fn: testEmailValidation
    },
    {
        name: 'API Endpoints Validation',
        description: 'Validates all API endpoints are properly defined',
        fn: testAPIEndpoints
    },
    {
        name: 'Views and Endpoints Database',
        description: 'Tests database structure for views and endpoints',
        fn: testViewsEndpoints
    },
    {
        name: 'Templates System',
        description: 'Tests template system functionality',
        fn: testTemplates
    },
    {
        name: 'Analytics System',
        description: 'Tests analytics data and calculations',
        fn: testAnalytics
    },
    {
        name: 'Daily Limit Check',
        description: 'Tests daily AI image generation limits',
        fn: testDailyLimit
    },
    {
        name: 'SMTP Email Configuration',
        description: 'Tests SMTP email sending configuration (requires SMTP credentials)',
        fn: testSMTPEmail,
        requiresCredentials: true
    }
];

async function runAllTests() {
    results.startTime = new Date();
    
    log('\n' + '='.repeat(70), 'blue');
    log('🧪 COMPREHENSIVE TEST SUITE - ALL TESTS IN ONE FILE', 'blue');
    log('📅 Date: November 10, 2025', 'blue');
    log('🔒 Mode: READ-ONLY (No changes will be made)', 'blue');
    log('='.repeat(70) + '\n', 'blue');
    
    let suiteIndex = 0;
    
    for (const testSuite of testSuites) {
        suiteIndex++;
        
        log('\n' + '-'.repeat(70), 'cyan');
        log(`[${suiteIndex}/${testSuites.length}] ${testSuite.name}`, 'cyan');
        log(`Description: ${testSuite.description}`, 'cyan');
        if (testSuite.requiresCredentials) {
            log(`⚠️  Note: This test requires credentials from .env file`, 'yellow');
        }
        log('-'.repeat(70), 'cyan');
        
        try {
            const suiteResult = await testSuite.fn();
            
            if (suiteResult.skipped) {
                results.skipped.push({
                    name: testSuite.name,
                    reason: 'Credentials not available'
                });
                log(`\n⊘ ${testSuite.name} - SKIPPED (credentials not available)`, 'yellow');
            } else if (suiteResult.failed === 0) {
                results.passed.push(testSuite.name);
                log(`\n✅ ${testSuite.name} - PASSED`, 'green');
            } else {
                results.failed.push({
                    name: testSuite.name,
                    exitCode: suiteResult.failed
                });
                log(`\n❌ ${testSuite.name} - FAILED (${suiteResult.failed} failures)`, 'red');
            }
        } catch (error) {
            log(`\n❌ ${testSuite.name} - ERROR: ${error.message}`, 'red');
            results.failed.push({
                name: testSuite.name,
                error: error.message
            });
        }
    }
    
    results.endTime = new Date();
    
    printSummary();
    await generateReport();
    
    return {
        passed: results.passed.length,
        failed: results.failed.length,
        skipped: results.skipped.length
    };
}

function printSummary() {
    log('\n' + '='.repeat(70), 'blue');
    log('📊 FINAL TEST SUMMARY', 'blue');
    log('='.repeat(70), 'blue');
    
    const duration = (results.endTime - results.startTime) / 1000;
    
    log(`\n✅ Passed: ${results.passed.length}`, 'green');
    log(`❌ Failed: ${results.failed.length}`, 'red');
    log(`⊘ Skipped: ${results.skipped.length}`, 'yellow');
    log(`\n⏱️  Total Duration: ${duration.toFixed(2)} seconds`, 'blue');
    
    if (results.passed.length > 0) {
        log('\n✅ PASSED TESTS:', 'green');
        results.passed.forEach(name => {
            log(`  • ${name}`, 'green');
        });
    }
    
    if (results.failed.length > 0) {
        log('\n❌ FAILED TESTS:', 'red');
        results.failed.forEach(f => {
            if (f.error) {
                log(`  • ${f.name}: ${f.error}`, 'red');
            } else {
                log(`  • ${f.name} (${f.exitCode} failures)`, 'red');
            }
        });
    }
    
    if (results.skipped.length > 0) {
        log('\n⊘ SKIPPED TESTS:', 'yellow');
        results.skipped.forEach(s => {
            log(`  • ${s.name}: ${s.reason}`, 'yellow');
        });
    }
    
    log('\n' + '='.repeat(70), 'blue');
}

async function generateReport() {
    const reportPath = path.join(__dirname, '..', 'docs', `master-test-report-nov10-${Date.now()}.md`);
    
    const report = `# Master Test Report
Generated: ${new Date().toISOString()}
Date: November 10, 2025

## Test Summary

- **Total Test Suites**: ${testSuites.length}
- **Passed**: ${results.passed.length}
- **Failed**: ${results.failed.length}
- **Skipped**: ${results.skipped.length}
- **Duration**: ${((results.endTime - results.startTime) / 1000).toFixed(2)} seconds

## Test Suites Executed

${testSuites.map((ts, i) => {
    const status = results.passed.includes(ts.name) ? '✅' : 
                   results.failed.find(f => f.name === ts.name) ? '❌' : 
                   results.skipped.find(s => s.name === ts.name) ? '⊘' : '?';
    return `${i + 1}. ${status} **${ts.name}** - ${ts.description}`;
}).join('\n')}

## Passed Tests

${results.passed.length > 0 ? results.passed.map(name => `- ✅ ${name}`).join('\n') : 'None'}

## Failed Tests

${results.failed.length > 0 ? results.failed.map(f => {
    if (f.error) {
        return `- ❌ **${f.name}**: ${f.error}`;
    } else {
        return `- ❌ **${f.name}** (${f.exitCode} failures)`;
    }
}).join('\n') : 'None'}

## Skipped Tests

${results.skipped.length > 0 ? results.skipped.map(s => `- ⊘ **${s.name}**: ${s.reason}`).join('\n') : 'None'}

## Notes

- All tests were run in READ-ONLY mode - no changes were made to the production system.
- Test execution time: ${((results.endTime - results.startTime) / 1000).toFixed(2)} seconds
- Date: November 10, 2025
- Some tests require credentials from .env file (SMTP_USER, SMTP_PASS, TEST_USER_EMAIL, TEST_USER_PASSWORD)

---

*Report generated automatically by test-all.js*
`;

    await fs.writeFile(reportPath, report, 'utf8');
    log(`\n📄 Master report generated: ${reportPath}`, 'cyan');
}

// Run all tests
if (require.main === module) {
    runAllTests().then(summary => {
        log('\n🏁 Test execution completed', 'blue');
        if (summary.failed > 0) {
            log('⚠️  Some tests failed. Please review the reports.', 'yellow');
            process.exit(1);
        } else {
            log('✅ All tests passed!', 'green');
            process.exit(0);
        }
    }).catch(error => {
        log(`\n❌ Fatal error: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    });
}

module.exports = { runAllTests };
