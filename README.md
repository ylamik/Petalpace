# Petalpace

A calm, personal planning app for anyone who wants to stay on top of their days. Petalpace gives you one place for your tasks, deadlines, notes, and files — without the noise of heavy project-management tools.

> Built with React, TypeScript, Node.js, and SQLite.

---

## Overview

<!-- Screenshot: Landing / homepage hero -->
> **\<insert screenshot — Homepage hero with "Room for your plans"\>**

Petalpace is a full-stack web app with real user accounts, persistent storage, and a clean interface designed to feel easy rather than overwhelming.

---

## Pages

### Home
The public landing page. Explains what Petalpace is and lets visitors sign up or sign in.

> **\<insert screenshot — HomePage full view\>**

---

### Sign up / Sign in
Secure account registration with email verification. Password reset is handled by email link.

> **\<insert screenshot — Sign in page\>**

---

### Today
Your daily view. Shows tasks due today, overdue unfinished tasks, and undated tasks you still need to finish. Pinned tasks appear in **My top 3** at the top for quick focus.

> **\<insert screenshot — Today page with top 3 cards and task list\>**

Features on this page:
- Quick-add bar to create a task in seconds
- My top 3 — pin up to three tasks as your priority for the day
- Upcoming panel — next 3 tasks with deadlines, linking to the full Upcoming page
- Your progress heatmap (compact view)

---

### Upcoming
All tasks that have a future deadline, grouped by date on a timeline. Missed deadlines and completed tasks have their own collapsible sections.

> **\<insert screenshot — Upcoming page with date timeline\>**

- Filter by space, status, deadline range, or search by title
- "Tasks ahead" sidebar counts undone tasks per space
- Select multiple tasks and delete them at once

---

### All Tasks
Every task across all spaces in one filterable list.

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
- Tasks with no due date listed at the bottom under "No due date"
- Colour-coded by space

---

### Spaces
Tasks are organised into spaces — named and coloured categories you define (for example: Work, Personal, Creative, Health, or anything that fits your life). Each space has its own page showing only its tasks.

> **\<insert screenshot — Space page\>**

- Create a space with a name and colour from the palette or a custom hex
- **Edit** a space's name or colour at any time (pencil icon in sidebar or Edit space button on the space page)
- **Move** a task to a different space from the task detail panel
- Delete a space — tasks are moved to another space of your choice, never lost

---

### Task details
Opening any task slides open a detail panel on the right.

> **\<insert screenshot — Task details panel open\>**

Everything you can store on a task:
- Title (up to 160 characters)
- Space, priority (High / Medium / Low), status (To do / In progress / Blocked / Done)
- Due date and optional due time
- Notes (up to 20,000 characters)
- Steps with completion checkboxes and a progress bar
- File attachments — PDF, DOC, DOCX, PPT, PPTX, up to 10 MB each (10 files per task)
- Links (http/https only)
- Pin to My top 3

File icons show the document type (PDF in red, Word in blue, PowerPoint in orange).

---

### Bin
Deleted tasks are kept for 30 days before permanent removal.

> **\<insert screenshot — Bin page\>**

- Restore a task back to its original space (or choose a replacement if the space was deleted)
- Select multiple tasks and restore or permanently delete them together
- Completion history is preserved even after permanent deletion

---

### Progress (heatmap)
An activity heatmap recording each day you completed tasks — similar to GitHub's contribution graph.

> **\<insert screenshot — Progress heatmap full view\>**

- 4-week, 12-week, and 26-week range views
- Each cell's colour intensity reflects how many tasks you completed that day
- Reopening a task removes its completion count; completing again records the new date

---

## Features

### Accounts
- Email + password registration with email verification
- Secure sessions (7-day expiry, rotated on login)
- Password reset via email link (single-use, expires in 30 minutes)
- Profile photo (JPG/PNG/WebP, cropped and stored as 512×512 WebP)
- Account deletion with password confirmation (removes all data)
- Data export (`GET /api/auth/export`) — downloads your planner as JSON

### Tasks
- 2,000 tasks per account (including completed)
- Steps, links, file attachments, priority, status, deadline (date + optional time)
- Deadline labels turn red within 3 days of due date
- Missed deadline group for overdue unfinished tasks
- Gentle reminder dialog for To-do tasks due within 3 days (snoozable for 1 hour)
- Conflict detection — saving from another tab rejects stale versions instead of silently overwriting

