const { chromium } = require('playwright'); const path = require('path'); const B = path.resolve(__dirname, '..'), SH = B + '/shots';
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.QF_FAST = true; localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })); });
  await p.goto('file://' + B + '/out/download/quant-fun.html'); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  await p.addStyleTag({ content: '.bubble,.mini{display:none!important}' });
  await p.waitForTimeout(1500);
  for (const r of ['boss', 'portfolio', 'quant', 'trader', 'risk']) {
    await p.evaluate(r => window.__qf.work(r), r); await p.waitForTimeout(500);
    const info = await p.evaluate(r => { const a = document.getElementById('actor-' + r), d = a.querySelector('.act').dataset; return { st: a.dataset.status, face: a.dataset.facing, act: d.action }; }, r);
    const bx = await p.evaluate(r => { const e = document.getElementById('actor-' + r).getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; }, r);
    await p.screenshot({ path: SH + '/v8-desk-' + r + '.png', clip: { x: Math.max(0, bx.x - 110), y: Math.max(0, bx.y - 90), width: bx.w + 220, height: bx.h + 150 } });
    console.log(r, JSON.stringify(info));
  }
  console.log(errs); await b.close(); })();
