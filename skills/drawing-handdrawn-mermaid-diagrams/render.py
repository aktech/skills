"""Render a Mermaid file to PNG with a pinned Mermaid build in local Chrome.

Usage: python3 render.py <file.mmd> <out.png> [max-width, default 1400]
Needs Google Chrome or Chromium (or CHROME=/path); standard library only.

Renders twice: once to measure the diagram's natural size (its SVG viewBox),
then at that aspect ratio so the PNG holds the whole diagram with no excess.
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

src, out = sys.argv[1], sys.argv[2]
max_width = int(sys.argv[3]) if len(sys.argv) > 3 else 1400
MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME = (os.environ.get("CHROME") or (MAC_CHROME if os.path.exists(MAC_CHROME) else None)
          or next(filter(None, map(shutil.which, ["google-chrome", "chromium", "chromium-browser"])), None))
if not CHROME:
    sys.exit("Chrome not found: install Google Chrome or Chromium, or set CHROME=/path/to/chrome")
body = re.sub(r"^---\n.*?\n---\n", "", pathlib.Path(src).read_text(), flags=re.S)
config = {
    "startOnLoad": False, "securityLevel": "strict",
    "look": "handDrawn", "theme": "base", "handDrawnSeed": 7,
    "themeVariables": {
        "fontFamily": "Fira Sans, Helvetica Neue, Arial, sans-serif", "fontSize": "18px",
        "background": "#F5F3FF", "primaryColor": "#E0E7FF", "primaryBorderColor": "#4338CA",
        "primaryTextColor": "#312E81", "lineColor": "#7C3AED", "clusterBkg": "#FAF9FF",
        "clusterBorder": "#C4B5FD", "edgeLabelBackground": "#F5F3FF",
    },
    "flowchart": {"curve": "basis", "padding": 18, "useMaxWidth": False, "htmlLabels": True},
}
def page_html(svg_width):
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>html,body{{margin:0;background:#F5F3FF}} #out{{padding:24px;display:inline-block}}
#out svg{{width:{svg_width}px;height:auto}} #out b{{color:#7F1D1D;font-weight:600}}</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.17.0/dist/mermaid.min.js"
 integrity="sha384-1XxYRbOYiiyu+pmHSGPcd+f1+ISteo+dnLpgQKUB07vPr9ddelj3zjO+TAbBqFXY" crossorigin="anonymous"></script>
</head><body><div id="out"></div><script>
(async () => {{
  await document.fonts.load("18px 'Fira Sans'"); await document.fonts.ready;
  mermaid.initialize({json.dumps(config)});
  const {{ svg }} = await mermaid.render("d", {json.dumps(body)});
  document.getElementById("out").innerHTML = svg;
}})();
</script></body></html>"""

page = pathlib.Path(tempfile.mkdtemp()) / "diagram.html"
out = str(pathlib.Path(out).resolve())


def chrome(*args):
    return subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                           "--virtual-time-budget=20000", *args, f"file://{page}"],
                          check=True, stderr=subprocess.DEVNULL, capture_output=False,
                          stdout=subprocess.PIPE, text=True).stdout


# Pass 1: natural size from the rendered SVG's viewBox.
page.write_text(page_html(800))
dom = chrome("--dump-dom")
vb = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', dom)
w, h = float(vb.group(1)), float(vb.group(2))
svg_w = int(min(max_width, w * 1.25))
svg_h = int(svg_w * h / w)

# Pass 2: render at that width into a window that fits it (24px padding).
page.write_text(page_html(svg_w))
chrome("--force-device-scale-factor=2", f"--window-size={svg_w + 48},{svg_h + 48}", f"--screenshot={out}")
print(out, f"natural {int(w)}x{int(h)}, rendered {svg_w}x{svg_h}")
