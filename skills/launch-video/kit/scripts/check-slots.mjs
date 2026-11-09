// Steps every frame (60 fps) of each slot card and measures where its line really is, including
// the widest item the reel rolls through; fails if anything comes within 120 px of a side.
//   node scripts/check-slots.mjs
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { SHOTS } from '../src/story.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' }
const BASE = 'http://127.0.0.1:5199'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
await context.route(`${BASE}/**`, (route) => {
  const p = new URL(route.request().url()).pathname
  if (!p.startsWith('/__v/')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' })
  const rel = p.slice(5)
  const file = rel.startsWith('three/') ? path.join(ROOT, 'node_modules', rel) : rel.startsWith('assets/') || rel === 'brand.json' ? path.join(ROOT, rel) : path.join(ROOT, 'src', rel)
  route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream', body: fs.readFileSync(file) })
})
const page = await context.newPage()
const slots = SHOTS.filter((s) => s.kind === 'slot')
await page.goto(`${BASE}/__v/page/index.html`, { waitUntil: 'load' })
await page.evaluate((s) => window.V.init(s), JSON.parse(JSON.stringify(slots)))
let bad = false
for (const shot of slots) {
  const r = await page.evaluate((sh) => {
    let lo = 1e9, hi = -1e9
    for (let f = 0; f <= Math.round((sh.end - sh.start) * 60); f++) {
      window.V.slot(f / 60, sh)
      const line = [...document.querySelectorAll('#slots .slot-card')].find((c) => c.style.display !== 'none').querySelector('.slot-line')
      const b = line.getBoundingClientRect()
      lo = Math.min(lo, b.left); hi = Math.max(hi, b.right)
    }
    return { lo, hi }
  }, JSON.parse(JSON.stringify(shot)))
  const ok = r.lo >= 120 - 0.5 && r.hi <= 1800 + 0.5
  if (!ok) bad = true
  console.log(`${shot.name}: x from ${r.lo.toFixed(1)} to ${r.hi.toFixed(1)} px (safe 120..1800) ${ok ? 'OK' : 'OUTSIDE'}`)
}
await browser.close()
process.exit(bad ? 1 : 0)
