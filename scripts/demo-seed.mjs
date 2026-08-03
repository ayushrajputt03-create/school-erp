/**
 * Landing page ke screenshots ke liye demo data.
 *
 * App demo mode me apna data localStorage se uthata hai, aur `fees` aur
 * `attendance` ki default `{}` hai — isliye khaali dashboard par sab ₹0 aur 0%
 * dikhta hai. Marketing screenshot ke liye wo bekaar hai, to yahan ek bhara
 * hua school bana dete hain.
 *
 * Saare naam banaye hue hain. Kisi asli school ka data yahan nahi aata —
 * aur aa bhi nahi sakta, kyunki ye script sirf demo mode ke localStorage me
 * likhti hai.
 *
 * PRNG seeded hai taaki har baar bilkul wahi screenshot bane; warna har capture
 * par numbers badalte aur diff me shor hota.
 */

const FIRST = ['Aarav', 'Ananya', 'Advait', 'Bhavya', 'Chirag', 'Diya', 'Eshan', 'Gauri',
  'Harsh', 'Ira', 'Ishaan', 'Kabir', 'Kavya', 'Krish', 'Meera', 'Naina', 'Nikhil', 'Ojas',
  'Pari', 'Rahul', 'Riya', 'Rohan', 'Saanvi', 'Samar', 'Tara', 'Vihaan', 'Yash', 'Zara']
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kapoor', 'Malhotra', 'Nair', 'Reddy',
  'Patel', 'Joshi', 'Mehta', 'Chauhan', 'Bansal', 'Rao', 'Iyer', 'Desai']
const CLASSES = ['5-A', '5-B', '6-A', '6-B', '7-A', '7-B', '8-A', '8-B', '9-A', '9-B', '10-A', '10-B']
const TONES = ['blue', 'violet', 'green', 'orange', 'cyan', 'pink']

/** mulberry32 — chhota deterministic PRNG */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n, w = 3) => String(n).padStart(w, '0')

// App ka dateKey() LOCAL date deta hai (toISOString se pehle timezone offset
// ghata deta hai). Seedha toISOString() lagane se IST me poori attendance ek
// din peeche shift ho jaati thi — "Present today 0%" isi wajah se aa raha tha.
const iso = (d) => {
  const local = new Date(d)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

export function buildDemoData({ count = 240, today = new Date() } = {}) {
  const rand = rng(20260804)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]

  /* students */
  const students = []
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST)
    const last = pick(LAST)
    const attendance = 78 + Math.floor(rand() * 22)
    const feeRoll = rand()
    const schemeRoll = rand()
    students.push({
      id: 1000 + i,
      name: `${first} ${last}`,
      roll: `2026-${pad(41 + i)}`,
      className: pick(CLASSES),
      guardian: `${pick(FIRST)} ${last}`,
      phone: `9${Math.floor(rand() * 900000000 + 100000000)}`.slice(0, 10),
      attendance,
      fee: feeRoll > 0.78 ? 'Pending' : feeRoll > 0.72 ? 'Overdue' : 'Paid',
      initials: (first[0] + last[0]).toUpperCase(),
      tone: pick(TONES),
      // Dashboard `!student.active` ko dropout ginta hai — ye chhoot jaye to
      // saare 240 bachche "Dropouts" me aa jaate hain.
      active: true,
      admissionType: rand() > 0.88 ? 'New' : 'Existing',
      admissionScheme: schemeRoll > 0.93 ? 'RTE' : schemeRoll > 0.86 ? 'EWS' : 'General',
    })
  }

  /* pichhle 7 din ki attendance — chart isi se bharta hai */
  const attendance = {}
  for (let back = 6; back >= 0; back--) {
    const day = new Date(today)
    day.setDate(day.getDate() - back)
    if (day.getDay() === 0) continue                       // itwaar chhutti
    const date = iso(day)
    attendance[date] = {}
    for (const s of students) {
      const roll = rand()
      attendance[date][s.id] = roll > 0.955 ? 'A' : roll > 0.93 ? 'L' : 'P'
    }
  }

  /* is mahine ki fee invoices — kuch chukti, kuch baaki
   *
   * Dashboard "Pending fees" ko har invoice ke `balance` se jodta hai aur
   * collection % = collected / (collected + pending). Sirf paid invoices
   * banane se har screenshot me "₹0 pending, 100% collected" aata tha, jo
   * na sach lagta hai na product ka kaam dikhata hai. Isliye Pending/Overdue
   * wale bachchon ke invoice bhi bante hain, balance ke saath. */
  const fees = {}
  const billingMonth = iso(today).slice(0, 7)
  students.forEach((s, i) => {
    const amount = 8500 + Math.floor(rand() * 6000)
    const isPaid = s.fee === 'Paid'
    const paidAmount = isPaid ? amount : s.fee === 'Pending' ? Math.floor(amount * 0.4) : 0
    const paidAt = today.getTime() - Math.floor(rand() * 25) * 86400000
    fees[`${s.id}_${billingMonth}`] = {
      studentId: s.id,
      studentName: s.name,
      className: s.className,
      billingMonth,
      billingPeriod: billingMonth,
      invoiceNumber: `INV-${billingMonth.replace('-', '')}-${pad(i + 1, 4)}`,
      receiptNumber: i + 1,
      amount: paidAmount,
      paidAmount,
      discount: 0,
      balance: amount - paidAmount,
      totalDue: amount,
      method: pick(['UPI', 'Cash', 'Card', 'Bank Transfer']),
      status: isPaid ? 'paid' : 'partial',
      paymentStatus: isPaid ? 'paid' : s.fee.toLowerCase(),
      paidAt,
      updatedAt: paidAt,
    }
  })

  const notices = [
    { id: 1, title: 'Parent Teacher Meeting', detail: 'Classes 6-10, Saturday at 10:00 AM', date: '08 Aug', type: 'Event', priority: 'High' },
    { id: 2, title: 'Annual Day rehearsals begin', detail: 'Selected students report to the auditorium', date: '11 Aug', type: 'Event', priority: 'Normal' },
    { id: 3, title: 'Unit Test 2 datesheet published', detail: 'Classes 5-10, starts 18 August', date: '12 Aug', type: 'Academic', priority: 'High' },
    { id: 4, title: 'Inter-house football trials', detail: 'Senior wing sports ground after school', date: '14 Aug', type: 'Sports', priority: 'Normal' },
  ]

  return { students, attendance, fees, notices }
}

/** Playwright ke addInitScript ke liye — page load se pehle localStorage bhar deta hai */
export function seedScript(data) {
  return `
    localStorage.setItem('northstar-students', ${JSON.stringify(JSON.stringify(data.students))});
    localStorage.setItem('northstar-attendance-records', ${JSON.stringify(JSON.stringify(data.attendance))});
    localStorage.setItem('northstar-fees', ${JSON.stringify(JSON.stringify(data.fees))});
    localStorage.setItem('northstar-notices', ${JSON.stringify(JSON.stringify(data.notices))});
  `
}
