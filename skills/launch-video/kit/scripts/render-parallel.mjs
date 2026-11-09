// Renders the video in parallel: cuts [from, to) into equal frame ranges, renders each in its
// own browser (src/record.mjs into frames/part-<i>), then merges frames and sound logs into
// one folder that scripts/assemble.sh reads. A part that starts inside a shot replays that
// shot from its start without capturing, so long shots split across workers.
//   node scripts/render-parallel.mjs [--preview] [--workers 12] [--from 0 --to 40] [--out frames/full]
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { TOTAL } from '../src/story.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const PREVIEW = process.argv.includes('--preview')
const WORKERS = Number(arg('--workers', 12))
const FROM = Number(arg('--from', 0)), TO = Number(arg('--to', TOTAL))
const OUT = path.join(ROOT, arg('--out', PREVIEW ? 'frames/preview' : 'frames/full'))
const FPS = PREVIEW ? 30 : 60

const bounds = [FROM]
for (let i = 1; i < WORKERS; i++) bounds.push(Math.round((FROM + (TO - FROM) * i / WORKERS) * FPS) / FPS)
bounds.push(TO)
const parts = bounds.slice(0, -1).map((from, i) => ({ from, to: bounds[i + 1], dir: `frames/part-${i}` }))
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true })
console.log('parts:', parts.map((p) => `${p.from}-${p.to}`).join(', '))

const run = (p) => new Promise((resolve, reject) => {
  const args = ['src/record.mjs', '--from', String(p.from), '--to', String(p.to), '--out', p.dir, ...(PREVIEW ? ['--preview'] : [])]
  const child = spawn('node', args, { cwd: ROOT })
  const log = fs.createWriteStream(path.join(ROOT, 'out', `render-${path.basename(p.dir)}.log`))
  child.stdout.pipe(log); child.stderr.pipe(log)
  child.stdout.on('data', (d) => process.stdout.write(`[${p.from}-${p.to}] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[${p.from}-${p.to}] ${d}`))
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`part ${p.from}-${p.to} exited ${code}`))))
})
await Promise.all(parts.map(run))

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
let keys = [], clicks = []
for (const p of parts) {
  const dir = path.join(ROOT, p.dir)
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.renameSync(path.join(dir, f), path.join(OUT, f))
  keys = keys.concat(JSON.parse(fs.readFileSync(path.join(dir, 'keys.json'), 'utf8')))
  clicks = clicks.concat(JSON.parse(fs.readFileSync(path.join(dir, 'clicks.json'), 'utf8')))
  fs.rmSync(dir, { recursive: true, force: true })
}
const frames = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length
fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify({ fps: FPS, from: FROM, to: TO, startFrame: Math.round(FROM * FPS) }))
fs.writeFileSync(path.join(OUT, 'keys.json'), JSON.stringify(keys.sort((a, b) => a.t - b.t)))
fs.writeFileSync(path.join(OUT, 'clicks.json'), JSON.stringify(clicks.sort((a, b) => a.t - b.t)))
const expected = Math.round(TO * FPS) - Math.round(FROM * FPS)
console.log(`merged ${frames} frames (expected ${expected}) into ${OUT}`)
if (frames !== expected) process.exit(1)
