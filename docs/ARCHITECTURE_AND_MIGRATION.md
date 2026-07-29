# NXT School ERP — Architecture, Schema aur Migration ka Naksha

Ye document 4 diagram me poori tasveer deta hai:

1. **Aaj ka architecture** — code kis tarah chalta hai
2. **Code ka logic** — data andar-bahar kaise aata-jaata hai
3. **Database schema** — RTDB ke 57 node → Postgres ki tables
4. **Migration flow** — agar Supabase pe jaana ho to kis kram me

> Faisla is document ka hissa nahi hai. Uske liye [FIREBASE_VS_SUPABASE_DECISION.md](FIREBASE_VS_SUPABASE_DECISION.md) dekh.
> Line-by-line code ka farak [FIREBASE_VS_SUPABASE_GUIDE.md](FIREBASE_VS_SUPABASE_GUIDE.md) me hai.

---

## 1. Aaj ka Architecture

```mermaid
flowchart TB
    subgraph browser["BROWSER"]
        main["src/main.jsx<br/>route splitter"]
        app["src/App.jsx<br/>~5200 lines<br/>school admin shell"]
        teacher["src/TeacherApp.jsx"]
        parent["src/ParentPortal.jsx"]
        super["src/SuperAdminApp.jsx"]
        mods["Lazy modules<br/>FeeManager, CertificateManager,<br/>ReportCardManager, IDCardManager,<br/>AccountsManager, BackupCenter, ..."]
    end

    subgraph vercel["VERCEL"]
        api1["api/parent-portal.js<br/>firebase-admin"]
        api2["api/monthly-backup.js<br/>cron 0 3 1 * *"]
        static["Static SPA build<br/>+ rewrites + CSP"]
    end

    subgraph firebase["FIREBASE"]
        auth["Firebase Auth<br/>email+password, Google popup"]
        rtdb[("Realtime Database<br/>57 nodes<br/>database.rules.json")]
        storage[("Firebase Storage<br/>photos, logos, seals")]
    end

    main --> app
    main --> super
    main --> parent
    main --> teacher
    app --> mods

    app -->|"getIdToken()"| auth
    teacher -->|"getIdToken()"| auth
    super -->|"getIdToken()"| auth

    app -->|"databaseRequest REST<br/>+ 16 onValue listeners"| rtdb
    teacher -->|"4 onValue listeners"| rtdb
    mods -->|"REST"| rtdb

    app -->|"uploadBytes / getDownloadURL"| storage

    parent -->|"fetch POST<br/>ek hi call, koi listener nahi"| api1
    api1 -->|"admin SDK, rules bypass"| rtdb

    api2 -->|"poora school dump"| rtdb
    api2 -->|"Resend email"| mail["Resend<br/>backup email"]

    browser -.->|"served by"| static
```

### Padhne layak baatein

- **`src/App.jsx` hi asli app hai.** Auth, session, sidebar, dashboard, admissions, students, settings — sab isi me. Baaki manager files isi se lazy import hote hain.
- **Do raaste hain data tak** — `databaseRequest()` (ek-baar ka REST call) aur `onValue` listener (live). Dono ek hi RTDB pe.
- **Parent portal alag hai.** Wo seedhe Firebase se baat karta hi nahi — sirf `api/parent-portal.js` se. Isiliye parent ke paas **realtime hai hi nahi**, refresh pe hi update hota hai. (Ye Supabase pe jaane se badalta nahi.)
- **Super Admin console sirf Ayush ke liye hai.**

---

## 2. Code ka Logic — data andar-bahar kaise chalta hai

### 2a. Login se dashboard tak

```mermaid
sequenceDiagram
    participant U as User
    participant A as AuthScreen.jsx
    participant FA as Firebase Auth
    participant App as App.jsx
    participant DB as RTDB

    U->>A: email + password
    A->>FA: signInWithEmailAndPassword
    FA-->>A: user
    Note over App: onAuthStateChanged (App.jsx:5142) fire hota hai
    App->>FA: session.getIdToken()
    FA-->>App: JWT token
    App->>DB: databaseRequest("schools/{id}/profile", token)
    DB-->>App: school profile
    App->>App: attachListeners() — 16 onValue lagte hain
    DB-->>App: students, staff, fees, homework, ... live
    Note over App,DB: 8-second watchdog (App.jsx:2745)<br/>agar listener khaali laut aaye to REST se dobara maangta hai
    App-->>U: Dashboard
```

