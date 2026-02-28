#!/usr/bin/env node

/**
 * SMTP Email Test Script with Deliverability Checking
 * 
 * Tests SMTP email deliverability with custom SMTP server configuration.
 * 
 * Features:
 *  - SMTP connection and authentication testing
 *  - Spam blacklist checking (10+ major blacklists)
 *  - DNS record verification (SPF, DMARC, MX, PTR)
 *  - Domain configuration validation for Gmail/Yahoo/Outlook/Live
 *  - Comprehensive deliverability scoring
 * 
 * Usage:
 *   node scripts/test-smtp.js
 *   node scripts/test-smtp.js --host smtp.example.com --port 587 --user user@example.com --pass password
 *   node scripts/test-smtp.js --config-file /path/to/config.json
 * 
 * Environment Variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
 */

const nodemailer = require('nodemailer');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--host' && args[i + 1]) {
      config.host = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      config.port = parseInt(args[++i]);
    } else if (arg === '--user' && args[i + 1]) {
      config.user = args[++i];
    } else if (arg === '--pass' && args[i + 1]) {
      config.pass = args[++i];
    } else if (arg === '--secure' && args[i + 1]) {
      config.secure = args[++i].toLowerCase() === 'true';
    } else if (arg === '--from' && args[i + 1]) {
      config.from = args[++i];
    } else if (arg === '--to' && args[i + 1]) {
      config.to = args[++i];
    } else if (arg === '--config-file' && args[i + 1]) {
      config.configFile = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  
  return config;
}

// Load configuration from file
function loadConfigFile(filePath) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading config file: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Get configuration from various sources
function getConfig() {
  const args = parseArgs();
  
  // Priority: command line args > config file > environment variables > defaults
  let config = {};
  
  // Load from config file if specified
  if (args.configFile) {
    const fileConfig = loadConfigFile(args.configFile);
    config = { ...config, ...fileConfig };
  }
  
  // Override with command line arguments
  config = { ...config, ...args };
  
  // Fill in from environment variables if not set
  config.host = config.host || process.env.SMTP_HOST || 'mail.sw7ft.com';
  config.port = config.port || parseInt(process.env.SMTP_PORT) || 465;
  config.user = config.user || process.env.SMTP_USER || process.env.EMAIL_USER;
  config.pass = config.pass || process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;
  config.secure = config.secure !== undefined ? config.secure : (process.env.SMTP_SECURE === 'true' || config.port === 465);
  config.from = config.from || config.user || 'test@example.com';
  config.to = config.to || config.user || 'test@example.com';
  
  return config;
}

