# Election Mode - Master Implementation Document

**Last Updated**: February 11, 2026  
**Status**: Active Development - Phase 4 Implementation  
**Environment**: `public_html_election_dev` (Development/Staging)

---

## Executive Summary

Election Mode is a feature set that transforms Campaign Builder into a comprehensive election campaign operations platform. It provides specialized tools for voter interaction tracking, vote tracking (scrutineering), dynamic list building, and canvassing management.

**Key Principle**: Election Mode is a **status flag**, not a pricing tier. All feature code remains available to all accounts; only data models, routes, and UI visibility differ.

---

## Implementation Status

### ✅ Completed Components

#### 1. Database Foundation (Phase 2 & 3)
- **PostgreSQL Integration**: Dual-write capability with JSON fallback
- **Migration System**: Automated migration runner with rollback support
- **Core Tables**: `accounts`, `users`, `contacts` (Phase 2)
- **Election Tables**: All 6 election-specific tables created (Phase 3)

#### 2. Election Mode Activation
- **Account-Level Flag**: `account.electionMode = true` or `user.accountType === 'election'`
- **Middleware**: `requireElectionMode` checks account status
- **Admin Endpoint**: `/api/admin/accounts/:accountId/election-mode` (POST) to enable/disable
- **Status Endpoint**: `/api/election/status` (GET) to check current status

#### 3. Database Schema (Phase 3)

**All tables include append-only or immutable audit enforcement at database level:**

##### `election_interactions` (Append-Only)
- Tracks all voter interactions
- Fields: `id`, `account_id`, `contact_id`, `user_id`, `interaction_type`, `interaction_method`, `support_likelihood` (0-100), `notes`, `metadata`, `created_at`, `created_by`
- **Enforcement**: Database triggers prevent UPDATE and DELETE operations
- **Indexes**: `account_id`, `contact_id`, `created_at`

##### `election_lists` (Soft Delete)
- Saved filter configurations for dynamic lists
- Fields: `id`, `account_id`, `user_id`, `name`, `description`, `filter_config` (JSONB), `contact_count`, `is_shared`, `created_at`, `updated_at`, `deleted_at`
- **Indexes**: `account_id`, `user_id`

##### `election_poll_turnout` (Updateable)
- Tracks voter turnout by poll
- Fields: `id`, `account_id`, `poll_number`, `riding`, `province`, `total_voters`, `votes_cast`, `last_updated_at`, `updated_by`
- **Unique Constraint**: `(account_id, poll_number, riding, province)`
- **Indexes**: `account_id`, `poll_number + riding + province`

##### `election_vote_marks` (Immutable)
- Records vote marking events - completely immutable
- Fields: `id`, `account_id`, `contact_id`, `poll_number`, `riding`, `province`, `marked_by`, `marked_at`, `verification_code`, `notes`, `metadata`, `created_at`
- **Enforcement**: Database triggers prevent UPDATE and DELETE operations
- **Indexes**: `account_id`, `poll_number + riding + province`, `contact_id`

##### `canvass_assignments` (Updateable)
- Assigns canvassing areas to users/volunteers
- Fields: `id`, `account_id`, `assigned_to`, `assigned_by`, `area_name`, `area_description`, `area_boundaries` (JSONB), `contact_ids` (JSONB), `status`, `priority`, `due_date`, `completed_at`, `notes`, `metadata`, `created_at`, `updated_at`
- **Indexes**: `account_id`, `assigned_to`, `status`

##### `canvass_events` (Append-Only)
- Tracks canvassing activities and results
- Fields: `id`, `account_id`, `assignment_id`, `user_id`, `contact_id`, `event_type`, `event_data` (JSONB), `location` (JSONB), `notes`, `created_at`
- **Indexes**: `account_id`, `assignment_id`, `user_id`

#### 4. Services Layer (Phase 4)

##### `services/election.js` (Orchestrator)
- Central election service that delegates to specialized services
- Functions: `recordInteraction`, `getContactInteractions`, `markVote`, `updatePollTurnout`, `getPollTurnout`, `saveElectionList`, `getElectionLists`, `createCanvassAssignment`, `recordCanvassEvent`
- **Status**: ✅ Implemented (delegates to specialized services)

##### `services/voter-interactions.js`
- **Purpose**: Track voter interactions and calculate support likelihood
- **Functions**:
  - `recordInteraction()` - Append-only interaction recording
  - `getContactInteractions()` - Get all interactions for a contact
  - `calculateSupportScore()` - Calculate average support likelihood
  - `getInteractionStatistics()` - Aggregate statistics
- **Status**: ✅ Fully Implemented
- **Storage**: PostgreSQL with JSON fallback support

