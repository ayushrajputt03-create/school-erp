# Migration / Handoff Guide — NXT / Northstar School OS

> **Ye document kiske liye hai:** kisi bhi AI agent (ya developer) ke liye jise
> is app ko **naye host, naye Supabase project, ya naye machine** par shift
> karna ho. Ise upar se neeche padho. Har step ke saath verify command diya hai
> — assume mat karna, check karke aage badhna.
>
> **Sabse zaroori niyam (ise kabhi mat todna):** ye ek **live app hai jisme asli
> school, asli bachchon ka data hai.** Koi bhi cheez overwrite/delete karne se
> pehle backup lo aur dry-run dikhao. Naye field jodo, purane badlo mat.

---

## 1. App kya hai (ek nazar me)

| Cheez | Value |
|---|---|
| Frontend | **React 18 + Vite SPA** (koi Next.js nahi — path routing `src/main.jsx` me) |
| Backend data | **Supabase Postgres** (Firebase RTDB se migrate ho chuka) |
| Auth | **Supabase Auth** (email+password owner ke liye, magic-link staff ke liye) |
| File storage | **Supabase Storage** — 2 bucket: `school-assets` (public), `student-photos` (private) |
| Serverless API | **Vercel `api/*.js`** — kuch abhi bhi `firebase-admin` par (neeche §7) |
| Deploy | **Vercel**, config `vercel.json` |
| Live URL | https://northstar-school-os.vercel.app |
| Fallback switch | `VITE_USE_SUPABASE=false` karte hi app wapas Firebase par chala jaata hai |

**Design ka dil:** poora app RTDB-jaisa interface use karta hai
(`databaseRequest(path)` / `listen(path)`), aur `src/lib/dataAdapter.js` us
interface ko Supabase par translate karta hai. **168 call site hain jo is adapter
par tike hain** — inhe haath mat lagao. Naya backend chahiye to adapter badlo,
call sites nahi.

Har Postgres table me ek `source` jsonb hai jisme poora original record padha
hai — wahi "document" hai. Typed column (`class_name`, `date`...) sirf query/RLS
ke liye hain. Ye baat samajhna zaroori hai (`src/lib/nodeMap.js` ka header
padho).

---

## 2. Shift ke teen scenario — pehchano kaun sa hai

1. **Sirf naya host** (Vercel → koi aur), same Supabase → §6 (deploy) kaafi hai.
2. **Naya Supabase project** (same/naya host) → §3, §4, §5 poore karo. Ye sabse
   bada kaam hai.
3. **Naya developer machine** (same sab kuch) → §3.1 (clone + env) + `npm install`.

Neeche sab kuch scenario #2 (poora naya backend) maankar likha hai — usme baaki
dono aa jaate hain.

---

## 3. Nayi jagah setup

### 3.1 Code + tooling
```bash
git clone https://github.com/ayushrajputt03-create/school-erp.git
cd school-erp
npm install          # Windows: npm.cmd install
```
Node 18+ chahiye. Windows par shell **PowerShell** hai, par `.mjs` scripts Node
se chalti hain.

### 3.2 Naya Supabase project
1. supabase.com par naya project banao. Region soch-samajh kar (client ke paas)
   — abhi `ap-south-1` (Mumbai) hai.
2. Note kar lo: **Project URL**, **anon key**, **service_role key**, aur
   **database password** (Settings → Database).
3. `supabase/db.mjs` me `PROJECT_REF` aur `REGION` **naye project ke** daal do —
   saari `.mjs` scripts yahi se DB se judti hain.

---

## 4. Environment variables

`.env.local` banao (`.env.example` se copy karke). **Asli values kabhi commit
mat karna** — `.env*` `.gitignore` me hai, waise hi rehne do.

### Frontend (browser me jaata hai — sirf public keys)
```env
VITE_SUPABASE_URL=            # naya project URL
VITE_SUPABASE_ANON_KEY=       # anon/publishable key (service_role NAHI)
VITE_USE_SUPABASE=true        # false = Firebase par wapas
VITE_APP_ENV=production
VITE_USE_FIREBASE_STORAGE=true
```

### Backend / scripts (server par, secret)
```env
SUPABASE_URL=                 # same project URL
SUPABASE_SERVICE_ROLE_KEY=    # SIRF api/ aur scripts me, browser me kabhi nahi
SUPABASE_DB_PASSWORD=         # migrations chalane ke liye (db.mjs)
SUPABASE_DB_URL=              # optional, pooler ke bajaye seedha connection
```

