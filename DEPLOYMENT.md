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
- Reminder dialogs work only while the website is open. They are not push, email or SMS reminders. Snooze is local to the browser.
- Tasks save through the API. Existing attachments are sent as account-scoped references; only new files are uploaded. Task metadata is still saved as a revision-controlled snapshot. Concurrent stale saves are rejected, not silently merged.
- Cross-device live sync and offline drafting are not provided. Reload another device to fetch changes; retain the page and use Retry when a save fails.
- Current-task attachments are limited to 30 MiB; current plus Bin attachments are limited to 50 MiB of decoded file content. The Bin holds up to 2,000 recoverable tasks. Cleanup that reduces a legacy over-limit account is permitted.
- Deleted tasks are recoverable for 30 days. Cleanup runs hourly while the server runs and also on planner requests. Expired tasks cannot be restored even before cleanup executes.
- Permanently deleted contents are removed from the live planner/Bin. ID tombstones and completion history remain until account deletion. SQLite disk pages and retained backups are not a secure-erasure guarantee.
- Account deletion removes that user's live records through foreign-key cascades; retained offline backups expire under the operator's policy. Account export is a private JSON download, not an import/restore UI.
- Document checks reject unsupported extensions and invalid signatures. DOCX/PPTX additionally require Office package structure and reject detected macro packages. This is **not antivirus scanning** or a guarantee that a document is harmless; legacy DOC/PPT and PDF checks remain limited. Do not market uploads as malware-free. Add a scanning service if required by your hosting/use policy.
- Email success means the provider accepted the message, not a guaranteed inbox delivery. There is no delivery webhook or automatic retry queue.

## Before calling the deployment complete

Record the production URL, host, persistent mount, latest successful backup, restore-test date, smoke-test result, verified email sender, and manual test outcomes. These environment-specific checks cannot be inferred from passing local tests.
