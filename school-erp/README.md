# School ERP MVP — Setup Guide

## Kya kya milega iss ERP mein:
- ✅ Admin Login (Supabase Auth)
- ✅ Student Records (Add / Delete / Search / Filter)
- ✅ Daily Attendance (Mark Present/Absent, History)
- ✅ Fee Management (Track Paid/Pending/Overdue)
- ✅ Dashboard with stats

---

## Step 1: Supabase Setup (Free)

1. **supabase.com** pe jao, free account banao
2. "New Project" click karo
3. Project name: `school-erp`, password yaad rakho
4. Project create hone ke baad left menu mein **SQL Editor** click karo
5. `supabase_schema.sql` file ka poora content copy karo aur paste karke **Run** karo
6. **Settings > API** pe jao:
   - `Project URL` copy karo
   - `anon public` key copy karo

---

## Step 2: Code mein URL aur Key daalo

`src/lib/supabase.js` file mein:
```js
const SUPABASE_URL = 'https://TUMHARA_PROJECT.supabase.co'  // yahan daalo
const SUPABASE_ANON_KEY = 'tumhari_anon_key_yahan'  // yahan daalo
```

---

## Step 3: Project Run Karo

Computer mein Node.js install hona chahiye (nodejs.org se free mein download karo)

```bash
# Is folder mein terminal kholo aur yeh commands chalaao:
npm install
npm run dev
```

Browser mein `http://localhost:5173` khulega — ERP ready!

---

## Step 4: Vercel pe Deploy karo (Free hosting)

1. **github.com** pe free account banao
2. Is folder ko GitHub pe upload karo (New Repository > Upload files)
3. **vercel.com** pe jao, GitHub se connect karo
4. Project select karo, Deploy karo
5. Tumhara ERP live ho jayega ek free URL pe!

---

## Admin Login kaise banaye?

1. App kholo → "Account banao" click karo
2. Email aur password daalo
3. Login karo

---

## Files ka structure:
```
school-erp/
├── src/
│   ├── lib/
│   │   └── supabase.js      ← Supabase connection
│   ├── pages/
│   │   ├── Login.jsx        ← Login page
│   │   ├── Dashboard.jsx    ← Main dashboard
│   │   ├── Students.jsx     ← Student records
│   │   ├── Attendance.jsx   ← Attendance marking
│   │   └── Fees.jsx         ← Fee management
│   └── App.jsx              ← Main app with sidebar
├── supabase_schema.sql      ← Database tables
└── package.json
```

---

## School ko demo kaise dikhao?

1. Vercel URL pe apna ERP deploy karo
2. School principal ke saamne phone/laptop pe kholo
3. Live demo dikhao — student add karo, attendance mark karo, fee record karo
4. Bolo: "Yeh sirf ₹X/month mein milega, aapka data cloud mein safe rahega"

---

## Agle features (Phase 2):
- Report cards / marksheet
- Teacher login
- WhatsApp fee reminders
- Parent portal
- Monthly reports PDF