// Create readline interface for interactive input
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt for user input
function question(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Get configuration interactively
async function getConfigInteractive() {
  const rl = createReadline();
  const config = {};
  
  console.log(`${colors.cyan}${colors.bright}SMTP Configuration${colors.reset}`);
  console.log(`${colors.cyan}Press Enter to use defaults or environment variables${colors.reset}\n`);
  
  config.host = await question(rl, `SMTP Host [${process.env.SMTP_HOST || 'mail.sw7ft.com'}]: `);
  if (!config.host) config.host = process.env.SMTP_HOST || 'mail.sw7ft.com';
  
  config.port = await question(rl, `SMTP Port [${process.env.SMTP_PORT || '465'}]: `);
  config.port = config.port ? parseInt(config.port) : (parseInt(process.env.SMTP_PORT) || 465);
  
  config.user = await question(rl, `SMTP Username [${process.env.SMTP_USER || ''}]: `);
  if (!config.user) config.user = process.env.SMTP_USER || process.env.EMAIL_USER;
  
  config.pass = await question(rl, `SMTP Password [hidden]: `);
  if (!config.pass) config.pass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;
  
  // Auto-configure secure setting based on port with explanation
  let securePrompt;
  let secureDefault;
  
  if (config.port === 465) {
    securePrompt = `Use secure connection (implicit TLS/SSL - recommended for port 465) [true]: `;
    secureDefault = true;
  } else if (config.port === 587) {
    securePrompt = `Use secure connection (STARTTLS - use 'false' for port 587, 'true' for implicit TLS) [false]: `;
    secureDefault = false;
  } else {
    securePrompt = `Use secure connection (TLS/SSL) [${config.port === 465 ? 'true' : 'false'}]: `;
    secureDefault = config.port === 465;
  }
  
  const secureInput = await question(rl, securePrompt);
  config.secure = secureInput ? (secureInput.toLowerCase() === 'true') : secureDefault;
  
  config.from = await question(rl, `From email address [${config.user || 'test@example.com'}]: `);
  if (!config.from) config.from = config.user || 'test@example.com';
  
  config.to = await question(rl, `To email address [${config.user || 'test@example.com'}]: `);
  if (!config.to) config.to = config.user || 'test@example.com';
  
  rl.close();
  return config;
}

// Validate configuration
function validateConfig(config) {
  const errors = [];
  
  if (!config.host) {
    errors.push('SMTP host is required');
  }
  
  if (!config.port || isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('Valid SMTP port is required (1-65535)');
  }
  
  if (!config.user) {
    errors.push('SMTP username is required');
  }
  
  if (!config.pass) {
    errors.push('SMTP password is required');
  }
  
  if (!config.from || !config.from.includes('@')) {
    errors.push('Valid from email address is required');
  }
  
  if (!config.to || !config.to.includes('@')) {
    errors.push('Valid to email address is required');
  }
  
  return errors;
}

// Test SMTP connection
async function testConnection(transporter) {
  try {
    console.log(`${colors.blue}Testing SMTP connection...${colors.reset}`);
    await transporter.verify();
    console.log(`${colors.green}✓ Connection successful!${colors.reset}\n`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Connection failed: ${error.message}${colors.reset}`);
    
    // Provide helpful diagnostics for common errors
    if (error.message.includes('wrong version number') || error.message.includes('SSL routines')) {
      console.error(`${colors.yellow}⚠ SSL/TLS Configuration Issue Detected:${colors.reset}`);
      console.error(`${colors.yellow}  Port 587 typically uses STARTTLS (secure: false)${colors.reset}`);
      console.error(`${colors.yellow}  Port 465 uses implicit TLS/SSL (secure: true)${colors.reset}`);
      console.error(`${colors.yellow}  Try toggling the secure setting and test again.${colors.reset}`);
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error(`${colors.yellow}⚠ Connection refused - check if the host and port are correct.${colors.reset}`);
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error(`${colors.yellow}⚠ Connection timed out - check firewall settings or network connectivity.${colors.reset}`);
    } else if (error.message.includes('ENOTFOUND')) {
      console.error(`${colors.yellow}⚠ Host not found - check the SMTP hostname.${colors.reset}`);
    }
    
    console.log('');
    return false;
  }
}

// Send test email
async function sendTestEmail(transporter, config) {
  const testSubject = `SMTP Test Email - ${new Date().toISOString()}`;
  const testHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #333;">SMTP Test Email</h2>
        <p>This is a test email sent from the SMTP test script.</p>
        <hr>
        <p><strong>Test Details:</strong></p>
        <ul>
          <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          <li><strong>SMTP Host:</strong> ${config.host}</li>
          <li><strong>SMTP Port:</strong> ${config.port}</li>
          <li><strong>Secure:</strong> ${config.secure ? 'Yes (TLS/SSL)' : 'No (STARTTLS)'}</li>
          <li><strong>From:</strong> ${config.from}</li>
          <li><strong>To:</strong> ${config.to}</li>
        </ul>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you received this email, your SMTP configuration is working correctly!
        </p>
      </body>
    </html>
  `;
  
  const testText = `
SMTP Test Email

This is a test email sent from the SMTP test script.

Test Details:
- Timestamp: ${new Date().toISOString()}
- SMTP Host: ${config.host}
- SMTP Port: ${config.port}
- Secure: ${config.secure ? 'Yes (TLS/SSL)' : 'No (STARTTLS)'}
- From: ${config.from}
- To: ${config.to}

If you received this email, your SMTP configuration is working correctly!
  `;
  
  const mailOptions = {
    from: config.from,
    to: config.to,
    subject: testSubject,
    html: testHtml,
    text: testText
  };
  
  try {
    console.log(`${colors.blue}Sending test email...${colors.reset}`);
    console.log(`  From: ${config.from}`);
    console.log(`  To: ${config.to}`);
    console.log(`  Subject: ${testSubject}\n`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`${colors.green}✓ Email sent successfully!${colors.reset}`);
    console.log(`  Message ID: ${info.messageId || 'N/A'}`);
    console.log(`  Response: ${info.response || 'N/A'}\n`);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error(`${colors.red}✗ Email sending failed:${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    
    if (error.code) {
      console.error(`  Code: ${error.code}`);
    }
    
    if (error.command) {
      console.error(`  Command: ${error.command}`);
    }
    
    if (error.response) {
      console.error(`  Server Response: ${error.response}`);
    }
    
    console.log('');
    
    return {
      success: false,
      error: error.message,
      code: error.code,
      response: error.response
    };
  }
}

// Get IP address from hostname
async function getIPAddress(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses[0];
  } catch (error) {
    return null;
  }
}

// Check if IP is blacklisted
async function checkBlacklists(ip) {
  console.log(`${colors.blue}Checking spam blacklists for IP ${ip}...${colors.reset}`);
  
  // Major blacklists to check
  const blacklists = [
    'zen.spamhaus.org',           // Spamhaus (combined list)
    'bl.spamcop.net',             // SpamCop
    'b.barracudacentral.org',     // Barracuda
    'dnsbl.sorbs.net',            // SORBS
    'psbl.surriel.com',           // Passive Spam Block List
    'dnsbl-1.uceprotect.net',     // UCEProtect Level 1
    'cbl.abuseat.org',            // Composite Blocking List
    'dnsbl.dronebl.org',          // DroneBL
    'spam.dnsbl.anonmails.de',    // Anon Mails
    'all.s5h.net'                 // S5H
  ];
  
  const results = {
    checked: 0,
    listed: 0,
    clean: 0,
    errors: 0,
    listings: []
  };
  
  // Reverse the IP for DNSBL queries (e.g., 1.2.3.4 becomes 4.3.2.1)
  const reversedIP = ip.split('.').reverse().join('.');
  
  for (const bl of blacklists) {
    try {
      const query = `${reversedIP}.${bl}`;
      await dns.resolve4(query);
      // If resolve succeeds, IP is listed
      results.listed++;
      results.listings.push(bl);
      console.log(`  ${colors.red}✗ Listed on ${bl}${colors.reset}`);
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        // Not listed (this is good!)
        results.clean++;
      } else {
        // Query error
        results.errors++;
      }
    }
    results.checked++;
  }
  
  if (results.listed === 0) {
    console.log(`${colors.green}✓ Not listed on any checked blacklists (${results.checked} checked)${colors.reset}\n`);
  } else {
    console.log(`${colors.red}⚠ Listed on ${results.listed} blacklist(s)!${colors.reset}\n`);
  }
  
  return results;
}

// Check DKIM records for domain
async function checkDKIMRecords(domain) {
  const commonSelectors = ['default', 'mail', 'dkim', 'selector1', 'selector2', 's1', 's2', 'google', 'k1'];
  const foundSelectors = [];
  
  for (const selector of commonSelectors) {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const txtRecords = await dns.resolveTxt(dkimDomain);
      const dkimRecord = txtRecords.find(record => 
        record.join('').includes('v=DKIM1')
      );
      
      if (dkimRecord) {
        foundSelectors.push({
          selector: selector,
          record: dkimRecord.join('')
        });
      }
    } catch (error) {
      // Selector doesn't exist, continue
    }
  }
  
  return foundSelectors;
}

// Check DNS records for email authentication
async function checkDNSRecords(domain) {
  console.log(`${colors.blue}Checking DNS records for ${domain}...${colors.reset}`);
  
  const results = {
    spf: { exists: false, record: null, valid: false },
    dkim: { exists: false, selectors: [], valid: false },
    dmarc: { exists: false, record: null, valid: false },
    mx: { exists: false, records: [], valid: false },
    issues: []
  };
  
  // Check SPF record
  try {
    const txtRecords = await dns.resolveTxt(domain);
    const spfRecord = txtRecords.find(record => 
      record.join('').startsWith('v=spf1')
    );
    
    if (spfRecord) {
      results.spf.exists = true;
      results.spf.record = spfRecord.join('');
      results.spf.valid = true;
      console.log(`  ${colors.green}✓ SPF record found${colors.reset}`);
      console.log(`    ${colors.cyan}${results.spf.record}${colors.reset}`);
    } else {
      results.issues.push('No SPF record found - emails may be marked as spam');
      console.log(`  ${colors.red}✗ No SPF record found${colors.reset}`);
    }
  } catch (error) {
    results.issues.push('No SPF record found - emails may be marked as spam');
    console.log(`  ${colors.red}✗ No SPF record found (${error.code})${colors.reset}`);
  }
  
  // Check DKIM records
  const dkimSelectors = await checkDKIMRecords(domain);
  if (dkimSelectors.length > 0) {
    results.dkim.exists = true;
    results.dkim.selectors = dkimSelectors;
    results.dkim.valid = true;
    console.log(`  ${colors.green}✓ DKIM records found (${dkimSelectors.length} selector(s))${colors.reset}`);
    dkimSelectors.forEach(selector => {
      const preview = selector.record.substring(0, 80) + (selector.record.length > 80 ? '...' : '');
      console.log(`    ${colors.cyan}${selector.selector}._domainkey: ${preview}${colors.reset}`);
    });
  } else {
    results.issues.push('No DKIM records found - CRITICAL for Microsoft/Outlook delivery');
    console.log(`  ${colors.red}✗ No DKIM records found (checked common selectors)${colors.reset}`);
    console.log(`    ${colors.yellow}Microsoft requires DKIM for inbox delivery!${colors.reset}`);
  }
  
  // Check DMARC record
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const txtRecords = await dns.resolveTxt(dmarcDomain);
    const dmarcRecords = txtRecords.filter(record => 
      record.join('').startsWith('v=DMARC1')
    );
    
    if (dmarcRecords.length > 0) {
      results.dmarc.exists = true;
      results.dmarc.record = dmarcRecords[0].join('');
      results.dmarc.valid = true;
      console.log(`  ${colors.green}✓ DMARC record found${colors.reset}`);
      console.log(`    ${colors.cyan}${results.dmarc.record}${colors.reset}`);
      
      if (dmarcRecords.length > 1) {
        console.log(`  ${colors.yellow}⚠ Warning: Multiple DMARC records found (${dmarcRecords.length}) - only first one is used${colors.reset}`);
        results.issues.push(`Multiple DMARC records detected - remove duplicates (only first record is processed)`);
      }
    } else {
      results.issues.push('No DMARC record found - recommended for Gmail/Yahoo/Outlook');
      console.log(`  ${colors.yellow}⚠ No DMARC record found (recommended)${colors.reset}`);
    }
  } catch (error) {
    results.issues.push('No DMARC record found - recommended for Gmail/Yahoo/Outlook');
    console.log(`  ${colors.yellow}⚠ No DMARC record found (recommended)${colors.reset}`);
  }
  
  // Check MX records
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      results.mx.exists = true;
      results.mx.records = mxRecords;
      results.mx.valid = true;
      console.log(`  ${colors.green}✓ MX records found (${mxRecords.length} record(s))${colors.reset}`);
      mxRecords.sort((a, b) => a.priority - b.priority).forEach(mx => {
        console.log(`    ${colors.cyan}Priority ${mx.priority}: ${mx.exchange}${colors.reset}`);
      });
    } else {
      results.issues.push('No MX records found - domain cannot receive email');
      console.log(`  ${colors.red}✗ No MX records found${colors.reset}`);
    }
  } catch (error) {
    results.issues.push('No MX records found - domain cannot receive email');
    console.log(`  ${colors.red}✗ No MX records found (${error.code})${colors.reset}`);
  }
  
  console.log('');
  
  return results;
}

// Check reverse DNS (PTR record)
async function checkReverseDNS(ip) {
  try {
    const hostnames = await dns.reverse(ip);
    if (hostnames && hostnames.length > 0) {
      console.log(`  ${colors.green}✓ Reverse DNS (PTR) found: ${hostnames[0]}${colors.reset}`);
      return { exists: true, hostname: hostnames[0] };
    } else {
      console.log(`  ${colors.yellow}⚠ No reverse DNS (PTR) record found${colors.reset}`);
      return { exists: false, hostname: null };
    }
  } catch (error) {
    console.log(`  ${colors.yellow}⚠ No reverse DNS (PTR) record found${colors.reset}`);
    return { exists: false, hostname: null };
  }
}

// Comprehensive deliverability check
async function checkDeliverability(config) {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}       Email Deliverability & Configuration Check${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  const results = {
    ip: null,
    reverseDNS: null,
    blacklists: null,
    dns: null,
    score: 0,
    maxScore: 0,
    issues: []
  };
  
  // Extract domain from email address
  const domain = config.from.split('@')[1];
  
  // Get server IP
  console.log(`${colors.blue}Resolving SMTP server IP address...${colors.reset}`);
  const ip = await getIPAddress(config.host);
  if (ip) {
    results.ip = ip;
    console.log(`  ${colors.green}✓ Server IP: ${ip}${colors.reset}\n`);
  } else {
    console.log(`  ${colors.red}✗ Could not resolve IP address${colors.reset}\n`);
    results.issues.push('Could not resolve SMTP server IP address');
  }
  
  // Check reverse DNS
  if (ip) {
    console.log(`${colors.blue}Checking reverse DNS...${colors.reset}`);
    results.reverseDNS = await checkReverseDNS(ip);
    console.log('');
    
    if (results.reverseDNS.exists) {
      results.score += 10;
    } else {
      results.issues.push('No reverse DNS (PTR) record - may affect deliverability');
    }
    results.maxScore += 10;
  }
  
  // Check blacklists
  if (ip) {
    results.blacklists = await checkBlacklists(ip);
    
    if (results.blacklists.listed === 0) {
      results.score += 30;
    } else {
      results.issues.push(`Listed on ${results.blacklists.listed} spam blacklist(s) - emails will be blocked`);
    }
    results.maxScore += 30;
  }
  
  // Check DNS records
  results.dns = await checkDNSRecords(domain);
  
  // Score DNS records
  if (results.dns.spf.valid) results.score += 15;
  results.maxScore += 15;
  
  if (results.dns.dkim.valid) results.score += 25;  // DKIM is CRITICAL for Microsoft
  results.maxScore += 25;
  
  if (results.dns.dmarc.valid) results.score += 15;
  results.maxScore += 15;
  
  if (results.dns.mx.valid) results.score += 15;
  results.maxScore += 15;
  
  // Add DNS issues to main issues list
  results.issues.push(...results.dns.issues);
  
  // Display summary
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}Deliverability Score: ${results.score}/${results.maxScore}${colors.reset}`);
  
  const percentage = Math.round((results.score / results.maxScore) * 100);
  let scoreColor = colors.red;
  let rating = 'Poor';
  
  if (percentage >= 90) {
    scoreColor = colors.green;
    rating = 'Excellent';
  } else if (percentage >= 70) {
    scoreColor = colors.yellow;
    rating = 'Good';
  } else if (percentage >= 50) {
    scoreColor = colors.yellow;
    rating = 'Fair';
  }
  
  console.log(`${scoreColor}${percentage}% - ${rating}${colors.reset}\n`);
  
  if (results.issues.length > 0) {
    console.log(`${colors.bright}Issues Found:${colors.reset}`);
    results.issues.forEach(issue => {
      console.log(`  ${colors.red}⚠${colors.reset} ${issue}`);
    });
    console.log('');
  }
  
  // Recommendations
  console.log(`${colors.bright}Recommendations:${colors.reset}`);
  
  if (!results.dns.spf.valid) {
    console.log(`  ${colors.cyan}•${colors.reset} Add SPF record to DNS: ${colors.bright}v=spf1 mx a ~all${colors.reset}`);
  }
  
  if (!results.dns.dkim.valid) {
    console.log(`  ${colors.cyan}•${colors.reset} ${colors.red}CRITICAL for Microsoft:${colors.reset} Configure DKIM signing`);
    console.log(`    ${colors.yellow}Mail-in-a-Box should auto-configure DKIM. Check:${colors.reset}`);
    console.log(`    ${colors.bright}https://mail.sw7ft.com/admin#system_status${colors.reset}`);
    console.log(`    Look for "DKIM" status and ensure it's configured for ${colors.bright}${domain}${colors.reset}`);
    console.log(`    Common issue: Domain added but DKIM not yet propagated (wait 24-48 hours)`);
  } else if (results.dns.dkim.selectors.length > 0) {
    console.log(`  ${colors.green}✓ DKIM configured with selector(s): ${results.dns.dkim.selectors.map(s => s.selector).join(', ')}${colors.reset}`);
    console.log(`    ${colors.cyan}Ensure Mail-in-a-Box is signing emails with one of these selectors${colors.reset}`);
  }
  
  if (!results.dns.dmarc.valid) {
    console.log(`  ${colors.cyan}•${colors.reset} Add DMARC record to DNS: ${colors.bright}v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}${colors.reset}`);
  }
  
  if (!results.reverseDNS || !results.reverseDNS.exists) {
    console.log(`  ${colors.cyan}•${colors.reset} Set up reverse DNS (PTR) record with your hosting provider`);
  }
  
  if (results.blacklists && results.blacklists.listed > 0) {
    console.log(`  ${colors.cyan}•${colors.reset} ${colors.red}URGENT:${colors.reset} Request delisting from blacklists:`);
    results.blacklists.listings.forEach(bl => {
      console.log(`    - ${bl}`);
    });
  }
  
  // Microsoft-specific recommendations
  if (results.dns.dkim.valid && results.dns.spf.valid && results.dns.dmarc.valid) {
    console.log(`\n${colors.bright}${colors.cyan}Microsoft/Outlook Specific:${colors.reset}`);
    console.log(`  ${colors.cyan}•${colors.reset} All DNS records are present - good start!`);
    console.log(`  ${colors.cyan}•${colors.reset} Verify DKIM signing is working: Send test email and check headers`);
    console.log(`  ${colors.cyan}•${colors.reset} Check Microsoft SNDS reputation: ${colors.bright}https://sendersupport.olc.protection.outlook.com/snds/${colors.reset}`);
    console.log(`  ${colors.cyan}•${colors.reset} If still blocked, submit sender info: ${colors.bright}https://sendersupport.olc.protection.outlook.com/pm/services.aspx${colors.reset}`);
    console.log(`  ${colors.cyan}•${colors.reset} Warm up your IP: Start with 100 emails/day, gradually increase over 2-4 weeks`);
  }
  
  if (results.issues.length === 0) {
    console.log(`\n  ${colors.green}✓ Your configuration looks great!${colors.reset}`);
  }
  
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  return results;
}

// Print help message
function printHelp() {
  console.log(`
${colors.bright}SMTP Email Test Script with Deliverability Checking${colors.reset}

Tests SMTP email deliverability with custom SMTP server configuration.

${colors.bright}Features:${colors.reset}
  • SMTP connection and authentication testing
  • Spam blacklist checking (10+ major blacklists including Spamhaus, SpamCop, Barracuda)
  • DNS record verification (SPF, DMARC, MX, PTR/Reverse DNS)
  • Domain configuration validation for Gmail, Yahoo, Outlook, and Live
  • Comprehensive deliverability scoring and recommendations

${colors.bright}Usage:${colors.reset}
  node scripts/test-smtp.js [options]

${colors.bright}Options:${colors.reset}
  --host <host>              SMTP server hostname (default: mail.sw7ft.com)
  --port <port>              SMTP server port (default: 465)
  --user <username>          SMTP username
  --pass <password>          SMTP password
  --secure <true|false>      Use secure connection
                             true = Implicit TLS/SSL (for port 465)
                             false = STARTTLS (for port 587)
                             (default: true for port 465, false otherwise)
  --from <email>             From email address
  --to <email>               To email address
  --config-file <path>       Load configuration from JSON file
  --help, -h                 Show this help message

${colors.bright}Environment Variables:${colors.reset}
  SMTP_HOST                  SMTP server hostname
  SMTP_PORT                  SMTP server port
  SMTP_USER                  SMTP username
  SMTP_PASS                  SMTP password
  SMTP_SECURE                Use secure connection (true/false)
  EMAIL_USER                 Alternative SMTP username
  EMAIL_PASSWORD             Alternative SMTP password

${colors.bright}Examples:${colors.reset}
  # Interactive mode (prompts for all settings) - RECOMMENDED
  node scripts/test-smtp.js

  # Using mail.sw7ft.com defaults with credentials
  node scripts/test-smtp.js --user your@email.com --pass yourpassword --to recipient@example.com

  # Gmail (uses port 587 with STARTTLS)
  node scripts/test-smtp.js --host smtp.gmail.com --port 587 --secure false --user user@gmail.com --pass password --to recipient@example.com

  # Using environment variables
  SMTP_HOST=mail.sw7ft.com SMTP_PORT=465 SMTP_USER=user@example.com SMTP_PASS=pass node scripts/test-smtp.js

  # Using config file
  node scripts/test-smtp.js --config-file smtp-config.json

${colors.bright}Config File Format (JSON):${colors.reset}
  {
    "host": "mail.sw7ft.com",
    "port": 465,
    "user": "user@example.com",
    "pass": "password",
    "secure": true,
    "from": "sender@example.com",
    "to": "recipient@example.com"
  }
  
${colors.bright}Note:${colors.reset}
  ${colors.cyan}Port 465 uses implicit TLS/SSL (secure: true)${colors.reset}
  ${colors.cyan}Port 587 uses STARTTLS (secure: false)${colors.reset}
`);
}

// Main function
async function main() {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}           SMTP Email Deliverability Test${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  let config;
  
  // Check if running in interactive mode (no arguments provided)
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--interactive') || args.includes('-i')) {
    config = await getConfigInteractive();
  } else {
    config = getConfig();
  }
  
  // Validate configuration
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error(`${colors.red}Configuration errors:${colors.reset}`);
    errors.forEach(error => console.error(`  - ${error}`));
    console.log(`\nUse --help for usage information.\n`);
    process.exit(1);
  }
  
  // Display configuration (hide password)
  console.log(`${colors.bright}Configuration:${colors.reset}`);
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Password: ${'*'.repeat(config.pass.length)}`);
  
  // Display secure setting with recommendation
  let secureDisplay = config.secure ? 'Yes (Implicit TLS/SSL)' : 'No (STARTTLS)';
  let secureRecommendation = '';
  if (config.port === 587 && config.secure === true) {
    secureRecommendation = ` ${colors.yellow}⚠ Warning: Port 587 typically uses STARTTLS (secure: false)${colors.reset}`;
  } else if (config.port === 465 && config.secure === false) {
    secureRecommendation = ` ${colors.yellow}⚠ Warning: Port 465 typically uses implicit TLS (secure: true)${colors.reset}`;
  }
  
  console.log(`  Secure: ${secureDisplay}${secureRecommendation}`);
  console.log(`  From: ${config.from}`);
  console.log(`  To: ${config.to}`);
  console.log('');
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    // Additional options for better error reporting
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: false, // Set to true for verbose SMTP communication logs
    logger: false
  });
  
  // Test connection
  const connectionSuccess = await testConnection(transporter);
  if (!connectionSuccess) {
    console.log(`${colors.yellow}Note: Connection test failed, but attempting to send email anyway...${colors.reset}\n`);
  }
  
  // Check deliverability (spam lists, DNS records, etc.)
  const deliverabilityResults = await checkDeliverability(config);
  
  // Send test email
  const result = await sendTestEmail(transporter, config);
  
  // Summary
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}                    Final Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  const deliverabilityPercentage = Math.round((deliverabilityResults.score / deliverabilityResults.maxScore) * 100);
  
  console.log(`${colors.bright}Email Send Test:${colors.reset} ${result.success ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  console.log(`${colors.bright}Deliverability Score:${colors.reset} ${deliverabilityPercentage}% (${deliverabilityResults.score}/${deliverabilityResults.maxScore})`);
  
  if (deliverabilityResults.blacklists) {
    console.log(`${colors.bright}Blacklist Status:${colors.reset} ${deliverabilityResults.blacklists.listed === 0 ? colors.green + '✓ Clean' : colors.red + `✗ Listed (${deliverabilityResults.blacklists.listed})`}${colors.reset}`);
  }
  
  console.log('');
  
  if (result.success && deliverabilityPercentage >= 70) {
    console.log(`${colors.green}${colors.bright}✓ Test completed successfully!${colors.reset}`);
    console.log(`${colors.green}Your SMTP configuration is working correctly.${colors.reset}`);
    console.log(`${colors.yellow}Please check the recipient inbox to confirm email delivery.${colors.reset}\n`);
    
    if (deliverabilityResults.issues.length > 0) {
      console.log(`${colors.yellow}Note: Some deliverability issues were detected. Review recommendations above.${colors.reset}\n`);
    }
    
    process.exit(0);
  } else if (result.success) {
    console.log(`${colors.yellow}${colors.bright}⚠ Test partially successful${colors.reset}`);
    console.log(`${colors.yellow}Email was sent, but deliverability issues may prevent inbox delivery.${colors.reset}`);
    console.log(`${colors.yellow}Review the recommendations above to improve deliverability.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.red}${colors.bright}✗ Test failed!${colors.reset}`);
    console.log(`${colors.red}Your SMTP configuration has issues that need to be resolved.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { 
  testConnection, 
  sendTestEmail, 
  getConfig, 
  checkBlacklists, 
  checkDNSRecords,
  checkDKIMRecords,
  checkDeliverability,
  getIPAddress,
  checkReverseDNS
};

