// Runs in every frame before its own scripts, and acts only inside the filmed product
// (the #app frame): not in the compositor page, not in a second page the product opens.
(() => {
  if (window === window.top || location.pathname.startsWith('/__v/')) return
  if (window.frameElement && window.frameElement.id !== 'app') return

  // Video clock for the product's CSS animations: the recorder slows the page's animation
  // clock to a crawl and calls this once per frame with the video time (ms), so each animation
  // runs from the moment it was first seen at its natural speed.
  const started = new WeakMap()
  window.__videoTick = (now) => {
    for (const a of document.getAnimations()) {
      if (!started.has(a)) started.set(a, now - (a.currentTime ?? 0))
      a.currentTime = now - started.get(a)
    }
  }

  // No scrollbars on camera.
  const style = () => {
    const s = document.createElement('style')
    s.textContent = '::-webkit-scrollbar{display:none} *{scrollbar-width:none}'
    document.documentElement.appendChild(s)
  }
  if (document.documentElement) style()
  else document.addEventListener('DOMContentLoaded', style)

  // Mock data: answer the product's API calls the story needs, so every screen agrees (names,
  // states, ids). window.top.__stage is set by a scene (ctx.setStage) to move progress along.
  // Everything else goes to the real server.
  const native = window.fetch.bind(window)
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const MOCKS = [
    // [method, path regex, (url, req) => Response]
    // ['GET', /^\/api\/example$/, () => json({ ok: true })],
  ]
  window.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(new URL(String(input), location.origin), init)
    const url = new URL(req.url)
    for (const [method, re, answer] of MOCKS) if (req.method === method && re.test(url.pathname)) return answer(url, req)
    return native(input, init)
  }
  void json
})()
