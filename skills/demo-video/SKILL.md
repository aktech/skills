---
name: demo-video
description: Build a narrated 4K product walkthrough video with Playwright, TTS and ffmpeg. Covers real 4K capture, drawn cursor and highlights, camera zoom, narration voice, audio/visual sync, trimming and cutting dead air. Triggers on demo video, walkthrough video, record the UI, narrated screencast, product demo recording.
---

# Automated demo videos

Pipeline: **TTS narration, then Playwright recording, then ffmpeg merge**. Narration is
generated first and drives the pacing; the recorder holds each shot for exactly as long as
its clip.

## The pipeline

Build it fresh for each video, in its own directory with its own `package.json`, TTS venv
and ffmpeg environment. Never add a new video's scripts to an existing demo repo; it
pollutes that repo. Pin every dependency exactly and run supply-chain checks before
installing.

Five parts, each with one job:

1. **Narration script** (Python, Pocket TTS, voice `george`): a list of (clip file, words),
   one clip per thing the viewer sees, spelled for the voice. Writes the WAVs and
   `durations.json` in milliseconds. It must be able to regenerate only named clips and
   keep every other clip and duration, because the voice never says a line in the same
   time twice (rule 21).
2. **Recorder** (TypeScript, Playwright, run with tsx): stages the backend off camera
   (rule 9), opens a 4K take (rule 16), starts a scene clock, then plays one scene per
   clip. A scene has three steps: `arrive` (navigation, before the clip's timestamp is
   taken), `lead` (a highlight, ~400ms ahead of the words), `act` (what the words
   describe), and holds the shot until the clip ends (rule 3). Dead air goes inside a
   `skip` that records its from/to on the scene clock (rule 17). At the end it writes
   `timestamps.json` (clip, start_ms) and `recording.json` (preroll_ms, cuts, and the
   opening's end), and moves the video to `demo.webm`. Its helpers: drawn cursor that
   survives navigation, click = move + ring + press at 2x coordinates (rules 6, 16),
   highlight/clear, camera zoom on the page's own container (rule 13), a brightness nudge
   against encoder ghosts, typing a terminal command, polling with a timeout.
3. **Panels page** (HTML served by the recorder through `context.route`): title card,
   diagrams, mock editors, anything that is not the real product. Panels change with a
   hard cut. Diagram arrows draw themselves (animate `stroke-dashoffset` from the path
   length to 0, then add the arrowhead marker and the label, since a marker would sit at
   the end from the first frame).
4. **Converter** (Python + ffmpeg): trims the head start, forces a constant frame rate,
   drops the cut stretches, and mixes each clip with `adelay` at its offset minus the cuts
   before it (rules 11, 17). With an "opening" flag it joins a short opening-only take onto
   the last full take.
5. **Runner** (shell): narration if missing, record, convert; and an opening-only mode.

**The opening-only take.** Everything that needs no backend (title, diagrams, mock
editors) comes first. The recorder marks where that part ends, in every take, before the
first cut; in opening-only mode it stops there and needs no backend. The converter joins
opening-only[0:its mark] onto full[its mark:]. A change to the opening then takes a minute,
not a full re-record (rule 21).

**What to re-run for a change.** A narration line that still fits its slot: regenerate
that clip, re-run the converter. Anything before the opening mark: the opening-only take.
Anything else: a full take. Verify every time by pulling frames and looking at them.

## HARD RULES

**Keep this skill updated.** Every gotcha, timing, selector or fix discovered while building
a demo goes in here in the same session. These rules exist because each one was a correction.

### 1. Real 4K. Never upscale.

Record natively at 3840x2160. Do not record smaller and scale up in ffmpeg; it shows and
will be rejected.

The trap: `deviceScaleFactor: 2` **does not reach Playwright's video encoder**. A 1920x1080
page lands 1:1 in a 3840x2160 canvas and leaves three quarters of the frame empty.

What works:

```ts
viewport: { width: 3840, height: 2160 },
recordVideo: { dir: OUTPUT, size: { width: 3840, height: 2160 } },
// then, via addInitScript on DOMContentLoaded:
document.documentElement.style.zoom = "2";   // layout behaves as 1920x1080
```

If the page has a canvas (a terminal, a chart), `vw` sizing or dropdowns rendered in a
portal on `<body>`, skip this zoom and use **rule 16**, which reaches the same 3840x2160 without touching the document.

### 2. The zoom costs exactly one correction, on overlays only

Measured, not assumed (write a small probe if in doubt):

- `locator.boundingBox()` and in-page `getBoundingClientRect()` both report **zoomed** CSS
  pixels, spanning 0..1920.
- A `position: fixed` overlay is a child of the zoomed root, so its `left`/`top` get
  multiplied by the zoom **again**.

So every overlay divides measured coordinates by `ZOOM`, and nothing else does. Getting this
wrong puts highlights off-screen or half a page away.

### 3. Sync: navigate before the clock starts

Give each scene an `arrive` step that runs **before** the clip's timestamp is recorded, and a
`lead` step for highlights. Otherwise the voice announces a section a beat before it appears.

```ts
scene(page, clip, { arrive, lead, act })
//   arrive: navigation, before the timestamp
//   lead:   highlights, before the voice
//   act:    what the words describe, during the clip
```

**One clip per highlight.** Never narrate "who, what and when" over a single clip and move
the highlight mid-clip: it will drift. Split into one short clip per column or region.

### 4. Voice

Kyutai Pocket TTS, voice **`george`**, the same across demos so they sound like one
product. `pocket-tts==3.1.0` (OSV clean, wheel, no install scripts).

```python
from pocket_tts import TTSModel
model = TTSModel.load_model()
state = model.get_state_for_audio_prompt("george")
audio = model.generate_audio(state, text)
scipy.io.wavfile.write(path, model.sample_rate, audio.numpy())
```

Write `durations.json` in **milliseconds**. Keep a `SPOKEN_TO_WRITTEN` map for pronunciation
spellings (a CLI name spelled the way it is said) so the phonetic form never reaches the screen.

### 5. Narration content

- **Do not enumerate the sections in the intro** when the video then shows every section.
- Never phrase anything as "X, not Y" / "rather than" / "never copied". Say what it is.
- Slow down and split clips where the visual needs time to land.

### 6. Cursor and clicks

- Draw a fake cursor; a headless click leaves no visible cause.
- **Park it centre-frame before recording starts**, so the first move reads as a journey
  rather than a jump from the corner.
- Ring every click with a brief pulse so the viewer sees what was pressed.
- Highlight the region being discussed, and clear it afterwards.

### 7. Highlight geometry

Measure the cells, then adjust per the element's own padding. Table cells with **zero left
padding** need the outline *outside* the column on the left, or the border lands on the first
character; tuck the right edge inside the cell's right padding so it stays clear of the next
column. Symmetric padding fails in one direction or the other.

### 8. Captions

Off by default; ask before adding them. If used:

- reveal a **phrase at a time**, TikTok style, never a whole paragraph at once;
- run them **ahead** of the voice (~450ms): a subtitle arriving with the word is already missed;
- fold a one- or two-word tail into the previous chunk.

### 9. The demo must seed its own preconditions

A demo that mutates state consumes what it needs. Demoting an administrator worked once, then
silently did nothing on every later run because nobody was left to demote. **Set up the
starting state off camera** before recording, and reset the demo database between takes rather
than recording against whatever the last run left behind.

### 10. Closing scene

Do not end on a theme toggle (dark/light mode) by default. End on the outcome the viewer
cares about: for a flow, show where the person lands afterwards (their home page, what they
can now do), then the other side's confirmation. Ask before adding a theme scene.

### 11. Trim the head start, or the voice runs ahead of the picture

Playwright's video starts rolling when the page is created. The scene clock (`started`)
starts later, after the first page has loaded and the cursor is parked: about 1.8 seconds.
Clip offsets are counted from the scene clock, so mixed onto the untrimmed video every clip
plays that much **early**.

Measure it and cut it:

```ts
const rolling = Date.now();            // just before context.newPage()
...
started = Date.now();                  // first scene
// at the end
fs.writeFileSync("recording.json", JSON.stringify({ preroll_ms: started - rolling }));
```

```bash
ffmpeg -i demo.webm -ss "$PREROLL" ...   # -ss after -i: accurate, we re-encode anyway
```

To check sync, extract a frame at `start_ms + 400ms` of a clip with a highlight: the
highlight must already be up.

### 12. One take across several pages and several people

- **Stay in one tab.** One page means one video file. Change who is signed in by swapping
  cookies off camera (`context.clearCookies()`, then `context.addCookies(saved)`); the tab's
  `sessionStorage` survives, which matters when a page keeps state there.
- **Every navigation throws the cursor away.** Keep its position in Node, outside the page,
  and have `ensureCursor` redraw it there. Call `ensureCursor` after each navigation.
- **The init script zoom applies to every page**, third-party ones included (an identity
  provider's sign-in form). Probe them at the recording viewport before writing selectors.

### 13. Camera zoom

- Transform the page's **own container** (`#root`, the identity provider's page div), never
  `<html>` or `<body>`: a transform there turns every `position: fixed` overlay into an
  absolute one. Overlays live on `<body>`, outside the container, and stay in screen space.
- The origin that puts a target in the middle of the frame: `o = (centre - s*p) / (1 - s)`,
  in **layout** pixels (measured box divided by ZOOM).
- **Clamp the origin to the frame.** Unclamped, a target near an edge drags that edge into
  view and leaves an empty band.
- After a zoom the target has moved under a cursor that did not. Move the cursor again
  before typing or clicking.
- `boundingBox()` is post-transform, so highlights and cursor moves need no extra maths.
- **Anything you draw with text or thickness lives outside the transform**, so it stays
  page-sized while the camera is in. Keep the camera's scale in Node (`cameraScale`, set by
  `zoomTo`/`zoomOut`) and multiply font sizes, paddings and borders of drawn overlays by it.
  An unscaled drawn menu comes out at two thirds of the control's text.

