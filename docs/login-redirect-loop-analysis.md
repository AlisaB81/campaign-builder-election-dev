# Login Redirect Loop – Root Cause Analysis (Revised)

**Status:** Loop persisted after server-side fixes. This revision adds **client-side** causes and fixes.

---

## 1) Middleware and redirect map (current state)

| Middleware / Handler | Redirect to login | Param | When |
|----------------------|-------------------|-------|------|
| **auth** (2617) | Yes | `?loop=1` | No token or invalid JWT / user not found (HTML) |
| **adminAuth** (2711) | Yes | `?loop=1` | No token, user not found, not admin, or catch (HTML) |
| **requireNdaAcceptance** (1361) | Yes | `?loop=1` | User not found or catch (HTML) |
| **requireActiveAccount** (account.js) | Yes | `?loop=1` | No user, user not found, or catch (page) |
| **requireAccountAccess** (1643) | No redirect | – | Uses `req.user.id`; returns 401/403/500 JSON |
| **secureErrorHandler** (738) | Yes | `?loop=1` | HTML + (401/403/500 or no status) |
| **GET /login** (16895) | To dashboard/NDA | – | Only when **token present and `req.query.loop !== '1'`** |

All **server-side** redirects to the login page now use **`/login?loop=1`**. So the server alone should not create a loop.

---

## 2) Why the loop can still happen: client-side redirects

**Loop mechanism:**

1. User is on a **protected page** (e.g. dashboard, contact-manager, templates) with a **valid cookie**.
2. A **client-side** request (e.g. `fetch('/api/...')`) returns **401** (e.g. token expired, or cookie not sent on that request).
3. The **view** does `window.location.href = '/login'` (no `?loop=1`).
4. Browser loads **GET /login** and sends the **cookie**. Server sees valid token and **redirects to /dashboard** (because `loop !== '1'`).
5. Dashboard (or layout) loads and may call the same or another API; that call again returns 401 → client redirects to **/login** again → **loop**.

So the **first root cause** that can remain after server fixes is: **client-side redirect to `/login` without `?loop=1` on 401**. Any such redirect can participate in the loop when the browser still has a valid cookie.

---

## 3) Client-side redirect inventory

| File | Line(s) | Context | Fix |
|------|--------|---------|-----|
| **layout.ejs** | 339 | `logout()` – intentional | Keep `/login` (cookie cleared by API) |
| **contact-manager.ejs** | 2617, 2696, 2731, 2775, 2976, 3202, 3489 | `response.status === 401` | Use `/login?loop=1` |
| **management.ejs** | 1169 | 401 / auth failure | Use `/login?loop=1` |
| **messages.ejs** | 1111, 1552, 1583 | 401 / auth failure | Use `/login?loop=1` |
| **templates.ejs** | 3295 | 401 / auth failure | Use `/login?loop=1` |
| **my-numbers.ejs** | 1238 | 401 / auth failure | Use `/login?loop=1` |
| **my-tokens.ejs** | 604 | 401 / auth failure | Use `/login?loop=1` |
| **user-management.ejs** | 1617 | 401 / auth failure | Use `/login?loop=1` |
| **nda-agreement.ejs** | 288 | NDA declined (message) | Optional: `?loop=1&message=...` |
| **user-management.ejs** | 1428 | Account deleted (message) | Optional: `?loop=1&message=...` |

**Layout.ejs** `updateTokenBalances`: already does **not** redirect on 401 (comment at 319–322). Good.

---

## 4) POST login and GET /login

- **POST /api/login**: Sets cookie, returns `{ redirectTo: '/dashboard' | '/nda' }`. No auth middleware.
- **Client**: `window.location = data.redirectTo` (auth.ejs) → full page load to /dashboard or /nda.
- **GET /login** (16895–16930): Reads `req.query.loop === '1'` as `fromRedirect`. If **token present and !fromRedirect**, redirects to dashboard/NDA; otherwise renders login (and shows “Please sign in again.” when `fromRedirect`).

So the only way a **server** redirect creates a loop is by sending the user to **/login** without `?loop=1`. That is already fixed. The remaining loop is **client-driven**: redirect to **/login** (no param) on 401 → GET /login with cookie → server redirects back → page loads → 401 again → repeat.

---

## 5) Route order and cookies

- **GET /login**, **POST /api/login**, **GET /nda** are **not** behind `auth` or `adminAuth`.
- No global `app.use(auth)` on all routes.
- **secureErrorHandler** is mounted last (26056).

If the loop persisted **immediately after login** (first load of dashboard), then either:

