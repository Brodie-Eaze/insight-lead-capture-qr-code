"""Branded QR cards for the Insight call back page.
Run from the repo root: <venv with segno>/bin/python tools/make_qr.py  ->  public/qr/insight-qr-phone.png, insight-qr-ipad.png, insight-qr.svg
"""
import base64, pathlib, subprocess, segno

URL = "https://insight-quote-production.up.railway.app"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = pathlib.Path(__file__).resolve().parent.parent  # repo root
OUT = HERE / "public" / "qr"; OUT.mkdir(parents=True, exist_ok=True)
GREEN, DEEP = "#00774e", "#0b4d35"

def qr_svg(logo=True):
    q = segno.make(URL, error="h")  # H = 30% recovery, room for the centre mark
    m = [[bool(c) for c in row] for row in q.matrix]
    n = len(m)
    finder = lambda r, c: (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)
    hole = 9  # modules cleared in the centre for the mark (9x9 of 41x41 ~ 5% area)
    lo = (n - hole) // 2
    centre = lambda r, c: logo and lo <= r < lo + hole and lo <= c < lo + hole
    dots = "".join(f'<circle cx="{c+.5}" cy="{r+.5}" r=".44"/>' for r in range(n) for c in range(n)
                   if m[r][c] and not finder(r, c) and not centre(r, c))
    eyes = ""
    for x, y in [(0, 0), (n - 7, 0), (0, n - 7)]:
        eyes += (f'<rect x="{x+.5}" y="{y+.5}" width="6" height="6" rx="1.8" fill="none" stroke="{DEEP}" stroke-width="1"/>'
                 f'<rect x="{x+2}" y="{y+2}" width="3" height="3" rx=".9" fill="{GREEN}"/>')
    mark = ""
    if logo:
        b64 = base64.b64encode((HERE / "public" / "brand" / "mark-colour.png").read_bytes()).decode()
        mark = (f'<rect x="{lo+.6}" y="{lo+.6}" width="{hole-1.2}" height="{hole-1.2}" rx="2" fill="#fff"/>'
                f'<image href="data:image/png;base64,{b64}" x="{lo+1.6}" y="{lo+1.6}" width="{hole-3.2}" height="{hole-3.2}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="geometricPrecision"><g fill="{DEEP}">{dots}</g>{eyes}{mark}</svg>'

def card(w, h, qr_px):
    logo = base64.b64encode((HERE / "public" / "brand" / "logo-white.png").read_bytes()).decode()
    s = w / 1080  # scale type with the card
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
<style>
*{{margin:0;box-sizing:border-box}}
html,body{{width:{w}px;height:{h}px}}
body{{font-family:Manrope,sans-serif;background:{GREEN};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:{80*s}px {64*s}px {72*s}px;
background-image:radial-gradient(120% 70% at 50% 0%,rgba(255,255,255,.10),rgba(255,255,255,0) 60%)}}
.logo{{height:{64*s}px}}
.mid{{display:flex;flex-direction:column;align-items:center;gap:{40*s}px}}
h1{{font-size:{76*s}px;line-height:1.05;font-weight:800;letter-spacing:-.015em;text-align:center;white-space:nowrap}}
.qr{{background:#fff;border-radius:{44*s}px;padding:{qr_px*4/41:.0f}px;box-shadow:0 {24*s}px {60*s}px rgba(0,0,0,.18)}}
.qr svg{{display:block;width:{qr_px}px;height:{qr_px}px}}
.cue{{display:flex;align-items:center;gap:{16*s}px;font-size:{34*s}px;font-weight:700;white-space:nowrap}}
.cue svg{{width:{44*s}px;height:{44*s}px}}
.foot{{font-size:{28*s}px;font-weight:600;opacity:.85;white-space:nowrap}}
</style></head><body>
<img class="logo" src="data:image/png;base64,{logo}">
<div class="mid">
  <h1>Scan to request<br>a call back</h1>
  <div class="qr">{qr_svg()}</div>
  <div class="cue"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.5"/></svg>Point your phone camera here</div>
</div>
<div class="foot">insightpestsolutions.au</div>
</body></html>"""

def render(name, w, h, qr_px):
    html = OUT / f".{name}.html"; html.write_text(card(w, h, qr_px))
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", "--virtual-time-budget=4000", f"--screenshot={OUT / name}.png", html.as_uri()],
                   check=True, capture_output=True)
    html.unlink()

(OUT / "insight-qr.svg").write_text(qr_svg())
render("insight-qr-phone", 1080, 1440, 600)   # phone: shows at a comfortable size, not edge to edge
render("insight-qr-ipad", 1536, 2048, 900)    # iPad portrait: big enough to scan from a step back
print("done", *sorted(p.name for p in OUT.iterdir()))
