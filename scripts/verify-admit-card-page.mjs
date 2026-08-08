// ============================================================
// verify-admit-card-page.mjs
//
//   node scripts/verify-admit-card-page.mjs
//
// Admit card HAMESHA ek hi A4 page par aana chahiye — chahe 4 subject hon ya 20.
//
// Ye pehle toota tha: table har subject par ek row badhti hai, baaki card fixed
// height ka hai, to 10+ subject par card 277mm se bahar nikal kar doosre page
// par chala jata tha. School ko aadha-adhoora admit card mil jata aur browser
// kuch nahi batata.
//
// Sirf subject count hi khatra nahi hai — instructions ka text lamba karna,
// ya koi naya section jodna, wahi bug wapas la sakta hai. Isliye ye script
// asli values (src/lib/admitCardLayout.js) import karti hai: tiers, line-count
// logic, instructions aur print CSS. Wahan kuch badla to yahan turant dikhega.
//
// Naapta kya hai:
//   1. har subject count par card 277mm ke andar hai (5mm safety ke saath)
//   2. lambe subject naam (jo do line lete hain) par bhi fit hai
//   3. sabse chhote tier par bhi font padhne layak hai (>= 5.5pt)
//   4. tier boundaries wahi hain jo layout module kehta hai
// ============================================================
import { chromium } from 'playwright'
import {
  ADMIT_DENSITY_TIERS, ADMIT_INSTRUCTIONS, admitDensityFor, admitDensityKeyFor,
  admitInstructionLabel, admitLineCount, admitPrintCss,
} from '../src/lib/admitCardLayout.js'

