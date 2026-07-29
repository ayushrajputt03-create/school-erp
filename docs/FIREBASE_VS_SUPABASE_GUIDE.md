# Firebase → Supabase — Samajhne Wali Guide

Ye document **schema plan nahi** hai — wo alag file me hai (`SUPABASE_MIGRATION.md`).

Ye guide sirf ek kaam karti hai: **jo cheez aaj Firebase me jaise chal rahi hai, Supabase me wo bilkul kaisi dikhegi.** Har section me pehle "aaj" hai (tere apne code se), phir "kal".

Har code snippet tere hi app se liya gaya hai.

---

## 0. Ek line me farak

| | Firebase RTDB | Supabase (Postgres) |
|---|---|---|
| Data ka shape | Ek bada JSON tree | Tables, rows, columns |
| Data mangwana | Poora node utaro, JS me chhaano | SQL me jo chahiye wahi maango |
| Realtime | Har read apne aap live | Per-table on karna padta hai |
| Security | `database.rules.json` | RLS policies (SQL me) |
| Index | `.indexOn` rules me | `CREATE INDEX` |
| Auth | Firebase Auth | Supabase Auth (Postgres me hi) |
| Files | Firebase Storage | Supabase Storage (lagbhag same) |

**Sabse bada practical farak:** Firebase me tu **poora data mangwa ke JavaScript me filter karta hai**. Supabase me **database khud filter karke sirf jawaab bhejta hai**. Tera bandwidth yahi bachta hai.

---

## 1. Data ka shape

### Aaj

Tere paas ek JSON tree hai. `src/*.jsx` me kul **57 alag node** use ho rahe hain:

```
schools/{schoolId}/
  students          (38 jagah use hota hai — sabse zyada)
  profile           (23)
  parents           (18)
  homework          (12)
  attendance        (12)
  fees / feeManager (19)
  staff (8), certificates (7), transport (6),
  reportCards, reportMarks, reportExams, notices, leave,
  library, accounts, expenses, timetable, idCards, ...
```

Student ka ek record aise dikhta hai:

```json
"students": {
  "-NxAbc123": {
    "full_name": "Rahul Kumar",
    "father_name": "Suresh Kumar",
    "class": "5", "section": "A",
    "admission_number": "2024001",
    "createdAt": 1719830400000
  }
}
```

### Kal

Wahi cheez table me:

```sql
create table students (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id),
  full_name        text not null,
  father_name      text,
  class            text,
  section          text,
  admission_number text,
  created_at       timestamptz default now()
);

create index on students (school_id, class, section);
```

### Isse kya milta hai

Aaj `src/App.jsx` me student ka naam **teen naamon** se aa sakta hai — `full_name`, `name`, `fullName` — kyunki JSON kisi bhi column ko rok nahi sakta. Isi wajah se `studentFromRow()` aur `reconcileStudentIdentity()` jaise defensive function likhne pade.

Postgres me column fix hai. **Galat naam ka field ghusega hi nahi.** Ye drift wali dikkat jad se khatam ho jaati hai.

> **Dhyan de:** migration ke waqt purana data pehle **unify** karna padega — teenon naamon ko ek `full_name` me. Isiliye raw JSON dump migration se pehle lena zaroori hai.

---

## 2. Data padhna (read)

### Aaj

`src/App.jsx:88` wala helper:

```js
async function databaseRequest(path, token, options = {}) {
  const url = `${databaseUrl}/${path}.json?auth=${token}${options.query ? `&${options.query}` : ''}`
  const response = await fetch(url, { method: options.method || 'GET', ... })
  return await response.json()
}
```

Aur "5A ke bacche" nikaalne ka tareeka:

```js
const all = await databaseRequest(`schools/${schoolId}/students`, token)
const classStudents = Object.values(all).filter(s => s.class === '5' && s.section === 'A')
```

**Yahan 1000 bacche download hue, 40 kaam aaye. 960 ka bandwidth bekaar gaya.**

