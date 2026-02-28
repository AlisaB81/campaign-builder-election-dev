# Campaign Builder - Master Project Overview

## Project Status: PRODUCTION
**Last Updated**: January 23, 2026  
**Platform**: campaignbuilder.ca

## Application Statistics
- **Codebase**: ~24,500 lines (server.js)
- **API Routes**: 233 total (205 API, 28 page routes)
- **Views**: 24 EJS templates + 2 partials
- **Accounts**: 24 registered accounts
- **Users**: 15+ active users
- **Dependencies**: 25 npm packages

## Core Application Features

### ✅ COMPLETED FEATURES

#### User Authentication & Management
- JWT-based authentication system with cookie/header/query token support
- User registration and email verification with token-based confirmation
- **Two-Factor Authentication (2FA)** - SMS and email-based verification
- Admin user management with elevated privileges
- Token balance tracking system (Email, SMS, AI tokens)
- Phone number management with Twilio integration
- **Security Enhancements** - Enhanced login security with 2FA integration
- **Multi-User System** - Team collaboration with role-based permissions
- **User Invitations** - Email-based team member invitations with expiration tokens
- **Permission Management** - Granular access control for different user types
- **NDA Agreement System** - Required legal agreement before app access
  - One-time acceptance per user
  - Full audit trail (timestamp, IP, user agent)
  - Automatic redirect for non-accepted users
  - Responsive design for all devices

#### Contact Management System
- Professional-grade contact manager with data validation
- Address autocomplete using LocationIQ API
- Category management with duplicate prevention and bulk updates
- Bulk contact operations (import CSV/Excel, export, delete)
- Postal code lookup and province mapping
- Contact search and filtering by category, status, name
- **Phone Number Formatting** - Automatic E.164 format conversion for Twilio integration
- **Communication Preferences** - Per-contact subscription management for email, SMS, and voice
- **Unsubscribe Management** - Public unsubscribe endpoints with tracking
- **Trash System** - Soft delete with recovery capability
- **Upload History** - Track all contact import operations

#### Template Management System
- Email template creation and editing
- AI-powered content generation (HTML and images)
- Template categorization and tagging
- Version history and restoration
- Template preview and testing
- Image upload and management
- Template search and filtering
- **Image Library System** - Complete image management with user-specific libraries
  - Browse personal image collections
  - Search and filter images by section/category
  - Add images from templates to library
  - Select images from library for template use
  - User-specific image isolation and privacy

#### AI Voice Calling System
- **Professional Voice Selection** - Real Twilio Polly voices with Canadian English/French prioritization
- **Multi-Language Support** - 14+ languages with automatic translation from English
- **Campaign Creation** - Direct message delivery system with confirmation modals
- **Voice Preview** - Instant MP3 preview using Amazon Polly TTS (exact campaign voice)
- **Interactive Responses** - DTMF keypress collection (1=yes, 2=no, etc.) with response tracking
- **Live Campaign Monitoring** - Real-time call status tracking and progress updates
- **Contact Personalization** - Dynamic name insertion and message customization
- **Auto-Translation** - MyMemory API integration for automatic language translation
- **Token Management** - Pay-per-call AI token system with usage tracking
- **TwiML Generation** - Dynamic voice response generation with proper error handling
- **Campaign Analytics** - Comprehensive call statistics and response collection

#### Messaging System
- SMS and email message scheduling with scheduled message processor (runs every 60 seconds)
- Message template integration with variable substitution
- Contact list management and category-based targeting
- Message history and reporting with delivery status tracking
- Token-based pricing system (email tokens, SMS tokens)
- **Enhanced Message Analytics** - Comprehensive tracking and reporting
- **Email Sender Management** - SMTP integration with multiple transporter support
- **Sender Email Verification** - Domain verification and SPF/DKIM authentication
- **Suppression List Management** - Automated bounce and unsubscribe handling (101+ suppression checks)
- **Email Queue System** - Background processing for large campaigns
- **Domain Warmup System** - Automatic email sending limits for new domains
  - Progressive daily limits based on domain age
  - Track daily send counts per domain
  - Prevent deliverability issues with new sending domains
