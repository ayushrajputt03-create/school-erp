/**
 * Northstar ERP — Unified Print System
 *
 * Usage:
 *   import { safePrint, printInPopup, downloadPDF } from './print-utils'
 *
 *   safePrint('.formal-certificate')                         // A4 default
 *   safePrint('.report-card-paper', { pageSize: 'A4' })      // explicit
 *   safePrint('.fee-receipt-paper', { pageSize: 'A5' })       // A5 receipt
 *   printInPopup('<table>...</table>', { title: 'Report' })   // popup window
 *   downloadPDF('.report-card-paper', 'report.pdf')           // PDF download
 */

// ─── helpers ────────────────────────────────────────────────────────

const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

async function waitImages(container) {
  const root = typeof container === 'string' ? document.querySelector(container) : container
  if (!root) return
  const imgs = [...root.querySelectorAll('img[src]')].filter(i => !i.complete || !i.naturalWidth)
  if (!imgs.length) return raf()
  await Promise.all(imgs.map(i => new Promise(done => {
    i.addEventListener('load', done, { once: true })
    i.addEventListener('error', done, { once: true })
    setTimeout(done, 1500)
  })))
  await raf()
}

let dynamicStyle = null
function injectPageRule(size = 'A4', orientation = 'portrait', margin = '10mm') {
  if (dynamicStyle) dynamicStyle.remove()
  dynamicStyle = document.createElement('style')
  dynamicStyle.id = 'erp-print-page'
  dynamicStyle.textContent = `@page{size:${size} ${orientation};margin:${margin}}`
  document.head.appendChild(dynamicStyle)
}
function removePageRule() {
  if (dynamicStyle) { dynamicStyle.remove(); dynamicStyle = null }
}

// ─── safePrint — in-page print with body class isolation ────────────

export async function safePrint(target, options = {}) {
  const {
    pageSize = 'A4',
    pageMargin = '10mm',
    orientation = 'portrait',
    delay = 0,
  } = options

  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) return

  // inject @page dynamically so it doesn't conflict with other modules
  injectPageRule(pageSize, orientation, pageMargin)

  // mark body + target
  document.body.classList.add('erp-printing')
  document.querySelectorAll('.print-target').forEach(n => n.classList.remove('print-target'))
  el.classList.add('print-target')

  const cleanup = () => {
    document.body.classList.remove('erp-printing')
    el.classList.remove('print-target')
    removePageRule()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup, { once: true })

  await waitImages(el)
  if (delay > 0) await new Promise(r => setTimeout(r, delay))

  window.print()
  setTimeout(cleanup, 3000)
}

// ─── printInPopup — open new window, write HTML, print ──────────────

export function printInPopup(html, options = {}) {
  const {
    width = 900,
    height = 900,
    pageSize = 'A4',
    pageMargin = '10mm',
    orientation = 'portrait',
    title = 'Print',
    extraCss = '',
  } = options

  const win = window.open('', '_blank', `width=${width},height=${height}`)
  if (!win) { alert('Please allow popups to print.'); return null }

  const css = `
    @page{size:${pageSize} ${orientation};margin:${pageMargin}}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #333;padding:6px 8px;font-size:11px}
    th{background:#f4f4f4;font-weight:700;text-align:left}
    @media print{body{margin:0}}
    ${extraCss}
  `
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${css}</style></head><body>${html}</body></html>`)
  win.document.close()
  setTimeout(() => { try { win.print() } catch (_) {} }, 600)
  return win
}

// ─── downloadPDF — html2canvas + jspdf ──────────────────────────────

export async function downloadPDF(target, filename = 'document.pdf', options = {}) {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    scale = 2,
    margin = 10,
  } = options

  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) return

  await waitImages(el)

  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const pdf = new jsPDF({ orientation, unit: 'mm', format: pageSize })
  const pdfW = pdf.internal.pageSize.getWidth() - margin * 2
  const pdfH = pdf.internal.pageSize.getHeight() - margin * 2
  const imgW = canvas.width
  const imgH = canvas.height
  const ratio = Math.min(pdfW / imgW, pdfH / imgH)
  const w = imgW * ratio
  const h = imgH * ratio
  const x = margin + (pdfW - w) / 2
  const y = margin

  const imgData = canvas.toDataURL('image/png')

  // single page
  if (h <= pdfH) {
    pdf.addImage(imgData, 'PNG', x, y, w, h)
  } else {
    // multi-page: slice canvas
    const pageCanvasH = pdfH / ratio
    let srcY = 0
    let page = 0
    while (srcY < imgH) {
      if (page > 0) pdf.addPage()
      const sliceH = Math.min(pageCanvasH, imgH - srcY)
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = imgW
      sliceCanvas.height = sliceH
      sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, imgW, sliceH, 0, 0, imgW, sliceH)
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', x, y, w, sliceH * ratio)
      srcY += pageCanvasH
      page++
    }
  }

  pdf.save(filename)
}