##### `services/scrutineering.js`
- **Purpose**: Vote tracking, verification, and turnout management
- **Functions**:
  - `markVote()` - Mark a vote with verification code (immutable)
  - `verifyVote()` - Verify a vote mark by code
  - `getVoteMarks()` - Get vote marks with filters
  - `getPollVoteMarks()` - Get votes for a specific poll
  - `updatePollTurnout()` - Update turnout counts
  - `getPollTurnout()` - Get turnout statistics
- **Status**: ✅ Fully Implemented
- **Storage**: PostgreSQL with JSON fallback support
- **Security**: Requires `mark_votes` permission for vote marking

##### `services/election-lists.js`
- **Purpose**: Dynamic list building and segmentation
- **Functions**:
  - `saveList()` - Create/update saved list
  - `getLists()` - Get all lists for account
  - `getList()` - Get specific list
  - `deleteList()` - Soft delete list
  - `calculateListContactCount()` - Count contacts matching filters
  - `getContactsByFilters()` - Get filtered contacts with pagination
  - `refreshListCount()` - Recalculate list contact count
- **Status**: ✅ Fully Implemented (PostgreSQL + JSON fallback)
- **Filter Support**: Poll number, riding, province, categories, support score ranges, interaction history

##### `services/canvassing.js`
- **Purpose**: Canvass assignment and event tracking
- **Functions**:
  - `createAssignment()` - Create canvass assignment
  - `getAssignments()` - Get assignments with filters
  - `getAssignment()` - Get specific assignment
  - `updateAssignment()` - Update assignment status/details
  - `completeAssignment()` - Mark assignment as complete
  - `recordEvent()` - Record canvassing event
  - `getAssignmentEvents()` - Get events for assignment
- **Status**: ✅ Fully Implemented
- **Storage**: PostgreSQL with JSON fallback support
- **Security**: Requires `manage_canvassing` permission for creation

##### `services/admin-dashboard.js`
- **Purpose**: Election overview and analytics
- **Functions**:
  - `getDashboardData()` - Aggregate dashboard statistics
  - Supports date range filtering
- **Status**: ✅ Implemented
- **Security**: Requires `view_dashboard` permission

##### `services/bulk-operations.js`
- **Purpose**: Bulk actions on election data
- **Functions**:
  - `bulkUpdatePollTurnout()` - Bulk update turnout counts
  - `bulkCreateAssignments()` - Create multiple assignments
- **Status**: ✅ Implemented
- **Security**: Permission-based access

##### `services/export.js`
- **Purpose**: Export election data to CSV
- **Functions**: Export capabilities for election data
- **Status**: ✅ Implemented

#### 5. Middleware (Phase 3)

##### `middleware/election.js`
- **`requireElectionMode`**: Checks if account has election mode enabled
  - Checks PostgreSQL first (if enabled)
  - Falls back to JSON file check
  - Also checks user-level flags
  - Returns 403 if not enabled
- **`requireElectionPermission`**: Checks user permissions
  - Validates specific permission (e.g., `mark_votes`, `manage_canvassing`, `view_dashboard`)
  - Supports wildcard `*` permission
  - Admin and app_owner bypass
- **Status**: ✅ Fully Implemented

#### 6. API Endpoints (Phase 4)

##### HTML Routes (Page Views)
- `GET /election/scrutineering` - Vote Tracking page
- `GET /election/interactions` - Voter Interactions page
- `GET /election/lists` - Election Lists page
- `GET /election/canvassing` - Canvassing page
- **All routes require**: `auth`, `requireActiveAccount`, `requireNdaAcceptance`, `requireElectionMode`

##### API Routes - Status & Activation
- `GET /api/election/status` - Check election mode status
- `POST /api/admin/accounts/:accountId/election-mode` - Enable/disable election mode (admin only)

##### API Routes - Voter Interactions
- `POST /api/election/interactions` - Record interaction
- `GET /api/election/interactions/:contactId` - Get contact interactions
- `GET /api/election/contacts/:contactId/support-score` - Get support score
- `GET /api/election/contacts/:contactId/last-contact` - Get last contact info
- `GET /api/election/contacts/by-support-score` - Get contacts by support score range
- `GET /api/election/interactions/statistics` - Get interaction statistics

##### API Routes - Scrutineering (Vote Tracking)
- `POST /api/election/vote-marks` - Mark a vote (requires `mark_votes` permission)
- `GET /api/election/vote-marks` - Get vote marks with filters
- `GET /api/election/vote-marks/poll/:pollNumber` - Get votes for poll
- `GET /api/election/vote-marks/verify/:verificationCode` - Verify vote mark
- `GET /api/election/poll-turnout` - Get poll turnout statistics
- `GET /api/election/poll-turnout/:pollNumber` - Get turnout for specific poll

