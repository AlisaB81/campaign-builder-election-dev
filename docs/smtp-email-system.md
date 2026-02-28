# SMTP Email System Documentation

**Last Updated**: Nov 10, 2025  
**Status**: Production Ready

## Overview

Campaign Builder uses a custom SMTP email system for sending transactional and bulk email campaigns. The system migrated from Postmark to a direct SMTP implementation using `mail.sw7ft.com` for improved control, cost efficiency, and compliance features.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Configuration](#configuration)
3. [Email Sending Flow](#email-sending-flow)
4. [Safety & Compliance Features](#safety--compliance-features)
5. [Domain Warm-Up System](#domain-warm-up-system)
6. [Suppression List Management](#suppression-list-management)
7. [Bounce & Complaint Rate Monitoring](#bounce--complaint-rate-monitoring)
8. [Email Compliance Requirements](#email-compliance-requirements)
9. [Admin Monitoring](#admin-monitoring)
10. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Core Components

1. **SMTP Transporter** (`server.js`)
   - Nodemailer-based SMTP client
   - Configured for `mail.sw7ft.com`
   - Supports both secure (465) and non-secure (587) ports

2. **Email Sending Function** (`sendEmail()`)
   - Handles both transactional and bulk email sending
   - Implements safety checks and compliance features
   - Tracks campaign metrics

3. **Safety & Compliance System**
   - Suppression list management
   - Domain warm-up tracking
   - Bounce/complaint rate monitoring
   - Automatic campaign pausing

### File Structure

```
server.js
├── SMTP Configuration (line ~2598)
├── Helper Functions (line ~6477)
│   ├── getSuppressionList()
│   ├── addToSuppressionList()
│   ├── checkSuppressionList()
│   ├── getDomainWarmupData()
│   ├── checkDomainWarmup()
│   ├── incrementDomainWarmup()
│   ├── addAdminNotification()
│   └── calculateEmailRates()
└── sendEmail() Function (line ~6680)
    ├── Suppression list check
    ├── Domain warm-up check
    ├── Batch sending logic
    ├── Bounce/complaint tracking
    └── Campaign pause logic

data/shared-data/{accountId}/
├── suppression-list.json
├── domain-warmup.json
└── admin-notifications.json
```

---

## Configuration

### Environment Variables

All SMTP configuration is stored in `.env` file:

```bash
# SMTP Server Configuration
SMTP_HOST=mail.sw7ft.com
SMTP_PORT=587
SMTP_SECURE=false  # true for port 465, false for port 587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# Email Compliance (Optional)
BUSINESS_ADDRESS=Your Physical Business Address
UNSUBSCRIBE_EMAIL=unsubscribe@yourdomain.com  # Optional, falls back to SYSTEM_EMAIL
SYSTEM_EMAIL=system@yourdomain.com  # Fallback for unsubscribe email
```

### SMTP Transporter Setup

```javascript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.sw7ft.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
```

---

## Email Sending Flow

### 1. Request Processing

When an email send request is received via `/api/messages/send-email`:

1. **Authentication**: User must be authenticated
2. **Validation**: Email addresses are validated and normalized
3. **Token Check**: User must have sufficient email tokens
4. **Sender Verification**: Sender email must be confirmed

### 2. Pre-Send Safety Checks

Before sending any emails:

1. **Suppression List Check**
   - Filters out emails on the suppression list
   - Skips hard bounces and unsubscribed addresses

2. **Domain Warm-Up Check**
   - Checks if sending domain has reached daily limit
   - Queues excess emails if limit exceeded
   - Returns available sending capacity

3. **Recipient Filtering**
   - Removes suppressed emails from recipient list
   - Updates campaign to only include valid recipients

### 3. Batch Sending Process

Emails are sent in controlled batches:

- **Batch Size**: 125 recipients per batch (100-150 range)
- **Concurrency**: 2 SMTP connections at once (1-3 range)
- **Delay Between Batches**: 10 seconds (8-12 second range)
- **Retry Logic**: 3 retries with exponential backoff

### 4. Real-Time Monitoring

During sending:

- **Bounce Detection**: Identifies hard bounces via error codes
- **Rate Calculation**: Calculates bounce/complaint rates after each batch
- **Auto-Pause**: Pauses campaign if rates exceed 5% threshold
- **Notification**: Creates admin notification for paused campaigns

### 5. Post-Send Processing

After sending completes:

- **Warm-Up Update**: Increments domain warm-up counter
- **Campaign Recording**: Saves campaign metrics to message history
- **Token Deduction**: Charges tokens only for successful sends
- **Analytics Update**: Updates email analytics tracking

---

## Safety & Compliance Features

### 1. Batch Sending

**Purpose**: Prevents overwhelming SMTP server and triggering spam filters

**Configuration**:
- Batch size: 125 emails per batch
- Delay: 10 seconds between batches
- Concurrency: 2 simultaneous connections

**Implementation**:
```javascript
const batchSize = Math.min(125, totalRecipients);
const maxConcurrency = Math.min(2, totalRecipients);
const delayBetweenBatches = 10000; // 10 seconds
```

### 2. Domain Warm-Up System

**Purpose**: Gradually increases sending volume for new domains to establish sender reputation

**Warm-Up Schedule**:
- **Day 1**: 100 emails/day
- **Day 2**: 150 emails/day
- **Day 3**: 400 emails/day
- **Day 4**: 800 emails/day
- **Day 5**: 1,500 emails/day
- **Day 6-7**: 3,000-5,000 emails/day
- **Week 2+**: Up to 10,000/day (if healthy)

**Storage**: `data/shared-data/{accountId}/domain-warmup.json`

**Example Structure**:
```json
{
  "example.com": {
    "firstSendDate": "2025-01-15T10:00:00.000Z",
    "dailySentCount": {
      "2025-01-15": 100,
      "2025-01-16": 150
    },
    "currentDay": 2
  }
}
```

### 3. Suppression List

**Purpose**: Prevents sending to addresses that have bounced or unsubscribed

**Automatic Suppression Triggers**:
- Hard bounces (550, 551, 552, 553 error codes)
- User unsubscribes
- Spam complaints

**Storage**: `data/shared-data/{accountId}/suppression-list.json`

**Example Structure**:
```json
[
  {
    "email": "bounced@example.com",
    "reason": "hard_bounce",
    "suppressedAt": "2025-01-15T10:00:00.000Z"
  },
  {
    "email": "unsubscribed@example.com",
    "reason": "unsubscribe",
    "suppressedAt": "2025-01-15T11:00:00.000Z"
  }
]
```

### 4. Bounce & Complaint Rate Monitoring

**Purpose**: Automatically pauses campaigns when rates exceed safe thresholds

**Thresholds**:
- **Bounce Rate**: 5% (hard limit)
- **Complaint Rate**: 5% (hard limit)

**Auto-Pause Behavior**:
- Campaign immediately stops sending
- Remaining recipients marked as failed
- Admin notification created
- Campaign status set to "paused"

**Rate Calculation**:
```javascript
bounceRate = (failedSends / totalSends) * 100
complaintRate = (complaints / totalSends) * 100
```

---

## Domain Warm-Up System

### How It Works

1. **First Send Detection**
   - System detects first email from a new domain
   - Creates warm-up entry with current date
   - Sets daily limit based on day 1 (100 emails)

2. **Daily Limit Calculation**
   - Calculates days since first send
   - Looks up limit for current day
   - Checks emails sent today
   - Returns available capacity

3. **Queue Management**
   - If campaign exceeds limit, excess emails are queued
   - System sends only up to daily limit
   - Remaining emails can be sent on subsequent days

### Warm-Up Limits Function

```javascript
const getDomainWarmupLimit = (day) => {
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
  
  // After week 1, allow up to 10,000/day (if healthy)
  return 10000;
};
```

### Checking Warm-Up Status

```javascript
const warmupCheck = await checkDomainWarmup(accountId, domain, requestedCount);
// Returns:
// {
//   canSend: 100,        // How many can be sent today
//   queued: 50,          // How many need to be queued
//   dailyLimit: 100,     // Current day's limit
//   sentToday: 0,        // Already sent today
//   currentDay: 1,       // Current warm-up day
//   available: 100       // Remaining capacity
// }
```

---

## Suppression List Management

### Adding to Suppression List

**Automatic Addition**:
- Hard bounces detected during sending
- User unsubscribe events
- Spam complaints (when implemented)

**Manual Addition** (via API):
```javascript
await addToSuppressionList(accountId, email, 'hard_bounce');
await addToSuppressionList(accountId, email, 'unsubscribe');
await addToSuppressionList(accountId, email, 'spam_complaint');
```

### Checking Suppression List

Before sending, system automatically checks:
```javascript
const { filtered, suppressed } = await checkSuppressionList(accountId, recipientEmails);
// filtered: Emails that can be sent to
// suppressed: Emails that are blocked
```

### Suppression Reasons

- `hard_bounce`: Permanent delivery failure
- `unsubscribe`: User requested removal
- `spam_complaint`: User marked as spam (future)

---

## Bounce & Complaint Rate Monitoring

### Real-Time Tracking

During batch sending, system calculates rates after each concurrency batch:

```javascript
const { bounceRate, complaintRate } = calculateEmailRates(
  successfulSends, 
  failedSends, 
  complaints
);
```

### Auto-Pause Logic

```javascript
if (bounceRate > 5 || complaintRate > 5) {
  campaignPaused = true;
  pauseReason = bounceRate > 5 
    ? `Bounce rate ${bounceRate.toFixed(2)}% exceeds 5% threshold`
    : `Complaint rate ${complaintRate.toFixed(2)}% exceeds 5% threshold`;
  
  // Notify admin
  await addAdminNotification(accountId, {
    type: 'campaign_paused',
    severity: 'high',
    message: pauseReason,
    campaignId: messageId,
    bounceRate: bounceRate.toFixed(2),
    complaintRate: complaintRate.toFixed(2),
    successfulSends,
    failedSends
  });
}
```

### Hard Bounce Detection

System identifies hard bounces by error codes:
- `550`: Mailbox unavailable
- `551`: User not local
- `552`: Exceeded storage allocation
- `553`: Mailbox name not allowed
- Keywords: "permanent", "does not exist", "invalid", "bounce"

---

## Email Compliance Requirements

### 1. One-Click Unsubscribe Link

**HTML Footer**:
```html
<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
    <p style="margin: 10px 0;">You're receiving this email because you subscribed to our mailing list.</p>
    <p style="margin: 10px 0;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from emails</a>
    </p>
</div>
```

**Text Version**:
```
---
Unsubscribe from emails: https://yourdomain.com/unsubscribe?email=...
```

### 2. List-Unsubscribe Headers

**Required Headers**:
```javascript
headers: {
  'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:${unsubscribeEmail}?subject=Unsubscribe>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
}
```

**Purpose**: Allows email clients to show unsubscribe button in header

### 3. Physical Business Address

**Configuration**: Set `BUSINESS_ADDRESS` in `.env`

**Display**: Automatically added to email footer if configured

**Example**:
```html
<p style="margin: 10px 0; font-size: 11px;">123 Main St, Toronto, ON, M5H 2N2, Canada</p>
```

---

## Admin Monitoring

### Viewing Paused Campaigns

**Location**: Admin Management Page (`/management`)

**Features**:
- Lists all paused campaigns from all accounts
- Shows bounce/complaint rates
- Displays pause reason
- Shows successful/failed send counts
- Mark notifications as read

### Admin Notifications API

**Get All Notifications**:
```
GET /api/admin/notifications?unreadOnly=false
```

**Get Account-Specific Notifications**:
```
GET /api/admin/notifications?accountId={accountId}&unreadOnly=true
```

**Mark as Read**:
```
POST /api/admin/notifications/:notificationId/read
Body: { "accountId": "..." }
```

### Notification Structure

```json
{
  "id": "1234567890",
  "type": "campaign_paused",
  "severity": "high",
  "message": "Bounce rate 6.5% exceeds 5% threshold",
  "campaignId": "1234567890-123456",
  "bounceRate": "6.50",
  "complaintRate": "0.00",
  "successfulSends": 100,
  "failedSends": 7,
  "timestamp": "2025-01-15T10:00:00.000Z",
  "read": false
}
```

---

## Troubleshooting

### Common Issues

#### 1. Emails Not Sending

**Check**:
- SMTP credentials in `.env`
- SMTP server connectivity
- Domain warm-up limits
- Suppression list (recipient may be suppressed)

**Debug**:
```javascript
// Check SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready');
  }
});
```

#### 2. Campaign Paused Unexpectedly

**Check**:
- Bounce rate in admin notifications
- Complaint rate in admin notifications
- Failed send reasons in campaign details

**Resolution**:
- Review suppression list
- Check email list quality
- Verify sender reputation

#### 3. Domain Warm-Up Limit Reached

**Check**:
- Current day in warm-up schedule
- Emails sent today
- Daily limit for current day

**Resolution**:
- Wait until next day for limit reset
- Or manually adjust warm-up data (not recommended)

#### 4. High Bounce Rate

**Causes**:
- Invalid email addresses
- Old/expired email addresses
- Domain reputation issues

**Solutions**:
- Clean email list before sending
- Use email validation service
- Improve sender reputation gradually

### Debugging Tools

#### Check Suppression List
```javascript
const suppressionList = await getSuppressionList(accountId);
console.log('Suppressed emails:', suppressionList);
```

#### Check Domain Warm-Up
```javascript
const warmupData = await getDomainWarmupData(accountId, domain);
console.log('Warm-up status:', warmupData);
```

#### Check Campaign Status
```javascript
// Campaign data stored in:
// - data/shared-data/{accountId}/email-campaigns.json
// - data/individual-data/{userId}/messages.json
```

---

## Best Practices

### 1. Email List Hygiene

- Validate email addresses before importing
- Remove invalid/bounced emails regularly
- Honor unsubscribe requests immediately
- Monitor bounce rates closely

### 2. Sender Reputation

- Follow domain warm-up schedule strictly
- Don't send to purchased email lists
- Maintain low bounce rates (<2%)
- Keep complaint rates minimal (<0.1%)

### 3. Campaign Management

- Test campaigns with small batches first
- Monitor rates during sending
- Pause campaigns if rates spike
- Review admin notifications regularly

### 4. Compliance

- Always include unsubscribe link
- Include physical business address
- Use List-Unsubscribe headers
- Honor suppression list

---

## API Reference

### Send Email Endpoint

```
POST /api/messages/send-email
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "to": ["email1@example.com", "email2@example.com"],
  "subject": "Campaign Subject",
  "content": "<html>...</html>",
  "fromEmail": "sender@example.com"
}
```

### Unsubscribe Endpoint

```
POST /api/unsubscribe
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "channel": "email"
}
```

**Note**: Automatically adds email to suppression list

---

## Migration Notes

### From Postmark to SMTP

**Removed**:
- Postmark API client
- Postmark webhook handlers
- Postmark sender management endpoints
- Postmark bounce/complaint webhooks

**Replaced With**:
- Direct SMTP sending via Nodemailer
- Local suppression list management
- Custom bounce detection
- Admin notification system

**Benefits**:
- Lower cost (no per-email fees)
- Full control over sending
- Custom compliance features
- Better integration with existing system

---

## Security Considerations

### 1. Environment Variables

- Never commit `.env` file to git
- Rotate SMTP credentials regularly
- Use strong SMTP passwords
- Limit SMTP account permissions

### 2. Suppression List

- Suppression list stored locally (not exposed via API)
- Only accessible by account owner/admin
- Automatically updated on bounces/unsubscribes

### 3. Rate Limiting

- Email sending endpoint has rate limiting
- Prevents abuse and spam
- Configurable via `emailSendLimiter`

---

## Future Enhancements

### Planned Features

1. **Email Queue System**
   - Queue excess emails when warm-up limit reached
   - Automatic queue processing
   - Scheduled sending

2. **Spam Complaint Tracking**
   - Integration with feedback loops
   - Automatic suppression on complaints
   - Complaint rate monitoring

3. **Advanced Analytics**
   - Open rate tracking
   - Click-through rate tracking
   - Delivery rate tracking

4. **A/B Testing**
   - Subject line testing
   - Content variation testing
   - Send time optimization

---

## Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review paused campaigns
   - Check bounce/complaint rates
   - Monitor domain warm-up progress

2. **Monthly**:
   - Clean suppression list (remove old entries)
   - Review email sending patterns
   - Analyze campaign performance

3. **Quarterly**:
   - Review SMTP credentials
   - Audit suppression list size
   - Evaluate warm-up schedule effectiveness

### Contact

For issues or questions about the SMTP system:
- Check admin notifications for paused campaigns
- Review server logs for SMTP errors
- Consult this documentation

---



