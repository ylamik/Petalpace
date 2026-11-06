# Petalpace accounts

## Try your account

1. Stop the previous development server (Ctrl+C), then run `npm run dev` once. Look for `Feedback and account API ready on port 3001`.
2. Open Create account. Enter your name, email, and a unique password of 15–128 characters, then confirm it.
3. Open the verification email and press **Verify email** on the page. The link lasts 30 minutes. You cannot sign in until your inbox is verified.
4. Sign in to open Today. Click your profile circle at the top right, then **Sign out**. On mobile the profile circle is beside Menu.
5. Sign in again with the same account. Accounts persist across logout and server restarts.
6. For a forgotten password, use **Forgot password?** and follow the emailed reset link. Resetting invalidates all previous sessions.

The existing Resend key and sender are used at runtime by your app. No new key is needed. The account implementation and automated tests do not need to read `.env.local`. Never share the real file or key.

## Email setup

For local testing the app defaults to `http://localhost:5173`. If you use another address, set `APP_URL` to that address and include its exact origin in `APP_ORIGINS`, then restart. `AUTH_FROM` is optional; when omitted the app uses `FEEDBACK_FROM`.

With `onboarding@resend.dev`, Resend only permits delivery to the email associated with your Resend account. Use that address to test signup. Other people need a verified sender domain. The app does not bypass verification if delivery fails.

## What is stored

Node 24's built-in SQLite stores accounts, password hashes, sessions, one-time token hashes, and throttling counters in `server/data/accounts.sqlite`. This folder is excluded from Git. Keep it private and back it up securely. Passwords, session tokens and verification links are never stored in plaintext. Users' names and emails are stored as account information.

Planner tasks, spaces, attachments, and completion history are now stored per account in the same private SQLite database. New accounts start with empty task lists and three starter spaces. Today, Upcoming, All tasks, and Spaces share the same saved data. Restart the API once after this update so the new tables and routes are available.

Task detail edits remain drafts until Save changes. Planner saves are serialized and revision-checked; conflicting tabs cannot silently overwrite each other. Save failures remain visible with retry/reload actions. Sign out waits for planner saving. Attachments are limited to 10 MB each, 10 per task, and 30 MB total per account (PDF, Word, PowerPoint). Files are stored as private data and downloaded as attachments, not rendered as HTML. This does not scan documents for malware.

The heatmap shows completion dates in the user's browser time zone. Marking Done records a completion; editing a completed task doesn't count again. Reopening removes that completion, while deleting a completed task keeps the historical record. Counts update after a successful save. Hover previews a day; clicking pins the popover until closed, another day is selected, or the user clicks outside.

## Security implemented

Profile circles use the first and last name initials (one or two letters). Users can change/remove their photo and sign out from the circle menu. Photos accept static JPG/PNG/WebP up to 2 MB and 4096 × 4096 pixels. The server validates signatures, fully decodes and re-encodes to a 512 × 512 WebP with metadata stripped, and stores it in the private database. Photo reads and writes require a session and always use that session's user ID, not a client-provided account ID. `npm run test:profile` checks malformed uploads and cross-account access.

- All account queries bind parameters rather than inserting user strings into SQL.
- Passwords use salted scrypt (N=131072, r=8, p=1); comparison is timing-safe. Concurrent hashing is bounded by CPU and memory, and extra requests queue briefly. Set `HASH_CONCURRENCY` (1–16) to override.
- Sessions use random 256-bit tokens in HttpOnly, SameSite=Lax cookies, with a seven-day expiry. The database stores only token hashes. Logout deletes the session; password reset deletes all sessions for that user.
- Email verification and reset links use random 256-bit tokens, expire in 30 minutes, and are consumed once. Tokens are in the URL fragment, not a query string. Opening a link alone does not consume it.
- Login uses a generic incorrect-email-or-password message. Requests have body limits, IP/account throttling, trusted-origin checks and JSON-only POSTs. Session endpoints disable caching.
- Planner routes wait for a server-verified session. Session status is rechecked on tab return and every minute. The planner endpoint authorizes every read/write using the session user, validates payloads, and uses bound SQL parameters.

## Before public deployment

Use HTTPS and `NODE_ENV=production` (enables Secure, __Host- session cookies). Set `APP_URL=https://your-real-domain` and exact `APP_ORIGINS` without trailing slashes. Add a verified Resend sender using `AUTH_FROM` or `FEEDBACK_FROM`. Run the API on a Node host with persistent private disk; a static host alone cannot run it. Route `/api` through the same origin as the frontend.

The API binds to loopback behind a same-machine reverse proxy. Do not blindly trust forwarded IP headers. Configure trusted-proxy rate limiting for a public deployment; otherwise users behind a proxy share the socket-IP rate limit. Multiple app instances require shared storage/limiting. Add operational monitoring and backup/recovery before launch. This implementation is not a guarantee against every attack.

## Checks

`npm run test:auth` uses temporary databases and fake email delivery. It never sends real mail or loads `.env.local`. `npm run test:feedback` tests the existing feedback endpoint separately.

`node --test server/planner.test.mjs` checks planner persistence, account isolation, revisions, input validation, attachments, and activity. `node --test server/task-presentation.test.mjs` checks UI status and date logic. Both avoid real account databases and secrets.