- **Cookie not sent on first GET /dashboard**: e.g. domain/path/SameSite. Then auth would redirect to **/login?loop=1** and the user would see the login page once (no loop). So a **loop** implies the cookie **is** reaching GET /login.
- **Client 401 loop**: Dashboard (or its layout) loads; a script runs and calls an API that returns 401; the view redirects to **/login**; GET /login with cookie redirects back → loop.

So the most likely remaining cause is **client-side 401 → `/login`** in the views above.

---

## 6) Root cause (revised)

**Primary:** **Client-side redirect to `/login` (no `?loop=1`) on 401** in:

- contact-manager.ejs (7 places)
- management.ejs, messages.ejs (4), templates.ejs, my-numbers.ejs, my-tokens.ejs, user-management.ejs (1)

When the user still has a valid cookie, **GET /login** redirects to dashboard; the page (or layout) runs again; an API returns 401 → client sends user to **/login** again → loop.

**Secondary (already addressed):** All server-side redirects to login use **/login?loop=1**. No remaining server-only loop.

---

## 7) Minimal fix (additional)

- In every view that does **`window.location.href = '/login'`** (or equivalent) **on 401 or auth failure**, use **`/login?loop=1`** instead.
- Leave **logout()** in layout.ejs as **`/login`** (cookie is cleared; no loop).
- Optional: For “session expired” or “please sign in again” flows, use **`/login?loop=1`** (and optionally append `&message=...`).

This breaks the loop because GET /login will no longer redirect back when the user was sent from the app due to auth failure.

---

## 8) Verification

1. **After applying client-side fixes**
   - Log in, go to e.g. contact-manager. In DevTools, block or modify the next `/api/` request to return 401. Trigger that request. Expected: redirect to **/login?loop=1** and **no** redirect back to dashboard (login page stays).
2. **Normal flow**
   - Log in → dashboard or /nda. No loop. Navigate to contact-manager, templates, etc. No loop.
3. **Logout**
   - Click logout → should land on **/login** (no loop; cookie cleared).

---

## 9) Quick test to confirm client-side cause

- Reproduce the loop (login, then navigate until it happens).
- In the Network tab, note whether the **last request before the redirect to /login** is:
  - A **full page load** (e.g. GET /dashboard) → then server sent 302 to /login?loop=1 → then GET /login?loop=1. If the URL is **/login** without `?loop=1`, the redirect came from **client** (e.g. 401 handler).
  - An **XHR/fetch** (e.g. GET /api/user or /api/contacts) returning **401**, followed by a **full page navigation to /login**. That confirms the loop is **client-side** (401 → location = '/login').

If the loop only occurs after an XHR 401 and the address bar shows **/login** (no query), the fix is to change those client redirects to **/login?loop=1**.

---

## 10) Implementation: Shared helper and proof instrumentation (current)

### Shared helper (layout.ejs, &lt;head&gt;)

- **redirectToLogin(reason, extraParams)**  
  - If already on `/login` or `sessionStorage.__redirecting_to_login === '1'`, returns (no-op).  
  - Otherwise sets `__redirecting_to_login`, builds URL `/login?loop=1&reason=...&from=...&api=...&message=...`, logs to console, writes `sessionStorage.lastAuthRedirect`, then **location.replace(url)**.

- **redirectToLoginOn401(response, context)**  
  - If `response && response.status === 401`, calls **redirectToLogin('401', context)** and returns true; else returns false.

### Proof instrumentation

- **On redirect (in helper):**  
  - `console.warn('[AUTH] Redirecting to /login?loop=1', { reason, from, api, ts })`  
  - `sessionStorage.lastAuthRedirect = JSON.stringify({ reason, from, api, ts })`

- **On login page load (auth.ejs, end of body):**  
  - Clears `sessionStorage.__redirecting_to_login`.  
  - If `sessionStorage.lastAuthRedirect` exists: `console.warn('[AUTH] Login page loaded after client-side redirect', payload)`.

### Updated redirect locations (before → after)

