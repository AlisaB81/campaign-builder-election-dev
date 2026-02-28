# Commit: Fix infinite loading spinner – use isPostgresReady() for all request-time PG selection

## Summary
Replace every request-time branch that selected Postgres using env-only (`isPostgresEnabled()` or `getBackend() === 'pg'`) with `isPostgresReady()`. Startup still uses `isPostgresEnabled()` to start the async PG initialization; all request-time reads/writes use `isPostgresReady()` so `/api/user` and other routes do not hang while Postgres is initializing.

---

## Files changed

### 1. `server.js`
- **Imports:** Already had `isPostgresReady`, `setPgReady` from `./db`; kept `isPostgresEnabled` for startup only.
- **Conditions replaced (request-time → `isPostgresReady()`):**
  - `getAccountContacts(accountId)` – `if (isPostgresReady())` (already was; added IMPORTANT comment).
  - `getAccountCampaigns(accountId)` – `if (isPostgresReady())` (already was; added IMPORTANT comment).
  - `updateAccountContacts(accountId, contacts)` – `if (isPostgresReady())` (already was; added IMPORTANT comment).
  - PATCH `/api/election/account/:accountId/election-mode` – `if (isPostgresEnabled())` → `if (isPostgresReady())`.
  - GET `/api/election/status` – `if (isPostgresEnabled())` → `if (isPostgresReady())`.
  - POST `/api/election/interactions` (record interaction) – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/interactions` (list) – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/interactions/statistics` – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/interactions/:contactId` – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/contacts/:contactId/support-score` – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/contacts/:contactId/last-contact` – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/contacts/by-support-score` – `if (!isPostgresEnabled())` → `if (!isPostgresReady())`.
  - GET `/api/election/contact/:contactId` – `if (isPostgresEnabled && isPostgresEnabled())` → `if (isPostgresReady())`.
  - POST `/api/election/lists/contacts` – removed `require('./db/connection')` for `isPostgresEnabled`; use `if (isPostgresReady())` (already from top-level require).
- **dbHelpers for election middleware:** `dbHelpers: { isPostgresEnabled, ... }` → `dbHelpers: { isPostgresReady, getAdapter: ... }`.
- **Startup (unchanged):** `if (isPostgresEnabled()) { initializePool(); runMigrations(); setPgReady(true); }` in the `app.listen` callback – still uses `isPostgresEnabled()`.
- **Comment added** at each changed request-time branch: `// IMPORTANT: use Postgres only when ready; otherwise fallback to JSON to avoid hanging /api/user`

### 2. `middleware/election.js`
- **Options:** `const { isPostgresEnabled, getAdapter } = options.dbHelpers` → `const { isPostgresReady, getAdapter } = options.dbHelpers`.
- **Condition:** `if (isPostgresEnabled && isPostgresEnabled())` → `if (isPostgresReady && isPostgresReady())` (request-time check for reading account election mode from PG).
- **Comment added:** `// IMPORTANT: use Postgres only when ready; otherwise fallback to JSON to avoid hanging /api/user`

### 3. `services/election-lists.js`
- **Import:** `const { query, isPostgresEnabled } = require('../db/connection')` → `const { query, isPostgresReady } = require('../db')` (so `isPostgresReady` is available; connection does not export it).
- **Conditions replaced:** All 7 occurrences of `if (isPostgresEnabled && isPostgresEnabled())` → `if (isPostgresReady())`.
- **Comment added:** At first use (in `saveList`): `// IMPORTANT: use Postgres only when ready; otherwise fallback to JSON to avoid hanging /api/user`

---

## Exact conditions replaced

| Location | Before | After |
|----------|--------|--------|
| server: getAccountContacts | (already isPostgresReady) | + IMPORTANT comment |
| server: getAccountCampaigns | (already isPostgresReady) | + IMPORTANT comment |
| server: updateAccountContacts | (already isPostgresReady) | + IMPORTANT comment |
| server: PATCH election-mode | `if (isPostgresEnabled())` | `if (isPostgresReady())` |
| server: GET election/status | `if (isPostgresEnabled())` / else JSON | `if (isPostgresReady())` / then `if (!electionMode)` JSON |
| server: POST interactions | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET interactions (list) | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET interactions/statistics | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET interactions/:contactId | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET support-score | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET last-contact | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET by-support-score | `if (!isPostgresEnabled())` | `if (!isPostgresReady())` |
| server: GET election/contact/:id | `if (isPostgresEnabled && isPostgresEnabled())` | `if (isPostgresReady())` |
| server: POST lists/contacts | `require('./db/connection'); if (isPostgresEnabled...)` | `if (isPostgresReady())` |
| server: dbHelpers | `isPostgresEnabled` | `isPostgresReady` |
| middleware/election.js | `isPostgresEnabled && isPostgresEnabled()` | `isPostgresReady && isPostgresReady()` |
| services/election-lists.js | `isPostgresEnabled` from connection, `isPostgresEnabled && isPostgresEnabled()` ×7 | `isPostgresReady` from `../db`, `isPostgresReady()` ×7 |

---

## Confirmation

- **Startup** still uses **`isPostgresEnabled()`** in one place only: inside the `app.listen` callback, to decide whether to run `initializePool()`, `runMigrations()`, and `setPgReady(true)`.
- **All request-time** backend selection (PG vs JSON) for data reads/writes now uses **`isPostgresReady()`**, so no route hits Postgres before the pool and migrations are ready, avoiding the infinite loading spinner on `/api/user` and other endpoints.
