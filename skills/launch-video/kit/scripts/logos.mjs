// Copies Simple Icons logos (CC0) into a folder, each in its official brand colour, so reels and
// the globe show logos in colour. Colours too light to read on the paper are pulled towards ink.
// Only use logos of things the product genuinely works with; a brand Simple Icons lacks goes in
// as plain text.
//   node scripts/logos.mjs assets/logos notion figma trello
import fs from 'node:fs'
import path from 'node:path'
import * as si from 'simple-icons'

const [dir, ...slugs] = process.argv.slice(2)
if (!dir || !slugs.length) { console.error('usage: node scripts/logos.mjs <dir> <slug>...'); process.exit(1) }
const brand = JSON.parse(fs.readFileSync(new URL('../brand.json', import.meta.url)))
const ink = brand.colours.ink.replace('#', '')
const bySlug = Object.fromEntries(Object.values(si).filter((x) => x && x.slug).map((x) => [x.slug, x]))
const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const mix = (hex, toward, k) => [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + parseInt(toward.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')
fs.mkdirSync(dir, { recursive: true })
let missing = 0
for (const slug of slugs) {
  const icon = bySlug[slug]
  if (!icon) { console.error(`no Simple Icons logo for "${slug}": use plain text`); missing++; continue }
  const hex = lum(icon.hex) > 0.45 ? mix(icon.hex, ink, 0.45) : icon.hex
  fs.writeFileSync(path.join(dir, `${slug}.svg`), icon.svg.replace('<svg ', `<svg fill="#${hex}" `))
  console.log(`${dir}/${slug}.svg #${hex}`)
}
process.exit(missing ? 1 : 0)