- **SMS Reports** - Dedicated SMS analytics and reporting interface

#### Invoicing System
- Automatic invoice generation for purchases
- Receipt email delivery with nodemailer
- Payment processing integration
- Invoice status tracking and management

#### Analytics & Dashboard System
- **Comprehensive Dashboard** - Real-time analytics and campaign overview
- **Training Module** - User education and onboarding system
- **Campaign Analytics** - Multi-channel campaign performance tracking
- **Team Analytics** - Combined statistics for multi-user accounts
- **Individual Analytics** - Per-user performance metrics and tracking

#### Help Ticket System
- **User Support Requests** - In-app help ticket submission
- **Admin Ticket Management** - Full ticket dashboard for support staff
- **Ticket Status Workflow** - Open → In Progress → Resolved → Closed
- **Reply System** - Admin responses with email notifications
- **Priority Levels** - Urgent, high, normal, low priority classification
- **Ticket Statistics** - Dashboard with open/in-progress/resolved counts

#### Admin Management System
- **Account Management** - View and manage all user accounts
- **User Administration** - Create, edit, delete users; adjust tokens
- **Subscription Management** - View and modify user subscriptions
- **Phone Number Administration** - Assign/manage Twilio numbers
- **Audit Log Viewer** - Browse security audit logs by date
- **Email Queue Management** - Monitor and process email queues
- **System Notifications** - Admin notification system

#### Security & Compliance Features
- **NDA/Agreement Enforcement** - Mandatory legal acceptance before app access
- **Audit Logging** - Comprehensive security event logging with daily log files
- **IP & User Agent Tracking** - Full audit trail for compliance
- **Session Management** - Secure cookie-based authentication
- **Rate Limiting** - API rate limiting with express-rate-limit
- **Security Headers** - Helmet.js integration for HTTP security headers

## Technical Architecture

