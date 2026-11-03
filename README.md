# Petalpace

A calm, personal planning app for anyone who wants to stay on top of their days. Petalpace gives you one place for your tasks, deadlines, notes, and files — without the noise of heavy project-management tools.

> Built with React, TypeScript, Node.js, and SQLite.

---

## Overview

<!-- Screenshot: Landing / homepage hero -->
> **\<insert screenshot — Homepage hero with "Room for your plans"\>**

Petalpace is a full-stack web app with real user accounts, persistent storage, real-time cross-device sync, and a clean interface designed to feel easy rather than overwhelming.

---

## Pages

### Home
The public landing page. Explains what Petalpace is and lets visitors sign up or sign in.

> **\<insert screenshot — HomePage full view\>**

---

### Sign up / Sign in
Secure account registration with email verification. Password reset is handled by a single-use email link (expires in 30 minutes).

> **\<insert screenshot — Sign in page\>**

---

### Today
Your daily view. Shows tasks due today, overdue unfinished tasks, and undated unfinished tasks. Pinned tasks appear in **My top 3** at the top for quick focus.

> **\<insert screenshot — Today page with top 3 cards and task list\>**

- Quick-add bar to create a task in seconds
- My top 3 — pin up to three tasks as your priority for the day
- Upcoming panel — next 3 tasks with deadlines
- Compact progress heatmap with "View activity" link

---

### Upcoming
All tasks with a future deadline, grouped by date on a timeline. Missed deadlines and completed tasks have collapsible sections.

> **\<insert screenshot — Upcoming page with date timeline\>**

- Filter by space, status, deadline range, or search by title
- "Tasks ahead" sidebar counts unfinished tasks per space
- Select multiple tasks and bulk-delete

---

### All Tasks
Every task across all spaces in one filterable list, with the mountains illustration beside the header.

> **\<insert screenshot — All Tasks page with filters\>**

- Filter by space, status, priority, or deadline
- Sort by nearest deadline, farthest, priority, or title A–Z
- Missed deadlines and completed tasks in collapsible groups
- Select and bulk-delete tasks

---

### Calendar
A full calendar showing tasks on their due dates. Supports month, week, day, and year views.

> **\<insert screenshot — Calendar month view\>**
> **\<insert screenshot — Calendar week view\>**

- Click any date to drill into day view
- Click `+` on a date to add a task with that due date pre-filled
- Tasks with no due date listed under "No due date"
- Colour-coded by space

---

### Spaces
Tasks are organised into spaces — named and coloured categories you define (Work, Personal, Creative, Health, or anything that fits your life). Each space has its own page.

> **\<insert screenshot — Space page\>**

- Create a space with a name and colour from the palette or a custom hex
- **Edit** a space's name or colour at any time — pencil icon appears on hover in the sidebar, or use the "Edit space" button on the space page
- All tasks in that space automatically update when you rename it
- **Move** a task to a different space from the task detail panel
- Delete a space — tasks move to another space of your choice, never lost

---

### Task details
Opening any task slides open a detail panel on the right.

> **\<insert screenshot — Task details panel open\>**

Everything you can store on a task:
- Title (up to 160 characters) — warns if a duplicate title already exists
- Space, priority (High / Medium / Low), status (To do / In progress / Blocked / Done)
- Due date and optional due time
- Notes (up to 20,000 characters)
- Steps with completion checkboxes and a progress bar
- File attachments — PDF, DOC, DOCX, PPT, PPTX, up to 10 MB each (10 files per task)
  - Each type shown with its own image icon (pdf-file, doc-file, ppt-file)
- Links (http/https only) — shown with a link icon, truncated if long
- Pin to My top 3

---

### Bin
Deleted tasks are kept for 30 days before permanent removal.

> **\<insert screenshot — Bin page\>**

- Restore a task to its original space (or choose a replacement if the space was deleted)
- Select multiple tasks to restore or permanently delete together
- Completion history is preserved even after permanent deletion

---

### Progress (heatmap)
An activity heatmap recording each day you completed tasks.

