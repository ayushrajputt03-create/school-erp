# Firebase vs Supabase — Faisla Lene Wala Analysis

**Sawaal:** Firebase pe rahun ya Supabase pe jaun?

Ye document dono ka **imaandaar** hisaab hai. Pehle donon ka sabse achha roop dikhaya gaya hai, phir numbers, phir faisla.

> **Note:** pricing May 2026 tak ki jaankari se hai. Faisla lene se pehle firebase.google.com/pricing aur supabase.com/pricing khud dekh lena — daam badalte rehte hain.

---

## 1. Firebase ka paksh — jo main pehle kam bol raha tha

Ye baatein sach hain aur inhe halka nahi lena chahiye:

**1. Migration ka kharcha zero hai.** Supabase ka 4-5 din aur uske baad 1-2 hafte ke chhote bugs — ye sab **bacha ja sakta hai** agar Firebase pe rahe. Ye koi chhoti baat nahi.

**2. Firebase me optimization abhi khatam nahi hua.** Do batch ho chuke hain (commits `fa5837c`, `2817798`). Abhi ye baaki hain:
- `fees` ka full-node listener (`src/App.jsx:2818`) — rollup + indexed query se theek hoga
- `TeacherApp.jsx:101` — poore school ke students, sirf apni class hona chahiye
- Monthly summary node — Postgres ki tarah Firebase me bhi ban sakta hai, bas haath se maintain karna padega

**Yahi asli baat hai: rollup wala 15-school ka faayda Firebase me bhi mil sakta hai.** Wo Postgres ka jaadu nahi hai — wo bas achhi data design hai. Firebase me trigger nahi hai to write ke waqt khud update karna padega, par ho sakta hai.

**3. Spark ka download quota Supabase se dugna hai** — 10 GB/month vs 5 GB.

**4. Tu Firebase jaanta hai.** 5000 line ka `App.jsx` isi ke hisaab se likha hua hai. Supabase pe naya seekhna padega, aur naye system me nayi galtiyan hoti hain.

**5. Offline support built-in hai.** Supabase me ye khud banana padta hai. Abhi zaroorat nahi, par school me internet jaata rehta hai — kabhi kaam aa sakta hai.

---

## 2. Supabase ka paksh

**1. Storage me RTDB se lagbhag 2.3x kifayti.**

Tera attendance record (`src/App.jsx:4180`) me 10-11 field hain: `id`, `studentId`, `student_id`, `class`, `section`, `date`, `status`, `statusText`, `mark`, `markedBy`.

RTDB me **har record ke saath har field ka naam bhi store hota hai.** Sirf naamon ka kharcha:

```
id(2) + studentId(9) + student_id(10) + class(5) + section(7)
+ date(4) + status(6) + statusText(10) + mark(4) + markedBy(9)
= ~66 byte, har row me, bar bar
```

Plus values (~100 byte) plus record key `2026-07-28_-NxAbc123` (~20 byte) = **~225 byte per row**.

Postgres me column naam **table me ek baar** likha jaata hai, row me nahi. Wahi data = **~100 byte** (index milakar).

**2. Report SQL me ek line hai.** "75% se kam attendance wale bacche" — Postgres me `where`. Firebase me poora node utaar ke JS me chhaanna.

**3. Field drift jad se khatam.** `full_name` / `name` / `fullName` — jiske liye `studentFromRow()` aur `reconcileStudentIdentity()` likhne pade. Postgres me galat column ghusega hi nahi.

**4. Rules test ho sakte hain.** Abhi `.indexOn` deploy hua ya nahi ye **verify hi nahi ho pa raha** — koi CLI deployed rules padh nahi sakta. SQL me `\d attendance` bata deta hai.

**5. Paid tier pe muqabla hi nahi.** Neeche dekh.

---

## 3. Numbers — 1000 bacche per school

### Free tier

| | Firebase Spark | Supabase Free |
|---|---|---|
| Database | 1 GB | 500 MB |
| Ek school ka saal | ~55 MB (fatter rows) | ~26 MB |
| **Bina rollup ke** | ~14 school-saal | ~15 school-saal |
| **Rollup ke saath** | **~8 school** (tikaau) | **~15 school** (tikaau) |
| Download/egress | 10 GB/month | 5 GB/month |
| Concurrent limit | **100** | practically koi nahi |
| Auto backup | ❌ | ❌ |

**Free tier pe muqabla utna ek-tarfa nahi hai jitna main pehle bol raha tha.** Firebase ke paas dugna download quota hai aur dugni storage. Uska nuksan sirf ye hai ki row moti hai.

### Paid tier — yahan farak khulta hai

| | Firebase Blaze | Supabase Pro |
|---|---|---|
| Model | Jitna use, utna bill | Fixed $25/month |
| Storage | $5 per GB per month | 8 GB included |
| Download | $1 per GB | 250 GB included |
| **10 school ka anumaan** | ~$24/month | **$25/month** |
| **Usi paise me kitni jagah** | 700 MB + 20 GB | **8 GB + 250 GB** |
| Bill pehle se pata? | ❌ | ✅ |

**Yahi sabse bada number hai.** Lagbhag same ~$25 me Supabase **10 guna zyada** deta hai. Aur Blaze me bill mahine ke ant me pata chalta hai — ek buggy loop ya ek galat listener, aur bill kai guna.

---

## 4. Concurrent connection — main pehle jaldbaazi kar gaya tha

