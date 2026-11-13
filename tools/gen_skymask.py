"""Build-time: per-pixel sky mask (alpha) from the room image, inside the glass polygons."""
import json, base64, io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

GLASS_L = []
for x0, x1 in [(10, 14.8), (15.8, 20.7), (21.7, 27.0), (27.8, 33.0), (34.0, 38.4)]:
    t = lambda x: 25.8 - .6056 * (x - 10)
    b = lambda x: 57.0 - .6901 * (x - 10)
    GLASS_L.append([(x0, t(x0)), (x1, t(x1)), (x1, b(x1)), (x0, b(x0))])
GLASS_B = [[(44.0, 10.3), (58.3, 17.8), (58.3, 31.0), (54.5, 31.0), (54.5, 37.4), (53.7, 37.4), (53.7, 40.4), (44.0, 34.3)]]
W, H = 1600, 1195
MW = 800
MH = MW * H // W
# thanh đèn (đo trên ảnh phóng 2.5x, cắt từ (60,20) của ảnh 800 px): [thân, đầu treo, bộ khuếch tán]
def cv(pts, ox, oy):
    return [(round((ox + x / 2.5) / MW * 100, 2), round((oy + y / 2.5) / MH * 100, 2)) for x, y in pts]
LAMP_BODY = [cv([(285, 275), (605, 392), (598, 428), (548, 445), (295, 325)], 60, 20), cv([(728, 145), (1040, 262), (1030, 300), (1008, 308), (738, 200)], 60, 20)]
LAMP_ROD = [cv(p, 60, 20) for p in ([(338, 160), (360, 160), (360, 302), (338, 302)], [(530, 235), (552, 235), (552, 388), (530, 388)], [(778, 35), (799, 35), (799, 175), (778, 175)], [(970, 110), (992, 110), (992, 258), (970, 258)])]
LAMP_DIFF = [cv([(296, 305), (298, 332), (548, 449), (600, 430), (602, 408), (548, 428)], 60, 20), cv([(735, 186), (738, 208), (1005, 312), (1032, 300), (1040, 276), (1005, 290)], 60, 20)]


def room_img(B):
    A = json.load(open(B / 'assets/assets.json'))
    return Image.open(io.BytesIO(base64.b64decode(A['room'].split(',', 1)[1]))).convert('RGB')


def glass_mask(w, h, polys=None):
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for P in (polys or GLASS_L + GLASS_B):
        d.polygon([(x / 100 * w, y / 100 * h) for x, y in P], fill=255)
    return np.array(m) > 0


def build(B, debug=True):
    im = room_img(B); a = np.array(im).astype(int)
    r, g, bl = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1)
    bluish = (bl > r + 12) & (bl > g - 5) & ((mx - mn) >= 18)
    bright = mn >= 185          # vệt phản chiếu trắng trên kính
    excl = glass_mask(W, H, LAMP_BODY + LAMP_ROD + LAMP_DIFF)
    sky = (bluish | bright) & glass_mask(W, H) & ~ndi.binary_dilation(excl, iterations=2)
    # close pinholes, drop specks
    sky = ndi.binary_closing(sky, iterations=1)
    lab, n = ndi.label(sky); sizes = ndi.sum(sky, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 40]); sky = keep
    # to 800 px, erode 1 px, feather 1 px
    f = np.array(Image.fromarray((sky * 255).astype('uint8')).resize((MW, MW * H // W), Image.BOX)).astype(float) / 255
    hard = ndi.binary_erosion(f > .5, iterations=1)
    al = Image.fromarray((hard * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(.8))
    A = np.array(al)
    rgba = np.zeros(A.shape + (4,), 'uint8'); rgba[..., :3] = 255; rgba[..., 3] = A
    out = Image.fromarray(rgba, 'RGBA')
    buf = io.BytesIO(); out.save(buf, 'PNG', optimize=True)
    (B / 'assets').mkdir(exist_ok=True); (B / 'assets/skymask.png').write_bytes(buf.getvalue())
    if debug:
        base = im.resize((MW, MW * H // W)); ov = np.array(base).astype(float)
        k = A / 255 * .65
        ov[..., 0] = ov[..., 0] * (1 - k) + 255 * k
        ov[..., 1] = ov[..., 1] * (1 - k)
        ov[..., 2] = ov[..., 2] * (1 - k) + 255 * k * .6
        dd = ImageDraw.Draw(Image.new('RGB', (1, 1)))
        (B / 'gen').mkdir(exist_ok=True)
        Image.fromarray(ov.astype('uint8')).save(B / 'gen/skymask-overlay.png')
    (B / 'assets/lamps.json').write_text(json.dumps({'body': LAMP_BODY, 'rod': LAMP_ROD, 'diff': LAMP_DIFF}))
    return A


if __name__ == '__main__':
    from pathlib import Path
    A = build(Path(__file__).parent)
    print(A.shape, (A > 127).mean())
