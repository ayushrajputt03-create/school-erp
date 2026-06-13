import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = join(import.meta.dirname, 'dist')
const port = 5173
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const requested = normalize(join(root, pathname))
  let file = requested.startsWith(root) && existsSync(requested) && statSync(requested).isFile()
    ? requested
    : join(root, 'index.html')

  response.writeHead(200, {
    'Cache-Control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    'Content-Type': types[extname(file)] || 'application/octet-stream',
  })
  createReadStream(file).pipe(response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Northstar School OS: http://127.0.0.1:${port}`)
})