**Watchdog kyun hai:** ek baar Firebase SDK ka websocket flag kharab ho gaya tha aur listeners khaali data laut rahe the (commit `cea0bd3`). Ab har critical listener ke peeche 8-second ka REST fail-safe hai.

### 2b. Data access ke teen tareeke

```mermaid
flowchart LR
    subgraph code["App.jsx"]
        dr["databaseRequest(path, token, opts)<br/>App.jsx:88-106<br/>12s timeout + AbortController"]
        ls["listen(path, handler)<br/>App.jsx:2758<br/>onValue — poora node, hamesha"]
        lfd["listenFromDate(path, key, start, handler)<br/>App.jsx:2765<br/>orderByChild + startAt"]
    end

    dr -->|"GET/PATCH/PUT<br/>REST + ?auth=token"| rtdb[("RTDB")]
    ls -->|"websocket, live"| rtdb
    lfd -->|"websocket, live<br/>sirf is mahine ka"| rtdb

    note1["ye sabse mehnga hai —<br/>node jitna bada, utna egress"]
    note2["yahi optimization ka<br/>asli hathiyar hai<br/>.indexOn chahiye"]

    ls -.- note1
    lfd -.- note2
```

**Yahi egress ka poora khel hai.** `listen()` poora node kheenchta hai — 1000 students = har login pe poora students node. `listenFromDate()` sirf current month ka attendance laata hai. Optimization ka matlab hai `listen` ko `listenFromDate` ya rollup me badalna.

### 2c. Attendance — ek pooora write path

```mermaid
flowchart TB
    ui["Smart Attendance UI<br/>Present / Absent / Leave"]
    save["saveAttendance()<br/>App.jsx:4180"]
    key["key = date_studentId<br/>2026-07-28_-NxAbc123<br/>→ idempotent, dobara save<br/>se duplicate nahi banta"]
    patch["multi-path PATCH<br/>ek hi request me sab students"]
    node[("schools/{id}/attendance")]
    listener["listenFromDate('attendance','date', monthStart)"]
    dash["Dashboard counters<br/>+ % calculation"]

    ui --> save --> key --> patch --> node
    node -->|"live push"| listener --> dash
```

Har row me abhi 10 field hain: `id`, `studentId`, `student_id`, `class`, `section`, `date`, `status`, `statusText`, `mark`, `markedBy`. RTDB me **har row ke saath ye 10 naam bhi store hote hain** (~66 byte sirf naamon ka).

### 2d. Photo upload

```mermaid
flowchart LR
    file["File input"]
    comp["Canvas compression<br/>(ise kabhi mat hatana)"]
    up["uploadBytes(storageRef)"]
    url["getDownloadURL()"]
    db["RTDB me sirf URL string"]

    file --> comp --> up --> url --> db
```

**Pehle photos base64 me RTDB ke andar hi ja rahi thi** — ~133 KB per student. Wahi app ka sabse bada read tha. `migrateInlinePhotos` ne unhe Storage pe bheja. Ab RTDB me sirf URL rehta hai.

---

## 3. Database Schema — RTDB se Postgres

### 3a. Aaj ka RTDB shape

```mermaid
flowchart TB
    root["/"]
    schools["schools/{schoolId}"]
    sa["superAdmin"]

    root --> schools
    root --> sa

    schools --> p["profile"]
    schools --> st["students (38 jagah use)"]
    schools --> sub["subscription (28)"]
    schools --> par["parents (18)"]
    schools --> hw["homework (12)"]
    schools --> att["attendance (12)"]
    schools --> fm["feeManager (10) / fees (9)"]
    schools --> staff["staff (8)"]
    schools --> psi["parentStudentIndex (7)"]
    schools --> cert["certificates (7) / admissionRequests (7)"]
    schools --> rest["...aur 40 chhote node<br/>transport, library, expenses,<br/>accounts, leave, notices,<br/>reportMarks, reportExams, ..."]

    sa --> plans["plans / payments<br/>activityLog / notifications"]
```

**Kul 57 distinct node.** Har node ek JSON object hai jiski keys push-IDs hain.

### 3b. Postgres me kaisa dikhega

