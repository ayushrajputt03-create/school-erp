// ============================================================
// verify-print-isolation.mjs
//
//   node scripts/verify-print-isolation.mjs
//
// safePrint() ka target print par sach me dikhta hai ya nahi — yahi naapna hai.
//
// Report card blank chhap raha tha. Wajah app.css ka ye rule tha:
//
//     @media print { .page-content > *:not(.modal-backdrop){ display:none } }
//
// Ye fee receipt modal ke liye likha gaya tha, par .page-content ke HAR direct
// child par lagta hai. Report card usi ke andar inline render hota hai, aur
// .print-target par visibility:visible lagane se ancestor ka display:none kabhi
// wapas nahi aata. Certificate isliye bach gaya kyunki wo createPortal se body
// me chala jata hai — page-content ke bahar.
//
// Ye bug browser me bilkul chup hai: screen par card theek dikhta hai, pata
// tabhi chalta hai jab printer se khali kagaz nikal aaye. Isliye ye script asli
// CSS load karke, asli DOM nesting banakar, print media me naapti hai:
//
//   1. card ka koi bhi ancestor display:none nahi hai
//   2. card ki apni chaudai/unchai > 0 hai aur visible hai
//   3. card page ke upar se shuru hota hai — pehle khali page nahi aate
//   4. sidebar/header print se poori tarah hat gaye hain
//   5. bina .print-ancestor ke wahi DOM abhi bhi tuta hua hai (regression guard)
//
// Point 5 zaroori hai: agar koi kal ancestor-marking hata de, ye test turant
// bolega ki fix ab kaam nahi kar raha.
// ============================================================
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const css = ['app.css', 'print-shared.css', 'ReportCardManager.css']
  .map(name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'))
  .join('\n')

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

// Asli app shell ka dhaancha — App.jsx:5458 se mel khata hai.
const DOM = `
<div id="root">
  <div class="app-shell theme-light">
    <aside class="sidebar">sidebar links</aside>
    <main class="main-area">
      <header class="topbar">header</header>
      <div class="page-content page-enter">
        <div class="report-card-module">
          <div class="report-two-column">
            <div class="report-list">list of students</div>
            <div class="report-preview-wrap">
              <article class="report-card-paper">
                <div class="report-outer-border"><div class="report-inner-border">
                  <h2 id="card-title">REPORT CARD</h2>
                  <table class="report-card-table"><tbody><tr><td>English</td><td>90</td></tr></tbody></table>
                </div></div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.setContent(`<html><head><style>${css}</style></head><body>${DOM}</body></html>`)

// safePrint() jo karta hai, wahi yahan — target + poori ancestor chain mark karo.
const markPrint = (withAncestors) => page.evaluate(marking => {
  document.body.classList.add('erp-printing')
  document.querySelectorAll('.print-target,.print-ancestor')
    .forEach(n => n.classList.remove('print-target', 'print-ancestor'))
  const el = document.querySelector('.report-card-paper')
  el.classList.add('print-target')
  if (!marking) return
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    node.classList.add('print-ancestor')
  }
}, withAncestors)

const measure = () => page.evaluate(() => {
  const el = document.querySelector('.report-card-paper')
  const box = el.getBoundingClientRect()
  const hiddenAncestors = []
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') hiddenAncestors.push(node.className)
  }
  const gone = sel => {
    const node = document.querySelector(sel)
    return !node || getComputedStyle(node).display === 'none'
  }
  return {
    width: box.width,
    height: box.height,
    top: box.top + window.scrollY,
    display: getComputedStyle(el).display,
    visibility: getComputedStyle(el).visibility,
    titleVisible: getComputedStyle(document.getElementById('card-title')).visibility,
    hiddenAncestors,
    sidebarGone: gone('.sidebar'),
    headerGone: gone('.topbar'),
    listGone: gone('.report-list'),
  }
})

await page.emulateMedia({ media: 'print' })

// ── 1. bina fix ke: bug abhi bhi maujood hona chahiye ──────────────
await markPrint(false)
await page.waitForTimeout(80)
const broken = await measure()
check('regression guard: .print-ancestor ke bina card ab bhi chhup jaata hai',
  broken.hiddenAncestors.length > 0 || broken.height === 0,
  'app.css ka .page-content rule shayad hat gaya — tab ye guard bekaar hai, hata do')

// ── 2. fix ke saath ────────────────────────────────────────────────
await markPrint(true)
await page.waitForTimeout(80)
const fixed = await measure()

check('card ka koi ancestor display:none nahi hai',
  fixed.hiddenAncestors.length === 0, `chhupe hue: ${fixed.hiddenAncestors.join(', ')}`)
check('card ki apni jagah hai (width & height > 0)',
  fixed.width > 100 && fixed.height > 20, `${fixed.width}x${fixed.height}`)
check('card display:none nahi hai', fixed.display !== 'none', fixed.display)
check('card visible hai', fixed.visibility === 'visible', fixed.visibility)
check('card ka content bhi visible hai (sirf dabba nahi)',
  fixed.titleVisible === 'visible', fixed.titleVisible)
check('card page ke upar se shuru hota hai — pehle khali page nahi',
  fixed.top < 120, `top ${fixed.top.toFixed(0)}px — itni khali jagah matlab ek blank page pehle`)
check('sidebar print se hat gaya', fixed.sidebarGone === true)
check('header print se hat gaya', fixed.headerGone === true)
check('bagal ki student list bhi hat gayi', fixed.listGone === true)

// ── 3. screen par kuch nahi bigda ──────────────────────────────────
await page.emulateMedia({ media: 'screen' })
await page.waitForTimeout(80)
const onScreen = await measure()
check('screen par sidebar/header waise ke waise hain',
  onScreen.sidebarGone === false && onScreen.headerGone === false,
  'print ke rules screen par leak ho rahe hain')
check('screen par student list bhi dikhti hai', onScreen.listGone === false)

// ── 4. portal wala raasta (certificate / admit card) ───────────────
// Certificate createPortal se body ke neeche jata hai, #root ke bahar. Wo pehle
// bhi chhapta tha, par #root apni poori unchai ghere rehta tha. Yahan check ki
// naya rule use hatata hai aur certificate khud sahi salamat hai.
const certCss = readFileSync(new URL('../src/CertificateManager.css', import.meta.url), 'utf8')
await page.setContent(`<html><head><style>${css}\n${certCss}</style></head><body>
  ${DOM}
  <div class="certificate-preview-overlay"><div class="certificate-preview-shell">
    <button class="cert-close no-print">close</button>
    <div class="formal-certificate"><h1 id="cert-title">TRANSFER CERTIFICATE</h1></div>
  </div></div>
</body></html>`)
await page.evaluate(() => {
  document.body.classList.add('erp-printing')
  const el = document.querySelector('.certificate-preview-shell')
  el.classList.add('print-target')
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    node.classList.add('print-ancestor')
  }
})
await page.emulateMedia({ media: 'print' })
await page.waitForTimeout(80)
const cert = await page.evaluate(() => {
  const box = document.querySelector('.formal-certificate').getBoundingClientRect()
  return {
    width: box.width,
    height: box.height,
    visible: getComputedStyle(document.getElementById('cert-title')).visibility,
    rootGone: getComputedStyle(document.getElementById('root')).display === 'none',
  }
})
check('certificate abhi bhi chhapta hai (chaudai/unchai hai)',
  cert.width > 100 && cert.height > 100, `${cert.width}x${cert.height}`)
check('certificate ka text visible hai', cert.visible === 'visible', cert.visible)
check('portal print par app shell (#root) poori tarah hat gaya',
  cert.rootGone === true, '#root abhi bhi jagah ghere hue hai')

await browser.close()
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} pass, ${fail} fail\n`)
process.exit(fail === 0 ? 0 : 1)
