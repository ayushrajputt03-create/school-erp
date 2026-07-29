# Supabase Migration — Optimized Schema & Capacity Plan

**Project:** NXT / Northstar School ERP (School99)
**Written:** 2026-07-27 · against commit `b5185f7`
**Status:** PLAN ONLY. Nothing in this document has been implemented. No live data has been touched.

---

## 0. The short answer first

| Scenario | Per school / year | Schools on Supabase **free** |
|---|---|---|
| 800 students, naive port of current RTDB shape | ~60-80 MB | **5-6** |
| 800 students, optimized schema (this doc) | ~25 MB | **12-15** |
| 800 students, optimized + absence-only attendance | ~9 MB | **35-40** (capped by bandwidth/storage, not DB) |
| 500 students, optimized + absence-only | ~6 MB | **35-40** (same cap) |
| Any of the above on **Pro ($25/mo)** | same | **250+** |

**Hard ceiling of the free tier is ~40 schools**, no matter how well the schema is optimized — because three different free limits all converge near that number (DB size, egress bandwidth, file storage). Detail in §7.

Current stack for comparison: Firebase Spark realistically caps at **3-5 schools**, and the binding limit there is the **100 simultaneous connections** cap, which cannot be fixed by any amount of code.

**Recommendation: do not migrate yet.** Reasoning in §10.

---

## 1. What exists today (verified, not assumed)

Read from `database.rules.json` and `src/App.jsx` at `b5185f7`.

### 1.1 RTDB tree

```
users/{uid}                              → schoolId, fullName, role, uid
superAdmin/{uid}                         → ayushrajputt03@gmail.com only
schoolCodes/{code}                       → schoolId, schoolName, createdAt
teachersIndex/{uid}                      → schoolId
schoolMembers/{schoolId}/{uid}           → userId, role, status
studentPhotos/{schoolId}/{studentId}     → base64 string, <400 KB (validated)

schools/{schoolId}/
  profile students deletedStudents staff staffAttendance employeeManager
  attendance fees feeManager notices homework teachers transport expenses
  library accounts leave leaveRequests certificates certificateCounters
  certificateRequests admissionRequests admissionThrottle enquiries approvals
  parents parentStudentIndex parentMessages parentNotifications
  studentAcademics studentDocuments exams dateSheet admitCards
  reportExams reportMarks reportCards idCards idCardSettings
  timetable timetableRecords subscription staffCount backupSettings auditLogs
```

### 1.2 Real record shapes

**Attendance** — `src/App.jsx:4142`, key `{date}_{studentId}`:

```js
{ id, studentId, student_id, class, section, date, status, statusText,
  mark, markedBy, marked_by, created_at, updated_at, updatedAt }
```

Five of those fields are duplicates of three values (`studentId`/`student_id`, `status`/`statusText`/`mark`, `markedBy`/`marked_by`, `created_at`, `updated_at`/`updatedAt`). Because RTDB stores the key names inside every record, one attendance mark costs roughly **250-300 bytes on the wire and on disk**. The same fact in Postgres is **~28 bytes of data**.

**Students** — `src/App.jsx:2204`, snake_case on write, dual-read normalization at `2082`:

```
full_name admission_number class_name section father_name mother_name
guardian_name date_of_birth aadhaar blood_group father_aadhaar
mother_aadhaar fee_status fee_group penId apaarId ...
```

`src/App.jsx:2082-2160` exists purely to defend against three historical field-name formats (`full_name` / `name` / `fullName`). **This normalization layer must survive the migration** — it is what protects live client data.

**Fees** — `src/App.jsx:3703`: `receiptNumber`, `invoiceNumber` (duplicate), `amount`, `method`, `status`, `paidAt`, `updatedAt`, `billingPeriod`, plus a denormalized write back into `students/{id}/fee_status` and `fee_group`.

**Marks** — `src/App.jsx:4935`, key `{examId}_{studentId}`.

### 1.3 Known defects this migration would fix for free

| Defect | Location | Fixed by |
|---|---|---|
| `fees` full-node live listener, no scoping | `App.jsx:2818` | SQL `WHERE`, no listener |
| 23 nodes REST-fetched at every login | `App.jsx:2460` | Query on demand |
| Teacher loads **every** student in the school (privacy defect) | `TeacherApp.jsx:101` | RLS class-scoping (§5.4) |
| 5 redundant fields per attendance row | `App.jsx:4142` | Typed columns (§4.3) |
| No pagination anywhere | reports, certs, ID cards | `LIMIT`/`OFFSET` |

