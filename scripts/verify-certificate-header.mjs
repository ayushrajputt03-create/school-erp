// ============================================================
// verify-certificate-header.mjs
//
//   node scripts/verify-certificate-header.mjs
//
// Do cheezein naapta hai, dono certificate template par, chhote AUR lambe
// school naam ke saath:
//
//   1. School ka naam ek hi line me hai ya nahi  (h1 ki height / line-height)
//   2. Signature block dikh raha hai ya nahi     (line ka border + uski jagah)
//
// Ye asli CertificateManager.css load karta hai — markup wahi hai jo JSX me
// hai. Screen aur print, dono media me chalta hai, kyunki print ke @media
// block me alag font-size the aur wahin naam toot raha tha.
// ============================================================
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/CertificateManager.css', import.meta.url), 'utf8')

// JSX wala hi scale rule — dono jagah badla to test pakad lega.
const scale = (name) => {
  const n = String(name || '').trim().length
  if (n > 50) return 'name-xxl'
  if (n > 34) return 'name-xl'
  if (n > 26) return 'name-l'
  return ''
}

const NAMES = [
  ['chhota', 'Delhi Public School'],
  ['asli (Triveni)', 'TRIVENI TRIRATAN PUBLIC JR. HIGH SCHOOL'],
  ['bahut lamba', 'Shree Guru Nanak Dev Memorial Senior Secondary Public School'],
]

const tc = (name) => `<article class="formal-certificate tc-template">
  <header class="tc-school-top">
    <h1 class="${scale(name)}">${name}</h1>
    <strong>(RECOGNISED BY GOVT.)</strong>
    <p>Main Road, Kanpur, Uttar Pradesh, 208001, Ph.: 9876543210</p>
  </header>
  <div class="formal-signatures three tc-signatures">
    <div><span class="signature-line"></span><strong>(Prepared By)</strong></div>
    <div><span class="signature-line"></span><strong>(Checked By)</strong></div>
    <div class="principal-block"><span class="signature-line"></span><strong>Principal's Signature</strong><small>R. K. Sharma</small><small class="seal-placeholder">School Seal</small></div>
  </div>
</article>`

const character = (name) => `<article class="formal-certificate character-template">
  <header class="character-certificate-header ${scale(name)}">
    <div class="formal-logo character-logo"></div>
    <div class="character-school-block">
      <h1 class="${scale(name)}">${name}</h1>
      <p>Kanpur</p><small>(RECOGNISED BY GOVT.)</small>
    </div>
    <div class="formal-student-photo empty"><span>Paste Photo Here</span></div>
  </header>
  <div class="character-footer">
    <div><strong>Date: 04-08-2026</strong></div>
    <div class="principal-block character-principal"><span class="signature-line"></span><strong>${name}</strong><small>Kanpur</small><small class="signature-label">Principal's Signature</small><small class="seal-placeholder">School Seal</small></div>
  </div>
</article>`

const browser = await chromium.launch()
let pass = 0, fail = 0
const check = (label, ok, why) => ok
  ? (pass++, console.log(`  OK    ${label}`))
  : (fail++, console.log(`  FAIL  ${label}\n          ${why}`))

for (const media of ['screen', 'print']) {
  console.log(`\n=== ${media.toUpperCase()} ===`)
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
  await page.emulateMedia({ media })

  for (const [tmplName, build] of [['TC', tc], ['Character', character]]) {
    for (const [label, name] of NAMES) {
      await page.setContent(`<style>${css}</style><div style="width:794px">${build(name)}</div>`)
      const m = await page.evaluate(() => {
        const h1 = document.querySelector('h1')
        const cs = getComputedStyle(h1)
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.05
        const sig = document.querySelector('.principal-block .signature-line')
        const sigCs = sig && getComputedStyle(sig)
        const art = document.querySelector('.formal-certificate').getBoundingClientRect()
        const sigBox = sig && sig.getBoundingClientRect()
        return {
          lines: Math.round(h1.getBoundingClientRect().height / lh),
          fontSize: cs.fontSize,
          overflows: h1.scrollWidth > h1.clientWidth + 1,
          sigBorder: sigCs?.borderBottomWidth || 'none',
          sigWidth: sigBox ? Math.round(sigBox.width) : 0,
          sigInside: sigBox ? sigBox.bottom <= art.bottom + 1 : false,
        }
      })
      const tag = `${tmplName} / ${label} (${name.length} char, ${m.fontSize})`
      check(`${tag} — naam ek line me`, m.lines === 1, `${m.lines} line me toota`)
      check(`${tag} — naam box se bahar nahi gaya`, !m.overflows, 'h1 overflow kar raha hai')
      check(`${tag} — signature line dikh rahi hai`,
        parseFloat(m.sigBorder) > 0 && m.sigWidth > 40, `border=${m.sigBorder} width=${m.sigWidth}px`)
      check(`${tag} — signature page ke andar hai`, m.sigInside, 'signature certificate ke bahar nikal gaya')
    }
  }
  await page.close()
}

await browser.close()
console.log(`\n${'='.repeat(46)}\nPASS ${pass}   FAIL ${fail}`)
process.exit(fail ? 1 : 0)