### 14. Stage a separate instance; never film the development one

The development database holds whatever was typed into it, real email addresses included,
and they end up on screen in a list. Run a second instance for the demo on its own port and
its own database, recreated before every take by a staging script. That also covers rule 9.

### 15. Smaller things that each cost a take

- **No named functions inside `page.evaluate`.** `tsx` wraps every named function or
  `const f = () =>` in a `__name(...)` call that does not exist in the page
  (`ReferenceError: __name is not defined`). Inline the code, pass anonymous callbacks, or
  evaluate a string.
- **Fade the click ring before the press lands.** A ring that outlives the click hangs over
  empty space when the page changes under it.
- **Fill the clip, not the gap.** Typing that runs past its clip is silence. Either give it
  its own clip or move it inside one with time to spare.
- **Email with no mail client:** catch the message with a local stand-in and draw a
  **full-screen fake mail client** (folders, message list, reading pane) over the page, then
  open the message and click its link. A modal card over the app does not read as an email.
  Show the one-time code as dots.
- **Inline `style=""` is dead under the page's CSP.** `style-src 'self'` refuses style
  attributes in injected markup (everything renders unstyled, fonts and all). Styles set
  from script pass: carry them in `data-s` and apply with `el.style.cssText = el.dataset.s`,
  or use `Object.assign(el.style, {...})`.
