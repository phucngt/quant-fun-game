const { chromium } = require('playwright');
const path = require('path');
const B = path.resolve(__dirname, '..');
const URL = 'file://' + B + '/out/download/quant-fun.html', SH = B + '/shots';
const errs = [], fails = [], info = {};
const check = (n, ok, i) => { if (!ok) fails.push(n + ' ' + JSON.stringify(i)); };
const only = process.argv[2] || '';
async function open(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: o.dsf || 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.QF_FAST = true; });
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) errs.push('request: ' + r.url()); });
  await p.goto(o.url || URL); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  await p.addStyleTag({ content: '.actor,.label{display:none!important}' });
  return p;
}
const set = (p, t, w) => p.evaluate(([t, w]) => { window.QuantFun.setTime(t); window.QuantFun.setWeather(w); }, [t, w]);
const clip = async (p, x0, y0, x1, y1) => { const b = await p.locator('#room').boundingBox(); return { x: b.x + b.width * x0 / 100, y: b.y + b.height * y0 / 100, width: b.width * (x1 - x0) / 100, height: b.height * (y1 - y0) / 100 }; };
(async () => {
  const browser = await chromium.launch();
  const p = await open(browser, { dsf: 2 });
  // ---- mặt nạ trời
  const m = await p.evaluate(async () => {
    const cs = getComputedStyle(document.querySelector('#skyfx-left .rain'));
    const mk = e => { const c = getComputedStyle(e); return (c.maskImage || c.webkitMaskImage || '').slice(0, 20); };
    const els = [...document.querySelectorAll('.sky, .skyfx, .skyfx .rain, .skyfx .stars, .skyfx .city, .skyfx .clouds, .skyfx .flash')];
    const withMask = els.map(e => { let n = e; while (n && !/url\(/.test(getComputedStyle(n).maskImage || getComputedStyle(n).webkitMaskImage || '')) n = n.parentElement; return !!n && n.matches('.sky,.skyfx'); });
    const img = new Image(); img.src = SKYMASK; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const inP = (px, py, P) => { let o = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) o = !o; } return o; };
    const res = [];
    for (const kind of ['body', 'diff', 'rod']) LAMPS[kind].forEach((P, k) => {
      const xs = P.map(q => q[0]), ys = P.map(q => q[1]); let nIn = 0, aIn = 0, nB = 0, aB = 0;
      for (let py = Math.floor(Math.min(...ys) / 100 * H); py <= Math.ceil(Math.max(...ys) / 100 * H); py++) for (let px = Math.floor(Math.min(...xs) / 100 * W); px <= Math.ceil(Math.max(...xs) / 100 * W); px++) {
        const a = d[(py * W + px) * 4 + 3] > 127 ? 1 : 0; nB++; aB += a;
        if (inP(px / W * 100, py / H * 100, P)) { nIn++; aIn += a; }
      }
      res.push({ kind, k, inside: +(aIn / nIn * 100).toFixed(2), bbox: +(aB / nB * 100).toFixed(1) });
    });
    return { mask: mk(els[0]), withMask, n: els.length, lamps: res, w: W, h: H, rainClip: getComputedStyle(document.querySelector('#skyfx-left')).clipPath };
  });
  info.mask = m;
  check('all outside layers masked', m.withMask.every(Boolean), m.withMask);
  check('rain has mask-image', /url\(/.test(m.mask), m.mask);
  check('rain keeps clip-path fallback', /url\(/.test(m.rainClip), m.rainClip);
  for (const l of m.lamps) check('lamp ' + l.kind + l.k + ' mask coverage < 3%', l.inside < 3, l);
  // ---- ảnh chụp
  if (!only || only === 'rain') {
    await set(p, '10:00', 'mưa'); await p.waitForTimeout(500);
    await p.locator('#room').screenshot({ path: SH + '/v9-rain-day.png' });
    await p.screenshot({ path: SH + '/v9-rain-day-window.png', clip: await clip(p, 8, 5, 62, 45) });
    await set(p, '21:30', 'dông'); await p.waitForTimeout(500);
    await p.locator('#room').screenshot({ path: SH + '/v9-storm-night.png' });
    await p.screenshot({ path: SH + '/v9-rain-back-window-lamp.png', clip: await clip(p, 42, 6, 62, 42) });
  }
  await browser.close();
  console.log(JSON.stringify(info, null, 1)); console.log('ERRORS', JSON.stringify(errs)); console.log('FAILS', JSON.stringify(fails, null, 1));
  process.exitCode = errs.length || fails.length ? 1 : 0;
})();