---

## 2. Why Postgres is structurally cheaper here

Firebase RTDB bills on **bytes downloaded**. An `onValue` listener on a node re-downloads **the entire node** on any descendant change. Mark one student absent in a school with 3 admins online, and the whole `attendance` node ships three times.

Supabase bills on **database size** and **egress**. Marking a student absent writes one ~60-byte row. Nobody re-downloads anything. `SELECT ... WHERE class_id = 12 AND day = '2026-07-27'` returns exactly those rows.

Consequence: **daily attendance and fee updates are effectively free on Supabase.** On Firebase they are the single largest cost line. That difference is structural, not a tuning detail.

---

## 3. Optimization rules applied

These are the levers, ranked by how much they actually save. Every one of them is applied in the DDL in §4.

| # | Rule | Saving |
|---|---|---|
| 1 | **Absence-only attendance** — store only absent/leave/half-day; present is the default | ~11x on the largest table |
| 2 | **`bigint` identity PKs, not `uuid`** — 8 bytes vs 16, in the row *and* in every index and FK | ~30% across the schema |
| 3 | **Postgres `enum` instead of `text`** for status/gender/grade | 4 bytes vs 5-12 bytes + varlena header |
| 4 | **Minimal index set** — each extra btree costs ~30-40 bytes/row | 20-30% per index avoided |
| 5 | **BRIN instead of btree** on append-only date columns | megabytes → kilobytes |
| 6 | **Photos in Supabase Storage, never in the DB** | keeps ~24 MB/school out of the 500 MB budget |
| 7 | **`int4` rupees, not `numeric`** for money | 4 bytes vs ~10 |
| 8 | **Column order: fixed-width first, then variable** — kills alignment padding | ~5-8% |
| 9 | **Capped audit-log retention** (90 days) | unbounded → ~1 MB/school/year |
| 10 | **`(select auth.uid())` in RLS policies** — evaluated once per statement, not once per row | query speed, not size |

**Rule 1 carries a mandatory caveat.** "No row = present" is ambiguous with "no row = attendance was never taken that day." Without disambiguation, a school that forgets to take attendance looks like 100% attendance. The `attendance_days` companion table in §4.3 exists solely to close this hole. **Do not implement rule 1 without it.**

---

## 4. Schema (DDL)

### 4.1 Extensions, enums, tenancy

```sql
create extension if not exists pgcrypto;

create type user_role      as enum ('owner','admin','teacher','accountant','parent');
create type member_status  as enum ('active','suspended','removed');
create type attend_status  as enum ('absent','leave','half_day','late');
create type fee_status     as enum ('paid','partial','pending','overdue','cancelled');
create type req_status     as enum ('pending','approved','rejected');
create type gender_t       as enum ('male','female','other');

create table schools (
  id            int          generated always as identity primary key,
  code          varchar(12)  not null unique,
  name          text         not null,
  email         text,
  phone         varchar(15),
  address       text,
  academic_year varchar(9)   not null,
  logo_path     text,          -- Storage object path, NOT the image
  seal_path     text,
  signature_path text,
  principal_name text,
  created_at    timestamptz  not null default now(),
  settings      jsonb        not null default '{}'::jsonb
);
```

`int` (not `bigint`) for `schools.id` — 4 bytes, and it is a foreign key on every single other table. At 2 billion schools this becomes a problem; it will not.

`settings jsonb` is the **escape hatch for additive fields**. Anything school-specific and rarely queried goes here instead of triggering a migration. This directly serves the "additive fields only, build future-proof" rule.

```sql
create table school_members (
  school_id  int         not null references schools(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       user_role   not null,
  status     member_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (school_id, user_id)
);
create index on school_members (user_id);   -- required: RLS looks up by user
```

`user_id` is `uuid` because Supabase's `auth.users.id` is a uuid and that is not negotiable. Everything the app owns uses `bigint`.

### 4.2 Students

