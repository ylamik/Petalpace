# Petalpace deployment guide

## Supported deployment

Run one Node.js 24 service with a persistent disk and an HTTPS reverse proxy. The service serves the Vite build and `/api` from the same origin. This release uses SQLite; it is not configured for multiple application replicas or ephemeral/serverless filesystems.

The source is ready for release checks, but no public deployment, production inbox test, persistent-volume setup, external backup schedule, or monitoring account is created by this guide.

## Install and verify

```sh
npm ci
npm test
npm run build
```

Use Node 24.12 or newer within Node 24. `node:sqlite` may print an experimental-feature warning in this version. A build is required before production startup. Never publish `.env.local`, `server/data`, database exports, or backups. The repository's ignore rules exclude local environment files and the default database directory.

## Configure the service

Use your hosting provider's secret/environment settings. `.env.example` lists the supported variables; keep real secrets out of frontend `VITE_*` variables.

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | Exact HTTPS origin, for example `https://planner.example.com` |
| `APP_ORIGINS` | Comma-separated exact HTTPS origins; must include `APP_URL` |
| `DATA_DIR` | Absolute path on the persistent volume, e.g. `/var/lib/petalpace` |
| `RESEND_API_KEY` | Server-only email credential |
| `FEEDBACK_FROM` | Sender approved by the email provider |
| `FEEDBACK_TO` | Feedback recipient |
| `AUTH_FROM` | Optional account-email sender; otherwise uses `FEEDBACK_FROM` |
| `PORT` | Hosting provider's service port; overrides `FEEDBACK_PORT` |
| `TRUSTED_PROXY` | Exact IP addresses of trusted proxies, if used; no wildcard |
| `HOST` | Optional bind address; production defaults to `0.0.0.0` |

Start with `npm start`. Production startup rejects missing essential settings, non-HTTPS origins, relative storage paths, wildcard proxies, and a missing frontend build. Validate your mount through the host dashboard: a configured path alone does not make a disk persistent.

The proxy must terminate HTTPS and route all paths to this service. If it forwards client addresses, configure its actual socket IP in `TRUSTED_PROXY`; Petalpace walks the forwarded chain from the nearest proxy toward the client. Do not expose the origin directly if that would bypass the host's security controls.

Set the proxy request-body limit above Petalpace's 44 MiB request cap (for example 50 MiB), and give saves enough time to finish. Allow at least 40 seconds of graceful termination before the host kills the process. The app stops accepting new requests and gives active requests up to 35 seconds to finish.

## Backups and recovery

The database is `DATA_DIR/accounts.sqlite`. Do not copy a live SQLite file by itself: recent committed data may still be in its WAL. The provided backup command uses SQLite's online backup API and verifies integrity and foreign keys.

```sh
npm run db:backup -- /var/lib/petalpace/accounts.sqlite /backups/petalpace-2026-11-03.sqlite
```

Use a unique timestamped destination each time. Commands refuse to overwrite existing files. On Windows, quote paths containing spaces.

Before launch:

1. Configure a daily host-scheduled backup command with unique destination names.
2. Store an encrypted copy outside the application disk; limit access to the operator.
3. Set a documented retention policy. Recommended initial policy: 30 daily backups, then expire them. Scheduling and retention must be configured in the host; the application does not silently delete operator backups.
4. Alert on failed backups and failed `/api/health` checks.
5. Practice recovery into an isolated environment with outbound email disabled.

Restore to a NEW database path:

```sh
npm run db:restore -- /backups/petalpace-2026-11-03.sqlite /recovery/petalpace/accounts.sqlite
```

The restore command validates the copy and never overwrites the live database. Stop the application before switching `DATA_DIR` to the recovery directory, then restart and verify representative account/task/file records. Do not place backups under `public` or `dist`. A restored backup may contain old sessions and records deleted after the backup; invalidate recovered sessions and honor deletion requests before reopening it publicly.

Automated tests verify that the backup/restore tool preserves committed WAL data. They do not prove your hosting provider's backup schedule or disk works.

## Release smoke test

```sh
npm run deploy:check -- https://planner.example.com
```

This read-only check covers the homepage, direct frontend routes, health endpoint, unauthenticated API rejection, invalid URLs and missing assets. It does not create users or send email.

Manually test with your own test account:

- Sign up, receive and use verification email; verify wrong passwords fail.
- Sign in, create a task with a genuine PDF/Word/PowerPoint attachment, move it, edit its deadline and complete it.
- Delete, restore, and permanently delete a disposable task. Check another account cannot access it.
- Open Calendar directly, refresh, and test mobile navigation/light/dark themes.
- Export data and verify its contents. Delete only a disposable test account using the password-confirmation dialog.
- Request password reset; verify the new password works and old sessions stop working.
- Send feedback with and without a reply email; verify the real inbox receives it.
- Test two tabs editing, a temporarily interrupted connection, and a page left open across midnight.

## Current behavior and boundaries

