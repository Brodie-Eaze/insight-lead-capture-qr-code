"""Builds every QR code the team needs, for one address.
Run from the repo root:  python3 tools/make_qr.py https://your-address
Needs: pip install -r tools/requirements.txt, and Google Chrome (set CHROME if it is not in the Mac default spot).

Writes public/qr/:
  screens/  full screen cards to show on a device (iPhone, Android, iPad, iPad Pro, older phone)
  plain/    the QR on its own: SVG with and without the logo, PNG at 512, 1024 and 2048 px
  print/    A4 and A5 PDFs
  insight-qr-all.zip  everything above in one download
"""
import base64, os, pathlib, shutil, subprocess, sys, zipfile, segno

URL = sys.argv[1] if len(sys.argv) > 1 else "https://insight-quote-production.up.railway.app"  # our preview
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
HERE = pathlib.Path(__file__).resolve().parent.parent  # repo root
OUT = HERE / "public" / "qr"
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
@page{{size:{w}px {h}px;margin:0}}
*{{margin:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
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
@media print{{.qr{{box-shadow:none}}}}  /* shadows print as a dark box in PDFs */
</style></head><body>
<img class="logo" src="data:image/png;base64,{logo}">
<div class="mid">
  <h1>Scan to request<br>a call back</h1>
  <div class="qr">{qr_svg()}</div>
  <div class="cue"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.5"/></svg>Point your phone camera here</div>
</div>
<div class="foot">insightpestsolutions.au</div>
</body></html>"""

def plain(size):
    pad = round(size * 4 / 49)  # 4 module quiet zone around a 41 module code
    return f"""<!doctype html><style>*{{margin:0}}html,body{{width:{size}px;height:{size}px;background:#fff}}
body{{padding:{pad}px;box-sizing:border-box}}svg{{display:block;width:100%;height:100%}}</style>{qr_svg()}"""

def chrome(html, out, w, h, pdf=False):
    tmp = OUT / ".render.html"; tmp.write_text(html)
    mode = [f"--print-to-pdf={out}", "--no-pdf-header-footer"] if pdf else [f"--screenshot={out}"]
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", "--virtual-time-budget=4000", *mode, tmp.as_uri()], check=True, capture_output=True)
    tmp.unlink()

# Device screens, portrait, at each device's native pixel size. QR is about 55% of the width.
SCREENS = {
    "insight-qr-iphone.png":  (1179, 2556),  # iPhone 14 Pro to 16 and most modern iPhones
    "insight-qr-android.png": (1080, 2400),  # most Android phones
    "insight-qr-phone-short.png": (1080, 1440),  # older or smaller phones, and phones in a case window
    "insight-qr-ipad.png":     (1640, 2360),  # iPad and iPad Air 10.9 to 11 inch
    "insight-qr-ipad-pro.png": (2048, 2732),  # iPad Pro 12.9 to 13 inch
}
PRINT = {"insight-qr-a4.pdf": (794, 1123), "insight-qr-a5.pdf": (559, 794)}  # A4 and A5 at 96 px per inch
PLAIN = (512, 1024, 2048)

if OUT.exists(): shutil.rmtree(OUT)
for d in ("screens", "plain", "print"): (OUT / d).mkdir(parents=True)
(OUT / "plain" / "insight-qr.svg").write_text(qr_svg())
(OUT / "plain" / "insight-qr-no-logo.svg").write_text(qr_svg(logo=False))
for size in PLAIN: chrome(plain(size), OUT / "plain" / f"insight-qr-{size}.png", size, size)
for name, (w, h) in SCREENS.items(): chrome(card(w, h, round(w * .555)), OUT / "screens" / name, w, h)
for name, (w, h) in PRINT.items(): chrome(card(w, h, round(w * .555)), OUT / "print" / name, w, h, pdf=True)
files = sorted(p for p in OUT.rglob("*") if p.is_file())
with zipfile.ZipFile(OUT / "insight-qr-all.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in files: z.write(f, f.relative_to(OUT))
print("QR for", URL); print(*(str(f.relative_to(OUT)) for f in files + [OUT / "insight-qr-all.zip"]), sep="\n")