```sql
create table students (
  id               bigint generated always as identity primary key,
  school_id        int    not null references schools(id) on delete cascade,
  admission_no     varchar(20) not null,
  class_name       varchar(16) not null,
  section          varchar(4)  not null default 'A',
  academic_year    varchar(9)  not null,
  date_of_birth    date,
  admission_date   date,
  gender           gender_t,
  is_active        boolean not null default true,
  fee_status       fee_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- variable-width block starts here
  full_name        text not null,
  father_name      text,
  mother_name      text,
  guardian_phone   varchar(15),
  father_phone     varchar(15),
  address          text,
  city             varchar(60),
  state            varchar(40),
  pincode          varchar(6),
  aadhaar          varchar(14),
  blood_group      varchar(6),
  fee_group        varchar(40),
  photo_path       text,      -- Storage path
  extra            jsonb not null default '{}'::jsonb,
  unique (school_id, admission_no, academic_year)
);

create index students_roster_idx
  on students (school_id, class_name, section) where is_active;
create index students_phone_idx
  on students (school_id, guardian_phone) where guardian_phone is not null;
```

`extra jsonb` absorbs `penId`, `apaarId`, `motherTongue`, `nationality`, `height`, `weight`, `religion`, `category`, `stream`, `father_aadhaar`, `mother_aadhaar`, `sessionHistory`, and anything added later. These are printed on certificates but never filtered on — perfect jsonb candidates, and they cost nothing when empty.

Only **two** indexes beyond the PK. The roster index is partial (`where is_active`), so archived students are not indexed at all.

Deleted students: **do not create a `deleted_students` table.** Add `deleted_at timestamptz`, `deleted_by`, `deleted_reason` and filter on them. One table instead of two, and restore becomes an `UPDATE`.

### 4.3 Attendance — the big one

```sql
-- Fact table: ONLY non-present records.
create table attendance (
  school_id  int    not null references schools(id) on delete cascade,
  student_id bigint not null references students(id) on delete cascade,
  day        date   not null,
  status     attend_status not null,
  marked_by  uuid,
  note       text,
  primary key (school_id, day, student_id)
);

-- Companion: which (class, day) pairs were actually taken.
-- Without this, "no row" is ambiguous.
create table attendance_days (
  school_id  int    not null references schools(id) on delete cascade,
  day        date   not null,
  class_name varchar(16) not null,
  section    varchar(4)  not null,
  taken_by   uuid,
  taken_at   timestamptz not null default now(),
  primary key (school_id, day, class_name, section)
);

create index attendance_student_idx on attendance (student_id, day);
create index attendance_day_brin    on attendance using brin (day);
```

No surrogate `id` column — the natural key **is** the PK, so the PK index doubles as the lookup index. That alone saves ~8 bytes of data plus a whole index versus the RTDB-style `{date}_{studentId}` string key.

`brin` on `day`: attendance is inserted in date order, so BRIN summarizes it in a few kilobytes where a btree would cost megabytes. Month-range queries stay fast.

The read is a left join, and this becomes the one query the whole app depends on:

```sql
-- Attendance for one class on one day
select s.id, s.full_name, s.admission_no,
       coalesce(a.status::text, 'present') as status,
       exists (select 1 from attendance_days d
               where d.school_id = s.school_id and d.day = $2
                 and d.class_name = s.class_name and d.section = s.section) as was_taken
from students s
left join attendance a
       on a.student_id = s.id and a.day = $2
where s.school_id = $1 and s.class_name = $3 and s.section = $4 and s.is_active
order by s.admission_no;
```

If `was_taken` is false, the UI must show "not taken" — **not** "all present". This is the single most important correctness rule in the whole migration.

Monthly percentage, computed not stored:

```sql
select s.id, s.full_name,
       count(d.day) as working_days,
       count(d.day) - count(a.day) filter (where a.status in ('absent','leave')) as present_days
from students s
join attendance_days d
  on d.school_id = s.school_id and d.class_name = s.class_name and d.section = s.section
 and d.day >= $2 and d.day < $3
left join attendance a on a.student_id = s.id and a.day = d.day
where s.school_id = $1 and s.is_active
group by s.id, s.full_name;
```

### 4.4 Fees

```sql
create table fee_receipts (
  id            bigint generated always as identity primary key,
  school_id     int    not null references schools(id) on delete cascade,
  student_id    bigint not null references students(id) on delete restrict,
  amount        int    not null,          -- whole rupees
  discount      int    not null default 0,
  balance       int    not null default 0,
  status        fee_status not null,
  billing_month date   not null,          -- always day 1
  paid_at       timestamptz not null default now(),
  created_by    uuid,
  receipt_no    varchar(24) not null,
  method        varchar(24),
  note          text,
  unique (school_id, receipt_no)
);

create index fee_student_idx on fee_receipts (student_id, billing_month desc);
create index fee_due_idx on fee_receipts (school_id, billing_month)
  where status in ('pending','partial','overdue');

create table fee_lines (
  receipt_id bigint not null references fee_receipts(id) on delete cascade,
  head       varchar(40) not null,
  amount     int    not null,
  primary key (receipt_id, head)
);
```

