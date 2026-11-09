// Renders the video frame by frame: for each frame it advances the story to that time (clicks
// and typing in the real product happen at their scheduled frame), sets the compositor's state
// and saves a screenshot. Nothing is recorded in real time.
//
//   node src/record.mjs                  full quality: 60 fps, 3840x2160
//   node src/record.mjs --preview        30 fps, 1920x1080
//   node src/record.mjs --from 10 --to 21 --out frames/part
//
// The product: APP_URL (its origin) when set, otherwise example-app/ served in place.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { SHOTS, TOTAL } from './story.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const PREVIEW = process.argv.includes('--preview')
const FPS = Number(arg('--fps', PREVIEW ? 30 : 60))
const DPR = PREVIEW ? 1 : 2
const FROM = Number(arg('--from', 0))
const TO = Number(arg('--to', TOTAL))
const OUT = path.join(ROOT, arg('--out', PREVIEW ? 'frames/preview' : 'frames/full'))
const APP_URL = process.env.APP_URL
const BASE = APP_URL ? new URL(APP_URL).origin : 'http://127.0.0.1:5199'

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' }
const serve = (file) => ({ status: 200, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream', body: fs.readFileSync(file) })

// A second app the product opens may run on another local port; Chrome blocks such frames
// unless told not to.
const browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'] })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DPR })
// The compositor lives under /__v/ on the product's own origin, so the product frame is
// same-origin and can be driven and measured.
await context.route(`${BASE}/**`, (route) => {
  const p = new URL(route.request().url()).pathname
  if (p.startsWith('/__v/')) {
    const rel = decodeURIComponent(p.slice(5))
    const file = rel.startsWith('three/') ? path.join(ROOT, 'node_modules', rel)
      : rel.startsWith('assets/') || rel === 'brand.json' ? path.join(ROOT, rel)
      : path.join(ROOT, 'src', rel)
    return route.fulfill(serve(file))
  }
  if (APP_URL) return route.continue()
  const file = path.join(ROOT, 'example-app', p === '/' ? 'index.html' : p)
  return fs.existsSync(file) ? route.fulfill(serve(file)) : route.fulfill({ status: 404, body: '' })
})
await context.addInitScript({ path: path.join(ROOT, 'src', 'app-inject.js') })

const page = await context.newPage()
page.on('pageerror', (e) => console.error('page error:', e.message))
// The product's own CSS animations must play at natural speed, but rendering is slower than
// real time: freeze the page's animation clock and move each animation by video time instead.
const cdp = await context.newCDPSession(page)
await cdp.send('Animation.enable')
await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.0001 })
const keys = []     // every key typed on camera, video seconds (keyboard sounds)
const clicks = []   // every click on camera (mouse sound)
const appPath = APP_URL ? new URL(APP_URL).pathname + new URL(APP_URL).search : '/'
await page.goto(`${BASE}/__v/page/index.html?app=${encodeURIComponent(appPath)}`, { waitUntil: 'load' })
// Slot cards are built and measured up front, with their logos loaded.
const plain = (s) => JSON.parse(JSON.stringify(s))
await page.evaluate((slots) => window.V.init(slots), SHOTS.filter((s) => s.kind === 'slot').map(plain))
const app = page.frameLocator('#app')
const appFrame = () => page.frames().find((f) => f.name() === 'app')

// ---------- tweens ----------
const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
}
const state = {
  cam: { s: 1, cx: 960, cy: 540 },
  cursor: { x: 1100, y: 640, press: 0, visible: true },
  hl: { x: 0, y: 0, w: 0, h: 0, a: 0 },
  focus: { x: 0, y: 0, w: 0, h: 0, r: 12, a: 0, mode: 'spot' },
  scrollY: 0,
  secondY: 0,
}
let tweens = []
function tween(obj, prop, to, t0, dur, e = 'inOut') {
  tweens = tweens.filter((w) => !(w.obj === obj && w.prop === prop))
  if (dur <= 0) { obj[prop] = to; return }
  tweens.push({ obj, prop, from: obj[prop], to, t0, t1: t0 + dur, e: ease[e] })
}
function stepTweens(now) {
  for (const w of tweens) {
    const p = Math.min(1, Math.max(0, (now - w.t0) / (w.t1 - w.t0)))
    w.obj[w.prop] = w.from + (w.to - w.from) * w.e(p)
  }
  tweens = tweens.filter((w) => now < w.t1)
}

