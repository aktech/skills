// Turns a recorder keys.json into a keyboard-sound WAV on the video's timeline (48 kHz stereo),
// one real key press (cut from a recording, see src/keys/keys.html) per keystroke.
//   node src/keys/make-keys.mjs frames/full/keys.json out/keys-full.wav [--len 57]
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { TOTAL } from '../story.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const [input, output] = process.argv.slice(2)
const i = process.argv.indexOf('--len')
const LEN = i > 0 ? Number(process.argv[i + 1]) : TOTAL
const presses = JSON.parse(fs.readFileSync(input, 'utf8'))
// A real close-miked keyboard recording (see README: never a synthesised click).
const RECORDING = path.join(ROOT, 'assets', 'sfx', 'keyboard.mp3')
const mp3 = fs.readFileSync(RECORDING).toString('base64')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + path.join(ROOT, 'src', 'keys', 'keys.html'))
const { sr, b64, info } = await page.evaluate(async ([k, len, rec]) => {
  const { sr, left, right, info } = await window.render(k, len, rec)
  const pcm = new Int16Array(left.length * 2)
  for (let i = 0; i < left.length; i++) {
    pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)))
    pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)))
  }
  const bytes = new Uint8Array(pcm.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return { sr, b64: btoa(s), info }
}, [presses, LEN, mp3])
await browser.close()

const data = Buffer.from(b64, 'base64')
const header = Buffer.alloc(44)
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8)
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22)
header.writeUInt32LE(sr, 24); header.writeUInt32LE(sr * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34)
header.write('data', 36); header.writeUInt32LE(data.length, 40)
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, Buffer.concat([header, data]))
console.log('wrote', output, presses.length, 'presses', (data.length / 4 / sr).toFixed(3), 's', JSON.stringify(info))
