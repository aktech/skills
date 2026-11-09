// Breadth: a rolling stack of app cards, each something a different kind of user runs (an ML
// demo, a data pipeline, a model, an ops board, a finance report). The open card sits in the
// centre with its charts drawing in; the cards above and below are folded to their title bars.
// The stack rolls to the next app at even steps over the shot. Everything is a pure function
// of t. Data and people are fictional: edit APPS for the product's own audience.

const $ = (id) => document.getElementById(id)
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const span = (t, a, b) => clamp((t - a) / (b - a))
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

const INK = '#23221d', MUTED = '#8b8a84', GRID = '#ecebe7', LIGHT = '#dedcd6'
const ORANGE = '#e8613c', BLUE = '#3b6ef5', GREEN = '#1f9d55', AMBER = '#d99a1e'

// Geometry (1080p px). The open card's body is a 976 x 448 drawing area.
const W_OPEN = 1160, W_BAR = 980, H_OPEN = 624, H_BAR = 76, GAP = 20
const BW = 976, BH = 448            // drawing units; shown at SCALE
const SCALE = (W_OPEN - 64) / BW

// ---------- small SVG helpers (all animated elements carry data-* the frame loop reads) ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (x, y, s, { size = 15, fill = MUTED, weight = 400, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`
// A number that counts up to `to`.
const num = (x, y, to, { dec = 0, pre = '', suf = '', size = 32, fill = INK, weight = 600, anchor = 'start', comma = true } = {}) =>
  `<text class="num" x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="-0.01em"
     data-to="${to}" data-dec="${dec}" data-pre="${esc(pre)}" data-suf="${esc(suf)}" data-comma="${comma ? 1 : 0}"></text>`
const kpi = (x, label, to, opts) => text(x, 18, label, { size: 15 }) + num(x, 58, to, opts)

