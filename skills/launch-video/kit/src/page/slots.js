// Slot cards: a sentence with one slot that rolls like an odometer reel through many items
// (times, logos, numbers, people) and lands on its word: "Run jobs on a [schedule].". The fixed
// words never move sideways; only the slot's width eases as items of different widths pass.
// Everything is a pure function of t (seconds into the shot).
//
// A slot shot in story.mjs:
//   { kind: 'slot', before: 'Share it with your', after: '', intro: 0.1,
//     items: [{ person: 'Bob', colour: '#e8613c' }, { team: 'Data team' }, { logo: 'assets/logos/figma.svg' },
//             { text: '08:00', muted: true, small: true }, { text: 'team.' }],
//     moves: [[start, end, target, 'step'?], ...],      // target: an item's text or 'last'
//     second: { text: 'A quieter second line.', at: 2.7 } }
// A move without 'step' spins once and decelerates onto its target; with 'step' it ticks one
// item at a time (move, then a short hold), slow enough to read each logo (~0.3 s an item).

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const span = (t, a, b) => clamp((t - a) / (b - a))
const easeOut3 = (x) => 1 - Math.pow(1 - x, 3)
const easeInOut4 = (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2)

const SIZE = 96          // headline size, px at 1080p (every slot card shares it)
const ROW = 150          // reel row height (room for descenders inside the soft mask)
const SAFE = 120         // nothing goes closer than this to a frame edge
const LOGO = 92          // logo height in the reel

let root = null
const built = {}

function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e }

function build(spec) {
  const card = el('div', 'slot-card', root)
  const line = el('div', 'slot-line', card)
  if (spec.second) line.classList.add('raised')
  const before = el('span', 'slot-fixed', line); before.textContent = spec.before
  const mask = el('span', 'slot-mask', line)
  const reel = el('span', 'slot-reel', mask)
  for (const it of spec.items) {
    const row = el('span', 'slot-row', reel)
    if (it.person) {
      const a = el('span', 'slot-avatar', row); a.textContent = it.person[0]; a.style.background = it.colour ?? '#8b8a84'
      el('span', 'slot-text', row).textContent = it.person
    } else if (it.team) {
      el('span', 'slot-team', row).innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.6 14.2c2.4.2 4.2 1.9 4.9 4.8"/></svg>'
      el('span', 'slot-text', row).textContent = it.team
    } else if (it.logo) {
      el('img', 'slot-logo', row).src = `/__v/${it.logo}`
      if (it.name) el('span', 'slot-name', row).textContent = it.name
    } else {
      // Text sits on the row's full-size line box, so a smaller, muted item shares the
      // sentence's baseline.
      const tx = el('span', 'slot-text', row); tx.textContent = it.text || ' '
      if (it.muted) tx.classList.add('muted')
      if (it.small) tx.classList.add('small')
    }
  }
  const after = el('span', 'slot-fixed', line); after.textContent = spec.after ?? ''
  let second = null
  if (spec.second) { second = el('div', 'slot-second', card); second.textContent = spec.second.text }
  built[spec.name] = { card, line, before, after, mask, reel, rows: [...reel.children], second, spec, widths: null }
}

function measure(b) {
  b.widths = b.rows.map((r) => r.getBoundingClientRect().width)
  b.beforeW = b.before.getBoundingClientRect().width
  b.afterW = b.spec.after ? b.after.getBoundingClientRect().width : 0
  // One normal word space of the sentence's own font, so the slot reads as ordinary text.
  const probe = el('span', 'slot-fixed', b.line)
  probe.textContent = 'a a'; const w2 = probe.getBoundingClientRect().width
  probe.textContent = 'aa'; const w1 = probe.getBoundingClientRect().width
  probe.remove()
  b.space = w2 - w1
}

const label = (it) => it.text ?? it.person ?? it.team ?? it.name
function targetIndex(spec, target) {
  if (target === 'last') return spec.items.length - 1
  return spec.items.findIndex((it) => label(it) === target)
}

// Reel position (fractional row index) at time t.
function position(spec, t) {
  let pos = 0, from = 0
  for (const [a, b, target, mode] of spec.moves) {
    const to = targetIndex(spec, target)
    if (t <= a) break
    if (mode === 'step') {
      // One item at a time: each step moves for 55% of its slot, then holds so it can be read.
      const n = to - from, per = (b - a) / n
      const u = Math.min(n, (t - a) / per), k = Math.floor(u)
      const f = (u - k) / 0.55
      const e = f < 1 ? (f < 0.5 ? 4 * f ** 3 : 1 - Math.pow(-2 * f + 2, 3) / 2) : 1
      pos = from + Math.min(n, k + (k < n ? e : 0))
    } else {
      pos = from + (to - from) * easeInOut4(span(t, a, b))
    }
    from = to
    if (t < b) return pos
    pos = to
  }
  return pos
}

