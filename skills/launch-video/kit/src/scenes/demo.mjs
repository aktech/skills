// Product scene: ask in plain words, create, watch the steps tick one per beat, celebrate, then
// point at the new row and walk through the notes with the glass spotlight. Times are seconds
// from the scene's start; moves start and end on beats. Each new page first shows whole.
// Camera boxes are stage px (product layout px x 1.27222 + the window's offset (44, 76)).
const MOVE = 1
const INPUT = '#q', CREATE = '#create', ROW = '#new'
const CONTENT = { x: 325, y: 76, w: 1551, h: 873 }   // the page without its sidebar
const TOP = { x: 325, y: 90, w: 1551, h: 500 }       // title, box, steps
// One part of the notes: its heading and the paragraph under it.
async function part(c, i) {
  const a = await c.box(`#note h3:nth-of-type(${i})`), b = await c.box(`#note p:nth-of-type(${i})`)
  return { x: a.x, y: a.y, w: a.w, h: b.y + b.h - a.y }
}

export default {
  kind: 'product',
  async setup(c) { await c.go('/'); c.park(1180, 640); await c.setStage(0) },
  script: [
    // As the window settles, the camera heads for the box with the cursor.
    [0.5, async (c) => { await c.move(INPUT, MOVE, { fx: 0.25 }); await c.zoom(TOP, 1920 / TOP.w, MOVE) }],
    [1.5, (c) => c.click(INPUT)],
    [2, (c) => c.type('Quarterly revenue by region')],
    [4.25, (c) => c.move(CREATE, MOVE)],
    // Bring the eye to the button: everything else under the translucent veil. The veil
    // leaves before the click changes the page (a still of the old page would ghost).
    [4.5, (c) => c.focus(CREATE, { mode: 'spot', pad: 8, r: 14 })],
    [5, (c) => c.focus(null, { dur: 0.25 })],
    [5.25, async (c) => { await c.hover(CREATE); await c.click(CREATE) }],
    [6, (c) => c.setStage(1)],
    [6.5, (c) => c.setStage(2)],
    [7, async (c) => { await c.setStage(3); c.confetti() }],
    // The result: the page, then the new row, highlighted.
    [7.5, (c) => c.zoom(CONTENT, 1920 / CONTENT.w, MOVE)],
    [8.5, (c) => c.highlight(ROW)],
    // The notes, one part at a time.
    [9.5, async (c) => { await c.highlight(null); await c.zoom('#note', 1.3, MOVE) }],
    [10.25, async (c) => c.focus(await part(c, 1), { mode: 'glass', pad: 12 })],
    [11, async (c) => c.focus(await part(c, 2), { mode: 'glass', pad: 12 })],
  ],
}