`on delete restrict` on `student_id` is deliberate: **a paid receipt must never vanish because a student row was deleted.** This encodes the client-data-safety rule as a database constraint rather than a convention.

`fee_due_idx` is partial — paid receipts (the large majority over time) are not in it.

Drop `invoiceNumber` (duplicate of `receiptNumber`) and drop the denormalized `students.fee_status` write — derive it:

```sql
create view student_fee_status as
select s.id as student_id, s.school_id,
       coalesce(sum(f.balance) filter (where f.status <> 'cancelled'), 0) as outstanding
from students s left join fee_receipts f on f.student_id = s.id
group by s.id, s.school_id;
```

### 4.5 Exams and marks

```sql
create table exams (
  id         int generated always as identity primary key,
  school_id  int not null references schools(id) on delete cascade,
  name       varchar(60) not null,
  term       smallint,
  academic_year varchar(9) not null,
  starts_on  date,
  published  boolean not null default false
);

create table marks (
  school_id   int      not null references schools(id) on delete cascade,
  exam_id     int      not null references exams(id) on delete cascade,
  student_id  bigint   not null references students(id) on delete cascade,
  subject     varchar(40) not null,
  obtained    smallint,
  max_marks   smallint not null default 100,
  grade       varchar(3),
  primary key (exam_id, student_id, subject)
);
create index marks_student_idx on marks (student_id);
```

`smallint` for marks. Grade is derived at render time from `obtained`/`max_marks`; storing it is optional and only kept here because report cards allow manual override.

### 4.6 Staff, parents, access scoping

```sql
create table staff (
  id            bigint generated always as identity primary key,
  school_id     int not null references schools(id) on delete cascade,
  user_id       uuid references auth.users(id),   -- null until they log in
  employee_code varchar(20) not null,
  joining_date  date,
  is_active     boolean not null default true,
  first_name    text not null,
  last_name     text,
  phone         varchar(15),
  designation   varchar(60),
  department    varchar(60),
  photo_path    text,
  extra         jsonb not null default '{}'::jsonb,
  unique (school_id, employee_code)
);

-- Which classes a teacher may see. Fixes TeacherApp.jsx:101.
create table teacher_classes (
  school_id  int not null references schools(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  class_name varchar(16) not null,
  section    varchar(4)  not null,
  primary key (school_id, user_id, class_name, section)
);

-- Which children a parent may see. Replaces parentStudentIndex.
create table parent_students (
  user_id    uuid   not null references auth.users(id) on delete cascade,
  student_id bigint not null references students(id) on delete cascade,
  school_id  int    not null references schools(id) on delete cascade,
  relation   varchar(16),
  primary key (user_id, student_id)
);
create index parent_students_student_idx on parent_students (student_id);
```

### 4.7 Everything else

Low-volume modules — `notices`, `homework`, `transport_routes`, `transport_assignments`, `library_books`, `library_issues`, `expenses`, `leave_requests`, `admission_requests`, `certificates`, `id_cards`, `timetable` — all follow the same template:

```sql
create table <name> (
  id         bigint generated always as identity primary key,
  school_id  int not null references schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- typed columns for anything filtered or sorted on
  data       jsonb not null default '{}'::jsonb   -- everything else
);
create index <name>_school_idx on <name> (school_id, created_at desc);
```

Rule for deciding typed column vs jsonb: **if you filter, sort, or join on it, it is a column. Otherwise it is jsonb.** Certificates are the clearest case — `certificate_no`, `student_id`, `type`, `issue_date` are columns; the 40-field payload that only gets printed lives in `data`.

Audit logs get retention:

```sql
create table audit_logs (
  school_id  int not null references schools(id) on delete cascade,
  at         timestamptz not null default now(),
  actor      uuid,
  action     varchar(40) not null,
  detail     jsonb
);
create index audit_brin on audit_logs using brin (at);
-- Nightly: delete from audit_logs where at < now() - interval '90 days';
```

