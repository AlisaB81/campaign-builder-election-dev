# Admin & Billing Views – Current State

This document describes the current state of four key views in `public_html_election_dev` so you can plan changes. It covers: **management.ejs**, **admin/help-tickets.ejs**, **admin-audit-logs.ejs**, and **invoices.ejs**.

---

## 1. Management (`views/management.ejs`)

**Route:** `GET /management`  
**Auth:** `adminAuth`, `requireActiveAccount`, `requireNdaAcceptance`  
**Layout:** `layout`  
**Nav:** `partials/nav`

### Purpose
Central admin page for user and system management. Used by app owners and account holders with admin rights.

### Sections (top to bottom)

| Section | Description | Visibility / Notes |
|--------|-------------|--------------------|
| **User Management** | Add user form + users table with search/filter and pagination | All admins |
| **Assign Phone Number to Account** | Dropdown: account holder + app owner’s number; Assign button | **App owner only** (`isAppOwner` from EJS) |
| **Phone Number Subscriptions** | Read-only table of all numbers with User, Monthly Cost, Purchased Date, Status; paginated | All admins |
| **Token Adjustment Modal** | Set SMS/Email/AI tokens (totals) + reason for selected user | Opened from User Management |

### Data & APIs

- **Load on created:** `loadUsers()` → then `loadPhoneNumbers()`, and if `isAppOwner`, `loadAssignablePhoneNumbers()`; also `loadContacts()`, `loadAccounts()`.
- **APIs used:**
  - `GET /api/admin/users` – list users
  - `GET /api/admin/accounts` – accounts list
  - `GET /api/admin/numbers` – all phone numbers (for table)
  - `GET /api/admin/assignable-phone-numbers` – app owner’s numbers (for assign dropdown)
  - `POST /api/admin/numbers` – assign number to account (body: `userId`, `number`); app owner only on server
  - `POST /api/admin/users/create` – create user
  - Token adjustment: likely `POST /api/admin/users/:id/tokens` or similar (set totals)
  - User delete: likely `DELETE /api/admin/users/:id` or similar

### Tech

- **Framework:** Vue 3 (createApp), single `#app` mount.
- **Styling:** Tailwind (e.g. `bg-white shadow rounded-lg`).
- **Server data:** `user` passed to template; `isAppOwner` is derived in data as EJS boolean for showing Assign block and loading assignable numbers.

### Notable details

- User table columns: Email & Name, Role & ID (userType badge), Status (verified/last login), SMS/Email/AI tokens, Actions (Set Tokens, Delete).
- Account holder dropdown for “Assign” uses `accountHolders` computed from `users` where `userType === 'account_holder'`.
- Create user form includes: email, password, username, first/last name, company, userType (account_holder | team_member | user), accountType (reg_client | eda | app_owner), subscriptionStatus, isVerified, token balances, accountId (when team_member).

---

## 2. Help Tickets (`views/admin/help-tickets.ejs`)

**Route:** `GET /admin/help-tickets`  
**Auth:** `auth`, `requirePermission('manage_users')`  
**Layout:** `layout`  
**Nav:** `include('../partials/nav')` (path differs because view is under `admin/`)

### Purpose
Admin view to list all help tickets, view details, reply once, and update status.

### Sections

| Section | Description |
|--------|-------------|
| **Header** | Title “Help Tickets”, subtitle, Refresh button |
| **Stats cards** | Counts: Open, In Progress, Closed, Total |
| **Tickets table** | Columns: Ticket #, User (name + email), Page, Status, Created, Actions (View, Update Status). Row click opens detail modal. |
| **Ticket detail modal** | User, Status, Page, Created; user message; Admin Reply (textarea if no reply, or read-only existing reply + repliedAt) |
| **Status update modal** | Select new status (Open / In Progress / Closed); confirm/cancel |

### Data & APIs

- **Load on mounted:** `loadTickets()` → `GET /api/admin/help-tickets` (returns `{ tickets }`).
- **APIs used:**
  - `GET /api/admin/help-tickets` – list all tickets
  - `POST /api/admin/help-tickets/:ticketNumber/reply` – body `{ adminReply }` (one reply per ticket)
  - `POST /api/admin/help-tickets/:ticketNumber/status` – body `{ status }` (Open | In Progress | Closed)

### Tech

- Vue 3, Tailwind. No auth header in fetch (relies on cookies/session).
- Toast: `showToast(message, type)` – creates a temporary DOM element (success/error/warning/info).

### Notable details

- Ticket fields used: `ticketNumber`, `userFullName`, `userEmail`, `page`, `status`, `createdAt`, `message`, `adminReply`, `repliedAt`.
- Backend stores tickets per user (e.g. under individual user data); admin API aggregates from all user dirs.

---

## 3. Admin Audit Logs (`views/admin-audit-logs.ejs`)

**Route:** `GET /admin/audit-logs`  
**Auth:** `adminAuth`  
**Layout:** `layout`  
**Nav:** `partials/nav`

### Purpose
View and filter system audit logs (team, account, and contact operations).

### Sections

| Section | Description |
|--------|-------------|
| **Header** | “Audit Logs”, Refresh Logs button |
| **Filters** | Search text, Action dropdown (All + specific actions), Clear Filters |
| **Table** | Timestamp, User (email + userType), Action (badge), Details (counts, account, team member, reason, etc.) |
| **Pagination** | Per-page (10/25/50/100), prev/next and page numbers |