- Deadlines are **floating local times**: 9 AM means 9 AM on the device currently viewing the task. They are not fixed UTC appointments and may represent a different instant when travelling. The time field states this policy. Completion activity uses the submitting device's timezone.
- Today, task lists, deadline labels, Calendar and Bin use a shared clock with focus/visibility refresh. Browser suspension can still delay in-page updates until the tab resumes.
- Red deadline text means three calendar days or less remaining, including overdue. Missed tasks are not deleted automatically.
- In-page reminder dialogs work while the website is open; their snooze is browser-local. Profile → Email reminders opts into server-side email reminders within 72 hours, within 24 hours, and once after a missed deadline (up to seven days late). Done, in-progress and blocked tasks are skipped. No browser push or SMS. The server must stay running; reminders are scanned every minute and are not an exact-time alarm.
- Tasks save through the API. Existing attachments are sent as account-scoped references; only new files are uploaded. Task metadata is still saved as a revision-controlled snapshot. Concurrent stale saves are rejected, not silently merged.
- Personal and shared tasks use authenticated Server-Sent Events (SSE) for live updates, with reconnect and a 30-second fallback check. Personal metadata revisions are checked before downloading unchanged attachments. Incoming changes wait during open task dialogs or unsaved local work. Conflicting writes are rejected visibly; drafts are not silently merged. Offline drafting is not provided: keep the page open and retry failed saves.
- Current-task attachments are limited to 30 MiB; current plus Bin attachments are limited to 50 MiB of decoded file content. The Bin holds up to 2,000 recoverable tasks. Cleanup that reduces a legacy over-limit account is permitted.
- Deleted tasks are recoverable for 30 days. Cleanup runs hourly while the server runs and also on planner requests. Expired tasks cannot be restored even before cleanup executes.
- Permanently deleted contents are removed from the live planner/Bin. ID tombstones and completion history remain until account deletion. SQLite disk pages and retained backups are not a secure-erasure guarantee.
- Account deletion removes that user's live records through foreign-key cascades; retained offline backups expire under the operator's policy. Account export is a private ZIP with a personal-task CSV and attachments, not an import/restore UI. Shared tasks and Bin contents are not included in that ZIP.
- Document checks reject unsupported extensions and invalid signatures. DOCX/PPTX additionally require Office package structure and reject detected macro packages. This is **not antivirus scanning** or a guarantee that a document is harmless; legacy DOC/PPT and PDF checks remain limited. Do not market uploads as malware-free. Add a scanning service if required by your hosting/use policy.
- Email success means provider acceptance, not guaranteed inbox delivery; no delivery webhook is configured. Reminder receipts survive restarts. Failed reminder sends retry every 15 minutes for at most 23 hours using a stable Resend idempotency key and frozen message body. Verification and invitation email are not background-retried; the user can request them again. See [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Before calling the deployment complete

Record the production URL, host, persistent mount, latest successful backup, restore-test date, smoke-test result, verified email sender, and manual test outcomes. These environment-specific checks cannot be inferred from passing local tests.

## Collaboration and email reminder release checks

- Use one persistent Node server instance. SSE subscriptions and the reminder worker are in-process; multi-instance hosting needs a shared broker/job lock first. Do not host this API as a sleeping/static-only service.
- Proxy `/api/auth/stream` without buffering; allow long-lived requests and the 15-second keepalive. Do not cache authenticated API responses.
- The existing `RESEND_API_KEY` and `AUTH_FROM` (fallback `FEEDBACK_FROM`) deliver reminders and invitations. Use a verified sending domain for recipients other than the provider test-account owner. This implementation does not send until a user enables reminders.
- Shared tasks are separate from the personal planner. An owner can invite by email with Edit all content, Assigned status only, or View only access. Only the verified invited account can accept the single-use, seven-day link. A copied task link grants no access on its own.
- Editors can edit task details, create/assign steps and manage files/links. Assigned-step members only toggle completion of their own steps. Viewers only read/download. Only owners invite, change permissions, remove members or delete the shared task. Owner deletion is permanent after confirmation, outside the personal Bin.
- Up to 100 owned shared tasks, 50 members per task, 100 steps, 10 files/task, 10 MiB/file and 30 MiB shared attachment storage per owner. Group resources appear near task details; each delegated task has its own notes, links and attachments. All task members can read these resources (no private delegated-task files). Deleting a delegated task also deletes its resources after confirmation. Shared uploads additionally support decoded PNG/JPEG/WebP images, limited to 25 megapixels; animated images are rejected.
- Duplicate personal tasks are blocked when normalized title, space, priority, due date, time and timezone match. Status, notes or attachments alone do not make a new task distinct. Legacy duplicates are retained until edited rather than silently deleted.
- Test with two disposable accounts: invite, verify identity matching, each permission, step assignments, revoked access, upload/download/remove, stale concurrent saves, both devices updating, offline reconnect and mobile layouts. Run reminder tests against mock email first, then opt in a disposable real account and verify actual delivery/unsubscribe preferences.
- Recurring tasks and offline drafts are not implemented. Large attachment downloads still occur on initial load or a real remote revision; the database keeps base64 attachments. This is intended for the documented account limits, not large-scale file storage.
- Local browser visual verification was blocked by the review service's usage limit. Automated checks do not replace manual mobile/iPad/desktop testing before release.