Unbounded audit logs are the most common way a "small" schema quietly eats a free tier.

---

## 5. Row Level Security

RLS replaces `database.rules.json` entirely. **RLS is not optional here** — with the anon key in a public SPA bundle, RLS is the only thing standing between one school and another school's data.

### 5.1 Helper functions

```sql
create or replace function current_school_id()
returns int language sql stable security definer set search_path = public as $$
  select school_id from school_members
  where user_id = (select auth.uid()) and status = 'active' limit 1;
$$;

create or replace function current_role_in_school()
returns user_role language sql stable security definer set search_path = public as $$
  select role from school_members
  where user_id = (select auth.uid()) and status = 'active' limit 1;
$$;
```

`security definer` is required so the function can read `school_members` without the policy on `school_members` recursing into itself. `stable` lets Postgres call it once per statement instead of once per row — on a 800-row roster query that is an 800x difference.

`(select auth.uid())` rather than bare `auth.uid()` — same reason. This is the single most common Supabase RLS performance mistake.

### 5.2 Tenant isolation

```sql
alter table students enable row level security;

create policy students_staff_all on students
  for all to authenticated
  using (school_id = current_school_id())
  with check (school_id = current_school_id());
```

Repeat for every school-scoped table. This one policy replaces the entire `schools/$schoolId` `.read`/`.write` block in `database.rules.json`.

### 5.3 Parent access

```sql
create policy students_parent_read on students
  for select to authenticated
  using (exists (
    select 1 from parent_students p
    where p.student_id = students.id and p.user_id = (select auth.uid())
  ));

create policy attendance_parent_read on attendance
  for select to authenticated
  using (exists (
    select 1 from parent_students p
    where p.student_id = attendance.student_id and p.user_id = (select auth.uid())
  ));
```

A parent sees their own children and nothing else — enforced by the database, not by a query the client could rewrite. This is strictly stronger than the current `api/parent-portal.js` approach, which is correct today but relies on the server never making a mistake.

### 5.4 Teacher scoping — fixes the current privacy defect

```sql
create policy students_teacher_read on students
  for select to authenticated
  using (
    current_role_in_school() = 'teacher'
    and school_id = current_school_id()
    and exists (
      select 1 from teacher_classes t
      where t.user_id = (select auth.uid())
        and t.class_name = students.class_name
        and t.section = students.section
    )
  );
```

Today `TeacherApp.jsx:101` pulls every student in the school. Under this policy that query returns only the teacher's own classes — **the defect becomes structurally impossible**, regardless of what the client asks for.

### 5.5 Super admin

Keep the super admin out of RLS entirely. It uses the **service role key**, server-side only, in a Vercel function. The service role key must never reach the browser bundle. `SuperAdminApp.jsx` becomes a thin client over a serverless endpoint.

---

## 6. Storage and auth

**Photos never go in the database.** Bucket layout:

```
school-assets/{school_id}/logo.webp | seal.webp | signature.webp
student-photos/{school_id}/{student_id}.webp
staff-photos/{school_id}/{staff_id}.webp
documents/{school_id}/{student_id}/{type}.pdf
```

The DB stores only the path. Keep the existing client-side compression (`src/student-photos.js`) — it is what makes ~30 KB/photo achievable, and losing it would blow the 1 GB storage limit at ~10 schools instead of ~40.

Storage RLS policy:

```sql
create policy student_photos_school_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = current_school_id()::text
  );
```

