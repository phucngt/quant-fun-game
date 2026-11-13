"""Build-time: detect painted sun patches (floor, counter, right wall) and make a 'sunless' room webp."""
import io, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
import gen_skymask as G

W, H = 1600, 1195
ROOM_HEX = [(43.4, 2.3), (96.2, 31.0), (96.2, 64.4), (54.2, 95.2), (2.4, 63.8), (2.4, 27.2)]
# vùng loại trừ (px trên ảnh 1600x1195): đèn, màn hình, bảng, poster, bình nước, chuông, nhãn cửa, tay nắm
EXCL = [
    [(1185, 290), (1390, 372), (1390, 520), (1190, 440)],     # bảng trắng
    [(1390, 375), (1505, 430), (1500, 500), (1392, 450)],     # màn hình DEPLOYING
    [(855, 365), (950, 365), (950, 555), (855, 555)],         # bình nước
    [(60, 335), (145, 335), (145, 700), (60, 700)],           # poster, bình chữa cháy, đồng hồ
    [(970, 305), (1035, 305), (1035, 430), (970, 430)],       # chuông
    [(1065, 325), (1150, 325), (1150, 395), (1065, 395)],     # biển cửa
    [(1130, 455), (1165, 455), (1165, 500), (1130, 500)],     # tay nắm
    [(1040, 255), (1175, 300), (1175, 585), (1040, 545)],     # cánh cửa (gỗ)  -- giữ vệt nắng trên cửa tay phải
]
# vùng BẮT BUỘC gồm (sau khi loại trừ): phần cửa phía phải có nắng
INCL = [
    [(1118, 400), (1175, 420), (1175, 590), (1118, 570)],
]


def poly(w, h, P, scale=1.0):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon([(x * scale, y * scale) for x, y in P], fill=255)
    return np.array(m) > 0


def build(B, debug=True):
    im = G.room_img(B); a = np.array(im).astype(np.float32)
    lum = a @ np.array([.299, .587, .114], np.float32)
    sil = poly(W, H, [(x / 100 * W, y / 100 * H) for x, y in ROOM_HEX])
    glass = ndi.binary_dilation(G.glass_mask(W, H), iterations=6)
    lamp = ndi.binary_dilation(G.glass_mask(W, H, G.LAMP_BODY + G.LAMP_ROD + G.LAMP_DIFF) if False else np.zeros((H, W), bool))
    ex = np.zeros((H, W), bool)
    for P in EXCL: ex |= poly(W, H, P)
    inc = np.zeros((H, W), bool)
    for P in INCL: inc |= poly(W, H, P)
    region = sil & ~glass & (~ex | inc)
    # mực nền bóng: phân vị 30 trong cửa sổ ~60 px (làm việc ở 1/2 độ phân giải cho nhanh)
    s = 2
    rg = region[::s, ::s]
    ls = lum[::s, ::s]
    # phân vị có bỏ qua NaN: thay NaN bằng giá trị trung bình lân cận rồi lọc
    fill = np.where(rg, ls, np.median(ls[rg]))
    sh = ndi.percentile_filter(fill, 30, size=61 // s * 2 + 1, mode='nearest')   # cửa sổ ~120 px do vệt nắng lớn hơn 60 px
    sh = ndi.gaussian_filter(sh, 6)
    shf = np.array(Image.fromarray(sh.astype('float32'), 'F').resize((W, H), Image.BILINEAR))
    ratio = lum / np.maximum(shf, 1)
    warm = (a[..., 0] - a[..., 2])
    shw = np.array(Image.fromarray(ndi.gaussian_filter(ndi.percentile_filter(np.where(rg, (a[..., 0] - a[..., 2])[::s, ::s], 0), 30, size=61 // s * 2 + 1, mode='nearest'), 6).astype('float32'), 'F').resize((W, H), Image.BILINEAR))
    det = region & (ratio > 1.18) & ((warm - shw) > 2)
    det = ndi.binary_opening(det, iterations=3); det = ndi.binary_closing(det, iterations=4)
    lab, n = ndi.label(det); sz = ndi.sum(det, lab, range(1, n + 1))
    det = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 1500])
    m = ndi.gaussian_filter(det.astype(np.float32), 3.0)
    m = np.clip((m - .15) / .7, 0, 1)
    # bóng mục tiêu: chuẩn hoá tích chập từ điểm KHÔNG nắng
    known = (region & ~ndi.binary_dilation(det, iterations=6)).astype(np.float32)
    def nconv(x, sg):
        num = ndi.gaussian_filter(x * known[..., None], (sg, sg, 0)); den = ndi.gaussian_filter(known, sg)[..., None]
        return num / np.maximum(den, 1e-3), den
    lo, den = nconv(a, 28)
    lo2, den2 = nconv(a, 70)
    tgt = np.where(den > .03, lo, lo2)
    litm = (det & region).astype(np.float32)
    def nconv2(x, sg):
        num = ndi.gaussian_filter(x * litm[..., None], (sg, sg, 0)); dn = ndi.gaussian_filter(litm, sg)[..., None]
        return num / np.maximum(dn, 1e-3)
    sm = nconv2(a, 7)
    ratio_rgb = np.clip(tgt / np.maximum(sm, 1), .3, 1.2)
    new = np.clip(a * ratio_rgb, 0, 255)
    out = a * (1 - m[..., None]) + new * m[..., None]
    outim = Image.fromarray(out.astype('uint8'))
    buf = io.BytesIO(); outim.save(buf, 'WEBP', quality=88, method=6)
    (B / 'assets/room-sunless.webp').write_bytes(buf.getvalue())
    if debug:
        ov = a.copy(); k = m[..., None] * .6
        ov = ov * (1 - k) + np.array([255, 0, 200], np.float32) * k
        (B / 'gen').mkdir(exist_ok=True)
        Image.fromarray(ov.astype('uint8')).save(B / 'gen/sun-overlay.png'); outim.save(B / 'gen/room-sunless.png')
    return m


if __name__ == '__main__':
    from pathlib import Path
    m = build(Path(__file__).parent); print((m > .5).mean())
