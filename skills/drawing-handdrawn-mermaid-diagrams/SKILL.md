---
name: drawing-handdrawn-mermaid-diagrams
description: Use when asked for a hand-drawn Mermaid diagram, a diagram to share or put in a README/docs, or one rendered to PNG and opened in Chrome. Covers the hand-drawn lavender Mermaid look (Fira Sans, handDrawn, classDef palette) and rendering to PNG locally.
---

# Hand-drawn Mermaid diagrams

## Overview
Mermaid source (`.mmd`) in a fixed hand-drawn theme, rendered to PNG by `render.py` (pinned Mermaid 11.17.0 with SRI, headless local Chrome, two passes so the PNG fits the diagram), then opened in Chrome. Minimal: few boxes, short labels.

## Steps
1. Copy `example.mmd` (this folder) and keep its front matter and `classDef` palette unchanged. `render.py` ignores the front matter and applies the same theme itself (`handDrawnSeed: 7`, 18px); the front matter is there so the `.mmd` renders alike elsewhere (GitHub, mermaid.live). To change the look, edit `config` in `render.py`.
2. Write the diagram: labels as `"<b>Title</b><br/>line<br/>line"`, at most ~4 short lines per box.
3. Render: `python3 <this skill folder>/render.py <file.mmd> <file.png> 1400` (finds Chrome or Chromium; set `CHROME=` to override)
4. Read the PNG and fix layout problems (table below), re-render.
5. Open: `open -a "Google Chrome" <file.png>`. Give the user both full absolute paths.

## Palette (classDef)
| Class | Use | fill / stroke / text |
|---|---|---|
| `box` | our components | `#E0E7FF` / `#4338CA` / `#312E81` |
| `ext` | external party (dashed) | `#FEF3C7` / `#B45309` / `#78350F` |
| `chan` | channels, checks | `#EDE9FE` / `#7C3AED` / `#4C1D95` |
| `good` | groups, own data | `#ECFDF5` / `#059669` / `#064E3B` |
| `store` | buckets, remote stores | `#E0F2FE` / `#0369A1` / `#0C4A6E` |
| `old` | legacy, going away (dashed) | `#F3F4F6` / `#6B7280` / `#374151` |
| `refused` | blocked, errors | `#FEE2E2` / `#B91C1C` / `#7F1D1D` |

`<b>` renders dark red (the renderer's CSS). Shapes: `{{ }}` external party, `[( )]` store, `[ ]` component. Solid arrow = main path, dotted `-.->` = optional, legacy or refused.

## Layout fixes
| Problem | Fix |
|---|---|
| Too wide and flat | `flowchart TB`, group rows in subgraphs |
| `direction` inside a subgraph ignored | a node inside links outside; link the subgraph itself (`checks --> groups`) |
| Subgraph boxes stack vertically in a TB chart | give that subgraph `direction TB` (unlinked nodes then sit side by side) |
| Hyphenated word breaks across lines | one item per `<br/>` line |

## Common mistakes
- Changing the theme variables or fonts: the style is the point.
- Mermaid from a CDN without a pinned version: `render.py` pins it with an SRI hash.
- Long labels or many boxes: keep it to what the reader needs.
