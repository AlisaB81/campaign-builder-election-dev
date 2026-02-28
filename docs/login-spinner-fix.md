# Login / Blank UI / Spinner – Root Cause and Fix

## What was going wrong

1. **Unauthenticated user visits `localhost:3081/`**  
   The server served the full index page with layout (no auth on `GET /`). The layout script runs on `DOMContentLoaded` and calls `updateTokenBalances()` → `fetch('/api/user')`. If the response was slow, failed, or the browser resolved `/api/user` against a wrong `<base>` (e.g. production), the request could hang or fail. The UI never got a clear “redirect to login” and stayed in a loading state → **blank UI + spinner**.

2. **`/api/user` with relative URL and `<base>`**  
   With `<base href="https://campaignbuilder.ca">` in some views, `fetch('/api/user')` can resolve to production. On dev (port 3081) that causes wrong-origin or CORS, so the request never completes and the app never redirects to `/login`.

3. **No timeout and no redirect on network error**  
   If the fetch threw (network error, timeout, CORS), the code did nothing, so the user stayed on the same page with no redirect and no way out of the spinner.

4. **Heavy response for `/`**  
   Sending the full index + layout to unauthenticated users was unnecessary and increased the chance of slow first paint and confusing loading behaviour.

## Fixes applied

### 1. Server: redirect `GET /` to `/login` when no auth (server.js)

- **After `cookieParser()`**, added middleware: if `GET /` and no `req.cookies.token`, respond with `302` to `/login`.
- Unauthenticated users no longer receive the index or layout; they are sent straight to `/login` and never run the layout boot script that calls `/api/user`.

### 2. Server: `GET /login` served first (unchanged)

- The **first** middleware (before `express.json()`) still handles `GET /login` and sends the minimal login HTML immediately, so the login page is fast and never blocked by the rest of the stack.

### 3. Layout: robust boot fetch (views/layout.ejs)

- **Same-origin URL:** `apiUserUrl = window.location.origin + '/api/user'` so the request always goes to the current host (e.g. `http://localhost:3081`), regardless of `<base>`.
- **8s timeout:** `AbortController` + `setTimeout(..., 8000)` so the request cannot hang forever; on abort, redirect to `/login`.
- **401:** On `response.status === 401`, immediately `window.location.replace('/login')`.
- **Network/error:** In the `catch` block (including timeout/abort), `window.location.replace('/login')` so any failure leads to login instead of a stuck spinner.
- **Logging:** `console.log('[BOOT] api/user status', response.status)` and logs on failure so you can confirm behaviour in the console.

## Resulting flow (dev on 3081)

- **`GET http://localhost:3081/` (no cookie)** → 302 to `/login` → browser requests `GET /login` → first middleware returns minimal login HTML → user sees the form; no layout, no `/api/user` call, no spinner.
- **`GET http://localhost:3081/login`** → first middleware returns minimal login HTML immediately.
- **Any layout page with auth** (e.g. after login) → `updateTokenBalances()` uses same-origin `/api/user`, 8s timeout, 401 or error → redirect to `/login` so the spinner cannot persist.

## How to verify

1. **Restart the app** so this code is running (e.g. `pm2 restart server-election` or `node server.js`). Ensure the process listening on 3081 is this app (check `PORT` / ecosystem config).
2. **Hard refresh or use an incognito window** so the browser isn’t serving a cached blank page (no cookie).
3. Open `http://localhost:3081/` (or `http://localhost:3081/login`).
4. You should see the minimal login form with the text **“(fast path – no layout)”** under “Sign in to your account”. No spinner.
5. **View Page Source** (Ctrl+U / Cmd+U): you should see the comment `<!-- DEV_LOGIN_FAST_PATH: this page was served by the early boot middleware -->`. If you don’t, the response is coming from somewhere else (e.g. cached page, wrong port, or the later `res.render('auth', ...)` path).
6. **Server logs** (where you ran node/pm2): on localhost you should see `[BOOT] GET /login -> minimal HTML (fast path)` or `[BOOT] GET / (no cookie) -> 302 /login`. If these never appear, requests aren’t hitting this middleware (wrong server, port, or proxy).
7. In the browser console you should see `[BOOT] api/user status 401` only when you’re on a layout page and the session is missing or expired, followed by redirect to `/login`.
