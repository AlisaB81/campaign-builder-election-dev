#!/usr/bin/env node
/**
 * Security Scan Script for Campaign Builder
 * Checks for exposed secrets, sensitive data, and security issues before git push
 * 
 * Run: node scripts/test-security-secrets.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let errors = [];
let warnings = [];
let passed = [];

console.log('\n' + BLUE + '═══════════════════════════════════════════════════════════════' + RESET);
console.log(BLUE + '  CAMPAIGN BUILDER - PRE-COMMIT SECURITY SCAN' + RESET);
console.log(BLUE + '═══════════════════════════════════════════════════════════════' + RESET + '\n');

// ===== 1. CHECK .GITIGNORE EXISTS AND IS CONFIGURED =====
console.log(BLUE + '▶ Checking .gitignore configuration...' + RESET);

const gitignorePath = path.join(ROOT_DIR, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
    errors.push('.gitignore file is MISSING!');
} else {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = [
        { pattern: '.env', desc: 'Environment files (.env)' },
        { pattern: 'data/', desc: 'User data directory (data/)' },
        { pattern: 'node_modules/', desc: 'Dependencies (node_modules/)' },
        { pattern: 'security-logs/', desc: 'Security logs' },
        { pattern: '*.backup', desc: 'Backup files' },
    ];
    
    requiredPatterns.forEach(({ pattern, desc }) => {
        if (gitignore.includes(pattern)) {
            passed.push(`✓ ${desc} is in .gitignore`);
        } else {
            errors.push(`${desc} is NOT in .gitignore!`);
        }
    });
}

// ===== 2. CHECK FOR TRACKED SENSITIVE FILES =====
console.log(BLUE + '▶ Checking for tracked sensitive files...' + RESET);

try {
    const trackedFiles = execSync('git ls-files', { cwd: ROOT_DIR, encoding: 'utf8' });
    const sensitivePatterns = [
        { pattern: /\.env$/i, desc: '.env file' },
        { pattern: /\.env\./i, desc: '.env.* file' },
        { pattern: /backup/i, desc: 'backup file' },
        { pattern: /^data\//i, desc: 'data/ directory file' },
        { pattern: /security-logs\//i, desc: 'security-logs file' },
        { pattern: /credentials/i, desc: 'credentials file' },
        { pattern: /secrets?\.json$/i, desc: 'secrets file' },
    ];
    
    const trackedList = trackedFiles.split('\n').filter(f => f.trim());
    
    trackedList.forEach(file => {
        sensitivePatterns.forEach(({ pattern, desc }) => {
            if (pattern.test(file)) {
                errors.push(`TRACKED: ${file} (${desc})`);
            }
        });
    });
    
    if (errors.filter(e => e.startsWith('TRACKED:')).length === 0) {
        passed.push('✓ No sensitive files are tracked by git');
    }
} catch (e) {
    warnings.push('Could not check git tracked files (not a git repo?)');
}

// ===== 3. SCAN CODE FOR HARDCODED SECRETS =====
console.log(BLUE + '▶ Scanning code for hardcoded secrets...' + RESET);

const secretPatterns = [
    { pattern: /['"`]sk[-_]live[-_][a-zA-Z0-9]{20,}['"`]/g, desc: 'Stripe live secret key' },
    { pattern: /['"`]sk[-_]test[-_][a-zA-Z0-9]{20,}['"`]/g, desc: 'Stripe test secret key' },
    { pattern: /['"`]pk[-_]live[-_][a-zA-Z0-9]{20,}['"`]/g, desc: 'Stripe live publishable key' },
    { pattern: /['"`]AC[a-f0-9]{32}['"`]/g, desc: 'Twilio Account SID' },
    { pattern: /['"`][a-f0-9]{32}['"`]/g, desc: 'Possible API token (32 char hex)', checkContext: true },
    { pattern: /password\s*[:=]\s*['"`][^'"`]{8,}['"`]/gi, desc: 'Hardcoded password' },
    { pattern: /api[-_]?key\s*[:=]\s*['"`][a-zA-Z0-9_-]{20,}['"`]/gi, desc: 'Hardcoded API key' },
    { pattern: /secret\s*[:=]\s*['"`][a-zA-Z0-9_-]{20,}['"`]/gi, desc: 'Hardcoded secret' },
    { pattern: /auth[-_]?token\s*[:=]\s*['"`][a-zA-Z0-9_-]{20,}['"`]/gi, desc: 'Hardcoded auth token' },
    { pattern: /['"`]eyJ[a-zA-Z0-9_-]{50,}['"`]/g, desc: 'Hardcoded JWT token' },
];

const filesToScan = [
    'server.js',
    'config.js',
    'js/utils/api.js',
    'js/utils/imagePromptBuilder.js',
];

// Scan EJS files too
const viewsDir = path.join(ROOT_DIR, 'views');
if (fs.existsSync(viewsDir)) {
    const ejsFiles = fs.readdirSync(viewsDir, { recursive: true })
        .filter(f => f.endsWith('.ejs'))
        .map(f => path.join('views', f));
    filesToScan.push(...ejsFiles);
}

let secretsFound = 0;
filesToScan.forEach(file => {
    const filePath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    secretPatterns.forEach(({ pattern, desc, checkContext }) => {
        const matches = content.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // Skip false positives
                if (match.includes('process.env')) return;
                if (match.includes('placeholder')) return;
                if (match.includes('your_')) return;
                if (match.includes('example')) return;
                if (match.includes('xxx')) return;
                if (match.includes('...')) return;
                
                // For 32-char hex, only flag if it looks like a real token
                if (checkContext) {
                    if (!/[0-9]/.test(match) || !/[a-f]/i.test(match)) return;
                }
                
                secretsFound++;
                warnings.push(`Possible ${desc} in ${file}: ${match.substring(0, 40)}...`);
            });
        }
    });
});

if (secretsFound === 0) {
    passed.push('✓ No obvious hardcoded secrets found in code');
}

// ===== 4. CHECK .ENV FILE EXISTS (should exist but not be tracked) =====
console.log(BLUE + '▶ Checking environment configuration...' + RESET);

const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
    passed.push('✓ .env file exists (for local configuration)');
    
    // Check it's not tracked
    try {
        const isTracked = execSync(`git ls-files --error-unmatch .env 2>/dev/null`, { cwd: ROOT_DIR, encoding: 'utf8' });
        errors.push('.env file is TRACKED BY GIT! Remove it immediately!');
    } catch (e) {
        passed.push('✓ .env file is NOT tracked by git');
    }
} else {
    warnings.push('.env file does not exist (may be okay if using system env vars)');
}

// ===== 5. CHECK DATA DIRECTORY IS NOT TRACKED =====
console.log(BLUE + '▶ Checking data directory protection...' + RESET);

const dataDir = path.join(ROOT_DIR, 'data');
if (fs.existsSync(dataDir)) {
    try {
        const trackedDataFiles = execSync(`git ls-files data/ 2>/dev/null`, { cwd: ROOT_DIR, encoding: 'utf8' });
        if (trackedDataFiles.trim()) {
            errors.push(`Data directory files are TRACKED: ${trackedDataFiles.split('\n').slice(0, 3).join(', ')}...`);
        } else {
            passed.push('✓ data/ directory is not tracked by git');
        }
    } catch (e) {
        passed.push('✓ data/ directory is not tracked by git');
    }
}

// ===== 6. CHECK FOR SENSITIVE DATA IN STAGED FILES =====
console.log(BLUE + '▶ Checking staged files for sensitive data...' + RESET);

try {
    // Get files staged for ADDITION (not deletion) - these are the ones we need to worry about
    const stagedAdditions = execSync('git diff --cached --name-only --diff-filter=A 2>/dev/null', { cwd: ROOT_DIR, encoding: 'utf8' });
    const stagedModifications = execSync('git diff --cached --name-only --diff-filter=M 2>/dev/null', { cwd: ROOT_DIR, encoding: 'utf8' });
    const staged = [...stagedAdditions.split('\n'), ...stagedModifications.split('\n')].filter(f => f.trim());
    
    // Also check for deletions (these are safe - we're removing sensitive files)
    const stagedDeletions = execSync('git diff --cached --name-only --diff-filter=D 2>/dev/null', { cwd: ROOT_DIR, encoding: 'utf8' });
    const deletions = stagedDeletions.split('\n').filter(f => f.trim());
    
    if (deletions.length > 0) {
        const sensitiveDeletions = deletions.filter(f => /\.env|data\/|credentials|secrets?\.json/i.test(f));
        if (sensitiveDeletions.length > 0) {
            passed.push(`✓ ${sensitiveDeletions.length} sensitive file(s) staged for REMOVAL from git (good!)`);
        }
    }
    
    if (staged.length > 0) {
        console.log(`   Found ${staged.length} staged file(s) for addition/modification`);
        
        staged.forEach(file => {
            // Check if any staged file is sensitive
            if (/\.env|backup|data\/|credentials|secrets?\.json/i.test(file)) {
                errors.push(`STAGED SENSITIVE FILE (ADDITION): ${file}`);
            }
        });
        
        if (errors.filter(e => e.startsWith('STAGED')).length === 0) {
            passed.push('✓ No sensitive files being ADDED to staging area');
        }
    } else {
        passed.push('✓ No files staged for addition/modification');
    }
} catch (e) {
    // Not a git repo or no staged files
}

// ===== 7. CHECK FOR USER DATA IN PUBLIC DIRECTORY =====
console.log(BLUE + '▶ Checking public directory for user data...' + RESET);

const publicDir = path.join(ROOT_DIR, 'public');
if (fs.existsSync(publicDir)) {
    const checkPublicForSensitive = (dir, depth = 0) => {
        if (depth > 3) return; // Don't go too deep
        
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                if (['uploads', 'user-data', 'private'].includes(item.toLowerCase())) {
                    warnings.push(`Potentially sensitive directory in public: ${itemPath.replace(ROOT_DIR, '')}`);
                }
                checkPublicForSensitive(itemPath, depth + 1);
            } else {
                if (/\.json$/i.test(item) && !/package/i.test(item)) {
                    // Check if it contains user data
                    try {
                        const content = fs.readFileSync(itemPath, 'utf8');
                        if (content.includes('@') && content.includes('email')) {
                            warnings.push(`Possible user data in public: ${itemPath.replace(ROOT_DIR, '')}`);
                        }
                    } catch (e) {}
                }
            }
        });
    };
    
    checkPublicForSensitive(publicDir);
    passed.push('✓ Public directory scanned for sensitive data');
}

// ===== 8. VERIFY CRITICAL ENVIRONMENT VARIABLES ARE SET =====
console.log(BLUE + '▶ Checking required environment variables...' + RESET);

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
        'JWT_SECRET',
        'SMTP_USER',
        'SMTP_PASS',
    ];
    
    requiredVars.forEach(varName => {
        const regex = new RegExp(`^${varName}=.+`, 'm');
        if (regex.test(envContent)) {
            passed.push(`✓ ${varName} is configured`);
        } else {
            warnings.push(`${varName} may not be set in .env`);
        }
    });
}

// ===== RESULTS =====
console.log('\n' + BLUE + '═══════════════════════════════════════════════════════════════' + RESET);
console.log(BLUE + '  SCAN RESULTS' + RESET);
console.log(BLUE + '═══════════════════════════════════════════════════════════════' + RESET + '\n');

if (passed.length > 0) {
    console.log(GREEN + 'PASSED (' + passed.length + ')' + RESET);
    passed.forEach(p => console.log('  ' + GREEN + p + RESET));
    console.log('');
}

if (warnings.length > 0) {
    console.log(YELLOW + 'WARNINGS (' + warnings.length + ')' + RESET);
    warnings.forEach(w => console.log('  ' + YELLOW + '⚠ ' + w + RESET));
    console.log('');
}

if (errors.length > 0) {
    console.log(RED + 'ERRORS (' + errors.length + ')' + RESET);
    errors.forEach(e => console.log('  ' + RED + '✗ ' + e + RESET));
    console.log('');
}

// ===== FINAL VERDICT =====
console.log(BLUE + '═══════════════════════════════════════════════════════════════' + RESET);
if (errors.length > 0) {
    console.log(RED + '  ✗ SECURITY CHECK FAILED - DO NOT PUSH TO GIT' + RESET);
    console.log(RED + '    Fix the errors above before committing.' + RESET);
    process.exit(1);
} else if (warnings.length > 0) {
    console.log(YELLOW + '  ⚠ SECURITY CHECK PASSED WITH WARNINGS' + RESET);
    console.log(YELLOW + '    Review warnings above before pushing.' + RESET);
    process.exit(0);
} else {
    console.log(GREEN + '  ✓ SECURITY CHECK PASSED - SAFE TO PUSH' + RESET);
    process.exit(0);
}
console.log(BLUE + '═══════════════════════════════════════════════════════════════' + RESET + '\n');