### Abhi bhi Firebase par (§7 dekho — ye routes tab tak chahiye)
```env
FIREBASE_DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT_JSON=   # poora service account JSON, ek line me
RESEND_API_KEY=                  # email (backup report) — Resend
BACKUP_FROM_EMAIL=
CRON_SECRET=                     # monthly-backup cron ko protect karta hai
```

**Golden rule:** `service_role` key aur `FIREBASE_SERVICE_ACCOUNT_JSON` sirf
server-side hain. Agar ye kabhi `VITE_` prefix ke saath dikhein, ruk jao — wo
browser me leak ho jaayenge.

---

## 5. Database — schema + data (sabse nazuk hissa)

### 5.1 Schema (migrations)
`supabase/migrations/` me **31 SQL file** hain, date-order me. Ek naye project
par inhe kram se chalao. Runner repo me hai:

```bash
# ek-ek file, sabse purani se nayi tak (filename me timestamp order hai)
node supabase/apply-migration.mjs supabase/migrations/<file>.sql
```

Ya sab ek saath (bash):
```bash
for f in supabase/migrations/*.sql; do node supabase/apply-migration.mjs "$f" || break; done
```
Har file **ek transaction** me chalti hai (fail hua to kuch nahi lagta), aur
`supabase_migrations.schema_migrations` me darj hoti hai.

> **Order matter karta hai** — baad wali migrations pehle wali par tiki hain
> (RLS policies, functions). Kram mat todna.

Verify:
```sql
select count(*) from supabase_migrations.schema_migrations;   -- 31 hona chahiye
```

### 5.2 Storage buckets
Migrations me se `..._0007_storage_buckets.sql` aur `..._school_assets_...` ye
banati hain, par confirm kar lo:

| Bucket | Public? | Kya |
|---|---|---|
| `school-assets` | **public** | logo, seal, principal signature (URL seedha `<img>` me) |
| `student-photos` | **private** | bachchon ki photo — signed URL se aati hai (1 ghanta TTL) |

`student-photos` ko **kabhi public mat karna** — wo bachchon ki tasveer hai.
Path ka pehla folder school ka uuid hota hai; storage RLS usi par tiki hai.

### 5.3 Data (asli client data)
Ye guide **schema** setup karti hai, data nahi. Data do tarah se aa sakta hai:

- **Purane Supabase se naye me:** `pg_dump` / Supabase ka backup-restore. Ye
  sabse safe. Storage buckets alag se copy karne padenge (Supabase CLI ya
  `objects` table + files).
- **Firebase se (pehli baar wali migration):** `supabase/import-*.mjs` scripts
  (`import-auth`, `import-kv`, `import-photos`, `import-teachers`...) — ye ek
  baar chalti hain. Inhe dobara chalane se pehle `supabase/transform.mjs` aur
  har script ka header padho.

> **Auth ke bare me:** Firebase ke scrypt password hash Supabase me **native
> import ho jaate hain** — user ko password reset nahi karna padta. (Ye pehle
> galat samjha gaya tha; ab confirm hai.) Naye Supabase-to-Supabase shift me to
> `auth.users` bhi dump me aa jaata hai.

### 5.4 Verify data aaya
```sql
select 'schools' t, count(*) from schools
union all select 'students', count(*) from students where deleted_at is null
union all select 'app_users', count(*) from app_users
union all select 'parents', count(*) from parents;
```

---

## 6. Deploy (naya host)

### Vercel (jaisa abhi hai)
```bash
npm run build            # pehle local build green hona chahiye — hamesha
npx vercel link          # naye project se jodo
npx vercel deploy --prod --yes
```
Vercel dashboard me **saare env vars** (§4) daalna — build-time (`VITE_*`) aur
runtime (baaki) dono.

`vercel.json` me hai:
- **SPA rewrites** — har deep route `/index.html` par (SPA isi par chalta hai)
- **Cron** — `/api/monthly-backup` har mahine ki 1 taarikh 3 baje (`CRON_SECRET`
  se protected)
- **CSP headers**

### Kisi aur host par (Netlify, Cloudflare, apna server)
1. `npm run build` → `dist/` static files.
2. Host ko **SPA fallback** chahiye: har unknown route → `index.html` (warna
   deep links 404 denge).
