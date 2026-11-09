// The globe card: a centred headline over a slowly turning 3D shell of logos (everything the
// product works with). Each logo is a white rounded tile that always faces the camera; tiles
// at the back are smaller, dimmer and softly blurred, and tiles fade out before they reach the
// headline. Everything is a pure function of t.
//   { kind: 'globe', head: 'One home for all your work.', logos: ['assets/logos/notion.svg', ...] }

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const easeOut3 = (x) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

const CX = 960, CY = 540
const RX = 930, RY = 500, RZ = 620   // ellipsoid radii (px at z = 0)
const FOCAL = 1900                   // perspective distance
const TILE = 112                     // tile size at z = 0
const MARGIN = 90                    // fade distance outside the headline's keep-out box

let key = '', points = [], keep = null

function build(root, { head, logos }) {
  root.innerHTML = '<div class="shell"></div><div class="ghead"></div>'
  const shell = root.querySelector('.shell')
  // Fibonacci sphere: an even spread, no crowding at the poles.
  const n = logos.length
  points = logos.map((src, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const a = i * Math.PI * (3 - Math.sqrt(5))
    const el = document.createElement('div')
    el.className = 'gtile'
    el.innerHTML = `<img src="/__v/${src}" alt="">`
    shell.appendChild(el)
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, el }
  })
  const h = root.querySelector('.ghead')
  head.split(' ').forEach((w, i) => {
    if (i) h.appendChild(document.createTextNode(' '))
    const s = document.createElement('span'); s.className = 'gw'; s.textContent = w; h.appendChild(s)
  })
  // Keep-out box: the headline's own extent plus breathing room.
  const ws = [...h.querySelectorAll('.gw')].map((w) => w.getBoundingClientRect())
  const hw = (Math.max(...ws.map((r) => r.right)) - Math.min(...ws.map((r) => r.left))) / 2 + 60
  keep = { hw, hh: 120 }
}

export function drawGlobe(t, shot) {
  const root = document.getElementById('globe')
  const k = shot.head + shot.logos.join()
  if (k !== key) { build(root, shot); key = k }

  // The globe settles in over the first 0.9 s, turning the whole time.
  const enter = easeOut3(clamp(t / 0.9))
  const spin = 0.16 * t + 0.4
  const tilt = -0.22
  const ct = Math.cos(tilt), st = Math.sin(tilt), cs = Math.cos(spin), ss = Math.sin(spin)
  const scale = 0.86 + 0.14 * enter

  for (const p of points) {
    const x1 = p.x * cs + p.z * ss
    const z1 = -p.x * ss + p.z * cs
    const y2 = p.y * ct - z1 * st
    const z2 = p.y * st + z1 * ct
    const kz = FOCAL / (FOCAL - z2 * RZ * scale)   // nearer is bigger
    const sx = CX + x1 * RX * scale * kz
    const sy = CY + y2 * RY * scale * kz
    const depth = (z2 + 1) / 2                      // 0 back .. 1 front
    const size = TILE * kz
    p.el.style.transform = `translate(${sx - size / 2}px, ${sy - size / 2}px)`
    p.el.style.width = p.el.style.height = `${size}px`
    p.el.style.borderRadius = `${size * 0.26}px`
    const dx = Math.max(0, Math.abs(sx - CX) - keep.hw - size / 2)
    const dy = Math.max(0, Math.abs(sy - CY) - keep.hh - size / 2)
    const clear = clamp(Math.hypot(dx, dy) / MARGIN)
    p.el.style.opacity = String(enter * clear * (0.22 + 0.78 * Math.pow(depth, 1.4)))
    p.el.style.filter = `blur(${(1 - depth) * 3.2}px)`
    p.el.style.zIndex = String(Math.round(depth * 100))
  }

  // Headline centred like every card: words fade up in place in one calm sweep.
  ;[...root.querySelectorAll('.gw')].forEach((w, i) => {
    const e = easeOut3(clamp((t - 0.35 - i * 0.06) / 0.5))
    w.style.opacity = String(e)
    w.style.transform = `translateY(${12 * (1 - e)}px)`
    w.style.filter = `blur(${4 * (1 - e)}px)`
  })
  root.querySelector('.shell').style.opacity = String(easeInOut(clamp(t / 0.6)))
}
