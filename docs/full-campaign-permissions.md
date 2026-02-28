# Election Mode — Secure Access + Workflow Context (Campaign Builder)

## What this is
Election Mode is a high-security, restricted area of Campaign Builder (“server-election”) that is only available to EDA accounts flagged as **active election mode**. Each EDA has one account (tenant) with a team of users. Access must be tightly controlled with strong authentication, strict authorization, and audit logging.

Key security rule: **Every sign-in into Election Mode requires signing the NDA** (not just once). This is a hard gate before any Election Mode data is visible.

---

## Goals
- Prevent unauthorized access to Election Mode.
- Minimize data exposure for volunteers (least privilege).
- Ensure accountability (audit trail).
- Make it usable in the field (SMS fallback + short, predictable flows).
- Enforce NDA acceptance on **every Election Mode sign-in**.

---

## Users / Team Model
- **EDA Account (tenant)**: one per EDA.
- **Team members**: users belonging to the EDA account.
- **Campaign Manager**: full access to Election Mode and controls team creation, roles, permissions, constraints (poll assignments, list assignments).

Team operations:
- Add member (invite/create)
- Assign role template
- Customize per-user permissions (overrides)
- Set constraints: lists, turf, poll(s), etc.
- Suspend/revoke access immediately

---

## Roles (templates)
Required roles:
- Campaign Manager (full access)
- Phone Caller
- Door Knocker
- Lawn Signs
- Driver
- Scrutineer
- Marketer

Important: Roles are **default templates**; Campaign Manager may override per user.

---

## Election Mode Modules / Views
Define module access separately from actions.
Suggested modules:
1. Election Dashboard
2. Team Management (members, roles, permissions)
3. Contact Manager (search/view contact)
4. Lists (assigned lists; list browsing)
5. Phone Bank (calling workflow + dispositions)
6. Canvassing (door knocking workflow + outcomes)
7. Scrutineer (poll-scoped “voted” marking)
8. Lawn Signs (inventory, requests, delivery status)
9. Drivers (rides, scheduling, assignments)
10. Marketing (drafts, templates, sends/approvals)
11. Reports / Analytics
12. Settings
13. Audit Log

---

## Permission Model (RBAC + Scopes)

### A) Module access flags (examples)
- can_access_team
- can_access_contact_manager
- can_access_lists
- can_access_phone_bank
- can_access_canvassing
- can_access_scrutineer
- can_access_lawn_signs
- can_access_drivers
- can_access_marketing
- can_access_reports
- can_access_settings
- can_access_audit_log

### B) Action flags (examples)
- export_allowed (default false for volunteers)
- send_campaigns_allowed (usually manager-only)
- approve_campaigns_allowed (manager-only)
- manage_team_allowed (manager-only)
- manage_permissions_allowed (manager-only)

### C) Data scopes (enforced server-side)
- contact_read_scope: assigned_lists | poll_only | all
- contact_write_scope: outcomes_only | limited_fields | full
- list_scope: assigned_only | all_lists
- scrutineer_scope: assigned_polls_only
- turf_scope (optional): assigned_only | all
- pii_scope (optional): minimal | standard | full

### D) Default permission matrix (MVP)
Legend: V=view, E=edit/write, A=admin/assign

| Role | Team Mgmt | Contact Manager | Lists | Phone Bank | Canvassing | Scrutineer | Lawn Signs | Drivers | Marketing | Reports |
|---|---|---|---|---|---|---|---|---|---|---|
| Campaign Manager | A | E | E | E | E | E | E | E | E | V |
| Phone Caller | - | V/E* | V | E | - | - | - | - | - | - |
| Door Knocker | - | V/E* | V | - | E | - | - | - | - | - |
| Lawn Signs | - | V (minimal) | V (assigned) | - | - | - | E | - | - | - |
| Driver | - | V (minimal) | V (assigned) | - | - | - | - | E | - | - |
| Scrutineer | - | V (search-only, poll-only) | - | - | - | E (assigned polls) | - | - | - | - |
| Marketer | - | V (standard) | V | - | - | - | - | - | E** | V (limited) |