```mermaid
erDiagram
    schools ||--o{ students : "ke"
    schools ||--o{ staff : "ke"
    schools ||--o{ attendance : "ke"
    schools ||--o{ fees : "ke"
    schools ||--o{ parents : "ke"
    schools ||--o{ homework : "ke"
    schools ||--o{ certificates : "ke"
    students ||--o{ attendance : "ki"
    students ||--o{ fees : "ki"
    students ||--o{ attendance_summary : "ka rollup"
    parents }o--o{ students : "parent_students"

    schools {
        uuid id PK
        text name
        text code UK
        text address
        text phone
        text logo_url
        text principal_name
        jsonb settings
    }

    students {
        uuid id PK
        uuid school_id FK
        text full_name
        text admission_no
        text class
        text section
        date dob
        text photo_url
        text status
        timestamptz created_at
    }

    attendance {
        uuid id PK
        uuid school_id FK
        uuid student_id FK
        date date
        text status
        uuid marked_by
        timestamptz created_at
    }

    attendance_summary {
        uuid school_id PK
        uuid student_id PK
        text month PK
        int present
        int absent
        int leave_count
    }

    fees {
        uuid id PK
        uuid school_id FK
        uuid student_id FK
        text head
        numeric amount
        numeric paid
        text status
        date due_date
    }

    staff {
        uuid id PK
        uuid school_id FK
        text full_name
        text role
        text phone
        text photo_url
    }

    parents {
        uuid id PK
        uuid school_id FK
        text phone
        text email
        uuid auth_user_id
    }

    homework {
        uuid id PK
        uuid school_id FK
        text class
        text section
        text subject
        date assigned_on
    }

    certificates {
        uuid id PK
        uuid school_id FK
        uuid student_id FK
        text type
        text serial_no
        date issued_on
    }
```

### 3c. Do sabse zaroori design decisions

**1. `attendance` ki row patli ho jaati hai**

| | RTDB | Postgres |
|---|---|---|
| Field naam | har row me dobara | table me ek baar |
| Duplicate field | `studentId` + `student_id`, `status` + `statusText` + `mark` | ek-ek |
| Per row | ~225 byte | ~100 byte |

`class` aur `section` bhi hata sakte hain — wo `students` se join ho jaate hain.

**2. `attendance_summary` — rollup table**

```mermaid
flowchart LR
    a["attendance<br/>1 student × 220 din<br/>= 220 row/saal"]
    t["trigger<br/>after insert/update/delete"]
    s["attendance_summary<br/>1 student × 12 mahine<br/>= 12 row/saal"]
    d["Dashboard % <br/>ek chhoti si query"]

    a --> t --> s --> d
```

**Yahi 15-school wala aankda deta hai.** Purana attendance archive karke sirf summary rakho, to storage 18x kam ho jaata hai.

> **Zaroori baat:** ye Postgres ka jaadu nahi hai. **Ye Firebase me bhi ho sakta hai** — bas trigger nahi hai, to `saveAttendance()` ke waqt summary khud update karni padegi. Isiliye decision doc me kaha gaya hai ki ye kaam pehle Firebase me hi kar lo.

### 3d. RLS — rules ka Postgres wala roop

```mermaid
flowchart TB
    req["Query: select * from students"]
    jwt["JWT me school_id claim"]
    rls["RLS policy<br/>using (school_id = auth.jwt() ->> 'school_id')"]
    rows["Sirf apne school ki rows"]

    req --> jwt --> rls --> rows

    note["Ye database ke andar chalta hai.<br/>Client galat query bheje to bhi<br/>doosre school ka data nikal hi nahi sakta.<br/>TeacherApp.jsx:101 wali dikkat<br/>yahan structurally band ho jaati hai."]
    rls -.- note
```

---

## 4. Migration Flow