> **\<insert screenshot — Progress heatmap full view\>**

- 4-week, 12-week, and 26-week range views
- Colour intensity reflects how many tasks you completed that day
- Reopening a task removes its completion count; completing again records the new date
- **Reset activity history** button — clears all completion records after confirmation

---

## Features

### Accounts
- Email + password registration with email verification
- Secure sessions (7-day expiry, rotated on login)
- Password reset via email link (single-use, 30-minute expiry)
- Profile photo (JPG/PNG/WebP, cropped to 512×512 WebP, metadata stripped)
- Account deletion with password confirmation — removes all data immediately
- **Data export** — downloads a ZIP file containing:
  - `tasks.csv` — all tasks with title, space, status, priority, due date, notes, steps, links, file names (opens in Excel, Google Sheets, Numbers)
  - `files/` folder — your actual uploaded attachments organised by task title

### Real-time sync
- Changes saved on one device appear on all your other open tabs and devices **without reloading**
- Uses Server-Sent Events (SSE) — lightweight persistent connection per session
- The top progress bar runs while a sync is in progress
- If a tab has unsaved local changes, it skips the remote sync so your work-in-progress is never overwritten
- Conflicting saves (two devices saving at exactly the same time) are rejected with a clear message rather than silently merged

### Tasks
- 2,000 tasks per account (including completed)
- Steps, links, file attachments, priority, status, deadline (date + optional time)
- Deadline labels turn red within 3 days of due date
- Missed deadlines group for overdue unfinished tasks
- Gentle in-page reminder dialog for To-do tasks due within 3 days (snoozable for 1 hour)
- **Duplicate title detection** — warns when a task with the same title already exists, but lets you proceed if the details differ
- File magic-byte validation — checks actual file content, not just the extension

### Spaces
- 100 spaces per account, unique names up to 40 characters
- Edit name and colour at any time without losing tasks
- Moving a task preserves all its notes, steps, files, and history
- Delete a space — choose where tasks move before confirming

### Security
- Passwords hashed with OWASP-recommended scrypt (N=131072, random salt per password)
- CSRF protection — POST requests require exact trusted origin + JSON content-type
- Sessions stored as SHA-256 hashes only (raw token never persisted)
- Email tokens single-use, 30-minute expiry, consumed atomically in a transaction
- Rate limiting per IP (auth, feedback, photo endpoints)
- Proxy-aware rate limiting via `TRUSTED_PROXY` env var
- Profile photos decoded and re-encoded by Sharp (strips metadata, rejects corrupt/animated files)
- Document uploads validated by magic bytes (PDF, OLE2, OOXML signatures)
- Combined 50 MB storage quota (current tasks + Bin together)
- Graceful shutdown preserves in-progress saves

### Appearance
- Light, dark, and system themes
- Compact toggle in the sidebar cycles light → dark → system
- Theme stored in the browser — no flash on load (applied before React hydrates)
- Loading states: top progress bar during page transitions, saves, and cross-device sync; spinner on auth form buttons; full-page loader while session initialises

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, React Router 8, Motion |
| Backend | Node.js (built-in HTTP server), no external framework |
| Database | SQLite via Node.js built-in `node:sqlite` |
| Real-time sync | Server-Sent Events (SSE) — no external library |
| Email | Resend API |
| Image processing | Sharp |
| ZIP export | Custom zero-dependency ZIP builder (`server/zip-builder.mjs`) |
| Build | Vite 8 with code splitting (react-vendor, motion, app chunks) |
| Tests | Node.js built-in test runner — **58 tests** |

---

## Local development