- **Cut narration that states the obvious.** Each clip should say something the picture
  does not.
- **`localhost` can be somebody else.** A port-forward or tunnel bound to IPv6 localhost
  wins over a container published on IPv4. Address local services as `127.0.0.1`.
- **A `<select>` has no visible menu in a headless recording.** The native dropdown is
  drawn by the OS, so `selectOption()` shows only as the control's text changing. Draw the
  menu yourself: read the options, append a fixed `div` under the control (coordinates
  divided by ZOOM), move the cursor to the chosen row, tint it, pulse, remove the menu,
  then `selectOption()`.
- **Give each person a face.** When a recording changes hands, swap the header's initials
  avatar for a picture: illustrated SVGs served by `context.route()` on the app's own
  origin so `img-src 'self'` allows them. Re-apply after every navigation (it rides along
  in `ensureCursor`).
- **Say when the recording changes hands.** "Back on the administrator's page, ..." The
  cut from one person to another is not obvious from the picture alone.
- **A hash-only navigation never reloads a single-page app.** `/admin/` to
  `/admin/#invitations` keeps the bundle that was already loaded. After rebuilding the UI,
  `location.reload()` (or `goto` a different path first) before trusting what is on screen.
- **Stop a recording before changing the UI it films.** A rebuilt bundle is picked up at the
  next full navigation, so a take that spans a rebuild shows two versions of the same screen.
  Kill the recorder, rebuild, restage, record again.