3. **`api/*.js` Vercel serverless functions hain.** Naye host par inhe alag se
   port karna padega (Netlify Functions / Cloudflare Workers / Express server).
   Ye sirf ports hain — parent portal, teacher login, admission, backup. Bina
   inke frontend chalega par wo 4-5 feature toot jaayenge.
4. Cron (monthly backup) ko host ke apne scheduler par le jaana.

---

## 7. ⚠️ Jo abhi bhi Firebase par hai (chhupa hua trap)

Sab kuch Supabase par shift **nahi** hua. Ye 5 API routes abhi bhi
`firebase-admin` use karte hain:

```
api/admission.js
api/_admission-store.js
api/_backup-store.js
api/_parent-store.js
api/_staff-store.js
```

Iska matlab: **naye Supabase par shift karne ke baad bhi** ye routes tab tak
kaam nahi karenge jab tak inhe Supabase par port na karo. Jo feature inpar tike
hain:
- Parent portal (login + data)
- Staff/teacher login (magic-link grant)
- Public admission form
- Monthly backup email

Isliye `FIREBASE_DATABASE_URL` + `FIREBASE_SERVICE_ACCOUNT_JSON` env abhi bhi
chahiye. Agar Firebase project bhi band karna hai, to pehle in 5 routes ko
`src/lib/dataAdapter.js` jaise Supabase adapter par port karna padega — ye ek
alag, planned kaam hai, is guide ke dayre se bahar.

---

## 8. Verify checklist (shift ke baad — sab tick hone chahiye)

```
[ ] npm run build  → green (build.rollupOptions warnings theek hain)
[ ] Owner login → dashboard khulta hai, students dikhte hain
[ ] Profile screen → school ka logo dikhta hai
[ ] Ek certificate + ek report card → logo/seal dikhte hain, A4 print theek
[ ] Ek student add → save hota hai, photo upload hoti hai
[ ] Attendance mark → save, dobara load par wahi
[ ] Fee receipt → number milta hai (counter), print theek
[ ] Parent portal login (agar §7 wale routes deploy hain)
[ ] Super admin (/super-admin/login) → schools list dikhti hai
[ ] Supabase advisor: get_advisors(security) → koi naya CRITICAL nahi
```

---

## 9. Security — shift karte waqt ye galtiyan mat karna

- **`service_role` key kabhi frontend/`VITE_` me nahi.** Wo RLS bypass karti hai
  — browser me gayi to poora DB khula.
- **RLS har table par on rakho.** App multi-tenant hai; har row `school_id` se
  scoped hai aur `current_school_id()` / `is_school_admin()` functions par tiki
  hai. Naye project me migrations ye sab laati hain — chalane ke baad confirm:
  ```sql
  select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;
  -- 0 hona chahiye (har public table par RLS on)
  ```
- **`student-photos` bucket private hi rehna chahiye.**
- **`.env` / service account JSON / private key kabhi commit nahi.**
- Migration `..._fix_app_users_cross_tenant_escalation.sql` ek CRITICAL hole
  band karti hai (koi register karke doosre school ka owner nahi ban sakta) —
  ye migrations me hai, isliye naye project me apne aap lag jaayegi. Confirm:
  ```sql
  select with_check from pg_policies where tablename='app_users' and policyname='app_users_upd';
  -- isme is_school_admin() hona chahiye, sirf 'id = auth.uid()' NAHI
  ```
- Supabase dashboard → Auth → **"Leaked password protection" chaalu karo** (ye
  code/migration se nahi hota, manual toggle hai).

---

## 10. Reference — kahan kya hai

| Kaam | File |
|---|---|
| RTDB→Supabase translation | `src/lib/dataAdapter.js` |
| Node→table naksha | `src/lib/nodeMap.js` |
| Auth (login/register/signout) | `src/lib/authAdapter.js` |
| Supabase client + `useSupabase` flag | `src/lib/supabaseClient.js` |
| Migration runner | `supabase/apply-migration.mjs` |
| DB connection (scripts) | `supabase/db.mjs` (yahan PROJECT_REF/REGION) |
| Firebase→Supabase import | `supabase/import-*.mjs` |
| Main app shell | `src/App.jsx` |
| Deploy config | `vercel.json` |
| Handoff notes | `CLAUDE.md` (project instructions — pehle padho) |

**Sabse pehla kaam kisi bhi naye agent ka:** `CLAUDE.md` padho, phir ye file.
Uske baad koi bhi change karne se pehle nearby files me pattern dhundo — is
codebase me "clearly obvious" fix aksar galat hota hai.
