/**
 * Admit card ke wo naap jo tay karte hain ki card ek A4 page par aayega ya nahi.
 *
 * Alag file me isliye hain ki inhe teen jagah se padha jata hai:
 *   1. CertificateManager.jsx ka print path (admitCardPrintHtml, inline styles)
 *   2. CertificateManager.jsx ka screen preview (AdmitCardPaper, CSS classes)
 *   3. scripts/verify-admit-card-page.mjs — regression guard
 *
 * Verify script .jsx import nahi kar sakti (Node JSX nahi padhta). Agar ye
 * values wahan dobara likhi jatin to wo asli card se chupchap alag ho jatin —
 * yaani test pass hota rehta aur asli admit card do page par chhapta. Isliye
 * ek hi jagah.
 */

export const ADMIT_DENSITY_TIERS = {
  a: { max: 7, tableFont: '8pt', tablePad: '1.6mm 2.6mm', titleMinH: '38mm', instrPad: '2.6mm', instrH3Font: '9pt', instrFont: '8pt', instrLine: '1.3', sigPad: '6mm 6mm 4mm', sigLineH: '9mm' },
  b: { max: 12, tableFont: '6.8pt', tablePad: '1mm 2mm', titleMinH: '32mm', instrPad: '1.8mm', instrH3Font: '8pt', instrFont: '7pt', instrLine: '1.18', sigPad: '4mm 6mm 2.5mm', sigLineH: '7mm' },
  c: { max: 16, tableFont: '6.5pt', tablePad: '0.7mm 1.8mm', titleMinH: '25mm', instrPad: '1.4mm', instrH3Font: '7.4pt', instrFont: '6.4pt', instrLine: '1.1', sigPad: '3mm 6mm 2mm', sigLineH: '6mm' },
  d: { max: 19, tableFont: '6.3pt', tablePad: '0.55mm 1.6mm', titleMinH: '22mm', instrPad: '1.1mm', instrH3Font: '7pt', instrFont: '6.2pt', instrLine: '1.05', sigPad: '2.5mm 6mm 1.5mm', sigLineH: '5mm' },
  e: { max: Infinity, tableFont: '6pt', tablePad: '0.25mm 1.4mm', titleMinH: '18mm', instrPad: '0.9mm', instrH3Font: '6.6pt', instrFont: '5.9pt', instrLine: '1', sigPad: '2mm 6mm 1mm', sigLineH: '4mm' },
}
export const admitDensityKeyFor = subjectCount => (subjectCount <= ADMIT_DENSITY_TIERS.a.max ? 'a' : subjectCount <= ADMIT_DENSITY_TIERS.b.max ? 'b' : subjectCount <= ADMIT_DENSITY_TIERS.c.max ? 'c' : subjectCount <= ADMIT_DENSITY_TIERS.d.max ? 'd' : 'e')
export const admitDensityFor = subjectCount => ADMIT_DENSITY_TIERS[admitDensityKeyFor(subjectCount)]

export const ADMIT_SUBJECT_CHARS_PER_LINE = 46
export const admitLineCount = rows => rows.reduce((total, row) => total + Math.max(1, Math.ceil(String(row?.subject || 'Subject').length / ADMIT_SUBJECT_CHARS_PER_LINE)), 0)

export const ADMIT_INSTRUCTIONS = [
  'Permission to appear in the exam will be given to those students only, who will pay all dues and funds before examination start.',
  'All The Students are compulsory appear in this exam.',
  'You should not include in any unfair practice. If found, strict action will be taken.',
  'Carry this admit card and valid photo ID to examination center. Without it entry will be denied.',
  'No mobile phones, smartwatches, calculators allowed in exam.',
  'Follow dress code strictly.',
]
export const admitInstructionLabel = index => `(${String.fromCharCode(97 + index)})`

