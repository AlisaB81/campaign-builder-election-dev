# Campaign Builder – Ownership Transition & Election Mode Expansion Plan

## Purpose
This document defines the **technical, architectural, and feature roadmap** for Campaign Builder following:
- Infrastructure modernization
- Removal of legacy billing dependencies
- Introduction of Election Mode (full campaign operations)

---

## High-Level Goals

1. **Stabilize ownership & infrastructure**
2. **Remove Stripe and decouple billing from core app**
3. **Migrate from JSON file storage to PostgreSQL**
4. **Preserve all existing functionality**
5. **Introduce Election Mode features without feature-tier fragmentation**
6. **Prepare the platform for high-data, high-stakes election usage**

---

## Ownership & Business Model Assumptions

- Campaign Builder is now a **service + platform**, not a self-serve SaaS
- Pricing is handled **off-platform** (invoices, retainers, agreements)
- The app **must not hard-block usage based on Stripe or subscriptions**
- Access control is based on:
  - Account type
  - Permissions
  - Election Mode status

---

## Account Types (Logical, Not Pricing)

There are **three account types**:

### 1. Business
- Full platform access
- No election-specific tables enabled

### 2. EDA
- Same features as Business
- Slightly different data semantics (EDA-specific metadata)

### 3. Election Mode
- Full platform access
- Election-specific data tables enabled
- Elevated operational expectations

⚠️ **All feature code remains available to all accounts**
Only **data models, routes, and UI visibility** differ.

---

## Phase 1 – Billing & Stripe Removal (Immediate)

### Objectives
- Remove Stripe dependency completely
- Prevent billing logic from blocking app functionality
- Preserve invoice history for records

### Tasks
- Remove Stripe SDK usage
- Remove `/subscription` enforcement middleware
- Convert `requireActiveSubscription` to:
  - `requireActiveAccount`
- Replace subscription checks with:
  - `accountStatus: active | paused | archived`
- Keep:
  - Invoice generation
  - Manual invoice records
- Remove:
  - Stripe checkout flows
  - Auto-renew logic
  - Token auto-purchase logic

### Result
Campaign Builder becomes **billing-agnostic** and service-driven.

---

## Phase 2 – Infrastructure Modernization

### Server
- Migrate to **CPU-optimized DigitalOcean droplet**
- PM2 remains process manager
- Add structured environment configuration

### Database
- Replace JSON file storage with **PostgreSQL**
- Use PostgreSQL for:
  - Users
  - Accounts
  - Contacts
  - Campaigns
  - Messages
  - Analytics
  - Election data

### Backup Strategy
- Nightly PostgreSQL dumps
- Stored on:
  - In-house 1TB drive
  - Optional offsite snapshot
- Retain:
  - 7 daily
  - 4 weekly
  - 6 monthly backups

⚠️ JSON data remains **read-only** during migration until validated.

---

## Phase 3 – Data Model Migration

### Core Tables (Initial)
- accounts
- users
- contacts
- templates
- campaigns
- messages
- analytics
- audit_logs

### Migration Strategy
- Write migration scripts:
  - JSON → PostgreSQL
- Validate record counts
- Validate foreign key integrity
- Run in parallel until verified
- Flip reads to PostgreSQL only after validation

---

## Phase 4 – Election Mode (Major Feature Expansion)

Election Mode is a **status**, not a plan.

### Election Mode Activation
- `account.electionMode = true`
- Enables:
  - Additional tables
  - Additional routes
  - Additional UI components

---

## Election Mode Features

### 1. Voter Interaction Data
- Track:
  - Contact interactions
  - Support likelihood
  - Last contact method
- Append-only interaction history

### 2. List Building & Segmentation
- Dynamic lists by:
  - Poll
  - Location
  - Interaction history
  - Support score
- Saved views for teams

### 3. Scrutineering / Vote Tracking
- Poll-based vote marking
- Submit-only volunteer permissions
- Real-time turnout counters
- Immutable audit trail

### 4. Canvassing Planner
- Assign canvass areas
- Track completion
- Volunteer task views

### 5. Navigation Optimization
- Mapbox API integration
- Route optimization for canvassing
- “Circuit-style” walking/driving routes

### 6. Admin Team Builder (Election)
- Role-based access:
  - Admin
  - Organizer
  - Volunteer
- Permission-scoped UI
- NDA enforcement required

---

## Phase 5 – UI & UX Adjustments

- Add **Election Mode badge**
- Hide election-specific UI unless enabled
- Add canvassing & scrutineering dashboards
- Preserve existing dashboard layout
- No feature paywalls

---

## Phase 6 – Messaging & External Services (Confirmed)

### Email
- Postmark API
- Domain verification per account
- High deliverability priority

### SMS & Voice
- Twilio API
- SMS + AI calling
- TrustHub-compliant
- Usage logged and auditable

### AI
- OpenAI API
- Content generation
- Voice scripts
- Data analysis (non-sensitive)

### Maps
- Mapbox API
- Geocoding
- Route optimization

---

## Security & Compliance (Non-Negotiable)

- NDA required before access
- Audit logs for:
  - Election data
  - Vote marking
  - Admin actions
- Role-based permissions everywhere
- No destructive deletes on election data
- Append-only logs for scrutineering

---

## Explicit Non-Goals

- ❌ No Stripe
- ❌ No feature-tier paywalls
- ❌ No client-side-only security
- ❌ No live schema edits during elections
- ❌ No silent data mutation

---

## Development Principles (Cursor Guidance)

- Prefer clarity over cleverness
- Break up server.js during migration
- No schema shortcuts for election data
- Every election action must be auditable
- Production safety > speed

---

## End State Vision

Campaign Builder becomes:
- A **full campaign operations platform**
- Suitable for:
  - EDAs
  - Leadership campaigns
  - High-volume elections
- With:
  - Predictable infrastructure
  - Clean pricing outside the app
  - Strong data integrity
  - Clear operational boundaries

---

**Document Owner**: Alisa Brown  
**Status**: Active Development Plan  
**Next Review**: After PostgreSQL migration
