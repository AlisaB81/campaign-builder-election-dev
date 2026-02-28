# Election Mode – Operational Workflow

**Last Updated**: February 11, 2026  
**Applies To**: Election Mode Accounts (`account.electionMode = true`)  
**Environment**: `public_html_election_dev`

---

## Purpose

This document defines the **end-to-end operational workflow** for Election Mode accounts in Campaign Builder.

It describes **how users actually use the system**:
- From loading contacts
- To messaging and list building
- To canvassing and voter interaction updates
- To scrutineering on election day

This is a **workflow document**, not an architecture or API reference.

---

## Core Principles

- Election Mode is a **status flag**, not a separate app
- Election accounts retain **all standard Campaign Builder functionality**
- Election-specific workflows add:
  - Voter interaction tracking
  - Canvassing workflows
  - Volunteer role separation
  - Scrutineering (vote marking)
- All election actions must be **auditable**
- Volunteers have **restricted, task-specific access**

---

## Primary Roles & Access Levels

### 1. Admin
Full control over the election account.

**Can:**
- Enable Election Mode
- Load and manage contacts
- Create templates and campaigns (email, SMS, AI calling)
- Create and manage lists
- View and edit voter interactions
- Build volunteer teams and assign permissions
- Create canvassing assignments
- View dashboards and analytics
- Access scrutineering views

---

### 2. Organizer
Operational campaign staff.

**Can:**
- Create lists (calling / canvassing)
- View and update voter interactions
- Assign canvassing areas
- Review canvassing results
- Manage volunteers (limited)
- View dashboards

**Cannot:**
- Enable/disable Election Mode
- Modify system-level settings

---

### 3. Volunteer
Field-level users.

**Can:**
- Access assigned canvassing lists
- View limited contact details
- Record doorstep interactions
- Add notes
- Update voter support status via interactions

**Cannot:**
- Export data
- See full contact database
- Access dashboards
- Modify lists or filters

---

### 4. Scrutineer
Election-day poll workers.

**Can:**
- Search contacts by name and poll
- Mark whether a contact has voted
- View poll turnout counts

**Cannot:**
- Edit contact data
- View interaction history
- Add notes (except optional vote notes)
- Access canvassing or lists

---

## Workflow Overview (High Level)

1. **Admin loads contacts**
2. **Admin/Organizer creates templates and sends campaigns**
3. **Admin/Organizer builds lists**
4. **Lists are used for calling or canvassing**
5. **Canvassers collect doorstep data**
6. **Voter interactions update contact support status**
7. **Admins review data and adjust strategy**
8. **Scrutineers mark votes on election day**

---

## Detailed Workflow

---

## 1. Contact Loading & Preparation

### Actor
Admin

### Steps
1. Upload contacts via CSV / Excel
2. Contacts are stored in:
   - `contacts` table (PostgreSQL) or JSON fallback
3. Required fields:
   - firstName, lastName
4. Optional election-relevant fields:
   - address, city, province
   - postalCode
   - pollNumber
   - category

### Notes
- Contacts are **shared across messaging, lists, canvassing, and scrutineering**
- Election Mode does **not duplicate contacts**

---

## 2. Messaging Campaigns (Same as Non-Election Accounts)

### Actors
Admin, Organizer

### Channels
- Email
- SMS
- AI Calling

### Steps
1. Create templates
2. Select audience:
   - Entire account
   - Saved election list
3. Send campaign
4. Delivery and usage logged normally

### Notes
- Messaging workflows are unchanged
- Election Mode adds **context**, not restrictions

---

## 3. List Building (Calling & Canvassing Lists)

### Actors
Admin, Organizer

### Purpose
Create **dynamic lists** for:
- Phone calling
- Door-to-door canvassing
- Targeted follow-ups

### Steps
1. Navigate to **Election → Lists**
2. Create a new list with filters such as:
   - City or region
   - Poll number
   - Category
   - Support likelihood
   - Interaction history
3. Save list (stored in `election_lists`)
4. List remains dynamic and refreshable

### Result
A reusable list that can be:
- Used for campaigns
- Assigned for canvassing
- Exported (admin only)

---

## 4. Canvassing Workflow (Doorstep Data Collection)

### Actors
Admin, Organizer → Volunteer

### Steps (Admin / Organizer)
1. Select a list
2. Create a **canvassing assignment**
3. Assign:
   - Area (city / region / boundary)
   - Volunteer(s)
   - Due date and priority

### Steps (Volunteer)
1. Log in
2. See **assigned canvassing tasks only**
3. Open assigned contact list
4. Visit contacts door-to-door

---

## 5. Doorstep Interaction & Notes

### Actor
Volunteer (or Organizer)

### For Each Contact
Volunteer can:
- View basic contact info
- Add interaction notes
- Record interaction type (e.g. doorstep)
- Update perceived voter support:
  - Non-supporter → Undecided → Supporter

### Data Storage
- Each action creates a new row in:
  - `election_interactions` (append-only)

### Critical Requirement
**Interaction notes must surface in the main Contact Manager view**

#### Schema Impact
- Contact Manager UI must:
  - Pull latest interaction notes
  - Display interaction history summary
- No notes are stored directly on `contacts`
- Contacts derive state from interactions

---

## 6. Voter Status & Support Tracking

### Actor
Admin, Organizer

### How It Works
- Support score is calculated from interaction history
- Latest interaction determines:
  - Last contact method
  - Last known support status
- Contacts are **never overwritten**
- History remains intact and auditable

---

## 7. Volunteer Team Management (Admin UI Required)

### Actor
Admin

### Purpose
Create structured volunteer teams with controlled access.

### Required UI
**Election → Teams**

Admin can:
- Create roles (e.g. Canvasser, Scrutineer, Phone Bank)
- Assign permissions per role
- Assign users to roles
- Activate/deactivate volunteers

### Permissions Examples
- `canvass_contacts`
- `record_interactions`
- `mark_votes`
- `view_assigned_lists`

---

## 8. Scrutineering (Election Day)

### Actor
Scrutineer

### Purpose
Track who has voted at the poll.

### Steps
1. Scrutineer logs in
2. Navigates to **Election → Vote Tracking**
3. Searches contacts by:
   - Name
   - Poll number
4. For each contact:
   - Mark “Voted”
5. System:
   - Creates immutable `election_vote_marks` record
   - Updates poll turnout count

### Restrictions
- Scrutineers:
  - Cannot edit contacts
  - Cannot view interaction history
  - Cannot see support scores

---

## 9. Admin Review & Strategy Adjustment

### Actor
Admin

### Activities
- Review dashboards
- Monitor turnout
- Identify low-contact or undecided voters
- Create new lists
- Launch follow-up campaigns

---

## Audit & Compliance Guarantees

- All election interactions are append-only
- Vote marking is immutable
- No destructive deletes
- Full attribution:
  - who
  - when
  - what
- Database-level enforcement

---

## Summary

Election Mode workflows allow Campaign Builder to operate as a **full campaign operations system**:

- Contacts remain the core data object
- Lists drive action
- Interactions create intelligence
- Volunteers operate safely with limited access
- Scrutineers perform single-purpose election-day tasks
- Admins retain full oversight and auditability

This workflow defines **how the system is used**, not just how it is built.

---

**Document Owner**: Alisa Brown  
**Status**: Active – Workflow Defined  
**Next Review**: After Volunteer & Scrutineer UI completion