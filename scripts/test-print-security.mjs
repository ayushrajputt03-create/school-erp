import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><title>Print security test</title>')
  const source = await fs.readFile(new URL('../src/lib/printSecurity.js', import.meta.url), 'utf8')
  await page.addScriptTag({ content: source.replace('export function', 'function') })
  const result = await page.evaluate(() => {
    let written = ''
    const popup = { opener: window, closed: false, print: () => {}, document: { write: html => { written = html } } }
    writePrintDocument(popup, '<html><head><title>Receipt</title><meta http-equiv="refresh" content="0;url=https://attacker.example"></head><body><h1>Student</h1><img src="data:image/png;base64,AA==" onerror="window.attack=true"><a href="java\nscript:alert(1)">Open</a><iframe srcdoc="bad"></iframe><script>window.attack=true</script><table><tr><td>100</td></tr></table></body></html>')
    const parsed = new DOMParser().parseFromString(written, 'text/html')
    return {
      detached: popup.opener === null,
      executable: parsed.querySelectorAll('script,iframe,[onerror],a[href]').length,
      policy: parsed.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
      table: parsed.querySelector('td')?.textContent,
      image: parsed.querySelector('img')?.getAttribute('src'),
    }
  })
  assert.equal(result.detached, true)
  assert.equal(result.executable, 0)
  assert.match(result.policy, /script-src 'none'/)
  assert.equal(result.table, '100')
  assert.match(result.image, /^data:image\/png/)
  console.log('PASS: print XSS stripped, opener detached, tables and raster images preserved')
} finally { await browser.close() }