### Kal

```js
const { data } = await supabase
  .from('students')
  .select('id, full_name, father_name, admission_number')
  .eq('school_id', schoolId)
  .eq('class', '5')
  .eq('section', 'A')
```

**Sirf 40 row, aur sirf 4 column.** Photo, address, documents — jo screen pe dikh hi nahi raha, wo aaya hi nahi.

### Filtered query ka farak

Aaj RTDB me ek hi child pe filter lag sakta hai (`src/App.jsx:3876`):

```js
databaseRequest(`schools/${schoolId}/attendance`, token, {
  query: `orderBy="studentId"&equalTo="${studentId}"`
})
```

Do condition ek saath nahi lag sakti — isliye baaki kaam JS me hota hai.

Postgres me jitni chaho:

```js
supabase.from('attendance')
  .select('date, status')
  .eq('student_id', id)
  .gte('date', '2026-04-01')
  .lte('date', '2027-03-31')
  .order('date')
```

---

## 3. Realtime — yahan sabse zyada dhyan chahiye

### Aaj

`src/App.jsx:2766` me `listen()` helper har node pe live listener lagata hai:

```js
function listen(path, handler) {
  const r = dbRef(rtdb, path)
  onValue(r, handler, { onlyOnce: false })
  unsubs.push(() => off(r, 'value', handler))
}

listen(`schools/${schoolId}/students`, snap => setStudents(...))
```

Kul **12 listener `App.jsx` me, 4 `TeacherApp.jsx` me.**

Attendance ka listener pehle se date-bounded hai (`src/App.jsx:2777`), jo achha kaam hai — poore saal ki jagah sirf current month sunta hai.

### Kal

Supabase me **read aur realtime alag cheezein hain.** Pehle data lo, phir alag se subscribe karo:

```js
// 1. Pehla data
const { data } = await supabase.from('students').select('*').eq('school_id', schoolId)
setStudents(data)

// 2. Uske baad ke changes
const channel = supabase
  .channel('students-live')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'students', filter: `school_id=eq.${schoolId}` },
      payload => applyChange(payload))
  .subscribe()

// 3. Cleanup — bilkul aaj ke off() jaisa
return () => supabase.removeChannel(channel)
```

### Ye faayda bhi hai aur kaam bhi

**Kaam:** 16 listener haath se rewire karne padenge. Migration ke 4-5 din me ka sabse bada hissa yahi hai.

**Faayda:** Aaj har node apne aap live hai — chahe uski zaroorat ho ya na ho. Supabase me tu chunta hai ki kya live rahega. Jo cheezein live honi hi nahi chahiye (`profile`, `certificateSettings`, `idCardSettings`, `branding` — ye saal me ek baar badalte hain) unka listener hata dene se hi kaafi bandwidth bachta hai.

**Realtime kis kis pe rakhna chahiye:**

| Node | Live chahiye? | Kyun |
|---|---|---|
| `students` | Haan | Do admin ek saath kaam karte hain |
| `attendance` (current month) | Haan | Teacher mark karta hai, admin dekhta hai |
| `admissionRequests`, `leaveRequests` | Haan | Approval ka kaam hai |
| `fees` | Haan | Paise ka kaam, turant dikhna chahiye |
| `profile`, `branding`, `*Settings` | **Nahi** | Kabhi-kabhaar badalte hain, load pe padh lo |
| `deletedStudents`, `auditLogs` | **Nahi** | Module khulne pe hi mangwao |

---

## 4. Data likhna (write)

### Aaj

Attendance save karne me multi-path PATCH hota hai (`src/App.jsx:4180`):

```js
const changes = {}
Object.entries(normalizedMarks).forEach(([studentId, status]) => {
  changes[`schools/${schoolId}/attendance/${date}_${studentId}`] = {
    id: `${date}_${studentId}`, studentId, date, status, ...
  }
})
await databaseRequest('', token, { method: 'PATCH', body: changes })
```