### Data & APIs

- **Load on created:** `loadAuditLogs()` → `GET /api/admin/audit-logs` with `credentials: 'include'`.
- **Backend:** Reads from `data/audit-logs/` (e.g. `audit-YYYY-MM-DD.json`), returns array of log entries.

### Action types (filter + display)

- TEAM_MEMBER_ADDED, TEAM_MEMBER_REMOVED  
- ACCOUNT_CREATED, ACCOUNT_DELETED  
- DELETE_ALL_CONTACTS, BULK_DELETE_CONTACTS, PERMANENT_DELETE_CONTACTS  
- RESTORE_CONTACTS, BULK_IMPORT_CONTACTS  

Details may include: `deletedCount`, `restoredCount`, `importedCount`, `remainingCount`, `teamMemberEmail`, `accountName`, `reason`, and user identifiers.

### Tech

- Vue 3, Tailwind. Computed: `filteredLogs` (search + action), `paginatedLogs`, `totalPages`, `showPagination`. No Bearer token in fetch (session/cookies).

---

## 4. Invoices (`views/invoices.ejs`)

**Route:** `GET /invoices`  
**Auth:** `auth`, `requireActiveAccount`, `requireNdaAcceptance`; team members get 403.  
**Layout:** `layout`  
**Nav:** `partials/nav`

### Purpose
User-facing list of receipts/invoices for the current account, with PDF download and optional Pay Now (Stripe).

### Sections

| Section | Description |
|--------|-------------|
| **Receipt list** | For each receipt: type (e.g. Phone Number Setup Fee or token type), company/purchaser, date, items summary, amount CAD, status badge; “Download PDF” and “Pay Now” (if status is pending/requires_*) |
| **Payment modal** | Amount, Stripe Payment Element (card), security badges, Pay Now / Cancel. Uses Stripe.js and `STRIPE_PUBLIC_KEY` from `res.locals`. |

### Data & APIs

- **Load on created:** `loadReceipts()` and `loadUser()` in parallel.
  - `GET /api/invoices` (credentials: include) → receipts for current user’s account (shared-data).
  - `GET /api/user` (credentials: include) → current user (for PDF “Bill To”).
- **APIs used:**
  - `GET /api/invoices` – list receipts (account-scoped from shared-data)
  - `POST /api/invoices/pay` – body `{ receiptId }`; returns `clientSecret` for Stripe Payment Element
- **Stripe:** Confirm payment with `confirmPayment`; return_url points to `/invoices`.

### Receipt structure (used in view)

- `id`, `type` (e.g. `phone_number_setup`), `metadata` (e.g. `tokenType`, `tokenAmount`), `items[]` (description, quantity, unitPrice, total), `companyName`, `purchaserName`, `createdAt`, `amount`, `status` (e.g. succeeded, paid, pending, requires_payment_method, failed).

### Tech

- Vue 3, Tailwind. External scripts: jsPDF + jspdf-autotable for PDF; Stripe.js loaded in layout. PDF is generated client-side with company/purchaser and items table.

### Notable details

- Billing is partly off-platform (comment in server: “Stripe SDK disabled - billing handled off-platform”). Invoices/receipts still stored in shared-data and displayed here; Pay flow may depend on Stripe config.
- `STRIPE_PUBLIC_KEY` is set in `res.locals` globally; invoices template uses `<%= STRIPE_PUBLIC_KEY %>` for Stripe.

---

## Summary Table

| View | Route | Access | Main backend data |
|------|--------|--------|-------------------|
| management | `/management` | adminAuth (+ NDA, active account) | Users, accounts, phone numbers, notifications |
| help-tickets | `/admin/help-tickets` | auth + manage_users | Help tickets (per-user aggregation) |
| admin-audit-logs | `/admin/audit-logs` | adminAuth | Audit log files (date-based JSON) |
| invoices | `/invoices` | auth (no team_member) | shared-data invoices, Stripe pay |

---

## Planning Checklist

- **Access control:** Management and audit-logs use `adminAuth`; help-tickets uses permission `manage_users`. Invoices restrict team_member in route. Consider aligning with election/app-owner vs account-holder roles if you add more roles.
- **Nav:** Help-tickets uses `../partials/nav`; others use `partials/nav`. Unify if you move or rename views.
- **Auth in fetch:** Management uses `Authorization: Bearer ${localStorage.getItem('token')}`; help-tickets and audit-logs use `credentials: 'include'`. Invoices uses credentials. Consider standardizing (e.g. cookie-only or token-only) for consistency and security.
- **Election / app-owner:** Only management currently has app-owner–only UI (Assign phone number). Other views don’t differentiate app_owner vs account_holder with admin; you may want to hide or simplify some sections for non–app-owners.
- **Invoices / Stripe:** Stripe is currently disabled at server level; invoice list and PDF still work. Any “Pay Now” flow depends on re-enabling Stripe and configuring keys.
- **Audit log actions:** Filter list is fixed in the view; adding new action types requires updating the dropdown and any `formatAction` / `getActionClass` maps.
- **Help tickets:** Single admin reply per ticket; no thread. Consider multi-reply or email notification if you extend the feature.

Use this document as the baseline for planning changes to these four views and their routes/APIs.
