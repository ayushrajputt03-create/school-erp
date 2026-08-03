/**
 * Landing page ke liye product screenshots — asli app se, Playwright se.
 *
 *   npx vite --mode demo --port 5199      (ek terminal me)
 *   node scripts/capture-screens.mjs      (doosre me)
 *
 * DEMO MODE hi kyun: landing page public hai. Asli school ke dashboard ka
 * screenshot lagane ka matlab hoga 227 bachchon ke naam, admission number aur
 * fees ek marketing page par daal dena. Demo mode wahi asli UI chalata hai par
 * `seedStudents` ke nakli data ke saath — screen asli, bachche nakli.
 *
 * html2canvas se pehle koshish ki thi, par wo DOM clone karke dobara render
 * karta hai aur is app ka poora main content khaali aa raha tha. Playwright
 * asli browser se leta hai, isliye jo dikhta hai wahi milta hai.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { buildDemoData, seedScript } from './demo-seed.mjs'

const BASE = process.env.SHOT_BASE || 'http://localhost:5199'
const OUT = path.join(process.cwd(), 'public', 'screens')
fs.mkdirSync(OUT, { recursive: true })

// Landing card ka aspect ~16:10 hai, isliye 1440x900.
const VIEWPORT = { width: 1440, height: 900 }

// JPEG isliye ki ye landing page par jaate hain. PNG me har screen ~320 KB tha,
// yaani 4 screen ke 1.3 MB. Screenshot me flat UI hai, q82 par farak dikhta
// nahi aur file teen-chauthai chhoti ho jaati hai.
//
// Parent portal jaanbujh kar nahi hai: uska public page sirf login form hai,
// aur khaali form marketing me kuch nahi kehta. Parent dashboard ke liye asli
// parent ki session chahiye, jo demo mode me banti nahi.
const SHOTS = [
  { file: 'dashboard.jpg', path: '/admin', nav: 'Command Center' },
  { file: 'students.jpg', path: '/admin', nav: 'Students' },
  { file: 'attendance.jpg', path: '/admin', nav: 'Attendance' },
  // Fee Manager ka pehla tab "Submit Fee" hai, jo student chune bina khaali
  // empty-state dikhata hai. Fee Register me asli receipts ki list aati hai.
  { file: 'fees.jpg', path: '/admin', nav: 'Fee Management', tab: 'Fee Register' },
]

const browser = await chromium.launch()
// deviceScaleFactor 1.5 = 2160px chaudi. Ye sabse badi jagah (demo modal,
// ~1000px) par bhi retina ke liye kaafi hai; 2x par har file dugni thi aur
// dikhne me koi farak nahi tha.
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1.5 })

// App demo mode me localStorage se data uthata hai, aur fees/attendance ki
// default `{}` hai — bina iske har screenshot me ₹0, 0% aur khaali chart aata
// hai. Ye page load se PEHLE chalta hai, warna app khaali state pehle padh leta.
await page.addInitScript(seedScript(buildDemoData()))

const problems = []

for (const shot of SHOTS) {
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle' })

  // Demo mode me login screen nahi aani chahiye. Aa gayi to .env.demo.local me
  // VITE_USE_SUPABASE=false aur Supabase keys khaali honi chahiye.
  if (await page.getByText(/Sign in to your school account/i).count()) {
    problems.push(`${shot.file}: login screen aa gayi — demo mode chaalu nahi hai`)
    continue
  }

  if (shot.nav) {
    await page.getByRole('button', { name: shot.nav, exact: true }).first().click()
    await page.waitForTimeout(1200)
  }

  if (shot.tab) {
    const tab = page.getByRole('button', { name: shot.tab, exact: true }).first()
    if (await tab.count()) {
      await tab.click()
      await page.waitForTimeout(1000)
    } else {
      problems.push(`${shot.file}: "${shot.tab}" tab nahi mila`)
    }
  }

  // reveal/animation settle hone do
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, shot.file), type: 'jpeg', quality: 82 })

  const { size } = fs.statSync(path.join(OUT, shot.file))
  console.log(`  ${shot.file.padEnd(18)} ${(size / 1024).toFixed(0)} KB`)
}

await browser.close()

if (problems.length) {
  console.log('\nDIKKAT:')
  for (const p of problems) console.log('  ' + p)
  process.exit(1)
}
console.log(`\nSab ${OUT} me hain.`)
