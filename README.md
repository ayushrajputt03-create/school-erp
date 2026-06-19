<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
# VyaparFlow Billing SaaS (MVP)

Next.js + Tailwind + Supabase + Vercel-ready billing SaaS for Indian local shops.

## Features
- Multi-tenant shop isolation via `shop_id`
- Owner/staff auth foundations with role support
- Dashboard KPIs, Products, POS billing, Customers, Reports
- Subscription module (trial/basic/pro/premium)
- SaaS admin panel metrics placeholders
- Invoice print and PDF download
- Supabase RLS-first schema

## Stack
- Next.js App Router
- Tailwind CSS
- Supabase (Auth + Postgres + RLS)

## Setup
1. Install dependencies: `npm install`
2. Copy env: `cp .env.example .env.local`
3. Fill Supabase keys in `.env.local`
4. Run SQL in `supabase/schema.sql` using Supabase SQL editor.
5. Start dev server: `npm run dev`

## Subscription Rules
- Free Trial (14 days): 100 invoices, 1 staff
- Basic Rs 499/mo: 1000 invoices/mo, 2 staff
- Pro Rs 999/mo: unlimited invoices, 5 staff
- Premium Rs 1999/mo: unlimited, 15 staff, multi-branch
- Expired subscription: login allowed, new invoices blocked, old data retained

## Vercel Deploy
- Import repo into Vercel
- Set env vars from `.env.example`
- Deploy

## Notes
This is MVP scaffolding with production-friendly structure and DB-first tenancy/security model.
=======
=======
>>>>>>> theirs
# School ERP SaaS MVP (Next.js + Supabase)

Production-ready multi-tenant School ERP SaaS starter with school-code login, role-based dashboards, billing by active students, and Supabase RLS.

## Stack
- Next.js 15 + TypeScript + Tailwind CSS
- Supabase Auth + Postgres + RLS
- Vercel-ready deployment

## Core Features
- Multi-tenant school isolation with `school_id`
- Login via `school code + email/phone + password`
- Role model: super_admin, principal, teacher, student, parent
- Dashboard modules for all core ERP units
- Billing model: `active_students * per_student_price`
- Pricing override & discount via `pricing_rules`
- Subscription + invoice tables

## Local Setup
1. Install deps: `npm install`
2. Copy env: `cp .env.example .env.local`
3. Add Supabase keys in `.env.local`
4. Run SQL from `supabase/schema.sql` in Supabase SQL editor
5. Start app: `npm run dev`

## Demo Credentials
- Super Admin: `school_code = GLOBAL01`, `email = admin@erp.local`, `password = Password@123`
- Principal: `school_code = TRV2026`, `email = principal@trv.local`, `password = Password@123`
- Teacher: `school_code = TRV2026`, `email = teacher1@trv.local`, `password = Password@123`
- Student: `school_code = TRV2026`, `email = student1@trv.local`, `password = Password@123`
- Parent: `school_code = TRV2026`, `email = parent1@trv.local`, `password = Password@123`

## Vercel Deployment
- Import repo in Vercel
- Set environment variables from `.env.example`
- Deploy; build command `npm run build`

## Notes
- Use Supabase service-role key only in server-side jobs (billing cron/invoice generation).
- Add monthly cron job for invoice generation.
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
# School ERP SaaS MVP

A multi-tenant School ERP SaaS MVP built with **Next.js, TypeScript, Tailwind CSS, and Supabase**, ready for Vercel.

## What is included (MVP)
- Multi-tenant architecture using `school_id` in all core domain tables
- School-code login workflow (`school code + email/phone + password`)
- Role-based panel entry points:
  - Super Admin
  - Principal/Admin
  - Teacher
  - Student
  - Parent
- Starter dashboard UX with responsive SaaS layout, cards, sections, and sidebar navigation
- Billing data model with:
  - default ₹4 per active student/month
  - custom pricing rules
  - subscriptions and invoices
  - SQL function to compute monthly bill from active students
- Supabase RLS and helper SQL functions for school isolation and super admin access

## Stack
- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Vercel deployment

## Project setup
=======
# School ERP SaaS MVP

Production-ready multi-tenant School ERP SaaS MVP built with Next.js + TypeScript + Tailwind + Supabase.

## Features
- Multi-tenant school architecture with unique `school_code`
- School-code based login: school code + email/phone + password
- Role-oriented dashboard modules: Super Admin, Principal, Teacher, Student, Parent
- School-wise data isolation with RLS-ready schema
- Student, teacher, class/section, attendance, fees, notices, and billing domain models
- Subscription, pricing rules, invoices, and monthly billing support

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL + RLS
- Vercel-ready deployment

## Setup
>>>>>>> theirs
1. Install dependencies
   ```bash
   npm install
   ```
<<<<<<< ours
2. Create local env
   ```bash
   cp .env.example .env.local
   ```
3. Fill env values from your Supabase project.
4. Run `supabase/schema.sql` in Supabase SQL editor.
5. Start dev server:
=======
2. Configure env
   ```bash
   cp .env.example .env.local
   ```
3. Create Supabase project and run SQL from `supabase/schema.sql`.
4. Start local server
>>>>>>> theirs
   ```bash
   npm run dev
   ```

<<<<<<< ours
## Environment variables
See `.env.example`.

## Demo logins (seed these manually in Supabase)
- Super Admin: `GLOBAL01` / `admin@erp.local` / `Password@123`
- Principal: `TRV2026` / `principal@trv.local` / `Password@123`
- Teacher: `TRV2026` / `teacher1@trv.local` / `Password@123`
- Student: `TRV2026` / `student1@trv.local` / `Password@123`
- Parent: `TRV2026` / `parent1@trv.local` / `Password@123`

## Deployment (Vercel)
1. Import repository into Vercel.
2. Add env vars from `.env.example`.
3. Build command: `npm run build`.
4. Deploy.

## Next build steps to reach full production
- Add CRUD server actions/APIs for students, teachers, classes, sections, attendance, fees, notices
- Add report filters/search/pagination
- Add invoice generation cron (monthly)
- Add audit logs and activity timeline
- Add robust automated tests and CI checks
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
## Billing Logic
- Default price: ₹4 per active student per month.
- Monthly bill formula: `active_students * effective_price_per_student`.
- Override via `pricing_rules` table for custom discount/custom pricing/free trial.

## Demo Login Credentials
- Super Admin: `SUPER01 + admin@erp.local + Password@123`
- Principal: `TRV2026 + principal@trvschool.local + Password@123`
- Teacher: `TRV2026 + teacher1@trvschool.local + Password@123`
- Student: `TRV2026 + student1@trvschool.local + Password@123`
- Parent: `TRV2026 + parent1@trvschool.local + Password@123`

> Replace these with real seeded users and hashed passwords in production.

## Deployment (Vercel)
1. Push repo to GitHub.
2. Import project into Vercel.
3. Add all variables from `.env.example`.
4. Deploy and set production Supabase URL/keys.

## Security Notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Enforce RLS for all tenant tables.
- Validate all input payloads.
- Protect routes via middleware + server checks.
>>>>>>> theirs