function linePath(values, x0, y0, w, h, lo, hi) {
  return values.map((v, i) => {
    const x = x0 + (w * i) / (values.length - 1), y = y0 + h - ((v - lo) / (hi - lo)) * h
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
const grid = (x0, y0, w, h, rows, labels = []) => Array.from({ length: rows + 1 }, (_, i) => {
  const y = y0 + (h * i) / rows
  return `<line x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}" stroke="${GRID}" stroke-width="1"/>` +
    (labels[i] !== undefined ? text(x0 - 10, y + 5, labels[i], { size: 13, anchor: 'end' }) : '')
}).join('')
// A line that draws itself left to right (class "draw"), optionally with a soft area under it.
const drawLine = (d, colour, { width = 3, dash = '', area = '', delay = 0 } = {}) =>
  (area ? `<path class="fade" data-delay="${delay + 0.35}" d="${area}" fill="${colour}" fill-opacity="0.08"/>` : '') +
  `<path class="draw" data-delay="${delay}" d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`
// A horizontal bar that grows from the left (class "grow-x").
const hbar = (x, y, w, h, colour, delay = 0, track = true) =>
  (track ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#f1f0ec"/>` : '') +
  `<rect class="grow-x" data-delay="${delay}" data-w="${w}" x="${x}" y="${y}" width="0" height="${h}" rx="${h / 2}" fill="${colour}"/>`
// A vertical bar that grows from its base (class "grow-y").
const vbar = (x, base, w, h, colour, delay = 0) =>
  `<rect class="grow-y" data-delay="${delay}" data-h="${h}" data-base="${base}" x="${x}" y="${base}" width="${w}" height="0" rx="4" fill="${colour}"/>`
const pill = (x, y, label, bg, fg) =>
  `<rect x="${x}" y="${y - 17}" width="${label.length * 8.6 + 20}" height="24" rx="12" fill="${bg}"/>` + text(x + 10, y, label, { size: 13, fill: fg, weight: 600 })

// Seeded noise so the curves look measured, not drawn.
function series(n, f, seed = 1, amp = 0) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5)
  return Array.from({ length: n }, (_, i) => f(i / (n - 1)) + r() * amp)
}

// ---------- the five apps ----------
// A container (the deployed image opens the stack).
const CUBE = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2z"/><path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"/></svg>`

// The street scene the vision model classifies: drawn, with the detections boxed in.
function scene(x0, y0, w, h) {
  const sx = (v) => x0 + v * w, sy = (v) => y0 + v * h
  return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0f2"/><stop offset="1" stop-color="#eef2f5"/></linearGradient>
      <clipPath id="photo"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="14"/></clipPath></defs>
    <g clip-path="url(#photo)">
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="url(#sky)"/>
      <rect x="${sx(0.04)}" y="${sy(0.18)}" width="${w * 0.2}" height="${h * 0.5}" fill="#c9cfd6"/>
      <rect x="${sx(0.26)}" y="${sy(0.28)}" width="${w * 0.16}" height="${h * 0.4}" fill="#b9c1ca"/>
      <rect x="${sx(0.74)}" y="${sy(0.12)}" width="${w * 0.22}" height="${h * 0.56}" fill="#c3cad2"/>
      <rect x="${x0}" y="${sy(0.66)}" width="${w}" height="${h * 0.34}" fill="#8f949a"/>
      <rect x="${x0}" y="${sy(0.64)}" width="${w}" height="${h * 0.04}" fill="#b4b8bd"/>
      ${[0.1, 0.35, 0.6, 0.85].map((v) => `<rect x="${sx(v)}" y="${sy(0.82)}" width="${w * 0.08}" height="${h * 0.02}" fill="#e9ebee"/>`).join('')}
      <g transform="translate(${sx(0.3)},${sy(0.56)})">
        <rect x="0" y="${h * 0.06}" width="${w * 0.36}" height="${h * 0.13}" rx="10" fill="#e8613c"/>
        <path d="M${w * 0.06},${h * 0.07} L${w * 0.11},0 H${w * 0.25} L${w * 0.31},${h * 0.07} Z" fill="#d4512d"/>
        <path d="M${w * 0.125},${h * 0.015} H${w * 0.235} L${w * 0.27},${h * 0.065} H${w * 0.095} Z" fill="#cfe0f2" opacity="0.9"/>
        <circle cx="${w * 0.08}" cy="${h * 0.19}" r="${h * 0.045}" fill="#2a2a2a"/><circle cx="${w * 0.28}" cy="${h * 0.19}" r="${h * 0.045}" fill="#2a2a2a"/>
      </g>
      <g transform="translate(${sx(0.8)},${sy(0.47)})"><circle cx="0" cy="0" r="${h * 0.035}" fill="#3b3b3b"/><rect x="${-h * 0.028}" y="${h * 0.035}" width="${h * 0.056}" height="${h * 0.2}" fill="#3b3b3b"/></g>
      <g transform="translate(${sx(0.13)},${sy(0.52)})"><rect x="-3" y="0" width="6" height="${h * 0.15}" fill="#555"/><rect x="-11" y="${-h * 0.11}" width="22" height="${h * 0.12}" rx="4" fill="#3b3b3b"/>
        <circle cx="0" cy="${-h * 0.08}" r="4" fill="#e8613c"/><circle cx="0" cy="${-h * 0.05}" r="4" fill="#666"/><circle cx="0" cy="${-h * 0.02}" r="4" fill="#666"/></g>
    </g>
    <g class="fade" data-delay="0.45">
      <rect x="${sx(0.28)}" y="${sy(0.52)}" width="${w * 0.4}" height="${h * 0.3}" rx="6" fill="none" stroke="${BLUE}" stroke-width="3"/>
      <rect x="${sx(0.28)}" y="${sy(0.52) - 26}" width="104" height="24" rx="6" fill="${BLUE}"/>${text(sx(0.28) + 10, sy(0.52) - 9, 'car · 0.94', { size: 13, fill: '#fff', weight: 600 })}
    </g>
    <g class="fade" data-delay="0.6">
      <rect x="${sx(0.765)}" y="${sy(0.42)}" width="${w * 0.07}" height="${h * 0.3}" rx="6" fill="none" stroke="${AMBER}" stroke-width="3"/>
      <rect x="${sx(0.765)}" y="${sy(0.42) - 26}" width="128" height="24" rx="6" fill="${AMBER}"/>${text(sx(0.765) + 10, sy(0.42) - 9, 'person · 0.88', { size: 13, fill: '#fff', weight: 600 })}
    </g>`
}

const APPS = [
  {
    title: 'Vision demo', icon: CUBE, owner: 'Ana', team: 'ML engineering', av: '#0e9f8e',
    body() {
      const preds = [['car', 0.94], ['person', 0.88], ['traffic light', 0.81], ['truck', 0.06], ['bicycle', 0.03]]
      return text(0, 18, 'registry.example.com/vision:1.4', { size: 14, fill: MUTED }) +
        scene(0, 40, 560, 380) +
        text(616, 54, 'Detections', { size: 16, fill: INK, weight: 600 }) +
        preds.map(([n, v], i) => text(616, 104 + i * 64, n, { size: 15, fill: INK, weight: 500 }) +
          num(976, 104 + i * 64, v, { dec: 2, size: 15, weight: 600, anchor: 'end' }) +
          hbar(616, 116 + i * 64, 360 * v, 10, v > 0.5 ? BLUE : LIGHT, 0.15 + i * 0.07)).join('') +
        `<g class="fade" data-delay="0.7">${text(616, 436, 'street_scene_042.jpg · 38 ms on CPU', { size: 13 })}</g>`
    },
  },
  {
    title: 'Orders pipeline', logo: 'assets/logos/googlesheets.svg', owner: 'Kofi', team: 'Data engineering', av: '#6b4fd8',
    body() {
      const rows = [1.82, 1.94, 1.77, 2.05, 2.11, 1.98, 2.23, 2.31, 2.19, 2.4, 2.46, 2.52]
      const tasks = [['extract_orders', 'Succeeded', '1m 12s'], ['validate_schema', 'Succeeded', '8s'], ['dedupe_customers', 'Succeeded', '41s'], ['load_warehouse', 'Running', '0m 37s']]
      return kpi(0, 'Rows today', 2.52, { dec: 2, suf: 'M' }) + kpi(220, 'Freshness', 4, { suf: ' min' }) + kpi(440, 'Failed runs, 7 days', 0) +
        text(0, 120, 'Rows ingested per run, millions', { size: 16, fill: INK, weight: 600 }) +
        grid(48, 140, 512, 260, 4, ['3', '2.25', '1.5', '0.75', '0']) +
        rows.map((v, i) => vbar(48 + 10 + i * 42, 400, 26, 260 * (v / 3), i === rows.length - 1 ? BLUE : LIGHT, 0.06 + i * 0.04)).join('') +
        text(616, 120, 'Run 312 · tasks', { size: 16, fill: INK, weight: 600 }) +
        tasks.map(([n, st, d], i) => {
          const y = 172 + i * 64, ok = st === 'Succeeded'
          return `<g class="fade" data-delay="${0.25 + i * 0.12}"><line x1="616" x2="976" y1="${y + 26}" y2="${y + 26}" stroke="${GRID}"/>` +
            `<circle cx="626" cy="${y - 5}" r="7" fill="${ok ? GREEN : BLUE}"/>` +
            text(644, y, n, { size: 15, fill: INK, weight: 500 }) +
            text(976, y, `${st} · ${d}`, { size: 14, fill: ok ? GREEN : BLUE, anchor: 'end', weight: 500 }) + '</g>'
        }).join('')
    },
  },
  {
    title: 'Retention model · run 41', logo: 'assets/logos/notion.svg', owner: 'Priya', team: 'Data science', av: '#7c5cff',
    body() {
      const acc = series(40, (x) => 0.62 + 0.254 * (1 - Math.exp(-4.2 * x)), 7, 0.012)
      const tr = series(40, (x) => 0.64 + 0.29 * (1 - Math.exp(-3.6 * x)), 3, 0.006)
      const fx = [['tenure_months', 0.31], ['support_tickets', 0.22], ['monthly_spend', 0.17], ['plan_changes', 0.12], ['days_since_login', 0.09]]
      return kpi(0, 'AUC', 0.912, { dec: 3 }) + kpi(200, 'Accuracy', 87.4, { dec: 1, suf: '%' }) + kpi(420, 'Epochs', 40) +
        text(0, 120, 'Accuracy by epoch', { size: 16, fill: INK, weight: 600 }) +
        grid(48, 140, 512, 280, 4, ['95%', '85%', '75%', '65%', '55%']) +
        drawLine(linePath(tr, 48, 140, 512, 280, 0.55, 0.95), LIGHT, { width: 2.5, dash: '6 6' }) +
        drawLine(linePath(acc, 48, 140, 512, 280, 0.55, 0.95), BLUE, { delay: 0.05 }) +
        text(48, 444, 'Validation', { size: 13, fill: BLUE, weight: 600 }) + text(130, 444, 'Training', { size: 13 }) +
        text(616, 120, 'What drives retention', { size: 16, fill: INK, weight: 600 }) +
        fx.map(([n, v], i) => text(616, 168 + i * 56, n, { size: 14, fill: INK }) + num(976, 168 + i * 56, v, { dec: 2, size: 14, weight: 500, anchor: 'end' }) +
          hbar(616, 178 + i * 56, 360 * (v / 0.31), 10, i === 0 ? ORANGE : BLUE, 0.1 + i * 0.07)).join('')
    },
  },
  {
    title: 'On-call board', logo: 'assets/logos/zoom.svg', owner: 'Marco', team: 'Ops', av: '#e8613c',
    body() {
      const lat = series(48, (x) => 150 + 18 * Math.sin(x * 9) + (Math.abs(x - 0.62) < 0.04 ? 140 * (1 - Math.abs(x - 0.62) / 0.04) : 0), 11, 10)
      const rows = [['SEV2', 'checkout-api', 'Resolved', '14:02'], ['SEV3', 'search', 'Monitoring', '15:40'], ['SEV3', 'email-worker', 'Resolved', '09:15']]
      return kpi(0, 'Uptime, 30 days', 99.98, { dec: 2, suf: '%' }) + kpi(240, 'p95 latency', 182, { suf: ' ms' }) + kpi(460, 'Open incidents', 1) +
        text(0, 120, 'p95 latency, last 24 h', { size: 16, fill: INK, weight: 600 }) +
        grid(48, 140, 512, 280, 4, ['400', '300', '200', '100', '0']) +
        `<line x1="48" x2="560" y1="${140 + 280 * (1 - 250 / 400)}" y2="${140 + 280 * (1 - 250 / 400)}" stroke="${ORANGE}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.7"/>` +
        text(560, 140 + 280 * (1 - 250 / 400) - 8, 'SLO 250 ms', { size: 12, fill: ORANGE, anchor: 'end' }) +
        drawLine(linePath(lat, 48, 140, 512, 280, 0, 400), INK, { width: 2.5, area: linePath(lat, 48, 140, 512, 280, 0, 400) + ' L560,420 L48,420 Z' }) +
        text(616, 120, 'Incidents', { size: 16, fill: INK, weight: 600 }) +
        rows.map(([sev, svc, st, at], i) => {
          const y = 172 + i * 72
          return `<g class="fade" data-delay="${0.25 + i * 0.12}">` +
            `<line x1="616" x2="976" y1="${y + 30}" y2="${y + 30}" stroke="${GRID}"/>` +
            pill(616, y, sev, sev === 'SEV2' ? '#fde8e1' : '#f3efe2', sev === 'SEV2' ? '#c2410c' : '#8a6d16') +
            text(690, y, svc, { size: 15, fill: INK, weight: 500 }) +
            text(976, y, `${st} · ${at}`, { size: 14, fill: st === 'Resolved' ? GREEN : AMBER, anchor: 'end', weight: 500 }) + '</g>'
        }).join('')
    },
  },
  {
    title: 'Budget vs actual · Q3', logo: 'assets/logos/airtable.svg', owner: 'Lena', team: 'Finance', av: '#d99a1e',
    body() {
      const rows = [['Engineering', 4.2, 4.05], ['Field', 2.6, 2.84], ['Marketing', 1.8, 1.62], ['Operations', 1.1, 1.13], ['G&A', 0.9, 0.86]]
      return kpi(0, 'Budget', 10.6, { dec: 1, pre: '$', suf: 'M' }) + kpi(200, 'Actual', 10.5, { dec: 1, pre: '$', suf: 'M' }) + kpi(400, 'Variance', 0.9, { dec: 1, pre: '−', suf: '%', fill: GREEN }) +
        text(0, 120, 'By department, $M', { size: 16, fill: INK, weight: 600 }) +
        grid(48, 140, 512, 260, 4, ['4.8', '3.6', '2.4', '1.2', '0']) +
        rows.map(([n, b, a], i) => {
          const x = 48 + 20 + i * 102
          return vbar(x, 400, 30, 260 * (b / 4.8), LIGHT, 0.08 + i * 0.07) + vbar(x + 34, 400, 30, 260 * (a / 4.8), a > b ? ORANGE : INK, 0.14 + i * 0.07) +
            text(x + 32, 428, n.split(' ')[0], { size: 13, anchor: 'middle' })
        }).join('') +
        text(616, 120, 'Department', { size: 13 }) + text(976, 120, 'vs budget', { size: 13, anchor: 'end' }) +
        rows.map(([n, b, a], i) => {
          const y = 168 + i * 56, v = ((a - b) / b) * 100
          return `<g class="fade" data-delay="${0.3 + i * 0.08}"><line x1="616" x2="976" y1="${y + 22}" y2="${y + 22}" stroke="${GRID}"/>` +
            text(616, y, n, { size: 15, fill: INK, weight: 500 }) + text(840, y, `$${a.toFixed(2)}M`, { size: 15, fill: INK, anchor: 'end' }) +
            text(976, y, `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`, { size: 15, fill: v > 0 ? ORANGE : GREEN, anchor: 'end', weight: 600 }) + '</g>'
        }).join('')
    },
  },
]

// ---------- build once ----------
let built = false
function build() {
  const root = $('apps')
  root.innerHTML = APPS.map((a) => `
    <div class="acard">
      <div class="ahdr">
        <div class="alogo">${a.icon ?? `<img src="/__v/${a.logo}">`}</div>
        <div class="atitle">${esc(a.title)}</div>
        <div class="aowner"><div class="aav" style="background:${a.av}">${a.owner[0]}</div>
          <div class="aown"><b>${a.owner}</b><span>${a.team}</span></div></div>
      </div>
      <div class="abody"><svg width="${BW * SCALE}" height="${BH * SCALE}" viewBox="0 0 ${BW} ${BH}">${a.body()}</svg></div>
    </div>`).join('')
  for (const p of root.querySelectorAll('path.draw')) { const L = p.getTotalLength(); p.dataset.len = L; p.style.strokeDasharray = p.getAttribute('stroke-dasharray') ? '' : `${L}` }
  built = true
}

// ---------- timing ----------
const ROLL = 0.55                       // one roll, s
let R = []                              // when the stack rolls to app k (k = 1..n-1)
function position(t) {                   // continuous index of the open app
  return R.reduce((p, r) => p + easeInOut(span(t, r, r + ROLL)), 0)
}
const contentStart = (i) => (i === 0 ? 0.15 : R[i - 1] + 0.25)

// ---------- per frame ----------
function animateBody(card, c) {
  for (const p of card.querySelectorAll('path.draw')) {
    const e = easeOut(clamp((c - +p.dataset.delay) / 0.85))
    const L = +p.dataset.len
    if (p.getAttribute('stroke-dasharray')) { p.style.opacity = e > 0 ? 1 : 0; p.style.clipPath = `inset(0 ${100 - e * 100}% 0 0)` }
    else p.style.strokeDashoffset = `${L * (1 - e)}`
  }
  for (const r of card.querySelectorAll('.grow-x')) r.setAttribute('width', +r.dataset.w * easeOut(clamp((c - +r.dataset.delay) / 0.6)))
  for (const r of card.querySelectorAll('.grow-y')) {
    const h = +r.dataset.h * easeOut(clamp((c - +r.dataset.delay) / 0.6))
    r.setAttribute('height', h); r.setAttribute('y', +r.dataset.base - h)
  }
  for (const g of card.querySelectorAll('.fade')) g.style.opacity = easeOut(clamp((c - +g.dataset.delay) / 0.4))
  for (const n of card.querySelectorAll('.num')) {
    const e = easeOut(clamp(c / 0.9)), d = +n.dataset.dec
    let v = (+n.dataset.to * e).toFixed(d)
    if (n.dataset.comma === '1' && d === 0) v = Number(v).toLocaleString('en-US')
    n.textContent = `${n.dataset.pre}${v}${n.dataset.suf}`
  }
}

// dur: the shot's length; the last app holds ~1.5 s before the cut.
export function drawApps(t, dur) {
  if (!built) build()
  const step = (dur - 1.5) / APPS.length
  R = APPS.slice(1).map((_, k) => step * (k + 1))
  const p = position(t)
  const enter = easeOut(span(t, 0, 0.45))
  const cards = [...$('apps').querySelectorAll('.acard')]
  cards.forEach((card, i) => {
    const d = i - p, ad = Math.abs(d)
    if (ad >= 2) { card.style.display = 'none'; return }
    card.style.display = 'block'
    const a = clamp(1 - ad)                                   // how open: 1 in the centre
    const h = H_BAR + (H_OPEN - H_BAR) * a
    let w = W_BAR + (W_OPEN - W_BAR) * a, yc, op
    if (ad <= 1) { yc = 540 + d * (H_OPEN / 2 + GAP + H_BAR / 2); op = 1 - 0.12 * ad }
    else { yc = 540 + Math.sign(d) * (H_OPEN / 2 + GAP + H_BAR / 2 + (ad - 1) * (H_BAR + 12)); op = 0.88 * Math.pow(2 - ad, 2); w -= 60 * (ad - 1) }
    card.style.width = `${w}px`
    card.style.height = `${h}px`
    card.style.transform = `translate(${-w / 2}px, ${yc - h / 2 + 40 * (1 - enter)}px)`
    card.style.opacity = op * enter
    card.style.zIndex = String(10 - Math.round(ad * 4))
    const body = card.querySelector('.abody')
    body.style.opacity = clamp((a - 0.55) / 0.45)
    animateBody(card, t - contentStart(i))
  })
}