\* Contact Manager write restrictions by role:
- Phone Caller: write only call outcomes/dispositions, notes, follow-up flags, support rating (if allowed).
- Door Knocker: write only canvass outcomes, issues, notes, follow-up flags, yard sign request (if allowed).
No volunteer edits to core identity fields unless explicitly granted.

\** Marketing split (recommended):
- Marketer: can create drafts/templates
- Campaign Manager: approves/sends (or “send_campaigns_allowed” can be explicitly granted)

---

## Authentication Requirements (Election Mode)

### Baseline
All Election Mode access must satisfy:
1) Valid account + active team membership under the EDA tenant
2) Election Mode enabled for tenant
3) **2FA required** (enrollment mandatory)
4) **NDA signature required every Election Mode sign-in** (hard gate)
5) Server-side permission checks for each module/action

### Preferred 2FA methods (in order)
1) TOTP authenticator app (preferred)
2) SMS OTP fallback (field usability)
3) Email OTP last resort (recovery only)

Optional Phase 2:
- Passkeys (WebAuthn) for Campaign Manager (recommended)

### Step-up authentication
Use a “step-up” policy for Election Mode and sensitive actions.

Track:
- last2FAVerifiedAt (timestamp)
- lastElectionNDAAcceptedAt (timestamp)
- electionSessionId (or election_access token claim)

Rules (recommended defaults):
- Entering Election Mode requires last2FAVerifiedAt within 30 minutes OR challenge.
- Sensitive actions require last2FAVerifiedAt within 10–15 minutes OR challenge.

### Campaign Manager stronger requirement
- Campaign Manager must use TOTP (or Passkey in Phase 2); do not allow SMS-only as sole method by default.
- Always require step-up for:
  - permissions changes
  - exports
  - sending campaigns
  - poll assignment changes
  - user suspension/reactivation

### Scrutineer constraints
- Scrutineers are tightly scoped:
  - scrutineer_scope = assigned_polls_only
  - contact_read_scope = poll_only
  - no lists browsing, no exports, no marketing, no general contact browsing
- Session should be short and require step-up more frequently (field devices + risk).

---

## NDA Every Election Mode Sign-in (Hard Requirement)

### Definition: “Election Mode sign-in”
Any session attempt to access Election Mode routes (e.g., `/election/*`) must require:
- authentication + 2FA step-up (as per policy)
- THEN **NDA acceptance** (every time)

### NDA enforcement behaviors
- NDA acceptance must happen BEFORE any Election Mode page loads data.
- NDA acceptance should be:
  - a dedicated interstitial page (no nav to other modules)
  - a required checkbox + typed full name (optional) + timestamp
  - optionally capture IP + userAgent for recordkeeping
- NDA acceptance should be recorded as an immutable log entry:
  - userId, tenantId, electionId (if applicable), timestamp, ip, userAgent, ndaVersionHash

### “Every time” meaning
Recommended approach:
- NDA acceptance is tied to an “Election Mode session” (not general app session).
- On each new Election Mode entry:
  - if there is no valid `electionSessionId` OR the election session expired → require NDA again
- Also force NDA again when:
  - user logs out
  - refresh token rotation indicates new device session
  - user switches tenants (if ever supported)
  - election mode period resets (optional)

Practical default:
- NDA required once per Election Mode session; Election Mode session expires after short TTL (e.g., 8 hours or less), or sooner for scrutineers.

---

## Session Security (Election Mode)

### Tokens / cookies
- Use httpOnly cookies for auth tokens (avoid localStorage)
- Access token TTL: 15–30 minutes
- Refresh token rotation + replay detection
- Separate “Election Mode session” concept:
  - electionSessionId stored server-side or as signed claim with strict TTL
  - electionSessionActive = true only after 2FA + NDA

### Revocation rules
Immediately revoke Election Mode access on:
- password change
- 2FA method changes / reset
- permission changes (role/override changes)
- user suspension by Campaign Manager
- repeated failed OTP / 2FA challenges (lockout policy)

