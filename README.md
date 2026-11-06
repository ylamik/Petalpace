# Petalpace

A calm, personal planning app for anyone who wants to stay on top of their days. Petalpace gives you one place for your tasks, deadlines, notes, and files — without the noise of heavy project-management tools.

> Built with React, TypeScript, Node.js, and SQLite.

---

## Overview
 <img width="957" height="469" alt="image" src="https://github.com/user-attachments/assets/0f6ad025-53fb-49e6-bf36-4f467f520974" />

Petalpace is a full-stack web app with real user accounts, persistent storage, real-time cross-device sync, and a clean interface designed to feel easy rather than overwhelming.

---

## Pages

### Home
The public landing page. Explains what Petalpace is and lets visitors sign up or sign in.

<img width="948" height="452" alt="image" src="https://github.com/user-attachments/assets/3ff84c0c-090d-46ad-a3c0-1cc94c58a7de" />
<img width="956" height="470" alt="image" src="https://github.com/user-attachments/assets/ebaa1406-3429-41ec-88b7-b61d7cdbeaeb" />
<img width="958" height="417" alt="image" src="https://github.com/user-attachments/assets/d6afbac4-f362-432f-a4d5-388ccb46ed3a" />
<img width="959" height="442" alt="image" src="https://github.com/user-attachments/assets/c169010c-fc77-4091-bfd8-a681d009a637" />
<img width="958" height="470" alt="image" src="https://github.com/user-attachments/assets/f88eb662-8aba-472e-89f0-40209f754744" />
<img width="958" height="470" alt="image" src="https://github.com/user-attachments/assets/b6a972f2-535b-4276-ad5c-b7de5b0322c8" />

---

### Sign up / Sign in
Secure account registration with email verification. Password reset is handled by a single-use email link (expires in 30 minutes).

<img width="596" height="418" alt="image" src="https://github.com/user-attachments/assets/cfc92a7e-8f9a-4a1b-bfd0-cba6de598865" />


---

### Today
Your daily view. Shows tasks due today, overdue unfinished tasks, and undated unfinished tasks. Pinned tasks appear in **My top 3** at the top for quick focus.

<img width="959" height="472" alt="image" src="https://github.com/user-attachments/assets/eb841354-5961-4ebb-9bc9-ebb68e5c1434" />
<img width="957" height="470" alt="image" src="https://github.com/user-attachments/assets/2394a289-3c3e-4706-a704-319416e237d4" />


- Quick-add bar to create a task in seconds
- My top 3 — pin up to three tasks as your priority for the day
- Upcoming panel — next 3 tasks with deadlines
- Compact progress heatmap with "View activity" link

---

### Upcoming
All tasks with a future deadline, grouped by date on a timeline. Missed deadlines and completed tasks have collapsible sections.

<img width="959" height="471" alt="image" src="https://github.com/user-attachments/assets/888dccac-3c36-464a-a7e4-fdd8dff367ee" />

- Filter by space, status, deadline range, or search by title
- "Tasks ahead" sidebar counts unfinished tasks per space
- Select multiple tasks and bulk-delete

---

### All Tasks
Every task across all spaces in one filterable list, with the mountains illustration beside the header.

<img width="959" height="473" alt="image" src="https://github.com/user-attachments/assets/3e5f7095-3d43-4e4f-8aa8-a27575ca1486" />

- Filter by space, status, priority, or deadline
- Sort by nearest deadline, farthest, priority, or title A–Z
- Missed deadlines and completed tasks in collapsible groups
- Select and bulk-delete tasks

---

### Calendar
A full calendar showing tasks on their due dates. Supports month, week, day, and year views.

<img width="959" height="472" alt="image" src="https://github.com/user-attachments/assets/e492189c-67d6-43e8-a7ac-49f9d46b8d35" />
<img width="959" height="470" alt="image" src="https://github.com/user-attachments/assets/760b0e1e-69f1-4ece-a372-979352b596c1" />

- Click any date to drill into day view
- Click `+` on a date to add a task with that due date pre-filled
- Tasks with no due date listed under "No due date"
- Colour-coded by space

---

### Spaces
Tasks are organised into spaces — named and coloured categories you define (new accounts start with School and Personal; add Work, Health, or anything that fits your life). Each space has its own page.

<img width="958" height="468" alt="image" src="https://github.com/user-attachments/assets/87465c44-5080-496d-b05f-7dc04a6daac9" />
<img width="959" height="472" alt="image" src="https://github.com/user-attachments/assets/f2baa8ec-6af2-4aae-814d-533f086d3f0c" />