| File | Line (approx) | Before | After |
|------|----------------|--------|--------|
| layout.ejs | head | – | Added helper script (redirectToLogin, redirectToLoginOn401). |
| layout.ejs | 339 | `window.location.href = '/login'` | **Unchanged** (logout only; cookie cleared by API). |
| contact-manager.ejs | 7 places | `response.status === 401` → `window.location.href = '/login?loop=1'` | `redirectToLoginOn401(response, { from: 'contact-manager', api: '…' })` |
| management.ejs | 1169 | `window.location.href = '/login?loop=1'` | `redirectToLogin('no_token', { from: 'management' })` + fallback |
| messages.ejs | 1111, 1552, 1583 | same | `redirectToLogin('logout'/'no_token'/'error', { from: 'messages' })` + fallback |
| templates.ejs | 3295 | same | `redirectToLogin('no_token', { from: 'templates' })` + fallback |
| my-numbers.ejs | 1238 | same | `redirectToLogin('no_token', { from: 'my-numbers' })` + fallback |
| my-tokens.ejs | 604 | same | `redirectToLogin('no_token', { from: 'my-tokens' })` + fallback |
| user-management.ejs | 1428, 1617 | same / account deleted | `redirectToLogin('account_deleted'/'no_token', { … })` + fallback |
| nda-agreement.ejs | 288 | `window.location.href = '/login?message=nda_declined'` | `redirectToLogin('nda_declined', { from: 'nda-agreement', message: 'nda_declined' })` + fallback |
| public/js/utils/shared.js | 82 | `window.location.href = '/login'` | `redirectToLogin('no_token', { from: 'shared', api: 'requireAuth' })` or replace to `/login?loop=1&...` |
| auth.ejs | end of body | – | Script clears throttle and logs `lastAuthRedirect` when present. |

### Verification checklist (code comment + manual)

1. Login successfully.  
2. Simulate 401 (e.g. force one API to return 401). Confirm browser lands on `/login?loop=1` and **stays** (no bounce to dashboard).  
3. Confirm normal navigation does not redirect unexpectedly.  
4. Confirm **logout** still goes to **/login** (no loop param) and cookie is removed.  
5. In console: after a client-side auth redirect, see `[AUTH] Redirecting to /login?loop=1` and on login page `[AUTH] Login page loaded after client-side redirect` with same payload.

---

## 11) Login loop instrumentation (src/code)

Every redirect to login now includes **src** and **code** so the first redirect source can be identified.

### Server (server.js + middleware/account.js + lib/errors.js)

- **redirectToLogin(res, req, src, code, extra)** builds `/login?loop=1&src=...&code=...&from=...`, sets **X-Auth-Redirect-By: src:code**, logs `[LOGIN_REDIRECT] src=... code=... from=...`.
- **auth**: NO_TOKEN, INVALID_TOKEN  
- **adminAuth**: NO_TOKEN, USER_NOT_FOUND, NOT_ADMIN, CATCH  
- **requireNdaAcceptance**: USER_NOT_FOUND, CATCH  
- **requireActiveAccount**: NO_USER, USER_NOT_FOUND, CATCH  
- **secureErrorHandler**: HTML_ERR (status in query)  
- **nda**: USER_NOT_FOUND, CATCH  
- **dashboard**: NO_USER, RENDER_ERR, CATCH  
- **Page routes**: route name + CATCH (e.g. my-tokens, contact-manager, templates, invoices, requests, messages, management, my-numbers, ai-calling)  
- **lib/errors.js**: errors:401  
- **GET /login** when redirecting to dashboard/NDA: **X-Auth-Redirect-By: login:AUTO_REDIRECT**

### Client (layout.ejs)

- **__cbRedirectToLogin(reason, meta)** sets `__cb_redirecting`, builds URL with **src=client**, **code=reason**, **from=pathname**, writes **__cb_last_redirect** to sessionStorage, logs `[CLIENT_LOGIN_REDIRECT]`, then **location.replace**.
- **__cbHandle401(resp, meta)** calls __cbRedirectToLogin('HTTP_401', meta) when resp.status === 401.
- **redirectToLogin** / **redirectToLoginOn401** delegate to __cb*.
- On non-login pages, **__cb_redirecting** is cleared so the next redirect can run.

### Login page (auth.ejs)

- When **loop=1**, server passes **redirectSrc**, **redirectCode**, **redirectFrom** from query.
- A blue debug banner shows **src**, **code**, **from** when **redirectSrc** is set.
- On load, **__cb_redirecting** is cleared and **__cb_last_redirect** is logged if present.

### How to find the root cause

1. Reproduce the loop and note the **final** URL (e.g. `/login?loop=1&src=auth&code=NO_TOKEN&from=/dashboard`).
2. **src=auth, code=NO_TOKEN** → cookie not sent on protected request; fix cookie domain/secure/sameSite or confirm cookie is set after login.
3. **src=adminAuth, code=NOT_ADMIN** → non-admin hit an admin route; redirect to dashboard or 403 instead of login.
4. **src=secureErrorHandler, code=HTML_ERR** → an error was thrown on a page; fix the underlying error or stop redirecting 500 to login.
5. **src=client, code=HTTP_401** → a fetch returned 401 and the client redirected; fix the API or stop redirecting for that call.
6. Check **X-Auth-Redirect-By** on the 302 response in Network to see which server component sent the redirect.