##### API Routes - Election Lists
- `POST /api/election/lists` - Create/update list
- `GET /api/election/lists` - Get all lists for account
- `GET /api/election/lists/:listId` - Get specific list
- `POST /api/election/lists/contacts` - Get contacts matching filter config
- `DELETE /api/election/lists/:listId` - Delete list (soft delete)
- `POST /api/election/lists/:listId/refresh` - Refresh list contact count

##### API Routes - Canvassing
- `POST /api/election/canvass/assignments` - Create assignment (requires `manage_canvassing` permission)
- `GET /api/election/canvass/assignments` - Get assignments with filters
- `GET /api/election/canvass/assignments/:assignmentId` - Get specific assignment
- `PUT /api/election/canvass/assignments/:assignmentId` - Update assignment
- `POST /api/election/canvass/assignments/:assignmentId/complete` - Mark assignment complete
- `GET /api/election/canvass/assignments/:assignmentId/events` - Get assignment events
- `POST /api/election/canvass/events` - Record canvass event

##### API Routes - Admin & Bulk Operations
- `GET /api/election/admin/dashboard` - Admin dashboard data (requires `view_dashboard` permission)
- `POST /api/election/bulk/poll-turnout` - Bulk update turnout (requires `manage_turnout` permission)
- `POST /api/election/bulk/assignments` - Bulk create assignments (requires `manage_canvassing` permission)

**Total Election API Endpoints**: 30+ endpoints

#### 7. UI Views (Phase 4)

##### `views/election-scrutineering.ejs`
- **Purpose**: Vote Tracking interface
- **Status**: ✅ HTML UI Created (Placeholder - needs Vue.js integration)
- **Features**: Vote marking interface, poll turnout display, verification

##### `views/election-interactions.ejs`
- **Purpose**: Voter Interactions interface
- **Status**: ✅ HTML UI Created (Placeholder - needs Vue.js integration)
- **Features**: Interaction recording, support score display, interaction history

##### `views/election-lists.ejs`
- **Purpose**: Election Lists interface
- **Status**: ✅ HTML UI Created with Vue.js integration
- **Features**: 
  - List builder with filters (support level, poll number, city, date)
  - Saved lists display
  - Contact count preview
  - Create, view, export lists
- **Integration**: ✅ Connected to API endpoints

##### `views/election-canvassing.ejs`
- **Purpose**: Canvassing management interface
- **Status**: ✅ HTML UI Created (Placeholder - needs Vue.js integration)
- **Features**: Assignment management, area assignment, completion tracking

#### 8. Navigation Integration

##### `views/partials/nav.ejs`
- **Status**: ✅ Updated to show election routes for election accounts
- **Election Routes Shown**:
  - Vote Tracking (`/election/scrutineering`)
  - Voter Interactions (`/election/interactions`)
  - Lists (`/election/lists`)
  - Canvassing (`/election/canvassing`)
- **Layout**: Top horizontal navigation (reverted from sidebar)
- **Conditional Display**: Only shown when `isElectionAccount === true`

#### 9. Dashboard Integration

##### `views/dashboard.ejs`
- **Status**: ✅ Updated to support election accounts
- **Changes**:
  - Conditional welcome message for election accounts
  - `isElectionAccount` variable passed from server
  - `pageTitle` dynamic based on account type

---

## Technical Architecture

### Data Storage Strategy

#### Dual-Write Pattern
- **Primary**: PostgreSQL (when enabled via `DATA_BACKEND=postgres` or `isPostgresEnabled()`)
- **Fallback**: JSON file storage in `data/shared-data/{accountId}/`
- **Migration Path**: Services check PostgreSQL first, fall back to JSON if not available
- **Status**: ✅ Implemented across all election services

#### File Structure (JSON Fallback)
```
data/shared-data/{accountId}/
  ├── account.json (contains electionMode flag)
  ├── contacts.json
  ├── election-lists.json (fallback for lists)
  └── (other account data)
```

### Security & Permissions

#### Permission System
- **Granular Permissions**:
  - `mark_votes` - Can mark votes (scrutineering)
  - `manage_canvassing` - Can create/manage canvass assignments
  - `view_dashboard` - Can view admin dashboard
  - `manage_turnout` - Can update poll turnout
- **Permission Storage**: `user.permissions` array or `user.userType`
- **Wildcard Support**: `*` permission grants all access
- **Admin Bypass**: `app_owner` and `isAdmin === true` bypass all checks