Key `${date}_${studentId}` isliye banayi taaki dobara mark karne pe duplicate na bane.

### Kal

Wahi idempotency, Postgres ke apne tareeke se:

```sql
create unique index on attendance (school_id, student_id, date);
```

```js
await supabase.from('attendance').upsert(
  rows,
  { onConflict: 'school_id,student_id,date' }
)
```

Ek hi call, ek hi transaction. **Aur agar beech me fail hua to kuch bhi save nahi hoga** — aadha-adhoora nahi. Aaj RTDB multi-path PATCH me ye guarantee nahi hai.

---

## 5. Login / Auth

### Aaj

```js
// src/AuthScreen.jsx:96
await signInWithEmailAndPassword(auth, form.email, form.password)

// src/AuthScreen.jsx:114
await sendPasswordResetEmail(auth, form.email.trim())

// src/App.jsx:5142
onAuthStateChanged(auth, user => { ... })

// har DB call se pehle
const token = await session.getIdToken()
```

### Kal

Lagbhag copy-paste:

```js
await supabase.auth.signInWithPassword({ email, password })

await supabase.auth.resetPasswordForEmail(email)

supabase.auth.onAuthStateChange((event, session) => { ... })

// token khud lagta hai — getIdToken() ki zaroorat nahi
```

**`getIdToken()` ki 20+ call poori tarah hat jayengi.** Supabase client token khud lagata hai.

### ✅ Password reset nahi karna padega

> **Sudhaar:** is document me pehle likha tha ki har user ko password reset karna padega. **Wo galat tha.**

**Supabase Firebase ke password hash seedhe le leta hai.** Supabase Auth (GoTrue) ka `CompareHashAndPassword` hash ke prefix se pehchan leta hai — bcrypt, Argon2i/id, aur **Firebase scrypt (`$fbscrypt$`)** teenon verify kar sakta hai. User jab pehli baar login karta hai, hash apne aap bcrypt me badal jaata hai.

**User ko kuch pata bhi nahi chalega.** Wahi purana password, wahi login.

Karna sirf itna hai — Firebase Console se 4 parameter uthane hain:

`Authentication` → `Users` → upar dayein 3-dot menu → `Password hash parameters`

```
base64_signer_key
base64_salt_separator
rounds            (aam taur pe 8)
mem_cost          (aam taur pe 14)
```

Ye migration script me daal do, hash import ho jayenge.

**Iska ek bada asar hai faisle pe:** "abhi migrate karo warna baad me hazaaron parent ka password reset karna padega" — ye dalil **khatam ho gayi.** Baad me migrate karna ab utna mehnga nahi hai jitna maine pehle bataya tha.