### 16. A canvas, a `vw` layout or a portal dropdown on the page: scale the picture, not the document

The document zoom from rule 1 is fine for plain DOM pages. It **breaks** anything that
measures itself:

- a canvas-based widget (terminal, chart) draws at the wrong size, or keeps its axes and
  loses its data;
- a layout sized in `vw` comes out twice too wide and slides off the frame;
- a dropdown rendered in a portal on `<body>` lands twice too far from its trigger, and a
  scroll lock that pads `<body>` by `innerWidth - clientWidth` pads it by half the frame,
  collapsing the page into a sliver.

What works for those pages, and is cleaner everywhere: leave the document alone and tell
the browser to scale the picture.

```ts
const context = await browser.newContext({
  viewport: { width: 3840, height: 2160 },
  recordVideo: { dir: OUTPUT, size: { width: 3840, height: 2160 } },
});
const page = await context.newPage();
const devtools = await context.newCDPSession(page);
await devtools.send("Emulation.setDeviceMetricsOverride", {
  width: 1920, height: 1080,
  deviceScaleFactor: 2,       // canvases draw at 2x, so they stay sharp
  scale: 2,                   // the picture is scaled onto the surface
  mobile: false,
  dontSetVisibleSize: true,   // without this the surface shrinks to 1920x1080
});
```

The page then behaves like a 1920x1080 HiDPI screen: `innerWidth` is 1920, and **there is
one coordinate space**. `boundingBox()` is already what a style needs; nothing is divided
by ZOOM, so rule 2 does not apply. Measured by a probe that recorded each candidate
(`deviceScaleFactor` alone, `scale` alone, both, with and without `dontSetVisibleSize`).

It costs one correction, on **mouse input**:

- `locator.click()` misses. The browser maps the mouse back through the scale, so a press
  aimed at page point (x, y) lands at (x/2, y/2), on whatever is there (Playwright reports
  another element "intercepts pointer events"). Send the pointer to the scaled position:
  `page.mouse.click(x * 2, y * 2)` from the element's `boundingBox()`. Keyboard input,
  `pressSequentially`, `fill` and `focus` are unaffected.
- A canvas terminal can still draw at **twice** its font size under the scaled picture.
  Lower its own font size setting to compensate, and check the app accepts the value (a
  value below its minimum can be rejected and silently replaced by the default).
- A dropdown that opens in a portal on `<body>` sits outside the container the camera
  transforms: right place, page-sized text. While the camera is in, set its wrapper to
  `translate(trigger.left, trigger.bottom) scale(cameraScale)` on a short interval and
  give the list the trigger's width divided by the scale.

### 17. Cut the dead air instead of narrating over it

Page loads and a server starting are seconds of nothing. Mark them in the recorder and
remove them in the converter:

```ts
async function skip(work) {            // from/to on the scene clock
  const from = Date.now() - started; await work(); cuts.push({ from_ms: from, to_ms: Date.now() - started });
}
```

Converter: one filter chain,
`trim=start=PREROLL,setpts=PTS-STARTPTS,fps=25,select='not(between(t,a,b)+...)',setpts=N/(25*TB)`,
and every narration clip's `adelay` reduced by the cuts that end before it. A clip must
never start inside a cut. Force a constant frame rate before `select`; Playwright's video
is variable.

### 18. More things that each cost a take

- **Aim the camera at the content, not the block.** A full-width block's centre is empty
  editor; zooming to it pushed the text off the left edge. Pass a box that covers where
  the text is (`{ ...box, width: 1000 }`) and let the clamp anchor the edge.
- **Never poll with the tool the take is running.** Polling a CLI every 400ms while the
  same CLI ran in the filmed terminal made it fail on camera with "database is locked":
  every process opened the same database file with no busy timeout. Poll with
  something else (`test -x`, `pgrep`), or check once afterwards.
- **A faded overlay leaves a ghost.** After a title card fades out, its text lingers
  faintly on the parts of the page that then sit still (the recorder's encoder skips
  unchanged blocks). Make the overlay opaque, and after removing it nudge the whole
  picture for a few frames (`documentElement.style.filter = "brightness(0.985)"`, 160ms).
- **Open the app in a clean state.** Start in the folder or view the scene needs, so no
  `cd` or navigation is filmed. Hide first-run notices and columns that show
  clock-dependent text (a "modified" column reads "next yr." when the server clock is a
  hair ahead). Clear leftovers from earlier takes in the stage step, or a tab reads
  "Terminal 2".
