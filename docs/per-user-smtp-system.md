# Per-User SMTP Configuration System

**Date**: November 10, 2025  
**Status**: Implemented

## Overview

The system now supports per-user SMTP configuration, allowing each user/account to use their own SMTP server for sending emails. This replaces the previous Postmark API integration and provides users with full control over their email delivery.

## Architecture

### Storage Location

SMTP settings are stored per account in:
```
data/shared-data/{accountId}/smtp-settings.json
```

### File Structure

```json
{
  "host": "smtp.example.com",
  "port": 587,
  "secure": false,
  "user": "user@example.com",
  "pass": "password",
  "updatedAt": "2025-11-10T21:00:00.000Z",
  "updatedBy": "user-id-123"
}
```

### Fallback Behavior

- If a user has custom SMTP settings → Uses their SMTP server
- If no custom settings → Falls back to global SMTP (from `.env`)
- If custom settings invalid → Falls back to global SMTP

## API Endpoints

### 1. Get SMTP Settings
```
GET /api/smtp/settings
Authorization: Bearer {token}
```

**Response:**
```json
{
  "host": "smtp.example.com",
  "port": 587,
  "secure": false,
  "user": "user@example.com",
  "hasPassword": true,
  "isGlobal": false
}
```

**Note**: Password is never returned in the response.

### 2. Save/Update SMTP Settings
```
POST /api/smtp/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "host": "smtp.example.com",
  "port": 587,
  "secure": false,
  "user": "user@example.com",
  "pass": "password"
}
```

**Response:**
```json
{
  "message": "SMTP settings saved successfully",
  "settings": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "user": "user@example.com",
    "updatedAt": "2025-11-10T21:00:00.000Z",
    "updatedBy": "user-id-123"
  }
}
```

**Validation:**
- Host: Required, must be non-empty string
- Port: Required, must be 1-65535
- User: Required, must be non-empty string
- Pass: Required, must be non-empty string
- Secure: Optional boolean (auto-set to true if port is 465)

### 3. Test SMTP Connection
```
POST /api/smtp/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "host": "smtp.example.com",
  "port": 587,
  "secure": false,
  "user": "user@example.com",
  "pass": "password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "SMTP connection test successful"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "SMTP connection test failed: {error message}"
}
```

### 4. Delete SMTP Settings
```
DELETE /api/smtp/settings
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "SMTP settings removed. System will use global SMTP settings."
}
```

## Implementation Details

### Transporter Caching

- User-specific SMTP transporters are cached in memory
- Cache is cleared when settings are updated or deleted
- Improves performance by avoiding transporter recreation

### Email Sending Flow

1. User sends email via `/api/messages/send-email`
2. System checks for user's custom SMTP settings
3. If found → Creates/uses user-specific transporter
4. If not found → Uses global SMTP transporter
5. Sends email using appropriate transporter

### Security Considerations

1. **Password Storage**: 
   - Passwords are stored in `smtp-settings.json` (plain text)
   - **Recommendation**: Encrypt passwords in production
   - Never returned in API responses

2. **File Permissions**:
   - `smtp-settings.json` should have restricted permissions
   - Only accessible by the application user

3. **Validation**:
   - All SMTP settings are validated before saving
   - Connection tested before use (via test endpoint)

## Migration from Postmark

### What Changed

- **Before**: Global Postmark API configuration
- **After**: Per-user SMTP configuration with global fallback

### Where Postmark Was Used

The system previously used Postmark API for:
- Email sending
- Sender verification
- Bounce tracking
- Delivery tracking

### Current Implementation

- **Email Sending**: Direct SMTP via Nodemailer
- **Sender Verification**: Manual (users add sender emails)
- **Bounce Tracking**: Custom implementation (error code detection)
- **Delivery Tracking**: Custom implementation (open tracking pixel)

## Usage Examples

### Setting Up Custom SMTP

```javascript
// 1. Test connection first
const testResponse = await fetch('/api/smtp/test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'user@gmail.com',
    pass: 'app-password'
  })
});

// 2. If test succeeds, save settings
if (testResponse.ok) {
  const saveResponse = await fetch('/api/smtp/settings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'user@gmail.com',
      pass: 'app-password'
    })
  });
}
```

### Checking Current Settings

```javascript
const response = await fetch('/api/smtp/settings', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const settings = await response.json();
console.log('Using:', settings.isGlobal ? 'Global SMTP' : 'Custom SMTP');
```

## Common SMTP Providers

### Gmail
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "user": "your-email@gmail.com",
  "pass": "app-password"  // Use App Password, not regular password
}
```

### Outlook/Hotmail
```json
{
  "host": "smtp-mail.outlook.com",
  "port": 587,
  "secure": false,
  "user": "your-email@outlook.com",
  "pass": "password"
}
```

### SendGrid
```json
{
  "host": "smtp.sendgrid.net",
  "port": 587,
  "secure": false,
  "user": "apikey",
  "pass": "your-sendgrid-api-key"
}
```

### Mailgun
```json
{
  "host": "smtp.mailgun.org",
  "port": 587,
  "secure": false,
  "user": "postmaster@your-domain.mailgun.org",
  "pass": "your-mailgun-password"
}
```

### Custom SMTP Server
```json
{
  "host": "mail.yourdomain.com",
  "port": 587,
  "secure": false,
  "user": "noreply@yourdomain.com",
  "pass": "password"
}
```

## Troubleshooting

### Connection Test Fails

1. **Check credentials**: Verify username and password are correct
2. **Check port**: Ensure port matches your SMTP provider (587 or 465)
3. **Check secure flag**: Set `secure: true` for port 465
4. **Check firewall**: Ensure SMTP port is not blocked
5. **Check provider settings**: Some providers require app passwords

### Emails Not Sending

1. **Check SMTP settings**: Verify settings are saved correctly
2. **Check sender email**: Ensure sender email is verified/confirmed
3. **Check logs**: Review server logs for SMTP errors
4. **Test connection**: Use `/api/smtp/test` endpoint
5. **Fallback check**: Verify global SMTP works if custom fails

### Password Security

**Current**: Passwords stored in plain text  
**Recommendation**: Implement encryption for production

```javascript
// Future enhancement: Encrypt passwords
const crypto = require('crypto');
const encrypted = crypto.createCipher('aes-256-cbc', encryptionKey)
  .update(password, 'utf8', 'hex');
```

## Best Practices

1. **Test Before Saving**: Always use `/api/smtp/test` before saving settings
2. **Use App Passwords**: For Gmail/Outlook, use app-specific passwords
3. **Secure Storage**: Encrypt passwords in production
4. **Monitor Usage**: Track email sending to detect issues
5. **Fallback Ready**: Keep global SMTP configured as backup

## Future Enhancements

1. **Password Encryption**: Encrypt stored passwords
2. **SMTP Health Monitoring**: Track connection health
3. **Automatic Failover**: Switch to global SMTP if custom fails
4. **Rate Limiting**: Per-user SMTP rate limits
5. **Analytics**: Track per-user SMTP performance

---

*Documentation generated: November 10, 2025*