#### Audit Requirements
- **Append-Only Tables**: `election_interactions`, `canvass_events`
  - Database triggers prevent UPDATE/DELETE
  - All changes create new records
- **Immutable Tables**: `election_vote_marks`
  - Database triggers prevent UPDATE/DELETE
  - Complete audit trail for vote marking
- **Soft Delete**: `election_lists` uses `deleted_at` timestamp

### Error Handling

#### Service Layer
- All services use centralized logger (`lib/logger.js`)
- Errors are logged with context (accountId, userId, etc.)
- JSON fallback errors are logged but don't break functionality

#### API Layer
- Consistent error responses: `{ error: string, code?: string }`
- Status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 500 (server error)
- HTML error pages for browser requests

---

## Integration Points

### With Core Platform

#### Contact Management
- **Integration**: Election features use existing `contacts` table/JSON
- **Enhancement**: Adds `poll_number`, `riding`, `province` fields (if not present)
- **Support Score**: Calculated from `election_interactions` table

#### User Management
- **Integration**: Uses existing user authentication and permissions
- **Enhancement**: Adds election-specific permissions
- **NDA Requirement**: All election routes require NDA acceptance

#### Navigation
- **Integration**: Election routes added to main navigation
- **Conditional Display**: Only shown for election accounts
- **Layout**: Uses standard top navigation (not sidebar)

### External Services

#### PostgreSQL (Phase 2)
- **Connection**: `db/connection.js` manages pool
- **Migrations**: `db/migrations.js` runs on startup
- **Adapters**: `db/adapters.js` provides abstraction layer
- **Status**: ✅ Integrated, dual-write enabled

#### JSON File Storage (Legacy)
- **Location**: `data/shared-data/{accountId}/`
- **Usage**: Fallback when PostgreSQL not available
- **Status**: ✅ Maintained for backward compatibility

---

## Current Limitations & Known Issues

### 1. UI Implementation Status
- **Election Lists**: ✅ Fully functional with Vue.js
- **Vote Tracking**: ⚠️ HTML placeholder only, needs Vue.js integration
- **Voter Interactions**: ⚠️ HTML placeholder only, needs Vue.js integration
- **Canvassing**: ⚠️ HTML placeholder only, needs Vue.js integration

### 2. Data Migration
- **PostgreSQL**: ✅ Schema created, dual-write enabled
- **JSON to PostgreSQL**: ⚠️ Migration scripts not yet run for existing data
- **Validation**: ⚠️ Need to validate data integrity after migration

### 3. Feature Completeness
- **List Building**: ✅ Fully functional
- **Vote Tracking**: ✅ Backend complete, UI needs work
- **Voter Interactions**: ✅ Backend complete, UI needs work
- **Canvassing**: ✅ Backend complete, UI needs work
- **Route Optimization**: ❌ Not implemented (Mapbox integration planned)
- **Admin Dashboard**: ✅ Backend complete, UI needs work

### 4. Testing
- **Unit Tests**: ❌ Not implemented
- **Integration Tests**: ❌ Not implemented
- **Manual Testing**: ✅ Basic functionality tested with test account

### 5. Documentation
- **API Documentation**: ⚠️ Inline comments only, no Swagger/OpenAPI
- **User Guide**: ❌ Not created
- **Admin Guide**: ❌ Not created

---

## Development Environment

### Configuration
- **Environment**: `IS_ELECTION_DEV=true` in `.env`
- **Port**: 3081 (separate from production on 3080)
- **Process Manager**: PM2 (`server-election`)
- **Database**: PostgreSQL (if configured) + JSON fallback

### Test Account
- **Email**: `election-tester@test.com`
- **Password**: `TestElection123!`
- **Account Type**: Election Mode enabled
- **Location**: `data/individual-data/test-election-account/user.json`

### Access
- **Local**: `http://localhost:3081`
- **SSH Port Forwarding**: Required for remote access
- **Base URL**: Dynamically determined (no hardcoded redirects)

---

## Next Steps & Recommendations

### Immediate Priorities

1. **Complete UI Implementation**
   - Integrate Vue.js for Vote Tracking page
   - Integrate Vue.js for Voter Interactions page
   - Integrate Vue.js for Canvassing page
   - Add real-time updates where appropriate

2. **Data Migration**
   - Run migration scripts to move JSON data to PostgreSQL
   - Validate data integrity
   - Test dual-write functionality
   - Switch to PostgreSQL-only after validation

3. **Testing**
   - Create test suite for election services
   - Test permission system
   - Test audit trail enforcement
   - Test JSON fallback scenarios

### Future Enhancements

