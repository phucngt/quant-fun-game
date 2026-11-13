"""Cut, verify, normalise and embed the Pixel Agents art for Quant Fun.

Inputs are passed as arguments; this script never runs from inside the
downloaded repositories.
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

QF_ASSETS = Path(sys.argv[1])      # quant-fun/pixel-agents/assets
PA_CHARS = Path(sys.argv[2])       # pixel-agents/public/sprites/characters
FONT_DIR = Path(sys.argv[3])       # @fontsource/vt323 files
OUT = Path(sys.argv[4])            # build/assets

ANGLES = ["front-left", "front-right", "rear-left", "rear-right"]
# id -> source file stem. Order is the roster order in the game.
PERSONAS = [
    ("me", "Me-1"),
    ("claude", "Claude-1"),
    ("dev1", "dev-1"),
    ("security", "security-audit-1"),
    ("employee2", "employee-2"),
    ("frontend", "Frontend-dev-1"),
    ("dev2", "dev-2"),
    ("employee1", "employee-1"),
    ("employee3", "employee-3"),
    ("explore", "explore-1"),
]
BODY_H = 236          # every persona's tallest view is scaled to this height
PAD = 2


def webp_uri(im, quality=90, lossless=False):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6, lossless=lossless)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def feet_x(im):
    """Horizontal centre of the opaque pixels in the bottom 7% of the body."""
    a = im.getchannel("A")
    l, t, r, b = a.getbbox()
    band = a.crop((l, b - max(4, int((b - t) * 0.07)), r, b))
    px = band.load()
    total = weight = 0
    for x in range(band.width):
        col = sum(1 for y in range(band.height) if px[x, y] > 40)
        total += col * x
        weight += col
    return l + total / weight


def skin_share(im):
    """Share of skin-toned pixels in the head region: high on front views."""
    a = im.getchannel("A")
    l, t, r, b = a.getbbox()
    head = im.crop((l, t, r, t + int((b - t) * 0.36))).convert("RGBA")
    px = head.load()
    skin = opaque = 0
    for y in range(0, head.height, 2):
        for x in range(0, head.width, 2):
            R, G, B, A = px[x, y]
            if A < 128:
                continue
            opaque += 1
            if R > 150 and 85 < G < 215 and 60 < B < 190 and R - B > 35 and R > G:
                skin += 1
    return skin / max(1, opaque)


def mirror_error(a, b):
    """Mean alpha difference between a and the horizontal flip of b."""
    fa = a.getchannel("A")
    fb = b.transpose(Image.FLIP_LEFT_RIGHT).getchannel("A")
    if fa.size != fb.size:
        fb = fb.resize(fa.size)
    diff = ImageChops.difference(fa, fb)
    return sum(diff.getdata()) / (255 * fa.width * fa.height)


def face_side(im):
    """Which screen side the face points to, from where the skin sits in the head box.
    Returns 'right' or 'left'."""
    a = im.getchannel("A")
    l, t, r, b = a.getbbox()
    head = im.crop((l, t, r, t + int((b - t) * 0.30))).convert("RGBA")
    px = head.load()
    sx = n = 0
    ox = on = 0
    for y in range(0, head.height, 2):
        for x in range(0, head.width, 2):
            R, G, B, A = px[x, y]
            if A < 128:
                continue
            ox += x
            on += 1
            if R > 150 and 85 < G < 215 and 60 < B < 190 and R - B > 35 and R > G:
                sx += x
                n += 1
    if n < 12:
        return "?"
    return "right" if sx / n > ox / on else "left"


report = []
sprites = {}
frames = {}
for pid, stem in PERSONAS:
    views = {ang: Image.open(PA_CHARS / f"{stem}-{ang}.png").convert("RGBA") for ang in ANGLES}
    boxes = {ang: im.getchannel("A").getbbox() for ang, im in views.items()}
    tallest = max(b[3] - b[1] for b in boxes.values())
    scale = BODY_H / tallest
    checks = {
        "front_is_front": min(skin_share(views["front-left"]), skin_share(views["front-right"]))
        > max(skin_share(views["rear-left"]), skin_share(views["rear-right"])),
        "front_pair_mirrors": mirror_error(views["front-left"], views["front-right"]) < 0.03,
        "rear_pair_mirrors": mirror_error(views["rear-left"], views["rear-right"]) < 0.03,
        "face": {ang: face_side(views[ang]) for ang in ANGLES},
    }
    report.append((pid, stem, scale, checks))
    frames[pid] = {}
    for ang, im in views.items():
        l, t, r, b = boxes[ang]
        fx = feet_x(im)
        crop = im.crop((l, t, r, b))
        w = max(1, round(crop.width * scale))
        h = max(1, round(crop.height * scale))
        frames[pid][ang] = (crop.resize((w, h), Image.LANCZOS), (fx - l) * scale)

half = 0
for pid in frames:
    for ang, (im, ax) in frames[pid].items():
        half = max(half, ax, im.width - ax)
half = int(half) + PAD + 1
CW, CH = half * 2, BODY_H + PAD * 2
total = 0
for pid in frames:
    sprites[pid] = {}
    for ang, (im, ax) in frames[pid].items():
        canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        canvas.alpha_composite(im, (round(half - ax), CH - PAD - im.height))
        uri, size = webp_uri(canvas, quality=92)
        total += size
        sprites[pid][ang] = uri
        frames[pid][ang] = canvas

# Contact sheet of the normalised cuts, for one visual check.
sheet = Image.new("RGBA", (CW * 4 + 8, (CH + 16) * len(PERSONAS)), (58, 62, 80, 255))
draw = ImageDraw.Draw(sheet)
for row, (pid, stem) in enumerate(PERSONAS):
    y = row * (CH + 16)
    draw.line([(0, y + 14 + CH - PAD), (sheet.width, y + 14 + CH - PAD)], fill=(255, 220, 90, 255))
    for col, ang in enumerate(ANGLES):
        sheet.alpha_composite(frames[pid][ang], (col * CW + 4, y + 14))
        draw.line([(col * CW + 4 + half, y + 14), (col * CW + 4 + half, y + 14 + CH)], fill=(255, 220, 90, 90))
        draw.text((col * CW + 6, y + 1), f"{pid} {ang}", fill="white")
sheet.save(OUT / "contact.png")

room = Image.open(QF_ASSETS / "office.png").convert("RGB")
room_uri, room_size = webp_uri(room, quality=86)
# Backdrop colour around the room, so the page can continue it.
corner = room.resize((64, 48)).getpixel((2, 2))
desks = {}
for name in ("left", "rear", "right"):
    im = Image.open(QF_ASSETS / f"desk-{name}.png").convert("RGBA")
    desks[name], size = webp_uri(im, quality=92)
    total += size
    desks[name + "_ratio"] = im.width / im.height

fonts = {}
for subset in ("latin", "vietnamese"):
    data = (FONT_DIR / f"vt323-{subset}-400-normal.woff2").read_bytes()
    fonts[subset] = "data:font/woff2;base64," + base64.b64encode(data).decode()

(OUT / "assets.json").write_text(json.dumps({
    "room": room_uri, "roomSize": room.size, "backdrop": "#%02x%02x%02x" % corner,
    "desks": desks, "sprites": sprites, "spriteSize": [CW, CH], "fonts": fonts,
    "personas": [pid for pid, _ in PERSONAS],
}))
for pid, stem, scale, checks in report:
    print(f"{pid:10s} {stem:18s} scale {scale:.3f}  front={checks['front_is_front']} "
          f"mirror F={checks['front_pair_mirrors']} R={checks['rear_pair_mirrors']} face={checks['face']}")
print("sprite canvas", CW, CH, "| room", room_size, "bytes | sprites+desks", total, "bytes | backdrop", "#%02x%02x%02x" % corner)