### Prerequisites
- Node.js 22+
- A [Resend](https://resend.com) account for email (sign-up verification, password reset, feedback)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env.local
# Fill in RESEND_API_KEY, FEEDBACK_FROM, FEEDBACK_TO in .env.local

# 3. Start dev server (API on :3001, Vite on :5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Tests

```bash
npm test
```

58 tests covering auth, planner, calendar, file validation, quota, routing, backup, ZIP builder, task presentation, and theme.

### Build

```bash
npm run build
```

Output goes to `dist/`. The production server serves the SPA automatically from that folder.

---

## Deployment

### 1. Set environment variables on your host

```
NODE_ENV=production
APP_URL=https://yourdomain.com
APP_ORIGINS=https://yourdomain.com
RESEND_API_KEY=re_xxxxxxxxxxxx
FEEDBACK_FROM=noreply@yourdomain.com
FEEDBACK_TO=your-email@example.com
```

Optional — only needed behind a reverse proxy:
```
TRUSTED_PROXY=127.0.0.1
```

### 2. Build and start

```bash
npm run build
node --env-file=.env.local server/index.mjs
```

The server listens on `0.0.0.0:3001` in production and serves the built SPA with SPA route fallback for client-side routes.

### 3. Persistent storage

Mount `server/data/` as a persistent volume on your host. The SQLite database lives at `server/data/accounts.sqlite`. Back it up regularly — the app does not include automated backup tooling.

### 4. HTTPS

Configure HTTPS at the reverse-proxy level (nginx, Caddy, or your hosting provider). The app enforces HTTPS in production mode (`APP_URL` must start with `https://`).

### 5. Test email delivery

Sign up with a real address on your live domain and confirm that verification, password reset, and feedback emails arrive correctly before opening to users.

### Recommended hosts
- [Railway](https://railway.app) — persistent volumes, easy Node deploy
- [Render](https://render.com) — free tier with persistent disk add-on
- [Fly.io](https://fly.io) — good for SQLite with persistent volumes

---

## Known limitations

- **Reminders are in-page only** — no push notifications or background workers. Reminders do not fire while the browser tab is closed.
- **Whole-planner saves** — every edit uploads the full planner including attachments. Performance may degrade for accounts with many large file attachments.
- **Deadlines follow device local time** — no fixed-timezone scheduling. A task's due date may shift if you travel and your device timezone changes.
- **No recurring tasks or offline drafts** — unsaved changes are lost if the browser tab is closed before a save completes.

---

## Project structure

```
server/
  index.mjs             — HTTP server entry, SPA fallback, graceful shutdown
  auth.mjs              — Auth endpoints: register, login, logout, verify, reset, photo, export, SSE stream
  auth-store.mjs        — SQLite schema and database initialisation
  planner.mjs           — Task/space CRUD, Bin, heatmap, quota, activity reset
  feedback.mjs          — Feedback form endpoint, static file serving, health check
  profile-photo.mjs     — Image validation, re-encoding, metadata stripping
  sse-broker.mjs        — SSE connection registry and broadcast for real-time sync
  zip-builder.mjs       — Zero-dependency ZIP archive builder for data export
  document-format.mjs   — OOXML/OLE2 magic-byte validation for file uploads
  data/
    accounts.sqlite     — SQLite database (created on first run)

src/
  App.tsx               — Routes and auth provider
  pages/                — Today, Upcoming, All Tasks, Calendar, Bin, Space, CreateSpace, NotFound
  features/
    auth/               — Auth context, provider, RequireAccount guard
    spaces/             — SpacesProvider (save, sync, undo, Bin), Edit/Delete space dialogs
    tasks/              — TaskRows, TaskDetailsPanel, AddTaskDialog, reminders, heatmap, deadlines
    theme/              — Theme preference (light/dark/system)
  components/
    auth/               — AuthPage (sign in/up/verify/reset), ProfileMenu, AccountDataDialog
    layout/             — AppLayout (top progress bar, sync indicator), Sidebar (edit/delete spaces)
    ui/                 — ThemeControl, PageLoader, ButtonSpinner, FileTypeIcon, PlannerSelect
  hooks/
    usePlannerClock.ts  — Shared clock refreshed on visibility/focus for midnight rollover
    usePageTransition.ts — Route change detection for top progress bar
    usePlannerSync.ts   — SSE connection hook for real-time cross-device sync
```

---

## Credits

Created by **Mikyla Caras**.

---

*Petalpace — a kinder, calmer way to plan your days.*