- **A values or config change with no screen to film:** serve a small editor-and-terminal
  page from the recorder with `context.route()` and type into it from page functions.
  Mind `.row[hidden]`: an author `display:flex` beats the `hidden` attribute.
- **A consent page that appears once per user:** press it in the off-camera stage
  context and carry the cookies over.
- **Check the app the demo deploys, too.** A sample app that redrew its chart on input left
  a stale number on screen. Exercise it and assert what it shows before filming.

### 19. Style and wording

- **One monospace font everywhere.** Mock editors, terminal strips, the app's own terminal,
  inline code in a demo app. Install it locally so the recording browser finds it by name.
- **Do not point the camera at a terminal. Make its font bigger.** A terminal is a canvas;
  a camera zoom stretches its pixels. Raise the terminal's own font size so each glyph is
  drawn at full resolution (12px reads as 24px under rule 16 and still fits a 100-column
  table beside a sidebar).
- **Show the state the commands leave behind.** After a command that registers or creates
  something, run the listing command too; a success line alone is not enough.
- **Ask whether a setting is new before deciding how to film it.** A setting the audience
  already has is only shown and explained; one the change introduces is typed in and
  rolled out.
- **Use the product's exact terms, consistently.** Agree the names (qualified where a bare
  word is ambiguous) and their voice spellings before writing narration. Name one framework
  "for example" when it is one of several.
- **Say why, then how.** The opening explains the situation in the user's terms before the
  setting appears.

### 20. Measured while building a generic recorder engine

- **A camera that needs nothing from the page** (use this where rule 13's container
  transform is awkward). Re-send `Emulation.setDeviceMetricsOverride` with its `viewport`
  parameter on every step of the move. Under rule 16's capture, for a view whose top left is
  `(left, top)` in layout pixels at zoom `z`:
  `viewport: { x: 2*left, y: 2*top, width: 3840/z, height: 2160/z, scale: z/2 }`.
  At 1080p (send `deviceScaleFactor: 1` and no `scale`), `x`/`y` are layout pixels and
  `scale` is `z` itself. Everything zooms together: popups on `<body>`, fixed headers, the
  drawn cursor and highlight. Mouse coordinates and `boundingBox()` do not change while
  zoomed. 45 steps over 900 ms with ease in out cubic reads as smooth.
  - The browser does not clamp. Do it: `left = min(max(cx - 960/z, 0), 1920 - 1920/z)`.
  - `viewport` alone is refused; send the whole override each time. A misspelt parameter
    is accepted silently, so check names against the protocol, not against an error.
  - The zoom survives a navigation. Zoom out on purpose before a `goto` and at the end.
- **Playwright's recorder encodes VP8 at about 1 Mbit/s whatever the frame size.** 4K
  frames carry block noise during motion and settle when the picture is still. A sharper
  path would be grabbing frames over the protocol and encoding them ourselves.
- **Mouse input through `page.mouse` skips every check `locator.click()` does.** A click on
  a button under a cookie banner or a loading layer lands on the cover with no error, and
  a disabled button gets a ring and nothing happens. Ask the page what is at the point
  first (`elementFromPoint`): accept the target, something inside it, something containing
  it, or the target's own `<label>` (custom checkboxes and toggles hide the input under
  its label).
- **`page.goto` to a 404 or 500 succeeds.** Check the response's status, or a typo in a
  path films the server's error page.
- **`context.storage_state()` opens a hidden tab for every origin that no longer has one
  open.** Polling it while somebody signs in through an identity provider flickers tabs
  twice a second. Poll `context.cookies()` and each open page's own `localStorage`
  instead, and take one full read at the end.
- **Pocket TTS clips start with about 0.6 s of silence.** Speech begins that long after
  the clip's offset. Sync is still right; trim the head if the pacing feels slow.
- **A highlight that fades in is not fully drawn until the fade ends.** With a 200 ms fade
  and a 400 ms lead, a frame 300 ms before the voice can show a half-transparent box.
- **Python hides `ResourceWarning`.** Leaked ffmpeg pipes and browsers only showed up with
  `filterwarnings = ["error"]` in pytest. Turn it on from the first test.

