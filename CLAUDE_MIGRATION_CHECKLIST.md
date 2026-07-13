# Claude Migration Checklist

Use this checklist to move/open this exact project in Claude or Claude Code without changing UI or breaking integrations.

## 1. Open The Correct Repository

Clone/open:

```text
https://github.com/ayushrajputt03-create/school-erp.git
```

Expected app type:

```text
React 18 + Vite SPA
```

If Claude sees a Next.js `app/` router project, stop. That is the wrong/old placeholder structure. The correct restored ERP has `src/App.jsx`, `src/SuperAdminApp.jsx`, `src/ParentPortal.jsx`, and many `src/*Manager.jsx` files.

## 2. Install And Run

```powershell
npm.cmd install
npm.cmd run dev
```

Production check:

```powershell
npm.cmd run build
```

## 3. Environment Setup

Copy:

```powershell
Copy-Item .env.example .env.local
```

Fill Firebase web app values:

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

For Vercel API routes, also set:

```env
FIREBASE_DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT_JSON=
RESEND_API_KEY=
BACKUP_FROM_EMAIL=
CRON_SECRET=
```

## 4. Do Not Change These Unless Asked

- Do not change visual theme or layout.
- Do not replace Vite with Next.js.
- Do not remove restored modules.
- Do not rename Firebase collections.
- Do not remove Vercel rewrites in `vercel.json`.
- Do not commit `.env`, service account JSON, or real secrets.

## 5. Verify Important Routes

After running locally or deploying:

```text
/
/parent/login
/super-admin/login
/super-admin/dashboard
```

## 6. Deploy To Existing Vercel Project

If not linked:

```powershell
npx.cmd vercel link --yes --project northstar-school-os
```

Deploy:

```powershell
npx.cmd vercel deploy --prod --yes
```

Live URL should be:

```text
https://northstar-school-os.vercel.app
```

## 7. Before Any Claude Change Is Marked Complete

Claude should run:

```powershell
npm.cmd run build
```

Then verify:

- No blank page.
- No console crash.
- Login page still loads.
- Parent portal still loads.
- Super admin still loads.
- No UI/theme changes unless the user explicitly requested them.