// How long a hand takes to move the pointer there: by distance, 0.45 s for a short hop up to
// 0.9 s across the screen, and never longer than the scene asked for.
function handTime(x, y, asked) {
  const dist = Math.hypot(x - state.cursor.x, y - state.cursor.y)
  return Math.min(asked, 0.45 + Math.min(1, dist / 1400) * 0.45)
}

// Window geometry (matches page.css): the product frame is 1440x760 layout px, scaled to fill
// the window's 1832x968 viewport whose top-left is at stage (44, 76).
const WIN = { left: 44, top: 76 }, APP_SCALE = 1.27222

// Where a stage point is on screen under the current camera (mirrors V.product's clamping).
function stageToScreen(x, y) {
  const s = state.cam.s, k = Math.min(1, Math.max(0, (s - 1) / 0.12))
  const L = 44 * k, T = 36 * k, R = 1920 - 44 * k, B = 1080 - 36 * k
  let tx = 960 - s * state.cam.cx, ty = 540 - s * state.cam.cy
  tx = Math.min(-L * s, Math.max(1920 - R * s, tx)); ty = Math.min(-T * s, Math.max(1080 - B * s, ty))
  return { x: tx + s * x, y: ty + s * y }
}

// A still of the product viewport for the focus veil: one frame with the camera at rest and no
// cursor or overlays, at the render's pixel ratio.
async function snapshotApp() {
  await page.evaluate((s) => window.V.product(s), { ...state, cam: { s: 1, cx: 960, cy: 540 }, cursor: { ...state.cursor, visible: false }, hl: { ...state.hl, a: 0 }, focus: { ...state.focus, a: 0 }, enter: 9, confetti: null })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const buf = await page.screenshot({ clip: { x: WIN.left, y: WIN.top, width: 1832, height: 968 }, type: 'jpeg', quality: 92 })
  await page.evaluate(([u, d]) => window.V.focusImage(u, d), ['data:image/jpeg;base64,' + buf.toString('base64'), DPR])
}

