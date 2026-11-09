// The compositor. The recorder calls window.V.* once per frame and then takes a screenshot, so
// every function here draws a pure function of the time it is given. Brand (name, mark, font,
// colours, credit) comes from brand.json.
import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { drawApps } from './apps.js'
import { drawFocus, focusImage } from './focus.js'
import { drawGlobe } from './globe.js'
import { buildSlots, drawSlots, hideSlots } from './slots.js'

const $ = (id) => document.getElementById(id)
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeOut3 = (x) => 1 - Math.pow(1 - x, 3)
const easeOut4 = (x) => 1 - Math.pow(1 - x, 4)
const span = (t, a, b) => clamp((t - a) / (b - a))

let BRAND = null

async function loadBrand() {
  BRAND = await (await fetch('/__v/brand.json')).json()
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(BRAND.colours)) root.setProperty(`--${k}`, v)
  // The brand font, under one family name the CSS uses.
  for (const [weight, file] of Object.entries(BRAND.font.files)) {
    const face = new FontFace('Brand', `url(/__v/${file})`, { weight })
    document.fonts.add(await face.load())
  }
  $('urltext').textContent = BRAND.windowUrl
}

// ---------- headline cards ----------
// Every word is laid out once at its final place; a calm sweep fades them up in turn. Words
// between underscores (_plain words_) get a hand-drawn underline once the sweep has landed.
let cardKey = ''
function buildWords(lines) {
  const h = $('headline')
  h.innerHTML = ''
  for (const text of lines) {
    const line = document.createElement('div')
    line.className = 'wline'
    let marked = false
    text.split(' ').forEach((raw, i) => {
      if (i) line.appendChild(document.createTextNode(' '))
      const opens = raw.startsWith('_'), closes = /_[.,!?]?$/.test(raw)
      const word = raw.replace(/^_/, '').replace(/_([.,!?]?)$/, '$1')
      if (opens) marked = true
      const stop = marked && closes && /[.,!?]$/.test(word)
      const w = document.createElement('span')
      w.className = 'word' + (marked ? ' marked' : '')
      w.textContent = stop ? word.slice(0, -1) : word
      line.appendChild(w)
      if (stop) { const p = document.createElement('span'); p.className = 'word'; p.textContent = word.slice(-1); line.appendChild(p) }
      if (closes) marked = false
    })
    h.appendChild(line)
  }
  for (const line of h.querySelectorAll('.wline')) {
    const left = line.getBoundingClientRect().left
    line._end = Math.max(...[...line.querySelectorAll('.word')].map((w) => w.getBoundingClientRect().right - left))
    const m = [...line.querySelectorAll('.word.marked')]
    if (!m.length) continue
    // A pencil-brush stroke under the marked words: slightly wavy, drawn as two overlapping
    // passes like a quick marker.
    const x0 = m[0].getBoundingClientRect().left - left - 6
    const x1 = m[m.length - 1].getBoundingClientRect().right - left + 6
    const y = m[0].getBoundingClientRect().bottom - line.getBoundingClientRect().top - 2
    const wd = x1 - x0
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'scribble')
    svg.setAttribute('width', wd); svg.setAttribute('height', 30)
    svg.setAttribute('viewBox', `0 0 ${wd} 30`)
    svg.style.left = x0 + 'px'; svg.style.top = (y + 2) + 'px'
    const wave = (y0, a, off) => {
      let d = `M${4 + off} ${y0}`
      for (let k = 1; k <= 6; k++) d += ` Q ${(k - 0.5) * wd / 6 + off / 2} ${y0 + (k % 2 ? -a : a)} ${k * wd / 6 - (k === 6 ? 4 : 0)} ${y0 + (k === 6 ? -2 : 0)}`
      return d
    }
    svg.innerHTML = `<path d="${wave(14, 6, 0)}" stroke-width="6.5"/><path d="${wave(19, 4.5, 8)}" stroke-width="4" opacity=".75"/>`
    line.appendChild(svg)
    line._scribble = [...svg.querySelectorAll('path')]
    for (const p of line._scribble) { const L = p.getTotalLength(); p._len = L; p.style.strokeDasharray = L; p.style.strokeDashoffset = L }
  }
}
function revealWords(t, every) {
  let n = 0
  for (const line of $('headline').querySelectorAll('.wline')) {
    const words = [...line.querySelectorAll('.word')]
    words.forEach((w, i) => {
      const e = easeOut3(clamp((t - (n + i) * every) / 0.5))
      w.style.opacity = e
      w.style.transform = `translateY(${12 * (1 - e)}px)`
      w.style.filter = `blur(${4 * (1 - e)}px)`
    })
    line.style.transform = `translateX(${(1920 - line._end) / 2}px)`
    ;(line._scribble ?? []).forEach((p, i) => {
      const e = easeInOut(clamp((t - (n + words.length) * every - 0.25 - i * 0.12) / 0.45))
      p.style.strokeDashoffset = p._len * (1 - e)
    })
    n += words.length
  }
}

