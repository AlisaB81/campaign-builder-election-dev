# Why localhost:3081 Gets Stuck on Loading (No Errors)

## Request flow when you open localhost:3081

1. **GET /** – Served quickly (no DB). Returns HTML with layout.
2. **Layout script** runs and calls **GET /api/user** (with cookies) to show token balance and user info.
3. **GET /api/user** runs:
   - `auth` middleware → `findUserById` (file)
   - Handler: `findUserById`, `getEffectiveAccountId`, `isSpecialContactStructure` (file), then:
   - **`getAccountContacts(accountId)`** ← can hit Postgres
   - **`getAccountCampaigns(accountId)`** ← can hit Postgres
   - `getAccountTemplates`, `getAccountImages`, `getAccountTokens`, etc. (JSON files)

If **GET /api/user** never completes, the page stays “loading” (spinner, incomplete UI). No error is shown because the request is still pending.

## Root cause

- **`isPostgresReady()`** was changed to depend only on env:  
  `process.env.DATA_BACKEND === 'pg' && !!process.env.DATABASE_URL`
- So as soon as the process starts, **before** the listen callback runs and **before** `initializePool()` / `runMigrations()` / `setPgReady(true)` run, **`isPostgresReady()` is already true**.
- The first request (e.g. from the layout) can therefore hit **GET /api/user** → **getAccountContacts** → **contactRepo.getContacts()** → **pool.query()**.
- The pool may still be connecting (first connection) or migrations may still be running. **pg** can wait up to `connectionTimeoutMillis` (e.g. 10s) for a connection, so the request hangs with no error until that timeout or until our 8s fallback.

So the app is “stuck” because a request is waiting on Postgres before the pool is actually ready.

## Fix

Use Postgres only when **both** env is set **and** the pool is ready:

- **`isPostgresReady()`** = `(DATA_BACKEND === 'pg' && DATABASE_URL set) && pgReady`
- **`pgReady`** is set to `true` only after `runMigrations()` completes in the listen callback.

Then the first requests use JSON until Postgres is ready, and the page stops hanging.

Existing 8s timeout on contacts/campaigns remains as a safety net if a query ever hangs later.
