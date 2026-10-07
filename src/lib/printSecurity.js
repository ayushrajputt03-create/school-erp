// Print documents are assembled by older modules as HTML strings. Parse them
// inertly, remove executable content, and detach the popup from the opener.
export function writePrintDocument(popup, html) {
  if (!popup) return
  const autoPrint = /<script\b[\s\S]*?window\.print\s*\(/i.test(String(html))
  const document = new DOMParser().parseFromString(String(html), 'text/html')
  document.querySelectorAll('script,iframe,object,embed,form,base,meta[http-equiv]').forEach(node => node.remove())
  document.querySelectorAll('*').forEach(node => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.replace(/[\u0000-\u0020]/g, '').toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc' || ((name === 'href' || name === 'src' || name === 'xlink:href') &&
        (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html')))) {
        node.removeAttribute(attribute.name)
      }
    }
  })
  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https:; base-uri 'none'; form-action 'none'"
  document.head.prepend(policy)
  popup.opener = null
  popup.document.write(`<!doctype html>${document.documentElement.outerHTML}`)
  if (autoPrint) setTimeout(() => { if (!popup.closed) popup.print() }, 700)
}
