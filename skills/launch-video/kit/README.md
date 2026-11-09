# Launch video kit

A music-driven product video, rendered frame by frame at 4K 60 fps from code: headline cards,
a 3D logo, the real product in a browser window with a camera, cursor, clicks and typing.

## Start

```sh
cp -R <skill folder>/kit my-video && cd my-video
npm ci --ignore-scripts && npx playwright install chromium
node scripts/logos.mjs assets/logos googlesheets notion figma googledrive dropbox trello airtable zoom gmail googlecalendar miro asana   # any Simple Icons slugs
```

Needs node, ffmpeg and python3. Out of the box it films `example-app/`.

## Make it yours

| File | What |
|---|---|
| `brand.json` | name, mark (an SVG path in a 100x100 box), font, colours, window URL, credit |
| `src/story.mjs` | the shots and their times (one beat = 0.5 s) |
| `src/scenes/*.mjs` | product shots: `setup` + `[time, action]` script (see `ctx` in `src/record.mjs`) |
| `src/app-inject.js` | mock API answers so every screen agrees |
| `src/page/apps.js` | the apps in the breadth shot |

Film the real product: `APP_URL=http://127.0.0.1:<port>/ node src/record.mjs ...`, ideally from a
frozen copy: `scripts/snapshot.sh <repo> <commit> [subdir] [patch.sh]`.

## Sound

Not included (their licences forbid passing the files on). Download royalty-free files that
allow commercial use, e.g. from Pixabay:

- `assets/music/track.mp3`: a real, exciting track. Fit it: `python3 scripts/beat.py assets/music/track.mp3`,
  then `scripts/make-music-track.sh assets/music/track.mp3 <offset> <120/bpm>`.
- `assets/sfx/keyboard.mp3`: a close-miked recording of someone typing (single presses are cut out automatically).
- `assets/sfx/click.mp3`: a real mouse click, then `scripts/make-click.sh` writes `click.wav`.

Missing files render as silence.

## Render

```sh
node scripts/render-parallel.mjs --preview          # 1080p 30 fps, frames/preview
scripts/assemble.sh frames/preview out/preview.mp4
node scripts/render-parallel.mjs                    # 4K 60 fps, frames/full
scripts/assemble.sh frames/full out/video-4k.mp4    # also writes out/video-1080p.mp4
scripts/patch-parallel.sh c-share d-demo            # re-render only these shots, re-encode
node scripts/check-slots.mjs                        # nothing in a slot card leaves the safe area
```

Thumbnail: the first frame is the finished logo lock-up.
`cp frames/full/00000.png out/thumbnail-4k.png && ffmpeg -i out/thumbnail-4k.png -vf scale=1920:1080 -q:v 2 out/thumbnail.jpg`