// ---------- the context a product shot's script works with ----------
function makeCtx(now) {
  const pressCursor = () => {
    clicks.push({ t })
    tween(state.cursor, 'press', 1, ctx.now(), 0.06, 'out')
    ctx.after(0.09, () => tween(state.cursor, 'press', 0, ctx.now(), 0.12, 'out'))
  }
  const ctx = {
    now,
    el: (sel) => (typeof sel === 'string' ? app.locator(sel).first() : sel),
    text: (s, opts) => app.getByText(s, { exact: true, ...opts }).first(),
    role: (r, opts) => app.getByRole(r, opts).first(),
    // An element's box in stage px.
    async box(sel) {
      const r = await ctx.el(sel).evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })
      return { x: WIN.left + r.x * APP_SCALE, y: WIN.top + r.y * APP_SCALE, w: r.w * APP_SCALE, h: r.h * APP_SCALE }
    },
    // Move the drawn cursor onto an element (fx, fy: where inside it, 0..1).
    async move(sel, dur = 0.9, { fx = 0.5, fy = 0.5, dx = 0, dy = 0 } = {}) {
      const b = await ctx.box(sel)
      ctx.moveTo(b.x + b.w * fx + dx, b.y + b.h * fy + dy, dur)
    },
    moveTo(x, y, dur = 0.9) { const d = handTime(x, y, dur); tween(state.cursor, 'x', x, ctx.now(), d); tween(state.cursor, 'y', y, ctx.now(), d) },
    park(x, y) { state.cursor.x = x; state.cursor.y = y },
    // The real mouse at a stage point, for hover effects in a page that can't be measured
    // (a chart inside the second page).
    async mouseAt(x, y) { const p = stageToScreen(x, y); await page.mouse.move(p.x, p.y, { steps: 4 }); await page.waitForTimeout(700) },
    hide(v = true) { state.cursor.visible = !v },
    // Real hover and click in the product; the drawn cursor shows the press, a click sound is
    // logged.
    async hover(sel) { await ctx.el(sel).hover({ timeout: 5000 }) },
    async click(sel) { pressCursor(); await ctx.el(sel).click({ timeout: 5000 }); await page.waitForTimeout(350) },
    tap: pressCursor,   // a press with no click in the product (a link that would open a new tab)
    async press(name) { keys.push({ t, key: name }); await page.keyboard.press(name); await page.waitForTimeout(250) },
    // Typing: characters are sent at their own frames (15 a second reads as a person typing).
    type(s, cps = 15) { typing = { text: s, i: 0, t0: ctx.now(), cps } },
    // Camera: centre a box (stage px) or an element at scale s.
    async zoom(target, s, dur = 1, e = 'inOut') {
      const b = typeof target === 'object' && 'w' in target ? target : await ctx.box(target)
      const t0 = ctx.now()
      tween(state.cam, 's', s, t0, dur, e)
      tween(state.cam, 'cx', b.x + b.w / 2, t0, dur, e)
      tween(state.cam, 'cy', b.y + b.h / 2, t0, dur, e)
    },
    full(dur = 1) { const t0 = ctx.now(); tween(state.cam, 's', 1, t0, dur); tween(state.cam, 'cx', 960, t0, dur); tween(state.cam, 'cy', 540, t0, dur) },
    async go(url) {
      await appFrame().goto(BASE + url, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)
    },
    // Scroll the product page to y (layout px) over dur seconds, on the video clock.
    scroll(y, dur = 1.25) { tween(state, 'scrollY', y, ctx.now(), dur) },
    // A second page shown in the same window (e.g. the app the product just opened).
    secondEl: (sel) => page.frameLocator('#second').locator(sel).first(),
    async loadSecond(src) { await page.evaluate((u) => window.V.loadSecond(u), src) },
    async second(on, urlText) { await page.evaluate(([o, u]) => window.V.showSecond(o, u), [on, urlText]) },
    secondScroll(y, dur = 1.25) { tween(state, 'secondY', y, ctx.now(), dur) },
    // Point at what changed: an accent wash exactly between the row's own dividers plus a thin
    // leading bar. highlight(null) fades it out.
    async highlight(target, dur = 0.35) {
      if (target === null) { tween(state.hl, 'a', 0, ctx.now(), dur); return }
      const g = await ctx.el(target).evaluate((e) => {
        const r = e.getBoundingClientRect()
        const bt = parseFloat(getComputedStyle(e).borderTopWidth) || 0
        return { x: r.x, y: r.y + bt, w: r.width, h: r.height - bt }
      })
      Object.assign(state.hl, { x: WIN.left + g.x * APP_SCALE, y: WIN.top + g.y * APP_SCALE, w: g.w * APP_SCALE, h: g.h * APP_SCALE, s: APP_SCALE })
      tween(state.hl, 'a', 1, ctx.now(), dur, 'out')
    },
    // Focus: 'spot' veils everything but the control about to be pressed; 'glass' walks
    // through a block of text one part at a time. Moving between targets slides the cut-out;
    // focus(null) fades it.
    async focus(target, { mode = 'spot', pad = 10, r = 12, dur = 0.35 } = {}) {
      if (target === null) { tween(state.focus, 'a', 0, ctx.now(), dur); return }
      const b = typeof target === 'object' && 'w' in target ? target : await ctx.box(target)
      const box = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad }
      if (state.focus.a < 0.05) await snapshotApp()
      state.focus.mode = mode; state.focus.r = r
      for (const k of ['x', 'y', 'w', 'h']) {
        if (state.focus.a < 0.05) state.focus[k] = box[k]
        else tween(state.focus, k, box[k], ctx.now(), dur)
      }
      tween(state.focus, 'a', 1, ctx.now(), dur, 'out')
    },
    confetti() { confettiAt = ctx.now() },
    // Progress the product shows (read by the product, or by mocks in app-inject.js).
    async setStage(n) { await page.evaluate((k) => { window.__stage = k }, n) },
    wait: (ms) => page.waitForTimeout(ms),
    after(dt, fn) { later.push({ at: ctx.now() + dt, fn }) },
  }
  return ctx
}
let typing = null, confettiAt = null, later = []