### Database Structure
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "password": "hashed_password",
  "verificationToken": "token",
  "isVerified": true,
  "is2FAEnabled": true,
  "twoFA": {
    "method": "sms",
    "phone": "+1XXXXXXXXXX",
    "code": "encrypted_code",
    "codeExpiry": "timestamp"
  },
  "ndaAccepted": true,
  "ndaAcceptedAt": "2026-01-23T00:00:00.000Z",
  "ndaAcceptedIp": "xxx.xxx.xxx.xxx",
  "ndaAcceptedUserAgent": "Mozilla/5.0...",
  "tokenBalance": 0,
  "aiTokens": 50,
  "contacts": [...],
  "messageTemplates": [...],
  "autoReply": {...},
  "smsMessages": {...},
  "tokenTransactions": [...],
  "messages": [...],
  "invoices": [...],
  "smsTokens": 0,
  "emailTokens": 0,
  "phoneNumbers": [...],
  "voiceCampaigns": [...],
  "voiceAgents": [...],
  "voiceCalls": [...],
  "voiceResponses": [...],
  "isAdmin": false,
  "accountId": "parent_account_id",
  "userType": "app_owner|team_member",
  "createdAt": "2025-XX-XX...",
  "lastLoginAt": null
}
```

### Technology Stack

#### Core Framework
- **Runtime**: Node.js
- **Backend**: Express.js with EJS templating
- **Frontend**: Vue.js with Tailwind CSS
- **Database**: JSON file-based storage with multi-user architecture
- **Process Management**: PM2 for process management and auto-restart

#### Authentication & Security
- **Authentication**: JWT tokens with 2FA, NDA enforcement, and role-based permissions
- **Password Hashing**: bcryptjs
- **Security Headers**: Helmet.js
- **Rate Limiting**: express-rate-limit
- **Compression**: compression middleware

#### External Services
- **Voice/SMS**: Twilio Voice API and SMS
- **Text-to-Speech**: Amazon Polly via AWS SDK
- **AI Generation**: OpenAI GPT for content and image generation
- **Translation**: MyMemory API for auto-translation
- **Email**: SMTP with nodemailer (multi-transporter rotation)
- **Payments**: Stripe integration
- **Geocoding**: LocationIQ API for address autocomplete

#### File Processing
- **CSV Parsing**: csv-parser for contact imports
- **Excel**: exceljs for spreadsheet exports
- **PDF**: pdf-parse for document processing
- **Images**: sharp for image manipulation
- **File Uploads**: multer for multipart form handling
- **QR Codes**: qrcode for QR code generation

### NPM Dependencies (25 packages)
```
aws-sdk, bcryptjs, compression, cookie-parser, csv-parser, dotenv,
ejs, exceljs, express, express-ejs-layouts, express-rate-limit, helmet,
jsonwebtoken, multer, node-fetch, nodemailer, openai, pdf-parse, pm2,
postmark, qrcode, sharp, speakeasy, stripe, twilio
```

### File Structure
```
public_html/
├── server.js (main application - ~24,500 lines, 233 routes)
├── config.js (API configuration)
├── package.json (25 dependencies)
├── views/ (24 EJS templates)
│   ├── auth.ejs (login/register)
│   ├── dashboard.ejs (analytics dashboard)
│   ├── contact-manager.ejs (contact management)
│   ├── templates.ejs (email templates)
│   ├── messages.ejs (messaging interface)
│   ├── message-scheduler.ejs (scheduled messages)
│   ├── ai-calling.ejs (AI voice calling interface)
│   ├── my-tokens.ejs (token management)
│   ├── my-numbers.ejs (phone number management)
│   ├── image-library.ejs (image management)
│   ├── user-management.ejs (account settings)
│   ├── invoices.ejs (invoice management)
│   ├── subscription.ejs (subscription management)
│   ├── go-pro.ejs (upgrade page)
│   ├── training.ejs (user training module)
│   ├── nda-agreement.ejs (NDA acceptance page)
│   ├── management.ejs (admin management)
│   ├── admin-audit-logs.ejs (admin audit viewer)
│   ├── admin/help-tickets.ejs (help ticket management)
│   ├── unsubscribe.ejs (public unsubscribe)
│   ├── accept-invitation.ejs (team invitation acceptance)
│   ├── verify-success.ejs (email verification success)
│   ├── index.ejs (landing page)
│   ├── layout.ejs (main layout)
│   ├── layout-auth.ejs (auth layout)
│   └── partials/ (nav.ejs, _helpButton.ejs)
├── public/ (static assets - 241 files)
│   ├── css/ (stylesheets)
│   ├── js/ (client-side JavaScript)
│   └── images/ (159 PNG, 63 JPG, 8 JPEG, etc.)
├── data/ (JSON database files)
│   ├── accounts/ (24 account files)
│   ├── individual-data/ (15+ user directories)
│   │   └── {userId}/
│   │       ├── user.json (user profile + settings)
│   │       ├── analytics.json (user analytics)
│   │       └── messages.json (user messages)
│   ├── shared-data/ (25 account directories)
│   │   └── {accountId}/
│   │       ├── contacts.json
│   │       ├── templates.json
│   │       ├── images.json
│   │       ├── email-campaigns.json
│   │       ├── sms-campaigns.json
│   │       ├── voice-campaigns.json
│   │       ├── email-messages.json
│   │       ├── sms-messages.json
│   │       ├── voice-messages.json
│   │       ├── email-responses.json
│   │       ├── sms-responses.json
│   │       ├── email-queue.json
│   │       ├── senderEmails.json
│   │       ├── senders.json
│   │       ├── smtp-settings.json
│   │       ├── domain-warmup.json
│   │       ├── phoneNumbers.json
│   │       ├── tokens.json
│   │       ├── invoices.json
│   │       ├── upload-history.json
│   │       ├── trash.json
│   │       └── backups/
│   ├── invitations/ (team invitation tokens)
│   ├── audit-logs/ (daily security logs)
│   └── reports/ (generated reports)
├── scripts/ (utility scripts)
│   └── test-security-secrets.js (pre-commit security check)
├── docs/ (project documentation)
│   ├── master.md (this file)
│   ├── context-best-practices.txt (AI coding guidelines)
│   ├── pre-commit-security-checklist.md
│   ├── smtp-email-system.md
│   ├── per-user-smtp-system.md
│   └── work journals and reports
└── node_modules/ (dependencies)
```

## Middleware Architecture

### Authentication Flow
1. **auth** - JWT token validation (cookies, headers, or query params)
2. **requireActiveSubscription** - Subscription status check
3. **requireNdaAcceptance** - NDA agreement enforcement
4. **adminAuth** - Admin-only access control (isAdmin check)
5. **requirePermission(permission)** - Granular permission check for specific actions

### Route Protection Levels

#### Full Protection (auth + subscription + NDA)
- `/dashboard` - Main analytics dashboard
- `/contact-manager` - Contact management
- `/messages` - Messaging interface
- `/templates` - Template management
- `/my-numbers` - Phone number management
- `/my-tokens` - Token management
- `/ai-calling` - Voice campaign interface
- `/image-library` - Image management
- `/invoices` - Invoice management

#### Partial Protection (auth + NDA, no subscription)
- `/user-management` - Account settings
- `/training` - Training module
- `/go-pro` - Upgrade page
- `/message-scheduler` - Scheduled messages

#### Admin Only (adminAuth)
- `/management` - Admin management dashboard
- `/admin/audit-logs` - Audit log viewer
- `/admin/help-tickets` - Help ticket management
- `/api/admin/*` - All admin API endpoints

#### Public Routes
- `/`, `/login`, `/register` - Landing and authentication
- `/subscription` - Subscription management (auth only)
- `/nda` - NDA agreement page (auth only)
- `/unsubscribe` - Public unsubscribe page
- `/accept-invitation` - Team invitation acceptance
- `/verify` - Email verification
- `/t/:userId/:token` - Email tracking pixel

## Development Workflow

### Process Management
- **PM2**: Used for process management and auto-restart
- **Commands**: `pm2 restart server` for code updates
- **Logs**: `pm2 logs server` for real-time logging
- **Status**: `pm2 status` to check process health

### Code Organization
- **Current**: Monolithic structure in server.js (~24,500 lines)
- **Pattern**: Express routes with async middleware chains
- **Data**: JSON file-based with safe read/write functions
- **Error Handling**: Try-catch blocks with proper error logging

### Background Processes
- **Scheduled Message Processor** - Runs every 60 seconds to send scheduled messages
- **Email Queue Processor** - Background processing for large email campaigns
- **Domain Warmup Tracker** - Monitors and enforces sending limits for new domains

## Key Metrics & Performance

### User Experience
- Professional-grade contact management with phone number formatting
- Intuitive template creation with AI assistance
- **AI Voice Calling** - Complete campaign creation and monitoring workflow
- **Interactive Voice Responses** - Real-time DTMF keypress collection
- **Voice Preview System** - Instant audio preview with exact campaign voices
- **Multi-User Collaboration** - Team-based account management with role permissions
- **Comprehensive Dashboard** - Real-time analytics and campaign overview
- **Training Module** - User education and onboarding system
- **NDA Compliance** - Automatic legal agreement enforcement
- Responsive design for all devices with mobile optimization
- Real-time feedback and error handling
- **Two-Factor Authentication** - Enhanced security with SMS/email verification

### Technical Performance
- Efficient JSON-based data storage with multi-user architecture
- Optimized API integrations (Twilio, OpenAI, AWS Polly, MyMemory)
- **Real-time Campaign Monitoring** - Live call status updates and statistics
- **Multi-language Support** - Automatic translation and voice synthesis
- **E.164 Phone Formatting** - Automatic Twilio-compatible number formatting
- **Email Queue System** - Background processing for large campaigns
- **Team Analytics** - Combined performance metrics across team members
- **Safe File Operations** - Corruption prevention and auto-recovery
- Proper error handling and fallbacks
- Secure authentication and data protection with 2FA and role-based permissions

## Security & Compliance

### Data Protection
- JWT authentication for all routes with 2FA enhancement
- Password hashing with bcrypt
- **NDA Agreement Enforcement** - Legal compliance before app access
- **Two-Factor Authentication** - Encrypted code storage with expiry
- **Multi-User Data Isolation** - Account-based data separation and team permissions
- **Role-Based Access Control** - Granular permissions for different user types
- User data isolation and privacy
- **Voice Campaign Security** - User-specific campaign and call data isolation
- **Email Sender Security** - SPF/DKIM verification and domain authentication
- Secure file upload validation
- **Contacts Protection** - Prevention of accidental data loss (empty array writes blocked)

### Audit & Compliance
- **Security Event Logging** - Authentication, NDA acceptance, and critical actions
- **IP Address Tracking** - Full audit trail for compliance requirements
- **User Agent Recording** - Device and browser information logging
- **Timestamp Recording** - ISO 8601 format for all events

### API Security
- Environment variable configuration (AWS, Twilio, OpenAI keys)
- API key management with secure credential handling
- **Twilio Integration Security** - Secure webhook endpoints and status callbacks
- **Voice Data Protection** - Secure TwiML generation and call tracking
- **Team Invitation Security** - Secure token-based invitation system with expiration
- Rate limiting and validation
- Error handling without data exposure

## Deployment & Maintenance

### Server Management
- **Platform**: Linux server with PM2
- **Domain**: campaignbuilder.ca
- **Process**: Automated restart and monitoring
- **Backup**: JSON data files with timestamped backups

### Monitoring
- PM2 process monitoring
- Error logging and tracking
- **Voice Campaign Analytics** - Real-time call monitoring and response tracking
- **Twilio Webhook Monitoring** - Call status and interaction logging
- **Team Activity Monitoring** - Multi-user account activity tracking
- **Email Delivery Monitoring** - Email status and delivery tracking
- **Dashboard Analytics** - Comprehensive performance metrics and reporting
- **Security Audit Logs** - Authentication and NDA compliance logging
- User activity monitoring
- Performance metrics tracking

## Development History

### ✅ Recently Completed (January 2026)
- **NDA Agreement System** - Mandatory legal acceptance with full audit trail
- **Responsive NDA Page** - Mobile-optimized agreement interface
- **Security Event Logging** - Enhanced audit logging for compliance
- **Contact Category Management** - Bulk category updates and corrections
- **Pre-commit Security Script** - Automated secrets detection before git pushes

### ✅ 2025 Milestones
- **Twilio TrustHub Integration** - Primary Customer Profile for +1 number calling
- **AI Voice Calling System** - Complete voice campaign infrastructure
- **Multi-language Support** - 14+ languages with auto-translation
- **Help Ticket System** - User support request management
- **Domain Warmup System** - Progressive email sending limits
- **Email Queue System** - Background processing for large campaigns
- **Suppression List Management** - Automated bounce handling
- **Multi-User Architecture** - Team collaboration with shared data
- **Image Library System** - User-specific image management
- **Dashboard Analytics** - Comprehensive performance metrics

## API Route Summary

### API Categories (233 total routes)
| Category | Count | Description |
|----------|-------|-------------|
| /api/* | 205 | Core API endpoints |
| /admin/* | 3 | Admin page routes |
| Page routes | 25 | View rendering routes |

### Key API Endpoints
- **Contacts**: CRUD, import, export, categories, communication preferences
- **Templates**: CRUD, versions, AI generation, image integration
- **Messages**: SMS, email, voice campaigns, scheduling, history
- **Voice**: Campaigns, calls, TwiML, monitoring, analytics
- **Email**: Senders, verification, queue, warmup, stats
- **Users**: Team management, invitations, permissions
- **Admin**: Accounts, users, tokens, phone numbers, audit logs
- **Help**: Ticket submission, management, replies

---
**Last Review**: January 23, 2026  
**Status**: Production Application  
**Domain**: campaignbuilder.ca