- Create a space with a name and colour from the palette or a custom hex
- **Edit** a space's name or colour at any time — pencil icon appears on hover in the sidebar, or use the "Edit space" button on the space page
- All tasks in that space automatically update when you rename it
- **Move** a task to a different space from the task detail panel
- Delete a space — tasks move to another space of your choice, never lost

---

### Task details
Opening any task slides open a detail panel on the right.

<img width="958" height="472" alt="image" src="https://github.com/user-attachments/assets/5504051c-aa4f-4f73-9ca3-1d0f4a8838ae" />
<img width="958" height="476" alt="image" src="https://github.com/user-attachments/assets/5b22e08f-3fa0-4f0c-b664-7482332dc9e2" />


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

<img width="959" height="451" alt="image" src="https://github.com/user-attachments/assets/22048be3-3f02-4884-87c0-1c69b06fbd9b" />

- Restore a task to its original space (or choose a replacement if the space was deleted)
- Select multiple tasks to restore or permanently delete together
- Completion history is preserved even after permanent deletion

---

### Progress (heatmap)
An activity heatmap recording each day you completed tasks.

<img width="954" height="455" alt="image" src="https://github.com/user-attachments/assets/fe605b66-0647-400f-b399-7f79b67b55a2" />

- 4-week, 12-week, and 26-week range views
- Colour intensity reflects how many tasks you completed that day
- Reopening a task removes its completion count; completing again records the new date
- **Reset activity history** button — clears all completion records after confirmation

---

### Shared tasks
Work on a task together with other Petalpace users.

- **Delegated tasks** — split the work into items, assign each to a member, and track it with a status: To do, In progress, Done, or Blocked. Every status change asks for confirmation
- Each item has its own notes, links and files, plus group resources for the whole task
- **Invite several people at once** by email, each with their own access:

| Access | What they can do |
|---|---|
| Owner | Everything, including managing members and deleting the task |
| Edit all content | Change anything in the task, except members and deletion |
| Assigned items only | Update the status, notes and links of items assigned to them |
| View only | Read and download |

- Access is checked on the server, not just hidden in the page
- Changes appear live for every member
- The owner sets the deadline timezone; each member also sees the deadline in their own time

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
- Gentle in-page reminder dialog for tasks that are overdue or due soon (snoozable for 1 hour)
- Optional reminder emails, sent by the server even when the site is closed
- Deadlines keep the timezone they were saved in, and show your own local time when it differs
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
- Login limits per email and IP (10 in 15 minutes) with a per-email ceiling (50 in 15 minutes)
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
- A Gmail account with an app password (or a [Resend](https://resend.com) account) for email: sign-up verification, password reset, reminders, invites and feedback

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env.local
# Fill in SMTP_USER and SMTP_PASS (Gmail app password), FEEDBACK_FROM and FEEDBACK_TO

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

Petalpace is live at **https://petalpace.duckdns.org**, running on a $5/month Vultr server (Ubuntu, Singapore) with nginx, free HTTPS from Let's Encrypt, a free Duck DNS address, and email through Gmail.

The full step-by-step guide is in [`deploy/DEPLOY.md`](deploy/DEPLOY.md). In short:

```powershell
# Put new changes live (from the project folder on Windows)
.\deploy\upload.ps1 -VmIp YOUR_SERVER_IP

# Copy the newest database backup to your PC (weekly)
.\deploy\download-backup.ps1 -VmIp YOUR_SERVER_IP
```

- Settings live in `/opt/petalpace/.env.local` on the server; user data in `/var/lib/petalpace`
- Uploads back up the database first and never touch user data
- Daily backups run at 2 AM and the server keeps the last 30
- Only SSH key logins are allowed

Petalpace uses SQLite, so it runs as one Node.js process with a persistent disk. It isn't suited to serverless or multi-replica hosting.

---

## Known limitations

- **No push notifications** — reminders appear in the page and, if turned on, by email.
- **Whole-planner saves** — every edit uploads the full task list. Existing attachments are sent as references, and files download only when opened.
- **Gmail sending limit** — about 500 emails a day across verification, reset, reminder and invite emails.
- **One server** — SQLite on a single small VPS. Fine for a class, team or small organisation; a bigger plan is needed for heavy use.
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

Created by **Mikyla Caras**, assisted by **Erica Espiña**.

---

*Petalpace — a kinder, calmer way to plan your days.*