1. **Route Optimization** (Phase 4 - Planned)
   - Mapbox API integration
   - Geocoding for addresses
   - Route optimization for canvassing
   - "Circuit-style" walking/driving routes

2. **Advanced Analytics**
   - Support score trends
   - Interaction pattern analysis
   - Turnout predictions
   - Canvassing efficiency metrics

3. **Mobile Optimization**
   - Mobile-friendly canvassing interface
   - Offline capability for vote marking
   - GPS integration for canvassing

4. **Export/Import**
   - Export election data to CSV/Excel
   - Import voter lists
   - Bulk import interactions

---

## Code Organization

### Directory Structure
```
public_html_election_dev/
├── db/
│   ├── connection.js (PostgreSQL connection)
│   ├── migrations.js (Migration runner)
│   ├── migrations/
│   │   ├── 001_initial_schema.js
│   │   └── 002_election_mode_schema.js
│   └── adapters.js (Database abstraction)
├── services/
│   ├── election.js (Orchestrator)
│   ├── voter-interactions.js
│   ├── scrutineering.js
│   ├── election-lists.js
│   ├── canvassing.js
│   ├── admin-dashboard.js
│   ├── bulk-operations.js
│   └── export.js
├── middleware/
│   └── election.js (requireElectionMode, requireElectionPermission)
├── views/
│   ├── election-scrutineering.ejs
│   ├── election-interactions.ejs
│   ├── election-lists.ejs
│   ├── election-canvassing.ejs
│   └── partials/
│       └── nav.ejs (updated with election routes)
└── server.js (main application file)
```

### Key Files
- **Server Routes**: `server.js` lines 16871-25295 (election routes)
- **Middleware Setup**: `server.js` lines 2291-2297
- **Database Migrations**: `db/migrations/002_election_mode_schema.js`
- **Service Layer**: `services/*.js`

---

## Security Considerations

### Data Protection
- **Append-Only Enforcement**: Database triggers prevent data tampering
- **Immutable Audit Trail**: Vote marks cannot be modified or deleted
- **Permission-Based Access**: Granular permissions for sensitive operations
- **NDA Requirement**: All election routes require NDA acceptance

### Audit Logging
- **Interaction History**: All interactions recorded with timestamp and user
- **Vote Marking**: Complete audit trail with verification codes
- **Admin Actions**: All admin operations logged
- **Database Level**: Triggers enforce immutability

### Compliance
- **Data Retention**: Append-only design preserves complete history
- **Access Control**: Role-based permissions
- **Audit Trail**: Complete history of all election operations

---

## Performance Considerations

### Database Indexes
- All foreign keys indexed
- Common query patterns indexed (poll_number, account_id, contact_id)
- Composite indexes for multi-column queries

### Query Optimization
- Services use parameterized queries
- Pagination support for large datasets
- Efficient JOINs for related data

### Caching
- Currently no caching implemented
- **Recommendation**: Add Redis for frequently accessed data

---

## Deployment Notes

### Environment Variables
- `IS_ELECTION_DEV=true` - Enables election dev environment
- `DATA_BACKEND=postgres|json` - Database backend selection
- `DUAL_WRITE=true` - Enable dual-write mode
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config

### PM2 Configuration
- Process name: `server-election`
- Port: 3081
- Auto-restart on file changes: Disabled (manual restart required)

### Migration Strategy
1. Run migrations on startup if PostgreSQL enabled
2. Dual-write to both PostgreSQL and JSON
3. Validate data integrity
4. Switch to PostgreSQL-only after validation
5. Keep JSON as backup/archive

---

## Support & Maintenance

### Logging
- All services use centralized logger
- Log levels: `info`, `warn`, `error`
- Context included: accountId, userId, operation type

### Error Monitoring
- Errors logged to PM2 logs
- Error handler middleware catches unhandled errors
- Database errors logged with full context

### Backup Strategy
- PostgreSQL: Nightly dumps (planned)
- JSON files: File system backups
- Retention: 7 daily, 4 weekly, 6 monthly (planned)

---

## Conclusion

Election Mode is **substantially implemented** with:
- ✅ Complete database schema with audit enforcement
- ✅ Full service layer with dual-write support
- ✅ Comprehensive API endpoints (30+)
- ✅ Middleware and security
- ✅ Basic UI structure
- ⚠️ UI needs Vue.js integration for full functionality
- ⚠️ Data migration from JSON to PostgreSQL pending

The foundation is solid and production-ready for backend operations. The primary remaining work is UI integration and data migration.

---

**Document Maintainer**: Development Team  
**Review Frequency**: After each major feature completion  
**Related Documents**: 
- `/docs/plan.md` - Overall development plan
- `/docs/master.md` - General application overview