export function drawSlots(name, t) {
  root.style.display = 'block'
  for (const [n, x] of Object.entries(built)) x.card.style.display = n === name ? 'block' : 'none'
  const b = built[name]
  const spec = b.spec

  // The whole line fades up once (calm, no pop); the reel then does the moving.
  const intro = easeOut3(span(t, spec.intro ?? 0.1, (spec.intro ?? 0.1) + 0.5))
  b.line.style.opacity = intro
  b.line.style.transform = `translateY(${10 * (1 - intro)}px)`
  b.line.style.filter = `blur(${3 * (1 - intro)}px)`

  const pos = position(spec, t)
  b.reel.style.transform = `translateY(${-pos * ROW}px)`
  const i = Math.floor(pos), f = pos - i
  const w0 = b.widths[i], w1 = b.widths[Math.min(i + 1, b.widths.length - 1)]
  const slotW = w0 + (w1 - w0) * f
  b.mask.style.width = `${slotW}px`

  // Centred on the landed words (not the passing items), so the fixed words stay put while the
  // reel spins. While a wider item passes, the line is held inside the safe area.
  const gap = b.space
  const restW = Math.max(...spec.moves.map(([, , target]) => b.widths[targetIndex(spec, target)]))
  const total = b.beforeW + gap + restW + (spec.after ? gap + b.afterW : 0)
  const current = b.beforeW + gap + slotW + (spec.after ? gap + b.afterW : 0)
  const left = Math.max(SAFE, Math.min(960 - total / 2, 1920 - SAFE - current))
  b.line.style.left = `${left}px`
  window.__slotBox = { left, right: left + current }
  b.after.style.marginLeft = spec.after ? `${gap}px` : '0'
  b.mask.style.marginLeft = `${gap}px`

  if (b.second) {
    const s = easeOut3(span(t, spec.second.at, spec.second.at + 0.55))
    b.second.style.opacity = s
    b.second.style.transform = `translateY(${10 * (1 - s)}px)`
    b.second.style.filter = `blur(${3 * (1 - s)}px)`
  }
}

export function hideSlots() { if (root) root.style.display = 'none' }

// Build every slot card up front and wait for its logos, so widths are measured on real images.
export async function buildSlots(specs) {
  root = el('div', 'slots', document.body)
  root.id = 'slots'
  for (const s of specs) build(s)
  root.style.display = 'block'
  await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r }))))
  for (const b of Object.values(built)) { b.card.style.display = 'block'; measure(b); b.card.style.display = 'none' }
  root.style.display = 'none'
}

const css = `
#slots { position: absolute; inset: 0; background: var(--paper); display: none; }
#slots .slot-card { position: absolute; inset: 0; }
#slots .slot-line { position: absolute; top: 50%; margin-top: -${ROW / 2}px; height: ${ROW}px; display: flex; align-items: flex-start;
  font-family: var(--font); font-weight: 500; font-size: ${SIZE}px; letter-spacing: -0.024em; color: var(--ink); white-space: pre; }
#slots .slot-line.raised { margin-top: -${ROW / 2 + 52}px; }
#slots .slot-fixed { display: inline-block; height: ${ROW}px; line-height: ${ROW}px; }
#slots .slot-mask { position: relative; display: inline-block; height: ${ROW}px; overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 9%, #000 91%, transparent 100%); }
#slots .slot-reel { position: absolute; left: 0; top: 0; }
#slots .slot-row { display: block; height: ${ROW}px; line-height: ${ROW}px; white-space: pre; width: max-content; }
#slots .slot-text.muted { color: var(--muted); }
#slots .slot-text.small { font-size: ${Math.round(SIZE * 0.78)}px; }
#slots .slot-logo { display: inline-block; height: ${LOGO}px; width: auto; vertical-align: middle; position: relative; top: -0.06em; }
#slots .slot-avatar { display: inline-block; width: 76px; height: 76px; border-radius: 50%; color: #fff; text-align: center;
  line-height: 76px; font-size: 40px; font-weight: 600; letter-spacing: 0; vertical-align: middle; position: relative; top: -0.06em; margin-right: 0.24em; }
#slots .slot-team { display: inline-block; width: 80px; height: 80px; vertical-align: middle; position: relative; top: -0.06em; margin-right: 0.22em; color: var(--ink); }
#slots .slot-team svg { width: 100%; height: 100%; display: block; }
#slots .slot-name { font-size: ${Math.round(SIZE * 0.86)}px; margin-left: 0.24em; }
#slots .slot-second { position: absolute; left: 0; right: 0; top: 50%; margin-top: ${ROW / 2 - 40}px; text-align: center;
  font-family: var(--font); font-weight: 500; font-size: ${Math.round(SIZE * 0.62)}px; letter-spacing: -0.02em; color: var(--muted); opacity: 0; }
`
const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style)