// ---------- frame loop ----------
let current = null, ctx = null, actions = [], t = 0, scrollShown = 0, secondShown = 0
const startF = Math.round(FROM * FPS), endF = Math.round(TO * FPS)
const products = SHOTS.filter((s) => s.kind === 'product')

// Every product shot's setup puts the product in its starting state, so a render can start at
// any time: the shot --from falls in replays from its start without capturing.
const firstF = Math.round((SHOTS.find((s) => FROM < s.end)?.start ?? 0) * FPS)
for (let f = firstF; f < endF; f++) {
  t = f / FPS
  const shot = SHOTS.find((s) => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1]
  const local = t - shot.start
  if (shot !== current) {
    current = shot
    ctx = makeCtx(() => t - shot.start)
    tweens = []; typing = null; later = []; confettiAt = null
    if (shot.kind === 'product') {
      // Each product shot opens on the whole window with the cursor showing, whatever the
      // previous shot left behind.
      Object.assign(state.cam, { s: 1, cx: 960, cy: 540 }); state.cursor.visible = true; state.cursor.press = 0
      state.scrollY = 0; state.secondY = 0; scrollShown = 0; secondShown = 0; state.hl.a = 0; state.focus.a = 0
      await page.evaluate(() => window.V.showSecond(false))
      if (shot.setup) await shot.setup(ctx)
      actions = [...shot.script].sort((a, b) => a[0] - b[0])
    }
  }
  if (shot.kind === 'product') {
    while (actions.length && actions[0][0] <= local + 1e-6) await actions.shift()[1](ctx)
    for (const l of later.filter((l) => l.at <= local)) await l.fn()
    later = later.filter((l) => l.at > local)
    if (typing) {
      const due = Math.min(typing.text.length, Math.floor((local - typing.t0) * typing.cps) + 1)
      if (due > typing.i) {
        for (const ch of typing.text.slice(typing.i, due)) keys.push({ t, key: ch })
        await page.keyboard.type(typing.text.slice(typing.i, due)); typing.i = due
      }
      if (typing.i >= typing.text.length) typing = null
    }
    stepTweens(local)
  }
  // Before --from nothing is drawn, but the product still gets a frame's worth of real time per
  // frame, so debounced searches and replies arrive as they do in a full render.
  if (f < startF) { await page.waitForTimeout(1000 / FPS); continue }

  if (shot.kind === 'product') {
    await page.evaluate((s) => window.V.product(s), { ...state, enter: local, enterFrom: products.indexOf(shot), confetti: confettiAt === null ? null : local - confettiAt })
    await appFrame().evaluate((ms) => window.__videoTick?.(ms), t * 1000).catch(() => {})
    if (Math.round(state.scrollY) !== scrollShown) {
      scrollShown = Math.round(state.scrollY)
      await appFrame().evaluate((v) => window.scrollTo(0, v), scrollShown).catch(() => {})
    }
    if (Math.round(state.secondY) !== secondShown) {
      secondShown = Math.round(state.secondY)
      await page.frameLocator('#second').locator('html').evaluate((e, v) => e.ownerDocument.defaultView.scrollTo(0, v), secondShown).catch(() => {})
    }
  } else {
    // Designed shots: V[kind](t, shot), a pure function of time.
    await page.evaluate(([k, x, sh]) => window.V[k](x, sh), [shot.kind, local, plain(shot)])
  }

  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.screenshot({ path: path.join(OUT, `${String(f).padStart(5, '0')}.png`) })
  if (f % FPS === 0) console.log(`t=${t.toFixed(1)}s ${shot.name}`)
}
fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify({ fps: FPS, from: FROM, to: TO, startFrame: startF }))
fs.writeFileSync(path.join(OUT, 'keys.json'), JSON.stringify(keys.filter((k) => k.t >= FROM && k.t < TO)))
fs.writeFileSync(path.join(OUT, 'clicks.json'), JSON.stringify(clicks.filter((k) => k.t >= FROM && k.t < TO)))
await browser.close()
console.log('done', OUT)