### Rate limiting / lockout
- Rate limit:
  - login endpoint
  - OTP request endpoint
  - OTP verify endpoint
  - NDA accept endpoint (to prevent abuse)
- Lockout strategy:
  - progressive delays
  - temporary lock after N failed attempts
- Always log failures in audit logs.

---

## Onboarding & First Login Flow (Election Mode Team)

### Campaign Manager: create team + assign
1) Campaign Manager enters Election Mode dashboard
2) Goes to Team Management
3) Adds member (name + email/phone)
4) Assigns role template + permission overrides
5) Assigns constraints:
   - callers: assigned list(s)
   - door knockers: turf + list(s)
   - scrutineers: assigned poll location(s) / poll number(s)
6) Invite sent (activation link or OTP-based onboarding)

### Volunteer: first access
1) Authenticate (password or OTP flow)
2) Enroll 2FA if not enrolled (mandatory)
3) Election Mode entry triggers:
   - step-up 2FA (if required by policy)
   - **NDA acceptance (always)**
4) Land on role home screen (restricted nav)

---

## Route Protection (Server-Side)
All Election Mode routes must enforce in this order:
1) requireAuth (valid session)
2) requireTenantElectionModeEnabled
3) require2FAEnrolled
4) requireRecent2FA (step-up) — policy-based
5) requireElectionNDASignedForThisElectionSession (always on entry / session creation)
6) requirePermission(module/action)
7) requireScope(data-level enforcement)

---

## Sensitive actions requiring step-up (examples)
Require last2FAVerifiedAt within 10–15 minutes:
- export contacts/lists
- send SMS/email/AI calling campaigns
- approve campaigns
- change team permissions/roles
- assign poll(s) to scrutineers
- bulk updates to contacts
- view full PII (if you implement pii_scope)
- disable/enable Election Mode
- suspend/restore a user

---

## Audit Logging Requirements (Election Mode)
Log these events at minimum:
- login success/failure
- 2FA enrollment + method changes
- 2FA step-up success/failure
- NDA accepted (with ndaVersionHash)
- permission/role changes
- list assignments changes
- poll assignments changes
- exports
- campaign sends/approvals
- scrutineer “voted” marks (who/when/poll)
- contact modifications (who changed what field group)

---

## Scrutineer workflow (secure + scoped)
- Only sees Scrutineer module
- Can search contacts using limited fields (name + partial address/postal + poll number)
- Results restricted to assigned polls only
- Can mark “Voted” for a contact
- System records:
  - contactId, pollId, timestamp, scrutineerUserId, device/session id
- No list browsing, no exporting, no general contact browsing.

---

## MVP Phases
Phase 0 — Foundation
- Permission keys + scope model defined
- Election Mode middleware chain (auth → electionModeEnabled → 2FA → NDA → permission → scope)
- Audit log table + logging helpers

Phase 1 — Team + Secure Entry
- Team Management UI (add member, assign role, overrides, constraints)
- 2FA enforcement for Election Mode
- NDA interstitial REQUIRED every Election Mode sign-in
- Role-based nav restriction + server-side route protection

Phase 2 — Core volunteer modules
- Lists (assigned-only)
- Contact Manager limited views + role-specific write fields
- Phone Bank / Canvassing outcomes
- Scrutineer module with poll-only scope

Phase 3 — High-risk features hardened
- Exports + send campaigns (step-up required)
- Passkeys for Campaign Manager (optional)
- Device trust (optional)
- Enhanced PII minimization + reporting

---

## Open decisions (track explicitly)
- “Every sign-in NDA” definition: per Election Mode session vs every page load
  - Recommendation: **per Election Mode session** (still “every entry”), with strict session TTL
- Whether volunteers can use passwordless OTP-only login or must have passwords
- Whether to require TOTP for all roles or allow SMS for scrutineers/callers
- What fields are editable per role (final field-level permissions list)
- Poll assignment structure (pollId, location, polling station, multiple polls per station)