// ---------- logo (three.js) ----------
// The mark is brand.mark.path (a 100x100 box) extruded in 3D; the wordmark is brand.wordmark
// text in the brand font. Lock-up: mark (128 px) + gap + wordmark, centred as a group.
const PX = 1.28                // screen px per world unit at z = 0 (mark is 128 px wide)
const GAP = 46
let renderer, scene, camera, mark, matsLit, matsFlat, glCanvas, blur2d
let MARK_FINAL_X = 0, WORD_LEFT = 0, WORD_W = 0, WORD_H = 0

function buildLogo() {
  // three draws into an offscreen canvas; #gl (2D) shows the average of a few sub-frames.
  glCanvas = document.createElement('canvas')
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(2)
  renderer.setSize(1920, 1080, false)
  $('gl').width = 3840; $('gl').height = 2160
  blur2d = $('gl').getContext('2d')
  renderer.outputColorSpace = THREE.SRGBColorSpace
  scene = new THREE.Scene()
  const fov = 18
  camera = new THREE.PerspectiveCamera(fov, 1920 / 1080, 10, 20000)
  camera.position.set(0, 0, (1080 / PX) / 2 / Math.tan((fov / 2) * Math.PI / 180))

  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="${BRAND.mark.path}"/></svg>`)
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p))
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 24, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.4, bevelSegments: 4, curveSegments: 24 })
  geo.translate(-50, -50, -12)
  geo.scale(1, -1, 1)           // SVG y points down
  geo.computeVertexNormals()

  const ink = new THREE.Color(BRAND.colours.ink), moon = new THREE.Color(BRAND.colours.moon)
  matsLit = [
    new THREE.MeshStandardMaterial({ color: ink, roughness: 0.62, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ color: ink.clone().lerp(new THREE.Color('#ffffff'), 0.18), roughness: 0.5, metalness: 0.0 }),
  ]
  matsFlat = [new THREE.MeshBasicMaterial({ color: moon }), new THREE.MeshBasicMaterial({ color: moon })]
  mark = new THREE.Mesh(geo, matsLit)
  scene.add(mark)

  const key = new THREE.DirectionalLight(0xfff6ec, 2.1)
  key.position.set(-0.6, 0.9, 1.0)
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.7)
  fill.position.set(0.9, -0.4, 0.6)
  ;[new THREE.AmbientLight(0xffffff, 0.55), key, fill].forEach((l) => scene.add(l))

  // Wordmark, measured in the brand font, then the lock-up maths.
  const w = $('wordmark')
  w.textContent = BRAND.wordmark.text
  w.style.fontSize = `${BRAND.wordmark.size}px`
  w.style.fontWeight = BRAND.wordmark.weight
  w.style.lineHeight = '1'
  // The logo layer is hidden until its shot; a hidden element measures 0 x 0.
  const layer = $('logo'), shown = layer.style.display
  layer.style.display = 'block'; layer.style.visibility = 'hidden'
  const r = w.getBoundingClientRect()
  layer.style.display = shown; layer.style.visibility = ''
  WORD_W = r.width; WORD_H = r.height
  const group = 128 + GAP + WORD_W
  const markLeft = 960 - group / 2
  MARK_FINAL_X = (markLeft + 64 - 960) / PX
  WORD_LEFT = markLeft + 128 + GAP
}

function faceRightPx() { return 960 + (mark.position.x + 50 * mark.scale.x) * PX }
// The wordmark starts tucked behind the mark and slides out to the right; anything left of the
// mark's face-on right edge is clipped, so no letter shows before the mark uncovers it.
function placeWordmark(p, colour) {
  const shift = -(1 - p) * 200
  const el = $('wordmark')
  el.style.color = colour
  el.style.transform = `translate(${WORD_LEFT + shift}px, ${540 - WORD_H / 2 - WORD_H * 0.04}px)`
  const clipLeft = Math.min(WORD_W + 20, Math.max(0, faceRightPx() + 8 - (WORD_LEFT + shift)))
  el.style.clipPath = `inset(-20px -20px -20px ${clipLeft}px)`
}

// Motion blur: average SUBS renders spread over half a frame (a 180 degree shutter).
const SUBS = 12, SHUTTER = 0.5 / 60
function renderBlurred(t, pose) {
  blur2d.clearRect(0, 0, 3840, 2160)
  const n = t <= 0 ? 1 : SUBS
  for (let k = 0; k < n; k++) {
    pose(t - (k / Math.max(1, n - 1)) * SHUTTER)
    renderer.render(scene, camera)
    blur2d.globalAlpha = 1 / (k + 1)
    blur2d.drawImage(glCanvas, 0, 0)
  }
  blur2d.globalAlpha = 1
  pose(t)
}

// Critically damped settle: starts at rest, no overshoot, done by ~0.85 s.
function settle(t, k = 7) { return t <= 0 ? 0 : 1 - (1 + k * t) * Math.exp(-k * t) }
const introSlide = (t) => (t <= 0 ? 1 : easeInOut(span(t, 0.16, 0.74)))
function introPose(t) {
  if (t <= 0) { mark.rotation.set(0, 0, 0); mark.position.set(MARK_FINAL_X, 0, 0); mark.scale.setScalar(1); return }   // frame 0: the finished lock-up (a clean poster)
  const e = settle(t)
  mark.rotation.set(-1.25 * (1 - e), 2.6 * (1 - e), 0.6 * (1 - e))
  mark.position.set(MARK_FINAL_X * introSlide(t), 0, 0)
  mark.scale.setScalar(0.8 + 0.2 * easeOut3(span(t, 0, 0.55)))
}
function logoIntro(t) {
  $('logo').style.background = 'var(--paper)'
  mark.material = matsLit
  renderBlurred(t, introPose)
  placeWordmark(introSlide(t), 'var(--ink)')
}

// Outro: the flat mark starts larger than the frame, spinning, shrinks to size, holds alone,
// then slides aside as the wordmark is uncovered.
const outroSlide = (t) => easeInOut(span(t, 1.0, 1.28))
function outroPose(t) {
  const a = easeOut4(span(t, 0, 0.62))
  const b = easeOut3(span(t, 0, 0.62))
  mark.rotation.set(0.85 * (1 - b), 2.4 * Math.PI * (1 - b), -0.45 * (1 - b))
  mark.scale.setScalar(1 + 8 * (1 - a))
  mark.position.set(MARK_FINAL_X * outroSlide(t), 0, 0)
}
function logoOutro(t) {
  $('logo').style.background = 'var(--night)'
  mark.material = matsFlat
  renderBlurred(Math.max(t, 1e-6), outroPose)
  placeWordmark(outroSlide(t), 'var(--moon)')
}

// ---------- confetti ----------
// A seeded burst from the two bottom corners, a pure function of its age.
const CONFETTI = (() => {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const colours = ['#f2b25c', '#e8613c', '#3b82f6', '#22c55e', '#a855f7', '#f43f5e', '#14b8a6', '#facc15']
  return Array.from({ length: 260 }, (_, i) => {
    const left = i % 2 === 0
    const angle = (left ? -62 : -118) + (rnd() - 0.5) * 50
    const speed = 2300 + rnd() * 1100
    return {
      x: left ? 160 : 1760, y: 1120,
      vx: Math.cos(angle * Math.PI / 180) * speed, vy: Math.sin(angle * Math.PI / 180) * speed,
      w: 10 + rnd() * 10, h: 6 + rnd() * 8, spin: (rnd() - 0.5) * 18, flip: 6 + rnd() * 10, phase: rnd() * 6.28,
      colour: colours[Math.floor(rnd() * colours.length)], delay: rnd() * 0.12,
    }
  })
})()
function drawConfetti(age) {
  const c = $('confetti')
  if (age === null || age < 0 || age > 3.2) { c.style.display = 'none'; return }
  c.style.display = 'block'
  const g = c.getContext('2d')
  g.setTransform(2, 0, 0, 2, 0, 0)
  g.clearRect(0, 0, 1920, 1080)
  for (const p of CONFETTI) {
    const t = Math.max(0, age - p.delay)
    if (t <= 0) continue
    // Launch, air drag, gravity, a little flutter as it falls.
    const drag = 2.2, grav = 1500
    const k = (1 - Math.exp(-drag * t)) / drag
    const x = p.x + p.vx * k + Math.sin(p.phase + t * 3) * 18 * t
    const y = p.y + p.vy * k + grav * (t / drag - k / drag)
    g.save()
    g.globalAlpha = Math.min(1, (3.2 - age) / 0.6)
    g.translate(x, y)
    g.rotate(p.spin * t)
    g.scale(1, Math.cos(p.phase + p.flip * t))
    g.fillStyle = p.colour
    g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    g.restore()
  }
}

// ---------- odometer ----------
// Each character rolls up into place; digits count up. reel > 0: letters spin through that many
// copies of themselves before landing (no wider glyph is ever clipped by a narrow column).
function buildOdometer(el, text, reel = 0) {
  el.classList.add('odo'); el.innerHTML = ''
  ;[...text].forEach((ch) => {
    const col = document.createElement('span'); col.className = 'col'
    const strip = document.createElement('span'); strip.className = 'strip'
    const c = ch === ' ' ? ' ' : ch
    const glyphs = /[0-9]/.test(ch) ? Array.from({ length: 11 + Number(ch) }, (_, k) => String(k % 10))
      : reel > 0 && ch !== ' ' ? [' ', ...Array(reel).fill(c)] : [' ', c]
    for (const g of glyphs) { const s = document.createElement('span'); s.textContent = g; strip.appendChild(s) }
    col.appendChild(strip); el.appendChild(col); col.dataset.n = glyphs.length
    const probe = document.createElement('span'); probe.textContent = c; probe.style.cssText = 'position:absolute;visibility:hidden'
    el.appendChild(probe); col.style.width = probe.getBoundingClientRect().width + 'px'; probe.remove()
  })
}
function drawOdometer(el, t, start, stagger = 0.035, dur = 0.7, lineH = null) {
  el.querySelectorAll('.col').forEach((col, i) => {
    const n = Number(col.dataset.n)
    const p = easeOut4(span(t, start + i * stagger, start + i * stagger + dur))
    col.firstChild.style.transform = lineH ? `translateY(${-(n - 1) * p * lineH}px)` : `translateY(${-(n - 1) * p * 1.18}em)`
  })
}

function showCard(id, dark = false) {
  $('designed').classList.toggle('dark', dark)
  for (const c of document.querySelectorAll('.dcard')) c.style.display = c.id === id ? 'block' : 'none'
}

// Statement: the claim rolls in as an odometer line, the technical name fades up under it.
function drawStatement(t, { head, sub = '' }) {
  showCard('statement')
  const h = $('stodo')
  if (h.dataset.k !== head) { buildOdometer(h, head, 4); h.dataset.k = head }
  drawOdometer(h, t, 0.1, 0.03, 0.75, 80)
  const d = $('statement').querySelector('.ssub')
  d.textContent = sub
  const s = easeOut3(span(t, 1.15, 1.6))
  d.style.opacity = s
  d.style.transform = `translateY(${8 * (1 - s)}px)`
}

// Credit: the line rolls in, the makers rise through their masks one after another, then the
// URL is typed at the foot of the frame with a blinking caret.
function buildCredit() {
  const c = BRAND.credit
  const makers = $('creditcard').querySelector('.makers')
  const parts = []
  c.makers.forEach((m, i) => {
    if (i) parts.push(`<span class="rm joiner"><span class="ri">${c.joiner}</span></span>`)
    parts.push(m.src ? `<span class="rm"><span class="ri"><img src="/__v/${m.src}" alt="${m.alt ?? ''}"></span></span>`
      : `<span class="rm"><span class="ri name">${m.text}</span></span>`)
  })
  makers.innerHTML = parts.join('')
  buildOdometer($('fromodo'), c.line, 4)
}
function drawCredit(t) {
  showCard('creditcard', true)
  drawOdometer($('fromodo'), t, 0.1, 0.022, 0.7)
  $('creditcard').querySelectorAll('.rm .ri').forEach((el, i) => {
    const p = easeOut4(span(t, 0.95 + i * 0.16, 1.6 + i * 0.16))
    el.style.transform = `translateY(${(1 - p) * 72}px)`
  })
  const url = BRAND.credit.url, t0 = 1.9, cps = 18
  const n = Math.max(0, Math.min(url.length, Math.floor((t - t0) * cps)))
  $('webtext').textContent = url.slice(0, n)
  const typing = t >= t0 && n < url.length
  const blink = Math.floor((t - t0) / 0.5) % 2 === 0
  $('caret').style.opacity = t < t0 - 0.3 ? 0 : typing || blink ? 1 : 0
}

// ---------- row highlight ----------
// hl: the row's box in stage px (dividers excluded), a = 0..1, s = product scale.
function drawHighlight(hl) {
  const box = $('hl')
  if (!hl || hl.a <= 0) { box.style.opacity = 0; return }
  const S = hl.s || 1.27222, a = hl.a
  const padX = 12 * S, inset = 2 * S
  Object.assign(box.style, {
    opacity: a, left: `${hl.x - padX}px`, top: `${hl.y + inset}px`, width: `${hl.w + 2 * padX}px`, height: `${hl.h - 2 * inset}px`,
    borderRadius: `${8 * S}px`, transform: `scale(${1 - 0.015 * (1 - a)})`,
  })
  Object.assign(box.querySelector('.hl-bar').style, { left: '0px', top: `${6 * S}px`, bottom: `${6 * S}px`, width: `${3 * S}px`, borderRadius: `${1.5 * S}px` })
}

// ---------- public API ----------
function show(mode) {
  if (mode !== 'product') drawConfetti(null)
  if (mode !== 'slot') hideSlots()
  $('apps').style.display = mode === 'apps' ? 'block' : 'none'
  $('globe').style.display = mode === 'globe' ? 'block' : 'none'
  $('stage').style.display = mode === 'product' ? 'block' : 'none'
  $('card').style.display = mode === 'card' ? 'block' : 'none'
  $('logo').style.display = mode === 'logo' ? 'block' : 'none'
  $('designed').style.display = mode === 'designed' ? 'block' : 'none'
}

window.V = {
  // Called once by the recorder: loads the brand and the product, builds and measures the
  // slot cards (with their logos loaded).
  async init(slots) {
    await loadBrand()
    for (const w of Object.keys(BRAND.font.files)) await document.fonts.load(`${w} 64px Brand`)
    buildLogo()
    buildCredit()
    await buildSlots(slots)
    const app = new URLSearchParams(location.search).get('app') || '/'
    await new Promise((r) => { $('app').addEventListener('load', r, { once: true }); $('app').src = app })
    return true
  },

  // shot = the story's shot object; t = seconds into it.
  intro(t) { show('logo'); logoIntro(t) },
  outro(t) { show('logo'); logoOutro(t) },
  card(t, { lines }) {
    show('card')
    const k = lines.join('\n')
    if (k !== cardKey) { buildWords(lines); cardKey = k }
    revealWords(t - 0.1, 0.06)
  },
  slot(t, shot) { show('slot'); drawSlots(shot.name, t) },
  statement(t, shot) { show('designed'); drawStatement(t, shot) },
  credit(t) { show('designed'); drawCredit(t) },
  globe(t, shot) { show('globe'); drawGlobe(t, shot) },
  apps(t, shot) { show('apps'); drawApps(t, shot.end - shot.start) },

  focusImage(url, dpr) { return focusImage(url, dpr) },

  // The product: camera {s, cx, cy} (stage point to centre), cursor {x, y, press, visible}.
  product({ cam, cursor, enter = 9, enterFrom = 0, confetti = null, hl = null, focus = null }) {
    show('product')
    drawConfetti(confetti)
    // Entrance: the browser window swings in towards the viewer and settles flat over 0.8 s,
    // from a different side each product shot; the wallpaper stays still.
    const e = 1 - Math.pow(1 - clamp(enter / 0.8), 4), ek = 1 - e
    const ENTRANCES = [
      ['50% 100%', `translateY(${90 * ek}px) rotateX(${22 * ek}deg)`],           // up from below
      ['100% 50%', `translateX(${140 * ek}px) rotateY(${-24 * ek}deg)`],         // in from the right
      ['0% 50%', `translateX(${-140 * ek}px) rotateY(${24 * ek}deg)`],           // in from the left
      ['50% 0%', `translateY(${-90 * ek}px) rotateX(${-20 * ek}deg)`],           // down from above
      ['50% 50%', `translateZ(${-260 * ek}px) rotateZ(${-3 * ek}deg)`],          // forward from depth
    ]
    const [origin, move] = ENTRANCES[enterFrom % ENTRANCES.length]
    $('window').style.transformOrigin = origin
    $('window').style.transform = e >= 1 ? '' : `perspective(2400px) ${move} scale(${0.9 + 0.1 * e})`
    $('window').style.opacity = String(Math.min(1, 0.35 + e))
    // The cursor joins once the window has settled, so it never floats outside a moving window.
    $('cursor').style.opacity = String(clamp((enter - 0.55) / 0.25))
    drawHighlight(hl)
    drawFocus(focus, cam.s)
    const s = cam.s
    // Keep the frame inside the stage; once zoomed in, inside the window too, so the
    // wallpaper never slips in at an edge of a close-up.
    const k = clamp((s - 1) / 0.12)
    const L = 44 * k, T = 36 * k, R = 1920 - 44 * k, B = 1080 - 36 * k
    let tx = 960 - s * cam.cx, ty = 540 - s * cam.cy
    tx = Math.min(-L * s, Math.max(1920 - R * s, tx))
    ty = Math.min(-T * s, Math.max(1080 - B * s, ty))
    $('stage').style.transform = `translate(${tx}px, ${ty}px) scale(${s})`
    const c = $('cursor')
    c.style.display = cursor.visible ? 'block' : 'none'
    c.style.transform = `translate(${cursor.x - 8}px, ${cursor.y - 4}px) scale(${1 - 0.14 * (cursor.press || 0)})`
  },

  // A second page in the same window (src set once, off camera), with its own address text.
  loadSecond(src) { if ($('second').getAttribute('src') !== src) $('second').src = src },
  showSecond(on, url) {
    $('second').style.visibility = on ? 'visible' : 'hidden'
    $('urltext').textContent = on && url ? url : BRAND?.windowUrl ?? ''
  },
}