Maine pehle kaha tha "10 school × 10 user = 100, deewar pe." Wo aankda dhyan se nahi lagaya tha. Theek se dekhte hain:

Ek school me ek waqt pe online:
- 2-3 admin
- 3-5 teacher (jab attendance ka time ho)
- Parents — kabhi-kabhi, tera hi kehna hai

**Peak pe ~6-8 per school.** 10 school = **60-80 concurrent.**

To 100 ki limit **10 school pe tootegi nahi — par kinare pe hogi.** Parent-teacher meeting ya result wale din, jab sab ek saath aayein, tab toot sakti hai. 15 school pe pakka tootegi.

**Sudhri hui baat:** ye deewar 10 school pe **maut nahi** hai, par **jokhim** hai. Jis din tootegi, us din users ko "connection failed" milega — aur wo din wahi hoga jis din sabse zyada traffic hai.

---

## 5. Asli faisla trajectory pe hai, technology pe nahi

| Tera raasta | Faisla | Kyun |
|---|---|---|
| **1-5 school** (side project) | **Firebase pe raho** | Migration ka faayda hi nahi. Free tier me aaram se. 4-5 din bachao. |
| **5-15 school** (chhota business) | **Toss-up, halka Supabase** | Dono chal jayenge. Supabase me sar-dard kam. |
| **15+ school** (serious business) | **Supabase, abhi** | Firebase Blaze pe paise aur uncertainty dono badhenge. |
| **Pata nahi** | **Firebase pe raho, optimize karo** | Faisla tab lo jab pata ho. Optimization dono jagah kaam aati hai. |

---

## 6. Ek teesra raasta — jo shayad sabse samajhdaari ka hai

Ye do me se ek chunne ki majboori nahi hai.

**Pehle Firebase me hi rollup + baaki optimization kar lo.** 1-2 din ka kaam hai, migration nahi.

Isse ye hoga:

1. **Firebase pe hi 8-10 school tak jagah ban jayegi** — abhi ke 4-5 se dugni
2. **Pending kaam nipat jayega** — `fees` listener, teacher scoping (jo privacy ka masla bhi hai)
3. **Data design saaf ho jayega** — aur agar baad me Supabase gaya, to **transform script aasaan ho jayega** kyunki summary pehle se bani hogi
4. **Aur sabse zaroori — faisla aage khisak jayega**, tab tak pata chal jayega ki 3 school aa rahe hain ya 30

**Iska koi nuksan nahi hai.** Ye kaam Firebase pe rahne me kaam aata hai, aur Supabase jaane me bhi kaam aata hai. Ye "waste" nahi ho sakta.

**Aur intezaar karne ka jo ek nuksan main pehle bata raha tha, wo bhi nikal gaya.** Maine likha tha ki der karne se hazaaron parent ka password reset karna padega. **Wo galat tha** — Supabase Firebase ke scrypt hash seedhe le leta hai, koi reset nahi hota (guide ka section 5 dekh).

Matlab **intezaar karne ki keemat pehle se kaafi kam hai.** Baad me migrate karna zyada data aur zyada testing ka matlab hai — par koi user-facing tamasha nahi.

---

## 7. Meri seedhi salah

**Abhi Firebase pe raho. Optimization poori karo. Migration ka faisla 2-3 mahine baad lo.**

Wajah:

1. **Abhi tera 1 school hai, 220 bacche.** Dono me se koi bhi option is size pe pareshan nahi karega. Ye faisla lene ki jaldi hai hi nahi.
2. **Baaki optimization ka faayda dono raaston me milta hai.** Wo kabhi bekaar nahi jayega.
3. **Sabse badi baat — abhi tujhe khud nahi pata ki 10 school aayenge ya nahi.** Aur pooray migration ka faisla usi ek baat pe tika hua hai.
4. **Intezaar karna ab pehle se sasta hai** — password wali dikkat hai hi nahi, to "jaldi karo" wali ghadi band ho gayi.

**Migration turant tabhi karo agar:** agle 3 mahine me 5+ school pakke hon, ya koi paying client aa raha ho (tab backup ke liye waise bhi paid plan chahiye, aur us paise me Supabase Pro zyada deta hai).

---

## 8. Trigger — kab Supabase pe jaana hai

In me se koi ek bhi ho jaye, to migrate karo:

- [ ] **5+ school** ho jayein ya 3 mahine ke andar pakke ho jayein
- [ ] Firebase RTDB storage **700 MB** paar kare (1 GB limit ka 70%)
- [ ] Users ko **"connection failed"** dikhna shuru ho (100 cap tootna)
- [ ] Pehla **paying client** aa jaye (backup zaroori ho jaye)
- [ ] Blaze ka bill **$20/month** paar kare

Har mahine ek baar Firebase console pe usage dekh lena. Ye teen minute ka kaam hai aur yahi batayega ki din kab aaya.

---

## 9. Ek line me

**Firebase kharab nahi hai — tere aaj ke size pe wo sahi choice hai.**

**Supabase behtar hai — par tab jab tu 10+ school pe pahunche.**

**Aur beech ka raasta ye hai:** Firebase pe optimization poori karo, usage har mahine dekho, aur jis din upar wala koi trigger baje us din migrate karo — jab tak users kam hain aur migration sasta hai.

Migration ki keemat waqt ke saath badhti hai. Par **aaj wo kharcha karne ki koi wajah nahi hai.**