/** Print iframe ka poora CSS. Iframe me app ki koi doosri stylesheet nahi jati. */
export const admitPrintCss = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: #fff; }
  body { color: #021024; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .admit-print-grid { display: block; width: 100%; margin: 0; padding: 0; background: #fff; }
  .admit-card { width: 190mm; min-height: 277mm; margin: 0 auto; padding: 7mm; background: #fff; color: #021024; border: 2px solid #000; border-radius: 0; overflow: hidden; position: relative; page-break-after: always; page-break-inside: avoid; break-inside: avoid; box-shadow: none; font-family: Arial, sans-serif; letter-spacing: 0; }
  .admit-card::after { content: ""; position: absolute; inset: 3mm; border: 1px solid #000; pointer-events: none; z-index: 5; }
  .admit-card > * { position: relative; z-index: 6; }
  .admit-school-header { display: grid; grid-template-columns: 24mm minmax(0, 1fr) 24mm; gap: 5mm; align-items: center; background: #052659; color: #fff; border-bottom: 2px solid #000; padding: 5mm 6mm; }
  .admit-school-logo { width: 22mm; height: 22mm; border: 1px solid #fff; background: #fff; border-radius: 3px; display: grid; place-items: center; overflow: hidden; color: #052659; }
  .admit-school-logo img { width: 100%; height: 100%; object-fit: contain; }
  .admit-school-logo span { display: grid; text-align: center; font-size: 12pt; line-height: 1; }
  .admit-school-logo small { font-size: 6pt; letter-spacing: 1px; }
  .admit-school-copy { min-width: 0; text-align: center; }
  .admit-school-copy h1 { margin: 0 0 1.5mm; color: #fff; font-size: 18pt; line-height: 1.05; text-transform: uppercase; letter-spacing: .2px; overflow-wrap: anywhere; }
  .admit-school-copy p, .admit-school-copy small { display: block; margin: 0 0 .8mm; color: #fff; font-size: 8pt; line-height: 1.2; overflow-wrap: anywhere; }
  .admit-header-spacer { width: 22mm; height: 22mm; }
  .admit-title-band { display: grid; grid-template-columns: 1fr 32mm; gap: 7mm; align-items: center; background: #eef6ff; border-bottom: 1px solid #000; padding: 6mm 6mm; min-height: 44mm; }
  .admit-title-band h2 { margin: 0; color: #052659; font-size: 24pt; letter-spacing: 2.5px; }
  .admit-title-band strong { display: block; margin-top: 2mm; color: #021024; font-size: 11pt; }
  .admit-student-photo { width: 30mm; height: 38mm; justify-self: end; border: 1px solid #000; background: #fff; display: grid; place-items: center; color: #64748b; font: 700 8pt/1.2 Arial; text-align: center; overflow: hidden; }
  .admit-student-photo img { width: 100%; height: 100%; object-fit: cover; }
  .admit-student-photo span { border: 1px dashed #777; width: calc(100% - 8px); height: calc(100% - 8px); display: grid; place-items: center; padding: 4px; }
  .admit-student-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.2mm 7mm; padding: 6mm 6mm 4mm; }
  .admit-student-grid div { display: grid; grid-template-columns: 32mm 1fr; gap: 3mm; align-items: baseline; border-bottom: 1px dotted #777; padding-bottom: 1.3mm; font-size: 9.5pt; }
  .admit-student-grid .full { grid-column: 1 / -1; }
  .admit-student-grid strong { color: #000; }
  .admit-date-table { width: calc(100% - 12mm); margin: 2mm 6mm 5mm; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
  .admit-date-table th { background: #052659; color: #fff; text-align: left; padding: 2.2mm 3mm; border: 1px solid #000; }
  .admit-date-table td { padding: 2.2mm 3mm; border: 1px solid #777; color: #000; word-break: break-word; }
  .admit-date-table tbody tr:nth-child(even) { background: #eff6ff; }
  .missing-date { color: #991b1b; font-weight: 800; font-size: 8pt; }
  .admit-date-warning { margin: -2mm 6mm 4mm; padding: 2mm 3mm; border: 1px solid #fecaca; background: #fff1f2; color: #991b1b; border-radius: 2mm; font-size: 8pt; font-weight: 800; }
  .admit-instructions { margin: 0 6mm 5mm; padding: 3.5mm; background: #f8fbff; border: 1px solid #b9d2f0; border-radius: 2mm; page-break-inside: avoid; }
  .admit-instructions h3 { margin: 0 0 1.5mm; color: #000; font-size: 9.5pt; }
  .admit-instructions ol { margin: 0; padding-left: 5mm; font-size: 8.6pt; line-height: 1.45; }
  .admit-pending-fee { display: block; margin: 0 6mm 2mm; color: #b91c1c; font-size: 9pt; }
  .admit-issued { display: block; margin: 0 6mm 4mm; color: #000; font: 800 9pt Arial, sans-serif; }
  .admit-signatures { display: flex; justify-content: space-between; align-items: flex-end; gap: 9mm; padding: 8mm 6mm 6mm; font-size: 8.8pt; page-break-inside: avoid; break-inside: avoid; }
  .admit-signatures div { flex: 1 1 0; min-width: 0; display: grid; gap: 1.5mm; text-align: center; }
  .admit-signatures i { height: 12mm; border-bottom: 1px solid #000; }
  .admit-footer-note { position: absolute; left: 13mm; right: 13mm; bottom: 8mm; z-index: 6; display: flex; justify-content: space-between; gap: 8mm; border-top: 1px solid #cbd5e1; padding-top: 2mm; color: #334155; font-size: 7.5pt; }
  @media print { .admit-card { page-break-after: always; } .admit-card:last-child { page-break-after: auto; } }
`
