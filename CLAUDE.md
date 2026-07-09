# CLAUDE.md

This file is the handoff guide for Claude/Claude Code. Read it before making changes.

## Project Identity

- Project: NXT / Northstar School ERP
- Current production URL: https://northstar-school-os.vercel.app
- GitHub remote: https://github.com/ayushrajputt03-create/school-erp.git
- Current app type: React 18 + Vite SPA
- Backend/services: Firebase Auth, Firebase Realtime Database, Firebase Storage, Firebase Admin API routes on Vercel
- Deployment: Vercel, configured by `vercel.json`

Important: this repository was restored to the full Vite ERP app. Do not convert it back to the old Next.js placeholder shell. The real ERP modules live in `src/*.jsx` and `src/pages/*.jsx`.

## Commands

Use Windows PowerShell commands in this workspace.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
npx.cmd vercel deploy --prod --yes
```

Firebase rules deploy:

```powershell
npm.cmd run firebase:deploy
```

## Environment Variables

Create `.env.local` from `.env.example`.

Frontend Vite variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_ENV=development
VITE_USE_FIREBASE_STORAGE=true
```

Vercel/API variables:

```env
FIREBASE_DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT_JSON=
RESEND_API_KEY=
BACKUP_FROM_EMAIL=
CRON_SECRET=
```

Never commit real `.env`, service account JSON, API keys, or Firebase private keys.

## Main Files

- `src/main.jsx`: SPA entry. Routes `/super-admin/*` to `SuperAdminApp`, otherwise `App`.
- `src/App.jsx`: main school ERP shell, auth/session, school workspace state, sidebar, dashboard, admissions, students, settings, parent accounts, etc.
- `src/app.css`: main styling for the school ERP.
- `src/AuthScreen.jsx`: school login/register.
- `src/SchoolSetup.jsx`: first school setup.
- `src/SuperAdminApp.jsx`: owner console at `/super-admin/login` and `/super-admin/dashboard`.
- `src/ParentPortal.jsx`: parent portal at `/parent/login`.
- `api/parent-portal.js`: backend parent portal session/auth/data API.
- `api/monthly-backup.js`: scheduled backup API.
- `database.rules.json`: Firebase Realtime Database rules.
- `storage.rules`: Firebase Storage rules.
- `vercel.json`: Vercel routing, cron, CSP, and SPA rewrites.

## ERP Modules

The restored full modules are:

- Admissions and student profile: mostly in `src/App.jsx`
- Students: `src/App.jsx`, plus legacy page `src/pages/Students.jsx`
- Employees: `src/EmployeeManager.jsx`
- Leave: `src/LeaveManager.jsx`
- Attendance: `src/pages/Attendance.jsx` and main attendance surfaces
- Fee Management: `src/FeeManager.jsx`, `src/FeeReceipt.jsx`, `src/FeeReceipt.css`
- Certificates: `src/CertificateManager.jsx`, `src/CertificateManager.css`
- Admit Cards: inside `src/CertificateManager.jsx`
- Report Cards: `src/ReportCardManager.jsx`, `src/ReportCardManager.css`
- ID Cards: `src/IDCardManager.jsx`, `src/IDCardManager.css`
- Homework: `src/HomeworkManager.jsx`
- Transport: `src/TransportManager.jsx`
- Expenses: `src/ExpenseManager.jsx`
- Library: `src/LibraryManager.jsx`
- Accounts: `src/AccountsManager.jsx`
- Timetable: `src/TimetableManager.jsx`
- Backup: `src/BackupCenter.jsx`
- Parent Portal: `src/ParentPortal.jsx`, `src/ParentPortal.css`
- Super Admin: `src/SuperAdminApp.jsx`, `src/super-admin.css`

## Routing Notes

This is a Vite SPA. Deep routes are handled by Vercel rewrites to `index.html`.

Important routes:

- `/`: school admin login/dashboard
- `/parent/login`: parent portal login
- `/super-admin/login`: super admin login
- `/super-admin/dashboard`: owner dashboard

Do not add Next.js `app/` routes. They were removed during restore.

## Firebase Data Shape

The app uses school-scoped Realtime Database objects. The main root structure is approximately:

```text
schools/{schoolId}/
  profile
  students
  employees
  attendance
  fees
  certificates
  reportCards
  homework
  transport
  expenses
  library
  accounts
  leave
  parents
  parentNotifications
  certificateRequests

superAdmin/
  plans
  payments
  activityLog
  notifications
```

Use existing helper functions in `src/App.jsx` before creating new data-access patterns.

## Design Rules

- Keep the navy theme: `#021024`, `#052659`, `#5483B3`, `#7DA0CA`, `#C1E8FF`.
- Student/employee photos should be rectangular/passport style, not circles, except initials fallbacks where already used.
- Print documents must stay A4-safe and hide app UI in print.
- Certificates and admit cards use school profile fields for logo, address, phone, email, principal, seal, and signature.
- Avoid decorative one-off gradients/orbs. Keep ERP screens dense, clean, and operational.

## Development Rules

- Before editing a module, search existing patterns in nearby files.
- Do not delete a module to simplify a fix.
- Do not replace the restored Vite app with a Next.js shell.
- Use existing Firebase helpers and state shape when possible.
- For image upload/photo fixes, preserve compression before upload.
- For print fixes, test screen preview and browser print/PDF behavior.
- Run `npm.cmd run build` before claiming a fix is complete.

## Known Deployment Details

Vercel project is already linked to `ayushrajputo3/northstar-school-os`.

If deployment link is lost:

```powershell
npx.cmd vercel link --yes --project northstar-school-os
npx.cmd vercel deploy --prod --yes
```

The live alias should resolve to:

```text
https://northstar-school-os.vercel.app
```

## Recent Restore Context

The repository was temporarily changed into a Next.js module-card shell. That was not the desired app. It was restored from the full Vite backup and deployed again. Keep this restored Vite ERP as the source of truth.

