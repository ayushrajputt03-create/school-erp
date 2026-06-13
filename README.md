# Northstar School OS

Production-oriented school operations dashboard for student records, attendance,
fees, academics, and notices.

## Stack

- React 18 + Vite
- Firebase Authentication and Realtime Database
- Realtime Database Security Rules with school-scoped roles
- Vercel deployment

## Local development

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Required environment variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_ENV=development
```

Without Firebase credentials, local development uses device-only demo data.
Production builds fail closed and show a setup error instead of exposing a demo.

## Database

The production Realtime Database rules are in:

`database.rules.json`

It includes:

- Automatic first-admin school onboarding in a batched write
- Owner, admin, staff, and viewer roles
- School-isolated Row Level Security
- School-scoped student, attendance, fee, and notice paths

Apply after linking a Firebase project:

```powershell
npx.cmd firebase use YOUR_PROJECT_ID
npx.cmd firebase deploy --only database
```

## Deployment

The Vercel project must contain these variables in Development, Preview, and
Production:

- The six `VITE_FIREBASE_*` values from Firebase Web App configuration
- `VITE_APP_ENV=production`

Deploy a preview first:

```powershell
npx.cmd vercel deploy
```

Promote only after auth, data isolation, and write workflows are verified.

## Security notes

- Never expose Firebase Admin SDK credentials to this frontend.
- Enable only approved authentication providers.
- Restrict Firebase Authentication authorized domains to approved domains.
- Review Realtime Database usage and security rules before onboarding real data.
- Use synthetic records during acceptance testing.