**Auth migration is the hard part.** Firebase password hashes (`scrypt` with Firebase's parameters) cannot be moved into Supabase Auth. Three user classes, three answers:

- **School owners/admins** (few) — create accounts manually, force a password reset by email.
- **Teachers** (tens per school) — invite flow, set password on first login.
- **Parents** (hundreds per school) — they currently log in with school code + phone + DOB-as-default-password. This is the same mechanism as the **known parent reset security hole**. Migration is the natural moment to replace it with a proper OTP or emailed magic link. Do not port the hole across.

---

## 7. Capacity — full working

### 7.1 Free tier limits

| Limit | Free | Pro ($25/mo) |
|---|---|---|
| Database | 500 MB | 8 GB |
| File storage | 1 GB | 100 GB |
| Egress / month | 5 GB | 250 GB |
| Monthly active users | 50,000 | 100,000 |
| Projects per org | 2 | unlimited |
| **Pauses after 7 days idle** | **yes** | no |

### 7.2 Row-size arithmetic

Postgres per-row cost = 23-byte tuple header + data + 8-byte alignment padding + 4-byte item pointer. Each btree index adds roughly 30-40 bytes per row at typical fill factor.

| Table | Data | Row total | Index | **Per row** |
|---|---|---|---|---|
| `attendance` | 28 B | 60 B | 34 B (PK) + BRIN ~0 | **~95 B** |
| `marks` | 26 B | 58 B | ~36 B | **~95 B** |
| `fee_receipts` | ~70 B | ~105 B | ~70 B (2 idx) | **~175 B** |
| `students` | ~900 B | ~950 B | ~80 B | **~1 KB** |

### 7.3 Per school per year, 800 students, 220 working days

| Component | Rows/year | Full attendance | Absence-only |
|---|---|---|---|
| Attendance facts | 176,000 → 10,600 | 16.7 MB | 1.0 MB |
| `attendance_days` | — → 6,600 | — | 0.5 MB |
| Marks (8 subj × 3 exams) | 19,200 | 1.8 MB | 1.8 MB |
| Fee receipts + lines | 9,600 + 28,800 | 2.5 MB | 2.5 MB |
| Students | 800 | 0.9 MB | 0.9 MB |
| Everything else + capped audit | — | 2.0 MB | 2.0 MB |
| **Total** | | **~24 MB** | **~8.7 MB** |

Absence rate assumed 6%. At 10% the absence-only figure rises to ~9.5 MB — still an order of magnitude better.

### 7.4 Usable database space

500 MB is **not** all yours. Supabase's own `auth`, `storage`, `realtime`, and `_analytics` schemas plus the Postgres catalogs occupy **~40-60 MB** on a fresh project. Leave 15% headroom for autovacuum lag and index bloat.

**Usable ≈ 500 − 55 − 65 = ~380 MB.**

### 7.5 The three ceilings

| Constraint | Full attendance | Absence-only |
|---|---|---|
| **DB size** (380 MB usable) | 380 / 24 = **15 schools** | 380 / 8.7 = **43 schools** |
| **Egress** (5 GB/mo, ~130 MB per school/mo) | **38 schools** | **38 schools** |
| **Storage** (1 GB, 800 × 30 KB = 24 MB/school) | **41 schools** | **41 schools** |
| **MAU** (50,000; ~830 users/school) | 60 schools | 60 schools |

Read the columns, not the rows:

- **Full attendance → DB size binds at ~15 schools.**
- **Absence-only → the three limits converge at 38-43.**

That convergence is the real finding. **~40 schools is the hard ceiling of the Supabase free tier for this app**, and no further schema optimization moves it, because past that point bandwidth and photo storage bind instead of DB size. Optimizing beyond absence-only attendance is wasted effort.

### 7.6 Multi-year

Year 2 roughly doubles the accumulated data. At 15 schools on full attendance you hit the wall inside year 2. Mitigations, in order of preference:

1. Archive prior-year attendance to a Storage-hosted Parquet/CSV per school, delete the rows. Certificates and report cards already store their own snapshots, so history stays printable.
2. Move to Pro. 8 GB ÷ 24 MB = **~330 school-years**.

### 7.7 Honest caveat

**These are estimates from schema arithmetic, not measurements.** Real numbers can move 1.5-2x on: how many indexes actually get added during development, real text field lengths (Indian addresses run long), autovacuum lag under load, and TOAST behaviour on the jsonb columns.

The only way to get a real number is to measure:

```sql
-- After seeding one full school-year
select pg_size_pretty(pg_database_size(current_database()));
select relname, pg_size_pretty(pg_total_relation_size(c.oid)) as total
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;
```

A seed script generating one 800-student school-year is ~150 lines and would replace every estimate in §7 with a fact. Worth writing before committing to the migration.

---

## 8. Migration sequence

**Governing rule: live client data must never be lost or overwritten. Every step below is additive or reversible.**

| Phase | Work | Risk |
|---|---|---|
| 0 | Seed script + measure real `pg_database_size()` (§7.7) | none |
| 1 | Create Supabase project, apply DDL, apply RLS, write policy tests | none — RTDB untouched |
| 2 | One-way export script: RTDB JSON → Postgres. Run against a **copy**. Reconcile row counts per table per school. | none |
| 3 | Data-access layer: replace `databaseRequest`/`listen` in `App.jsx` with a `supabase-js` module exposing the **same function signatures**. Keep `studentFromRow` (`App.jsx:2082`) unchanged — it is the compatibility layer. | high, contained |
| 4 | Auth migration (§6). Owners manual, teachers invited, parents OTP. | high |
| 5 | Photos: Storage-to-Storage copy. Dual-read (Supabase path, fall back to RTDB base64) during transition. | low |
| 6 | Run both stacks in parallel for one full month. RTDB stays authoritative; Supabase shadow-writes. Diff daily. | low |
| 7 | Cutover on a weekend. Keep the RTDB project **read-only, not deleted**, for 90 days. | medium |

Phase 3 is the bulk of the effort. Realistic estimate for one developer: **3-5 weeks** including phase 6.

### 8.1 What breaks

- **Realtime.** RTDB listeners are how the UI stays live today. Supabase Realtime works but is a different API, and free-tier concurrent connections are capped at 200. Most ERP screens do not need live updates — convert them to fetch-on-mount and keep Realtime only for the attendance screen and notice badges.
- **`api/parent-portal.js`** — rewrite against Postgres; the `orderByChild().equalTo()` logic becomes a `WHERE`, and RLS makes it simpler than it is today.
- **`api/monthly-backup.js`** — becomes `pg_dump` to Storage, or just rely on Supabase's own backups (Pro only; free tier has **no automated backups** — this is a real risk worth naming).
- **`database.rules.json` and `storage.rules`** — deleted, replaced by §5.

### 8.2 Rollback

Until phase 7 completes, rollback is: stop writing to Supabase. RTDB has been authoritative the whole time. After phase 7, rollback means replaying 90 days of Supabase writes back into the read-only RTDB project — possible but painful, which is why phase 6 must not be skipped.

---

## 9. The free-tier pause problem

**A Supabase free project pauses after 7 days of inactivity.** For paying schools this is disqualifying — a school that closes for Diwali comes back to a dead ERP and a support call.

A cron ping keeps it alive, but that is working around a limit rather than respecting it. Once there is a single paying client, **Pro is mandatory**, and at that point the capacity question becomes 330+ school-years rather than 15.

Free tier is for development, demos, and the first unpaid pilots. Nothing else.

---

## 10. Recommendation

**Do not migrate now.** Three reasons:

1. **The schema is not settled.** Modules are still being added and changed. Migrating an unsettled schema means migrating twice.
2. **The current pain is fixable more cheaply.** The 6-point RTDB optimization is 1-2 days of work against 3-5 weeks for this migration.
3. **The binding limit today is Firebase's 100-connection cap, and Blaze fixes it for a few hundred rupees a month.** Set a ₹500 budget alert. That buys enough runway to reach 15-20 schools.

**Revisit this document at 15-20 schools**, when the schema has stopped moving and the effort is justified by real cost. Nothing in §4 is expected to need rewriting by then — the design is deliberately conservative.

If the migration does happen, **do phase 0 first**. One measured number beats every estimate in §7.

---

## Appendix — RTDB node → Postgres table

| RTDB | Postgres |
|---|---|
| `schools/{id}/profile` | `schools` |
| `students`, `deletedStudents` | `students` (+ `deleted_at`) |
| `attendance` | `attendance` + `attendance_days` |
| `fees`, `feeManager` | `fee_receipts` + `fee_lines` |
| `staff`, `employeeManager`, `staffAttendance` | `staff`, `staff_attendance` |
| `teachers`, `teachersIndex` | `school_members` + `teacher_classes` |
| `parents`, `parentStudentIndex` | `parent_students` (+ `auth.users`) |
| `reportExams`, `reportMarks`, `reportCards` | `exams`, `marks`, `report_cards` |
| `certificates`, `certificateCounters`, `certificateRequests` | `certificates`, `certificate_requests` |
| `studentPhotos`, `studentDocuments` | Supabase Storage + path columns |
| `schoolMembers`, `users` | `school_members` |
| `schoolCodes` | `schools.code` (unique) |
| `superAdmin` | service-role only, no table |
| `library`, `accounts`, `expenses`, `transport`, `leave`, `homework`, `notices`, `timetable`, `idCards`, `admitCards`, `enquiries`, `approvals`, `auditLogs` | one table each, §4.7 template |
| `database.rules.json` | RLS policies, §5 |
