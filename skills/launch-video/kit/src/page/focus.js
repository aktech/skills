// Focus overlay over the product window, in stage pixels (it lives inside #stage, so it moves and
// zooms with the camera). Two looks:
//   spot:  everything but the target sits under a light translucent glass veil; the target
//          stays clear inside a soft white ring (for the control about to be pressed).
//   glass: the same light veil, a touch more frosted; the target reads clear (for walking
//          through a block of text one part at a time).
// The blurred layer is a still of the app taken when a focus starts (focusImage), blurred with
// an ordinary CSS filter: a live backdrop-filter inside the zoomed stage left mirrored ghosts of
// the text. The target is cut out with an even-odd clip path, so the live page shows there.

const AREA = { left: 44, top: 76, w: 1832, h: 968 }   // the app viewport inside the window
const P = 48                                           // padding of the still, edges extended
let wrap, still, tint, halo

function build() {
  const stage = document.getElementById('stage')
  const box = document.createElement('div')
  box.id = 'focus'
  box.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none'
  wrap = document.createElement('div')
  wrap.style.cssText = `position:absolute;left:${AREA.left}px;top:${AREA.top}px;width:${AREA.w}px;height:${AREA.h}px;overflow:hidden;display:none`
  still = document.createElement('canvas')
  still.style.cssText = `position:absolute;left:${-P}px;top:${-P}px;width:${AREA.w + 2 * P}px;height:${AREA.h + 2 * P}px`
  tint = document.createElement('div')
  tint.style.cssText = 'position:absolute;inset:0'
  wrap.append(still, tint)
  halo = document.createElement('div')
  halo.style.cssText = 'position:absolute;box-sizing:border-box;display:none'
  box.append(wrap, halo)
  // Above the window and the highlight, below the cursor.
  stage.insertBefore(box, document.getElementById('cursor'))
}

// The still of the app viewport (url: an image of AREA at dpr), drawn with its edge pixels
// stretched into a padding, so the blur has real content to sample at the window's edges.
export async function focusImage(url, dpr) {
  if (!wrap) build()
  const img = new Image()
  img.src = url
  await img.decode()
  const W = AREA.w * dpr, H = AREA.h * dpr, p = P * dpr
  still.width = W + 2 * p; still.height = H + 2 * p
  const g = still.getContext('2d')
  const iw = img.naturalWidth, ih = img.naturalHeight
  g.drawImage(img, 0, 0, iw, 1, p, 0, W, p)                 // top edge
  g.drawImage(img, 0, ih - 1, iw, 1, p, p + H, W, p)        // bottom edge
  g.drawImage(img, 0, 0, 1, ih, 0, p, p, H)                 // left edge
  g.drawImage(img, iw - 1, 0, 1, ih, p + W, p, p, H)        // right edge
  g.drawImage(img, 0, 0, 1, 1, 0, 0, p, p)                  // corners
  g.drawImage(img, iw - 1, 0, 1, 1, p + W, 0, p, p)
  g.drawImage(img, 0, ih - 1, 1, 1, 0, p + H, p, p)
  g.drawImage(img, iw - 1, ih - 1, 1, 1, p + W, p + H, p, p)
  g.drawImage(img, p, p, W, H)
}

function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
}

// f: {x, y, w, h, r, a, mode} in stage px (a = 0..1 visibility); camS: the camera's scale, so the
// blur is the same on screen whatever the zoom.
export function drawFocus(f, camS = 1) {
  if (!wrap) build()
  const a = f ? Math.max(0, Math.min(1, f.a)) : 0
  if (a < 0.002) { wrap.style.display = 'none'; halo.style.display = 'none'; return }
  wrap.style.display = 'block'; halo.style.display = 'block'
  const lx = f.x - AREA.left, ly = f.y - AREA.top
  wrap.style.clipPath = `path(evenodd, 'M0 0 H${AREA.w} V${AREA.h} H0 Z ${roundedRect(lx, ly, f.w, f.h, f.r)}')`
  const glass = f.mode === 'glass'
  // A light glass veil: the page stays clearly visible through it, with at most a hair of
  // blur (1.5 css px on screen) and a soft white frost; the focused region is clear.
  const blur = 1.5 / camS * a
  still.style.opacity = String(a)
  still.style.filter = `blur(${blur.toFixed(2)}px)`
  tint.style.background = `rgba(255,255,255,${((glass ? 0.62 : 0.55) * a).toFixed(3)})`
  Object.assign(halo.style, {
    left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px`, borderRadius: `${f.r}px`, opacity: String(a),
    boxShadow: glass
      ? `0 0 0 ${1 / camS}px rgba(20,20,30,0.08), 0 ${10 / camS}px ${40 / camS}px rgba(20,20,40,0.10)`
      : `0 0 0 ${2.5 / camS}px rgba(255,255,255,0.95), 0 0 0 ${3.5 / camS}px rgba(20,20,30,0.06), 0 ${8 / camS}px ${30 / camS}px rgba(20,20,40,0.22)`,
  })
}