Sources: [Supabase docs](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth) · [firebase-to-supabase tool](https://github.com/supabase-community/firebase-to-supabase/tree/main/auth) · [GoTrue password security](https://deepwiki.com/supabase/auth/9.1-password-security)

---

## 6. Security rules → RLS

### Aaj

`database.rules.json` me alag JSON language:

```json
{
  "rules": {
    "schools": {
      "$schoolId": {
        ".read": "auth != null && root.child('schools').child($schoolId)...",
        "attendance": { ".indexOn": ["date", "studentId"] }
      }
    }
  }
}
```

Dikkat ye hai ki inhe **deploy kiye bina test nahi kar sakte**, aur deployed rules ko koi CLI **padh bhi nahi sakta**. Jo abhi `.indexOn` verify karne me atka hua hai — wahi problem.

### Kal

Wahi cheez SQL me, aur normal migration file ki tarah git me:

```sql
alter table students enable row level security;

create policy "school members read own students"
on students for select
using (school_id = auth_school_id());
```

Fayde:
- Git me hai, diff dikhta hai, history rehti hai
- Local pe test kar sakta hai
- Index bhi normal SQL: `create index on attendance (school_id, date)` — aur `\d attendance` se **verify** ho jaata hai ki laga ya nahi

Ek bonus: aaj `src/TeacherApp.jsx:101` me teacher poore school ke students load karta hai. RLS me ye ek policy se band ho jaata hai — teacher ko sirf apni class dikhe.

---

## 7. Storage (photos, logo, documents)

### Aaj

```js
// src/App.jsx:3016
const uploaded = await uploadBytes(storageRef(storage, path), file, { contentType: 'image/jpeg' })
return { path, url: await getDownloadURL(uploaded.ref) }
```

### Kal

Bilkul wahi shape:

```js
await supabase.storage.from('student-photos').upload(path, file, { contentType: 'image/jpeg' })
const { data } = supabase.storage.from('student-photos').getPublicUrl(path)
```

**Storage sabse aasaan hissa hai** — 8-10 call hain, seedha badal jayenge. Compression ka code jaisa hai waisa rahega.

Ek zaroori baat: **photos kabhi bhi Postgres row me mat daalna.** Aaj kuch purane record me base64 photo inline padi hai (~133 KB each) — usi ko theek karne ke liye `migrateInlinePhotos` likha gaya tha. Migration ke waqt ye sab Storage me hi jayenge.

---

## 8. Attendance summary — asli optimization

Ye Firebase me bhi ho sakta tha, par Postgres me ye lagbhag muft hai.

### Dikkat

1000 bacche × 220 din = **2.2 lakh row ek saal me, ek school ki**. Dashboard ko chahiye sirf "kitne present, kitne absent" — par aaj wo poora mahina download karke JS me ginta hai.

### Ilaaj

```sql
create table attendance_summary (
  school_id  uuid,
  student_id uuid,
  month      date,          -- mahine ka pehla din
  present    int default 0,
  absent     int default 0,
  leave      int default 0,
  primary key (school_id, student_id, month)
);
```

Ek bacche ka ek mahina = **1 row**. Saal ki 220 row ki jagah 12.

Raw attendance likhte hi ye apne aap update ho — ek trigger se:

```sql
create trigger attendance_rollup
after insert or update or delete on attendance
for each row execute function refresh_attendance_summary();
```

**Kaun kya padhega:**

| Screen | Kahan se |
|---|---|
| Dashboard ke counts | `attendance_summary` |
| Report card % | `attendance_summary` |
| Parent portal ka monthly view | `attendance_summary` |
| Ek din ka register (mark/edit) | `attendance` (raw) |
| Ek bacche ka poora history | `attendance` (raw, on demand) |

Aur har saal purana raw data Storage me export karke table se hata do. Summary hamesha rahegi.

**Iska seedha asar:** free tier me 8 school ki jagah **~15 school**, aur wo bhi hamesha ke liye — har saal ghatte nahi jayenge.

---

## 9. Jo waise ka waisa rahega

Ye poori list hai — inme kuch nahi badlega:

- **Saare UI, saare module** — Admissions, Students, Fees, Certificates, Report Cards, ID Cards, Homework, Transport, Library, Accounts, Timetable, Expenses, Leave
- **Navy theme aur poora CSS** — ek line nahi badlegi
- **Saare print layout** — A4 sizing, certificates, admit cards, receipts, report cards
- **Photo compression**
- **Vite + React setup**, `src/main.jsx` ka routing
- **Vercel deployment**, `vercel.json` ke rewrites
- **Parent portal ka behaviour** — dekh section 10

Sirf **data layer** badal raha hai. Uske upar sab kuch jaisa hai waisa.

---

## 10. Parent portal — yahan kuch nahi badlega

Ye check kiya gaya tha. `src/ParentPortal.jsx` me **ek bhi live listener nahi hai** — sirf ek fetch:

```js
// src/ParentPortal.jsx:49
const response = await fetch('/api/parent-portal', { ... })
```

Matlab **parent ko aaj bhi realtime nahi dikhta.** Fees update karega to parent ko page refresh pe hi dikhega — ye Supabase ke baad bhi bilkul waisa hi rahega.

`api/parent-portal.js` ke andar Firebase Admin ki jagah Supabase service client aa jayega. **Parent ko koi farak dikhega hi nahi** — wahi password, wahi behaviour.

---

## 11. Migration ka kram

Har step ke baad rukna hai, verify karna hai, tabhi aage.

| # | Kaam | Kaun | Kitna |
|---|---|---|---|
| 1 | **Raw JSON dump** — poora Firebase data file me | Claude | 5 min |
| 2 | Supabase project banana (credentials tere paas hi rahenge) | **Ayush** | 10 min |
| 3 | Schema + RLS + index apply | Claude | 3-4 ghante |
| 4 | Transform script — JSON → tables, naam unify | Claude | 4-5 ghante |
| 5 | Ek baar chalana, **row count milana** | Claude | 1 ghanta |
| 6 | 5 student haath se check | **Ayush** | 30 min |
| 7 | Data layer convert (`databaseRequest` → supabase) | Claude | 4-5 ghante |
| 8 | 16 listener rewire | Claude | 3-4 ghante |
| 9 | Storage call badalna | Claude | 1 ghanta |
| 10 | `npm run build` pass | Claude | — |
| 11 | **Module by module testing** | **Ayush** | 1-2 din |
| 12 | Firebase hash parameters nikaal ke dena (console se) | **Ayush** | 5 min |
| 13 | Vercel env + deploy | **Ayush** | 30 min |

**Claude: ~1.5-2 din. Ayush: ~2-3 din.** Total 4-5 din.

Step 11 ko chhota mat karna. Yahi wo step hai jo migration ko safe banata hai.

---

## 12. Kaise pata chalega ki sahi chal raha hai

### Layer 1 — Row count

Har table ka count Firebase ke count se milna chahiye. Ek bhi mismatch = ruko, dekho.

```
students     Firebase 220  →  Supabase 220  ✓
attendance   Firebase 4180 →  Supabase 4180 ✓
fees         Firebase 340  →  Supabase 340  ✓
```

### Layer 2 — 5 student haath se

Count milna kaafi **nahi** hai. 220 row aa sakti hain jinme aadhe field khaali hon. Isliye 5 bacche dono system me khol ke milao:

naam, pita ka naam, phone, class, section, admission number, photo, fees ka hisaab, attendance %

**Field drift yahin pakda jayega.**

### Layer 3 — Module chala ke dekho

- [ ] Naya student add karo
- [ ] Fee receipt banao aur print karo
- [ ] Attendance mark karo, page reload karke check karo
- [ ] Certificate print — A4 sahi aa raha hai?
- [ ] Report card print
- [ ] ID card print
- [ ] Parent login karke apne bacche ka data dekho
- [ ] Teacher login — sirf apni class dikh rahi hai?
- [ ] Backup center se export

### Sabse zaroori safety

**Ye poora testing tab hoga jab Firebase abhi bhi zinda hai, alag URL pe.** Dono side-by-side khol ke milana. Live app Firebase pe hi rahegi jab tak tu khud "haan" nahi bolta.

Aur step 1 ka JSON dump hamesha bacha rahega. **Kuch bhi ho jaye, wapas aaya ja sakta hai.**

---

## 13. Kya bura hai Supabase me — seedhi baat

Sirf achhi baatein likhna bemaani hai.

**1. Free tier 7 din me pause ho jaata hai.** Project chhua nahi to Supabase use sula deta hai. Dashboard se jagana padta hai. Development me pareshani hai; production me koi na koi roz aata hi hai to nahi hoti. Pro me ye hai hi nahi.

**2. Free tier me automatic backup nahi milta.** Ye paise se bada mudda hai. Jis din pehla paying school aayega, Pro lena chahiye — 8 GB DB ke liye nahi, **backup ke liye.**

**3. Realtime khud jodna padta hai.** Firebase me muft me milta tha. Naya feature banate waqt subscribe karna yaad rakhna padega.

**4. Migration ke baad kuch dino tak chhote bugs niklenge.** Ye normal hai. Isiliye Firebase ko turant band nahi karna — ek-do hafte dono rakhna.

**5. ~~Password reset sabko karna padega.~~** — ye galat tha, hata diya. Section 5 dekh: Firebase ke hash seedhe import ho jaate hain.

---

## 14. Kitne school chalenge — final numbers

Har school me 1000 bacche maan ke:

| | Bina optimization | Optimization ke saath |
|---|---|---|
| Free tier | ~8 school | **~15 school** |
| Pro ($25/mo) | ~40 school | **80+ school** |

Ek school ka saal bhar ka hisaab:
- Attendance (full Present/Absent/Leave): **22 MB**
- Fees: **4 MB**
- Students, staff, baaki sab: **~1 MB**
- **Kul ~26 MB per school per saal**

Free tier 500 MB, usme se ~400 MB kaam ka → **400 ÷ 26 ≈ 15 school**

**Zaroori baat:** ye numbers **poore Present/Absent/Leave** ke saath hain. Sirf absent store karke 100+ school aa jaate, par tab Leave aur Absent ka farak mit jaata aur "us din attendance li hi nahi" bhi "present" jaisa dikhta. **Percentage galat aata. Wo sauda nahi karna.**

**Egress (5 GB/month) ki chinta nahi** — kyunki:
- Ek admin optimized app pe 2-5 MB/din kha raha hai (budget 11 MB/din hai)
- Students kabhi-kabhi hi login karte hain
- MAU limit 50,000 hai, 15,000 student usme aadha bhi nahi

---

## 15. Final

**Migration tabhi karna jab 10+ school ka sach me iraada ho.**

Agar 2-3 school pe rukna hai — **Firebase pe hi raho.** Sirf mehnat hai, faayda zero.

Agar 10+ jaana hai — **abhi karo:**

| | Abhi (1 school, 220 bacche, 2 MB) | Baad me (10+ school) |
|---|---|---|
| Data | Zyadatar test data | Asli client data |
| Password reset | Koi nahi | Koi nahi |
| Waqt | 4-5 din | 1.5-2 hafte |
| Galti ka nuksan | Kuch nahi | Bahut |

*(Pehle yahan "hazaaron parent ka reset" aur "3-4 hafte" likha tha — password wali baat galat nikli, isliye baad wala kaam utna bhaari nahi hai.)*

Firebase kharab nahi hai. **Sirf 10 school pe uska Spark plan 100-connection ki deewar se takra jayega**, aur Blaze ka bill pehle se pata nahi chalta.

---

## Appendix — Quick lookup

| Aaj | Kal |
|---|---|
| `databaseRequest(path, token)` | `supabase.from(table).select()` |
| `databaseRequest(p, t, { method:'PATCH', body })` | `supabase.from(t).upsert(rows)` |
| `onValue(ref, handler)` | `supabase.channel().on('postgres_changes', ...)` |
| `off(ref, 'value', handler)` | `supabase.removeChannel(channel)` |
| `orderBy="x"&equalTo="y"` | `.eq('x', 'y')` |
| `orderBy="date"&startAt=...&endAt=...` | `.gte('date', a).lte('date', b)` |
| `signInWithEmailAndPassword()` | `supabase.auth.signInWithPassword()` |
| `sendPasswordResetEmail()` | `supabase.auth.resetPasswordForEmail()` |
| `onAuthStateChanged()` | `supabase.auth.onAuthStateChange()` |
| `session.getIdToken()` | *(zaroorat nahi)* |
| `uploadBytes(storageRef(...))` | `supabase.storage.from(b).upload()` |
| `getDownloadURL()` | `supabase.storage.from(b).getPublicUrl()` |
| `database.rules.json` | RLS policies |
| `".indexOn": ["date"]` | `create index on t (date)` |
| `Object.values(x).filter(...)` | SQL `where` |