### Spaces
- 100 spaces per account, unique names up to 40 characters
- Edit name and colour at any time without losing tasks
- Delete a space — choose where tasks move before confirming

### Security
- Passwords hashed with OWASP-recommended scrypt (N=131072)
- CSRF protection — POST requests require exact trusted origin + JSON content-type
- Sessions stored as SHA-256 hashes only (raw token never persisted)
- Email tokens single-use, 30-minute expiry, consumed atomically in a transaction
- Rate limiting per IP for auth and feedback endpoints
- Proxy-aware rate limiting (`TRUSTED_PROXY` env var)
- File uploads validated by magic bytes (not just extension)
- Profile photos decoded and re-encoded by Sharp (metadata stripped)

### Appearance
- Light, dark, and system themes
- Theme stored in the browser; cycles light → dark → system from the sidebar icon
- No flash on load (theme applied before React hydrates)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, React Router 8, Motion |
| Backend | Node.js (built-in HTTP server), no external framework |
| Database | SQLite via Node.js built-in `node:sqlite` |
| Email | Resend API |
| Image processing | Sharp |
| Build | Vite 8 with code splitting |
| Tests | Node.js built-in test runner — 57 tests |

---

## Local development

### Prerequisites
- Node.js 22+
- A [Resend](https://resend.com) account for email (or skip email features locally)

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

57 tests covering auth, planner, calendar, file validation, quota, routing, backup, task presentation, and theme.

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

The server listens on `0.0.0.0:3001` in production and serves the built SPA with SPA route fallback.

### 3. Persistent storage

Mount `server/data/` as a persistent volume on your host. The SQLite database lives at `server/data/accounts.sqlite`. Back it up regularly — the app does not include automated backup tooling.

### 4. HTTPS

Configure HTTPS at the reverse-proxy level (nginx, Caddy, or your hosting provider). The app enforces HTTPS in production mode (`APP_URL` must start with `https://`).

### Recommended hosts
- [Railway](https://railway.app) — persistent volumes, easy Node deploy
- [Render](https://render.com) — free tier, persistent disk add-on
- [Fly.io](https://fly.io) — good for SQLite with persistent volumes

---

## Known limitations

- **Reminders are in-page only** — no push notifications or background workers. Reminders do not fire while the browser tab is closed.
- **No live cross-device sync** — changes from another device appear after a manual reload. Conflicting saves are rejected rather than silently merged.
- **Whole-planner saves** — every edit uploads the full planner including attachments. Performance may degrade for accounts with many large file attachments.
- **Deadlines follow device local time** — no fixed-timezone scheduling. A task's due date changes if you travel and the device timezone changes.
- **No recurring tasks, collaboration, or offline drafts.**

---

## Project structure

```
server/
  index.mjs           — HTTP server entry, SPA fallback, graceful shutdown
  auth.mjs            — Auth endpoints: register, login, logout, verify, reset, photo, export
  auth-store.mjs      — SQLite schema and database initialisation
  planner.mjs         — Task/space CRUD, Bin, heatmap, quota enforcement
  feedback.mjs        — Feedback form endpoint
  profile-photo.mjs   — Image validation, re-encoding, metadata stripping
  data/
    accounts.sqlite   — SQLite database (created on first run)

src/
  App.tsx             — Routes and auth provider
  pages/              — Page components (Today, Upcoming, All Tasks, Calendar, Bin, Space, etc.)
  features/
    auth/             — Auth context, provider, guards
    spaces/           — SpacesProvider, space/task state, Edit/Delete dialogs
    tasks/            — Task rows, detail panel, add dialog, reminders, heatmap, deadlines
    theme/            — Theme preference (light/dark/system)
  components/
    auth/             — AuthPage (sign in/up/verify/reset), ProfileMenu
    layout/           — AppLayout, Sidebar
    ui/               — ThemeControl, PageLoader, FileTypeIcon, PlannerSelect
  hooks/
    usePlannerClock.ts — Shared clock with visibility/focus refresh for midnight rollover
    usePageTransition.ts — Route change detection for top progress bar
```

---

## Credits

Created by **Mikyla Caras**.

---

*Petalpace — a kinder, calmer way to plan your days.*
