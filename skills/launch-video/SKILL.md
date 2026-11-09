---
name: launch-video
description: Fundamental principles and pipeline for a premium product launch / promo video (Apple, Figma, Airbnb grade, music-driven, no narration) - story, honesty, typography, motion, camera, sound, music, deterministic rendering, delivery, and how the user wants the work run. Use for any launch video, product teaser, announcement or promo, "launch style video", "like <company>'s launch video". Not for narrated walkthroughs (that's demo-video).
---

# Launch videos: fundamental principles

Every rule here was stated or corrected by the user on a real launch video. Follow them from
the first draft so they never have to be repeated. Product-specific notes (story, wording,
brand choices) live in that video's own project folder, never in this skill.

## 0. Start from the kit
`kit/` is a working project that renders a complete example video (logo intro, cards, logo
globe, slot reel, a product shot with typing, clicks, focus veil, glass spotlight, highlight
and confetti, apps rolodex, statement, credit, logo outro) with every rule below built in.
- `cp -R <this skill folder>/kit <new project folder>`, then follow `kit/README.md`:
  `npm ci --ignore-scripts`, fetch logos, render a preview, look at it.
- Make it the product's: `brand.json` (name, mark path, font, colours, credit), `src/story.mjs`
  (shots and times), `src/scenes/*.mjs` (product shots), `src/app-inject.js` (mock data),
  `src/page/apps.js` (breadth apps). Film the real product with `APP_URL`, from
  `scripts/snapshot.sh`.
- Tools: node, ffmpeg, python3 (and uv if the video opens a small demo app of its own). Pin
  and vet any new dependency first. Music and sound effects are downloaded per video
  (licences forbid bundling them); the README says which files go where.
- Keep improving the kit: a fix made in a video that is not product-specific goes back here.

## 1. The default grammar
- **No voice, no captions.** Music plus short on-screen headlines and the real product.
- **Rhythm:** headline card 2-3 s, product shot 7-18 s, each card followed by the feature it
  names working. Hard cut between every shot, cut on a music beat; no crossfades or wipes.
- **Palette:** warm off-white cards (~#f5f5f3), warm near-black ink (~#25231c, never pure
  black), light grey for secondary marks; the logo ending on warm near-black (~#111009) with
  the mark in near-white.
- **Frame 0 is the finished logo lock-up** (one frame) so the poster is clean; the intro
  animation starts on frame 1. The last cut into the outro lands on a strong music hit.
- **Logo intro (~2 s):** a real 3D render of the mark tumbles near centre (~0.2 s), travels
  aside while the wordmark is uncovered from behind it (occlusion, not a fade), eases into
  its pose with a small overshoot by ~0.8 s, then holds still.
- **Logo outro (~2-3 s):** flat single-tone mark starts larger than the frame already
  spinning in 3D, shrinks to size in ~0.5 s, holds alone ~0.5 s, slides aside as the
  wordmark is uncovered left to right by a mask, short hold, end.
- **Camera grammar, three kinds:** eased zoom/pan (ease in-out, ~1.5-2.5x, aimed at the
  control about to be used); locked tight crop while content streams; zoom back out to
  re-establish. Real hover states and tooltips on camera.
- **Charts on cards** build axes first, then rows with ~0.17 s stagger; the hero row arrives
  grey like the rest, then turns ink with a bold label.
- Never copy another video's music, logo or wording.

## 2. Quality bar
- **A masterpiece, not a draft**: every minor detail matters; aim for an award-winning film.
- **Pixel perfect, Apple / Airbnb / Figma standard.** Alignment, optical centring, spacing on
  an 8 px grid, consistent stroke weights, kerning, easing, the first and last frame.
- **For anything designed (cards, overlays, highlights), show 3-4 mockups (still + short clip)
  and let the user pick** before wiring one in.
- Check every product screen on camera for real UI bugs; fix them in the filmed copy and tell
  the user so the product gets the fix too.

## 3. Story and words
- **Structure that works:** logo intro → claim → one headline card per feature, each followed
  by that feature working → breadth → values → credit → logo outro.
- **Plain words, no jargon, nothing a Twitter/Reddit crowd could call dumb or false.** Never
  claim what the product doesn't do; no made-up benchmarks; no counts for things that are
  growing; only show partner/provider logos the product genuinely works with.
- **Every cause, fix and outcome on screen must agree**: a careful viewer will check (a fix
  that doesn't cure the shown cause gets called out).
- **Main flow first, breadth after.** Show the core action before a breadth shot (templates,
  integrations), and connect scenes (click → progress → result), never jump.
- **Every example belongs to the story**: the thing you share, schedule or fix is the thing
  built earlier in the video, made in the product (never an unrelated object that happens to
  be in the demo data). For each feature pick the example that shows the product's newest,
  most distinctive ability.
- **Show the real outcome.** Open what was built or produced and make it beautiful with
  fictional but believable data. Point at real details (hover a chart point to show its
  real tooltip).
- **Cover the whole audience** (technical and non-technical): several kinds of user and use,
  not one kind of example repeated.
- **One idea per card.** Dense cards get split. Pictures only where the card is about the
  picture; never icons inline inside a sentence.
- **Say the benefit, not the paperwork**: the plain claim is the headline; any technical
  name behind it (a licence, a standard) is a quiet muted line under it, and the animation
  goes on the headline only.
- **Credit the makers** at the end: a small, muted "From the team that brought you ..." line,
  partner logos at exactly the same height, the URL typed in at the bottom; then the logo
  alone. No arrows, circles or boxes around anything on a card.
- **Don't squeeze into a minute.** Slow and clear beats rushed.
- Fake data, names and people only (alice/bob, example.com). No real personal data.

## 4. Typography and cards
- Use the product's own UI font for headlines, ~68 px at 1080p for sentence cards, bigger
  (~96 px) for short designed cards. Weight medium, not regular. No line wider than ~2/3 of
  the frame. Sentence case, full stop.
- Two surfaces: warm off-white cards and the real product; near-black only for the logo
  end. Ink is warm near-black, never pure black. Hard cuts between shots, no wipes.
- Text appears in its final position. Reveals are calm: a soft fade-up sweep (each word
  ~0.5 s fade + slight blur, staggered ~0.06 s), or an odometer roll for the key word.
  **Never jitter**: no letter typing on cards, no word-by-word build that re-centres,
  nothing shifting sideways. The one typed exception is a URL, typed in like an address bar.
- **Odometer ("speedometer") roll** is the signature move: for the main message, a credit
  line, and as metaphor (a word rolling through times before "schedule", through logos
  before "AI" / "infra", through numbers before "data", through people and team names
  before "team").
- **Odometer reels slow enough to read each item** (~0.3 s per item), logos always in brand
  colour, never black and white. Short headlines with a rolling slot share one big size.
- **Glass = translucent, not blur.** A spotlight's surround is a light translucent veil the
  page stays visible through, not a heavy blur over the whole page.
- **Keep every card's text centred**; decoration (a logo globe etc.) goes around it with an
  exclusion zone, never on it.
- **Breadth shots**: a slowly drifting 3D globe of logos (front and back depth) around a
  centred line; a rolodex of 4-5 real-looking apps from different kinds of user, each with
  real charts and tables.
- **Emphasise a key phrase with a hand-drawn pencil-brush underline** drawn in after the words.
- **Nothing ever leaves the frame.** Every element, at every frame (including mid-animation,
  the widest item a reel rolls through), stays inside a safe area (~120 px margins at 1080p).
  Check the widest state of every animated line with a script, not by eye.
- **Never pop things in with a scale/bubble spring, never drop or bounce them.** Things roll
  or rise through a mask.
- Logo intro: a real 3D render (three.js), mark tumbles in, settles with a small overshoot,
  wordmark uncovered from behind it by a mask. Outro: flat mark spins down from large to
  final size, slides aside, wordmark revealed, short hold.
- Third-party logos: use a CC0 set (e.g. Simple Icons) in brand colour; check trademark
  rules before using anything else (some foundations forbid their logo without permission).
  A company with no available logo gets its name in plain text.

## 5. Product shots and camera
- Film the **real product**, from a frozen snapshot of the **latest** main (re-snapshot before
  every final render), with mock data patched in one place so every screen agrees.
- **Each product shot enters with motion**: the browser window swings in (tilted, settling flat
  in ~0.8 s), **from a different direction each time**, then the camera goes straight to the
  first target. Never cut to a static window.
- **Establish, then zoom**: every new page first shows whole, then eases in. Never open zoomed.
- **Cursor speed like a real hand**: distance-based, ~0.5 s for short hops up to ~0.9 s for
  long moves (a fixed 1.25 s felt sluggish); no idle wait before the cursor heads for the
  next control. Typing ~15 characters a second so key sounds read as typing.
- **Smooth, on the beat, not too fast**: camera moves ≥ ~1 s, ease in-out, start and end on
  beats; hold 1.5-2 s on each result. No slow creep that stops (reads as jitter).
- **Focus the eye on dense screens**: dim everything but the control being pressed; reveal long
  text one section at a time with a translucent glass spotlight.
- **Bring the target to the middle before acting on it** (scroll a button near the bottom up
  to centre, then click), and after a fix lands, highlight the proof (e.g. the status).
- **Point at what changed** with a precise, subtle highlight (accent wash between the row's own
  dividers + thin leading bar), never a thick outline, arrow, circle or glow.
- **Celebrate the payoff** (e.g. confetti when the thing is ready).
- Progress steps tick one at a time, one per beat, never two at once.

## 6. Sound and music
- **Music must be exciting and real**: code-synthesised tracks get rejected. Use a licensed
  royalty-free track (commercial use, no attribution traps), render 5-10 candidate versions
  on the actual picture for the user to choose, then fit it: tempo-match (a few % speed
  change) so beats land on a 0.5 s cut grid, measure the start offset, cut on beats.
- **Real recorded sound effects only**: a key click per typed character, a mouse click on every
  click, sliced from real recordings. Never synthesised clicks. No music ducking under them.

## 7. Pipeline and rendering
- **Deterministic, frame by frame**: a headless browser compositor page (Playwright) renders
  each frame from a virtual clock at 4K 60 fps (1920x1080 layout, device scale 2); ffmpeg
  assembles. Never screen-record in real time.
- **Drive page animations from the video clock**: CDP `Animation.setPlaybackRate` near 0 and
  set each animation's current time per frame, so product CSS animations play at natural
  speed in a slow render. Shorten the product's poll intervals in the snapshot so states
  change per frame step.
- **Snapshot the product** with `git archive <commit>` into the video project and serve it on
  its own port; never film the live working tree (a branch switch kills a render). Patch mock
  data through one injected fetch wrapper.
- Embedded local apps on another port: Chrome needs
  `--disable-features=LocalNetworkAccessChecks` to frame them. Address local services as
  127.0.0.1. Pin and vet every dependency.
- Log every key press and click time during the render; the assembler mixes the sounds at
  those absolute times.
- **Render in parallel on equal frame ranges** (not shot boundaries: the longest shot then
  bounds the run), ~12 workers on a 16-core machine; a worker starting mid-shot replays the
  shot without capturing. **Patch, don't re-render**: cut changed shots into ~3 s chunks, run
  12 at a time, one encode at the end.
- **The product's own timers run on real time**, so a chunk that starts mid-shot can catch it
  in a different state (a list still expanded, a toast still showing). Drive anything visible
  from the video clock or a mocked stage, and check the frames at every chunk seam.
- **Status without being asked**: post real progress (frames done / total, time left)
  every few seconds to a minute while anything renders (asked for repeatedly), and give an honest finish time when asked.
- Keep a 1080p copy for social. Verify every cut by looking at frames before handing over.

## 8. Delivery
- **Thumbnail**: the final logo frame, copied losslessly from the rendered PNG (not grabbed
  from the encoded video), plus a 1920x1080 JPG under 2 MB for YouTube. Making frame 0 the
  finished logo lock-up also gives a clean poster.
- Title/description: plain words, chapter times from the shot table, no claims the video
  doesn't show.
- A stale link preview after a thumbnail change: check the platform's own thumbnail URL first;
  if it is new, the chat app cached its preview, so post a link variant it hasn't seen.

## 9. How the user wants the work run
- **Make the full video, then show it**, and iterate. When asked what's built, open the video.
- **Run independent parts in parallel with several agents**, each with full context, its own
  files and its own output folder.
- **Iterate fast**: change only what was asked, re-render only those shots, preview at
  1080p 30 fps, final at 4K.
- **Save every new instruction into this skill** the same session, as a general principle;
  product-specific decisions go in the project's own notes folder.