### 21. Scenes, narration and partial re-takes

- **Highlight a status change as it happens.** When a confirm button flips a status chip
  (for example "Running" to "Stopped"), put the highlight on the chip **as the confirm is
  pressed**; a highlight in the next clip lands on the new state and the change is missed.
  Probe a page before writing selectors: open it at the recording's size, dump buttons and
  `[role=menuitem]` with their boxes, screenshot, and click through once. Duplicate ids
  across cards are common; pick with `.first()` or scope to the card.
- **Staging must see stopped resources too.** An API that omits stopped items by default
  left an earlier take's stopped app in place, and the next take deployed a second one with
  the same name. Ask for stopped items before deleting.
- **An opening diagram explains the concept before any code.** One clip per beat (parts,
  then the path that does not apply crossed out, then the path that does lit). It lives in
  the same served page as the title. Do not draw the cursor over a diagram: nothing is
  clicked there, and parked mid-frame it covers a box's text.
- **Narration says what happens, neutrally, and nothing else.** "They save it as app.py."
  Every qualifier the picture does not need turns a choice into a rule: "in the same
  folder", "on a small server", "as it stops, the server saves" are each read as requirements.
  Do not over-correct either ("it doesn't have to be named app.py"): that pushes the other
  way. Check every new line for this before proposing it, not only the line that was
  flagged; a fix that stays local gets corrected again on the next line. Mechanism detail
  belongs in the docs.
- **Change one part without filming the rest.** What needs no backend (title, diagram, a
  served page) gets its own short take (an opening-only mode), and the converter joins it
  to the last full take at that take's first cut. Join at a cut, where the picture changes
  anyway, and check frames on both sides of the join.
- **The voice is not repeatable.** Pocket TTS said the same line in 3.76s, then 3.92s.
  Regenerating every clip puts a recorded take out of sync with its narration. Regenerate
  only the clips whose words changed; a changed line that fits its old slot needs no new
  footage at all, only the converter.
- **Cut between full-screen panels; do not fade.** A faded diagram left its ghost on the
  next panel for a second and a half, even with the brightness nudge. A hard cut leaves
  nothing.
- **Do not let staging do what the viewer needs to see.** A file copied in off camera
  "magically appears". Create it in the take (new file, paste, save, any dialog the first
  save opens). Use `ControlOrMeta+s`: on a macOS
  recording browser `Control+s` does nothing. Paste the code (one `insertText`); typing it
  is not what the demo is about.
- **Clear server-side state the scene claims to create.** Delete it in staging and check it
  after the scene, so state from an earlier take can never make the scene pass on its own
  (rule 9).

### 22. Stage through the app's API with a token

Sign in once in a browser off camera, mint an API token, and use it for every staging call.
Form login plus CSRF tokens via `curl` is a trap of 403s that look like a wrong password.

Related traps, each seen while staging:

- `curl -c jar` without `-b jar` rewrites the jar without the session cookie. Every call
  after it is a 403 until you log in again.
- `waitUntil: "networkidle"` may never settle on a page that keeps polling. Wait for
  `domcontentloaded` and then for a selector.
- Server logs are often in UTC. An hour's difference from the local clock is the time
  zone, not clock drift.
- On macOS Playwright's browsers live in `Library/Caches/ms-playwright` under the home
  directory, not `.cache/ms-playwright`; do not download them again if they are there.
- An idle timeout can stop a server the demo needs while you prepare. Start or check it
  in staging, right before the take.
- Never print a password, even to check it (`cat`, `od -c`, `echo`). Check its length
  (`wc -c`) or log in with it.

## ffmpeg

`-filter_complex_script` was **removed in ffmpeg 8**. Detect and fall back:

```bash
if ffmpeg -hide_banner -h full 2>/dev/null | grep -q -- "-filter_complex_script"; then
  FILTER_ARGS=(-filter_complex_script "$FILTER_FILE")
else
  FILTER_ARGS=("-/filter_complex" "$FILTER_FILE")
fi
```

Audio is mixed in at each clip's recorded offset with `adelay` + `amix`.

## Verify before handing over

Extract frames with ffmpeg and **look at them**: mid-scene, during each highlight, and at the
close. Check: full frame used, highlight on the right element and within bounds, cursor
visible, the demonstrated action actually happened. A "successful" render proves nothing about
what is on screen.
