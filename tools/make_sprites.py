"""Cut the six Quant Fun sprite sheets into 21 personas x 4 angles, normalise
them (one scale per persona, common body height, feet on one baseline,
feet centred) and write them into assets.json in place of the Pixel Agents cast.

Usage: python3 -I make_sprites.py SHEETS_DIR ASSETS_JSON CONTACT_PNG
"""
import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SHEETS, ASSETS, CONTACT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
ANGLES = ["front-left", "front-right", "rear-left", "rear-right"]
# From SPRITE-MAP.md: file -> rows top to bottom. Columns are ANGLES in order.
SHEET_ROWS = [
    ("01-arthur-jim-cathie-warren.png", [("arthur", "Arthur Hayes"), ("jim", "Jim Simons"),
                                         ("cathie", "Cathie Wood"), ("warren", "Warren Buffett")]),
    ("02-george-stanley-paul-ray.png", [("george", "George Soros"), ("stanley", "Stanley Druckenmiller"),
                                        ("paul", "Paul Tudor Jones"), ("ray", "Ray Dalio")]),
    ("03-ed-jesse-michael-raoul.png", [("ed", "Ed Thorp"), ("jesse", "Jesse Livermore"),
                                       ("michael", "Michael Saylor"), ("raoul", "Raoul Pal")]),
    ("04-planb-willy-cz.png", [("planb", "PlanB"), ("willy", "Willy Woo"), ("cz", "CZ")]),
    ("05-gcr-cobie-ansem.png", [("gcr", "GCR"), ("cobie", "Cobie"), ("ansem", "Ansem")]),
    ("06-hsaka-tetranode-gwyneth.png", [("hsaka", "Hsaka"), ("tetranode", "Tetranode"),
                                        ("gwyneth", "Gwyneth Chen")]),
]
BODY_H = 236
PAD = 2
ALPHA_GRID = 24   # alpha above this counts as sprite when finding gutters
ALPHA_NOISE = 8   # alpha at or below this is cleared (stray haze in the sheets)


def runs(mask, min_gap=4, min_len=20):
    out, start, gap, end = [], None, 0, 0
    for i, v in enumerate(mask):
        if v:
            if start is None:
                start = i
            gap, end = 0, i
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                if end - start + 1 >= min_len:
                    out.append((start, end + 1))
                start = None
    if start is not None and end - start + 1 >= min_len:
        out.append((start, end + 1))
    return out


def grid(im):
    m = np.array(im)[:, :, 3] > ALPHA_GRID
    cells = []
    for r0, r1 in runs(m.any(1)):
        row = []
        for c0, c1 in runs(m[r0:r1].any(0)):
            sub = m[r0:r1, c0:c1]
            ys, xs = np.where(sub.any(1))[0], np.where(sub.any(0))[0]
            row.append((c0 + xs[0], r0 + ys[0], c0 + xs[-1] + 1, r0 + ys[-1] + 1))
        cells.append(row)
    return cells


def feet_x(cut):
    a = np.array(cut)[:, :, 3] > 40
    band = a[-max(4, int(a.shape[0] * 0.07)):]
    cols = band.sum(0)
    return float((cols * np.arange(len(cols))).sum() / cols.sum())


def webp_uri(im):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=92, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


cuts, legends = {}, []
for fname, rows in SHEET_ROWS:
    im = Image.open(SHEETS / fname).convert("RGBA")
    arr = np.array(im)
    arr[arr[:, :, 3] <= ALPHA_NOISE] = 0
    im = Image.fromarray(arr)
    cells = grid(im)
    assert len(cells) == len(rows), (fname, len(cells), len(rows))
    for (pid, name), row in zip(rows, cells):
        assert len(row) == 4, (fname, pid, len(row))
        views = {ang: im.crop(box) for ang, box in zip(ANGLES, row)}
        scale = BODY_H / max(v.height for v in views.values())
        cuts[pid] = {}
        for ang, v in views.items():
            fx = feet_x(v)
            w, h = max(1, round(v.width * scale)), max(1, round(v.height * scale))
            cuts[pid][ang] = (v.resize((w, h), Image.LANCZOS), fx * scale)
        legends.append({"id": pid, "name": name, "sheet": fname,
                        "srcHeight": max(v.height for v in views.values())})

half = int(max(max(ax, im.width - ax) for p in cuts.values() for im, ax in p.values())) + PAD + 1
CW, CH = half * 2, BODY_H + PAD * 2
sprites, total, final = {}, 0, {}
for pid, views in cuts.items():
    sprites[pid], final[pid] = {}, {}
    for ang, (im, ax) in views.items():
        canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        canvas.alpha_composite(im, (round(half - ax), CH - PAD - im.height))
        uri, size = webp_uri(canvas)
        sprites[pid][ang], final[pid][ang] = uri, canvas
        total += size

# One contact sheet of the 84 normalised cuts: yellow baseline and feet centre line.
cols = 2
per_col = (len(legends) + 1) // 2
cellw = CW * 4 + 110
sheet = Image.new("RGBA", (cellw * cols, (CH + 16) * per_col), (58, 62, 80, 255))
draw = ImageDraw.Draw(sheet)
for i, leg in enumerate(legends):
    ox, oy = (i // per_col) * cellw, (i % per_col) * (CH + 16)
    draw.text((ox + 4, oy + CH // 2), leg["name"][:17], fill=(255, 220, 90, 255))
    draw.line([(ox + 106, oy + 14 + CH - PAD), (ox + cellw - 4, oy + 14 + CH - PAD)], fill=(255, 220, 90, 255))
    for c, ang in enumerate(ANGLES):
        x = ox + 106 + c * CW
        sheet.alpha_composite(final[leg["id"]][ang], (x, oy + 14))
        draw.line([(x + half, oy + 14), (x + half, oy + 14 + CH)], fill=(255, 220, 90, 80))
        draw.text((x + 2, oy + 1), ang, fill="white")
sheet.save(CONTACT)

data = json.loads(ASSETS.read_text())
data["sprites"] = sprites
data["spriteSize"] = [CW, CH]
data["legends"] = [{"id": l["id"], "name": l["name"]} for l in legends]
data.pop("personas", None)
data["spriteFacing"] = {
    "front-left": "faces viewer, looks screen-left: moving down-left",
    "front-right": "faces viewer, looks screen-right: moving down-right",
    "rear-left": "back to viewer, looks screen-left: moving up-left",
    "rear-right": "back to viewer, looks screen-right: moving up-right",
}
ASSETS.write_text(json.dumps(data))
print(len(legends), "legends x 4 angles | canvas", CW, CH, "| sprite bytes", total,
      "| assets.json", ASSETS.stat().st_size)
for l in legends:
    print(f"  {l['id']:10s} {l['name']:22s} {l['sheet']:34s} src h {l['srcHeight']}")