let pass = 0, fail = 0
const check = (label, ok, why) => ok === true
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why ?? ok}`))

const MM_PER_PX = 25.4 / 96
// Card 190mm chauda hai aur A4 ke 297mm me se 10mm margin dono taraf jaate
// hain, to content ke liye 277mm bachta hai. 5mm safety isliye ki asli printer
// driver ka rounding browser se thoda alag padta hai (print-a4-safety wala
// sabak — exact limit par kabhi mat baithao).
const MAX_MM = 277
const SAFE_MM = MAX_MM - 5

/**
 * Card ka wahi dhaancha jo admitCardPrintHtml banata hai. Values module se
 * aati hain, sirf markup yahan hai — poora admitCardPrintHtml import nahi kar
 * sakte kyunki wo .jsx me hai aur school/student helpers par tika hai.
 */
function buildCardHtml(rows) {
  const density = admitDensityFor(admitLineCount(rows))
  const dateRowsHtml = rows.map((row, index) => `
    <tr style="${index % 2 ? 'background:#eff6ff;' : ''}">
      <td style="padding:${density.tablePad};border:1px solid #777;color:#000;">${row.subject}</td>
      <td style="padding:${density.tablePad};border:1px solid #777;color:#000;">10 Aug 2026</td>
      <td style="padding:${density.tablePad};border:1px solid #777;color:#000;">09:00 - 12:00</td>
    </tr>
  `).join('')

  const instructionsHtml = ADMIT_INSTRUCTIONS.map((text, index) => `<li style="display:grid;grid-template-columns:6mm 1fr;gap:1mm;">
    <span>${admitInstructionLabel(index)}</span><span>${text}</span>
  </li>`).join('')

  return `
    <article class="admit-card" style="width:190mm;margin:0 auto;padding:7mm;background:#fff;color:#021024;border:2px solid #000;overflow:hidden;position:relative;font-family:Arial,sans-serif;box-sizing:border-box;">
      <header class="admit-school-header" style="position:relative;z-index:6;display:grid;grid-template-columns:24mm minmax(0,1fr) 24mm;gap:5mm;align-items:center;background:#052659;color:#fff;border-bottom:2px solid #000;padding:5mm 6mm;box-sizing:border-box;">
        <div class="admit-school-logo" style="width:22mm;height:22mm;border:1px solid #fff;background:#fff;border-radius:3px;box-sizing:border-box;"></div>
        <div class="admit-school-copy" style="min-width:0;text-align:center;">
          <h1 style="margin:0 0 1.5mm;color:#fff;font-size:18pt;line-height:1.05;text-transform:uppercase;">Triveni Triratan Public Jr. High School</h1>
          <p style="display:block;margin:0 0 .8mm;color:#fff;font-size:8pt;line-height:1.2;">Main Road, Ghaziabad, Uttar Pradesh 201001</p>
          <small style="display:block;margin:0 0 .8mm;color:#fff;font-size:8pt;line-height:1.2;">Phone: 9876543210 | Email: school@example.com</small>
          <small style="display:block;margin:0;color:#fff;font-size:8pt;line-height:1.2;">Affiliation No: 123456 | School Code: TTP01</small>
        </div>
        <div class="admit-header-spacer" style="width:22mm;height:22mm;"></div>
      </header>
      <section class="admit-title-band" style="position:relative;z-index:6;display:grid;grid-template-columns:1fr 32mm;gap:7mm;align-items:center;background:#eef6ff;border-bottom:1px solid #000;padding:6mm 6mm;min-height:${density.titleMinH};box-sizing:border-box;">
        <div><h2 style="margin:0;color:#052659;font-size:24pt;letter-spacing:2.5px;">ADMIT CARD</h2><strong style="display:block;margin-top:2mm;font-size:11pt;">Annual Examination 2026-27</strong></div>
        <div class="admit-student-photo" style="width:30mm;height:38mm;justify-self:end;border:1px solid #000;background:#fff;box-sizing:border-box;"></div>
      </section>
      <section class="admit-student-grid" style="position:relative;z-index:6;display:grid;grid-template-columns:1fr 1fr;gap:2.2mm 7mm;padding:6mm 6mm 4mm;box-sizing:border-box;">
        ${['Student Name', 'Roll Number', 'Admission No', 'Father Name', 'Date of Birth', 'Class & Sec']
          .map(label => `<div style="display:grid;grid-template-columns:32mm 1fr;gap:3mm;align-items:baseline;border-bottom:1px dotted #777;padding-bottom:1.3mm;font-size:9.5pt;box-sizing:border-box;"><strong>${label}</strong><span>Sample Value</span></div>`).join('')}
        <div style="grid-column:1/-1;display:grid;grid-template-columns:32mm 1fr;gap:3mm;align-items:baseline;border-bottom:1px dotted #777;padding-bottom:1.3mm;font-size:9.5pt;box-sizing:border-box;"><strong>Exam Name</strong><span>Annual Examination 2026-27</span></div>
      </section>
      <table class="admit-date-table" style="position:relative;z-index:6;width:calc(100% - 12mm);margin:2mm 6mm 5mm;border-collapse:collapse;font-size:${density.tableFont};table-layout:fixed;">
        <thead><tr><th style="background:#052659;color:#fff;text-align:left;padding:${density.tablePad};border:1px solid #000;">Subject</th><th style="background:#052659;color:#fff;text-align:left;padding:${density.tablePad};border:1px solid #000;">Date</th><th style="background:#052659;color:#fff;text-align:left;padding:${density.tablePad};border:1px solid #000;">Time</th></tr></thead>
        <tbody>${dateRowsHtml}</tbody>
      </table>
      <section class="admit-instructions" style="position:relative;z-index:6;margin:0 6mm 5mm;padding:${density.instrPad};background:#f8fbff;border:1px solid #b9d2f0;border-radius:2mm;">
        <h3 style="margin:0 0 1.5mm;color:#000;font-size:${density.instrH3Font};">Instructions :</h3>
        <ol style="margin:0;padding:0;list-style:none;font-size:${density.instrFont};line-height:${density.instrLine};">${instructionsHtml}</ol>
      </section>
      <strong class="admit-issued" style="position:relative;z-index:6;display:block;margin:0 6mm 4mm;color:#000;font:800 9pt Arial,sans-serif;">Issued On: 07 August 2026</strong>
      <footer class="admit-signatures" style="position:relative;z-index:6;display:flex;justify-content:space-between;align-items:flex-end;gap:9mm;padding:${density.sigPad};font-size:8.8pt;">
        <div style="flex:1 1 0;min-width:0;display:grid;gap:1.5mm;text-align:center;"><span>Class Teacher</span><i style="height:${density.sigLineH};border-bottom:1px solid #000;"></i></div>
        <div style="flex:1 1 0;min-width:0;display:grid;gap:1.5mm;text-align:center;"><span>Exam Controller</span><i style="height:${density.sigLineH};border-bottom:1px solid #000;"></i></div>
        <div style="flex:1 1 0;min-width:0;display:grid;gap:1.5mm;text-align:center;"><span>Principal &amp; Stamp</span><i style="height:${density.sigLineH};border-bottom:1px solid #000;"></i></div>
      </footer>
      <div class="admit-footer-note" style="position:absolute;left:13mm;right:13mm;bottom:8mm;z-index:6;display:flex;justify-content:space-between;gap:8mm;border-top:1px solid #cbd5e1;padding-top:2mm;color:#334155;font-size:7.5pt;">
        <span>Generated by SCHOOL99</span><span>School Code: TTP01</span><span>Issue Date: 07 August 2026</span>
      </div>
    </article>
  `
}

const subjects = (n, name = i => `Subject ${i + 1}`) => Array.from({ length: n }, (_, i) => ({ subject: name(i) }))

const browser = await chromium.launch()
const page = await browser.newPage()
await page.emulateMedia({ media: 'print' })

const measure = async rows => {
  const html = `<!doctype html><html><head><style>${admitPrintCss}
    /* Card ki apni min-height 277mm hai — wo asli overflow chhupa deti hai,
       isliye naapte waqt sirf content ki height chahiye. */
    .admit-card { min-height: 0 !important; }
  </style></head><body><main class="admit-print-grid">${buildCardHtml(rows)}</main></body></html>`
  await page.setContent(html, { waitUntil: 'load' })
  const px = await page.evaluate(() => document.querySelector('.admit-card').scrollHeight)
  return px * MM_PER_PX
}

console.log('\nchhote subject naam (ek line):')
for (const n of [4, 6, 8, 10, 12, 14, 16, 18, 20]) {
  const mm = await measure(subjects(n))
  check(`${String(n).padStart(2)} subject — tier ${admitDensityKeyFor(admitLineCount(subjects(n)))}, ${mm.toFixed(1)}mm`,
    mm <= SAFE_MM, `${mm.toFixed(1)}mm > ${SAFE_MM}mm safe limit (A4 content = ${MAX_MM}mm)`)
}

console.log('\nlambe subject naam (do line lete hain):')
const longName = () => 'Environmental Science and Sustainability Studies'
for (const n of [8, 10, 12, 14]) {
  const rows = subjects(n, longName)
  const mm = await measure(rows)
  check(`${String(n).padStart(2)} lambe subject — ${admitLineCount(rows)} line, tier ${admitDensityKeyFor(admitLineCount(rows))}, ${mm.toFixed(1)}mm`,
    mm <= SAFE_MM, `${mm.toFixed(1)}mm > ${SAFE_MM}mm safe limit`)
}

console.log('\nlegibility aur tier boundaries:')
for (const [key, tier] of Object.entries(ADMIT_DENSITY_TIERS)) {
  const pt = parseFloat(tier.tableFont)
  check(`tier ${key}: table font ${tier.tableFont} padhne layak hai`, pt >= 5.5, `${pt}pt — print me itna chhota padhna mushkil`)
}
check('tier a ki seema 7 line par hai', admitDensityKeyFor(7) === 'a' && admitDensityKeyFor(8) === 'b')
check('tier e sabse aakhri hai (koi bhi bada count)', admitDensityKeyFor(999) === 'e')

await browser.close()
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} pass, ${fail} fail\n`)
process.exit(fail === 0 ? 0 : 1)
