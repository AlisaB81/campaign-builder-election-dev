#!/usr/bin/env node

/**
 * Parkland Email Campaign Sender
 * This script sends emails to all contacts in the parkland-emails.csv file
 * using the Parkland Community Outreach template
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CSV_FILE = path.join(__dirname, 'parkland-emails.csv');
const API_BASE_URL = 'http://localhost:3000';
const TEMPLATE_FILE = path.join(__dirname, 'parkland-campaign-template.json');

// Email configuration
const EMAIL_CONFIG = {
  subject: 'Important Community Update - Parkland',
  fromName: 'Parkland Community Team',
  // fromEmail will be set from sender settings
  batchSize: 50, // Send emails in batches to avoid overwhelming the server
  delayBetweenBatches: 2000 // 2 seconds delay between batches
};

/**
 * Read emails from CSV file
 */
function readEmailsFromCSV(filePath) {
  const emails = [];
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n');
  
  for (const line of lines) {
    const email = line.trim();
    if (email && email.includes('@')) {
      emails.push(email);
    }
  }
  
  return [...new Set(emails)]; // Remove duplicates
}

/**
 * Generate HTML content from template
 */
function generateEmailContent(template) {
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="position: relative;">
              ${template.headerImage ? `
                <img src="${API_BASE_URL}${template.headerImage}" alt="Header" style="width: 100%; height: auto; display: block;">
              ` : ''}
              <div style="background: linear-gradient(to right, #1e3a8a, #2563eb); padding: 40px 20px; text-align: ${template.headerTextStyle.align};">
                <h1 style="color: white; font-size: 32px; margin: 0; ${template.headerTextStyle.bold ? 'font-weight: bold;' : ''} ${template.headerTextStyle.italic ? 'font-style: italic;' : ''}">${template.headerText}</h1>
              </div>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding: 30px;">
  `;
  
  // Add body elements
  if (template.bodyElements && template.bodyElements.length > 0) {
    for (const element of template.bodyElements) {
      if (element.type === 'text') {
        html += `<div style="margin-bottom: 20px;">${element.content}</div>`;
      } else if (element.type === 'image') {
        html += `
          <div style="text-align: center; margin: 30px 0;">
            <img src="${API_BASE_URL}${element.url}" alt="${element.alt || ''}" style="max-width: 100%; height: auto; border-radius: 8px;">
            ${element.caption ? `<p style="font-size: 14px; color: #6b7280; margin-top: 10px; font-style: italic;">${element.caption}</p>` : ''}
          </div>
        `;
      } else if (element.type === 'button') {
        html += `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${element.url}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${element.text}</a>
          </div>
        `;
      }
    }
  }
  
  html += `
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 10px 0;">${template.footerText}</p>
              ${template.footerLinks && template.footerLinks.length > 0 ? `
                <div style="margin-top: 15px;">
                  ${template.footerLinks.map(link => `<a href="${link.url}" style="color: #4f46e5; text-decoration: none; margin: 0 10px; font-size: 14px;">${link.text}</a>`).join('')}
                </div>
              ` : ''}
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  
  return html;
}

/**
 * Send emails via API
 */
async function sendEmails(emails, content, authToken) {
  const fetch = require('node-fetch');
  const batches = [];
  
  // Split emails into batches
  for (let i = 0; i < emails.length; i += EMAIL_CONFIG.batchSize) {
    batches.push(emails.slice(i, i + EMAIL_CONFIG.batchSize));
  }
  
  console.log(`\nSending emails to ${emails.length} recipients in ${batches.length} batches...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} emails)...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          to: batch,
          subject: EMAIL_CONFIG.subject,
          content: content,
          fromName: EMAIL_CONFIG.fromName,
          templateName: 'Parkland Community Outreach'
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        successCount += batch.length;
        console.log(`✓ Batch ${i + 1} sent successfully`);
      } else {
        failCount += batch.length;
        console.error(`✗ Batch ${i + 1} failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      failCount += batch.length;
      console.error(`✗ Batch ${i + 1} error: ${error.message}`);
    }
    
    // Delay between batches
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.delayBetweenBatches));
    }
  }
  
  console.log(`\n================================`);
  console.log(`Campaign Summary:`);
  console.log(`Total Recipients: ${emails.length}`);
  console.log(`✓ Successful: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log(`================================\n`);
}

/**
 * Main function
 */
async function main() {
  console.log('========================================');
  console.log('  Parkland Email Campaign Sender');
  console.log('========================================\n');
  
  // Check if CSV file exists
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`Error: CSV file not found at ${CSV_FILE}`);
    process.exit(1);
  }
  
  // Check if template file exists
  if (!fs.existsSync(TEMPLATE_FILE)) {
    console.error(`Error: Template file not found at ${TEMPLATE_FILE}`);
    process.exit(1);
  }
  
  // Read emails
  console.log('Reading email addresses from CSV...');
  const emails = readEmailsFromCSV(CSV_FILE);
  console.log(`Found ${emails.length} unique email addresses.\n`);
  
  // Load template
  console.log('Loading email template...');
  const template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8'));
  console.log(`Template loaded: ${template.name}\n`);
  
  // Generate HTML content
  const emailContent = generateEmailContent(template);
  
  // Get authentication token
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('To send emails, you need to provide an authentication token.');
  console.log('You can get this from your browser\'s cookies (JWT token) after logging in.\n');
  
  rl.question('Enter your authentication token: ', async (authToken) => {
    rl.close();
    
    if (!authToken || authToken.trim() === '') {
      console.error('\nError: Authentication token is required.');
      process.exit(1);
    }
    
    // Confirm before sending
    const confirmRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    confirmRl.question(`\nReady to send ${emails.length} emails. Continue? (yes/no): `, async (answer) => {
      confirmRl.close();
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        await sendEmails(emails, emailContent, authToken.trim());
      } else {
        console.log('\nCampaign cancelled.');
      }
    });
  });
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