```mermaid
flowchart TB
    start(["Trigger baja<br/>5+ school / 700MB / paying client"])

    subgraph prep["TAIYARI — 1 din"]
        p1["Firebase JSON dump<br/>poora RTDB export"]
        p2["Supabase project banao<br/>region: Mumbai"]
        p3["Firebase console se<br/>hash parameters nikalo<br/>base64_signer_key, salt_separator,<br/>rounds=8, mem_cost=14"]
    end

    subgraph schema["SCHEMA — 1 din"]
        s1["Tables + indexes ka DDL"]
        s2["attendance_summary trigger"]
        s3["RLS policies har table pe"]
    end

    subgraph data["DATA — 1 din"]
        d1["Transform script<br/>JSON → CSV/insert<br/>field drift yahin normalize hoga"]
        d2["Auth users import<br/>scrypt hash ke saath<br/>→ koi password reset NAHI"]
        d3["Storage files copy"]
    end

    subgraph code["CODE — 2 din"]
        c1["databaseRequest → supabase client"]
        c2["onValue → channel().on(postgres_changes)"]
        c3["api/parent-portal.js → service role key"]
        c4["Auth calls swap"]
    end

    subgraph verify["JANCH — 3 gates"]
        v1["Gate 1: row counts match<br/>Firebase vs Postgres"]
        v2["Gate 2: har module kholo<br/>students, fees, attendance,<br/>certificates, report cards, ID cards"]
        v3["Gate 3: purane password se<br/>login karke dekho"]
    end

    cut["Cutover<br/>Firebase read-only,<br/>Vercel env swap, deploy"]
    keep["Firebase 30 din tak<br/>chalu rakho — rollback ke liye"]
    done(["Ho gaya"])

    start --> prep --> schema --> data --> code --> verify
    v1 --> v2 --> v3
    verify --> cut --> keep --> done

    fail["Kuch bhi gadbad?<br/>env wapas Firebase pe"]
    verify -.->|"fail"| fail
    cut -.->|"fail"| fail
```

### Kaun kya karega

| # | Kaam | Kaun | Waqt |
|---|---|---|---|
| 1 | Firebase JSON dump | Claude | 5 min |
| 2 | Supabase project + region | Ayush | 10 min |
| 3 | Hash parameters console se | Ayush | 5 min |
| 4 | Schema DDL + indexes | Claude | 3 ghante |
| 5 | Rollup trigger | Claude | 1 ghanta |
| 6 | RLS policies | Claude | 3 ghante |
| 7 | Transform script | Claude | 4 ghante |
| 8 | Auth import | Claude | 1 ghanta |
| 9 | Storage copy | Claude | 1 ghanta |
| 10 | Code swap | Claude | 2 din |
| 11 | Gate 1/2/3 janch | **Ayush** | 3 ghante |
| 12 | Vercel env + deploy | Ayush | 30 min |

**Kul: 4-5 din kaam + 1-2 hafte chhote bugs.**

### Rollback

```mermaid
flowchart LR
    v["Vercel env vars"]
    f["Firebase<br/>30 din tak chalu"]
    s["Supabase"]

    v -->|"aaj"| s
    v -.->|"env wapas paste karo<br/>~5 minute"| f
```

Cutover ke baad 30 din tak Firebase ko **mat mitana**. Rollback matlab sirf env vars wapas badalna hai — koi data restore nahi.

---

## 5. Ek nazar me — kya badlega, kya nahi

| Cheez | Aaj | Supabase pe | Farak |
|---|---|---|---|
| React components | JSX | JSX | **kuch nahi** |
| CSS / navy theme | app.css | app.css | **kuch nahi** |
| Print / A4 layout | wahi | wahi | **kuch nahi** |
| Parent portal ka feel | refresh-based | refresh-based | **kuch nahi** |
| Passwords | Firebase scrypt | wahi hash import | **kuch nahi** |
| Data read | `databaseRequest` | `supabase.from().select()` | badlega |
| Live update | `onValue` (har jagah default) | `channel()` (jahan chahiye wahin) | badlega |
| Reports | poora node + JS filter | SQL `where` | **bahut aasaan** |
| Field drift | `studentFromRow()` se sambhalna | column hi galat nahi ho sakta | **jad se khatam** |
| Multi-tenant safety | rules (verify nahi ho paate) | RLS (SQL se dikhte hain) | **behtar** |

---

## 6. Abhi kya karna chahiye

Migration ka faisla abhi nahi lena. Par **schema ka ye design Firebase me bhi laagu hota hai**:

- [ ] `attendance_summary` jaisa rollup node Firebase me banao (write ke waqt manual update)
- [ ] `TeacherApp.jsx:101` — poore school ke students hatao, sirf apni class (privacy ka masla hai, sirf perf ka nahi)
- [ ] `App.jsx:2818` — `fees` ka full-node listener → rollup + indexed query
- [ ] Attendance row se duplicate field hatao (`student_id`, `statusText`, `mark` — nayi rows me)
- [ ] Har mahine Firebase console pe usage dekho

Ye saara kaam **dono raaston me kaam aata hai.** Bekaar nahi jaayega.
