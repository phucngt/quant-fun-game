const { chromium } = require('playwright');
const path = require('path');
const B = path.resolve(__dirname, '..'), SH = B + '/shots';
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.QF_AMBIENT = true; try { localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })); } catch (e) {} });
  await p.goto('file://' + B + '/out/download/quant-fun.html'); await p.waitForSelector('#title:not([hidden])'); await p.waitForTimeout(400);
  const nm = await p.textContent('#boss-legend-name'); console.log('legend', nm);
  await p.fill('#boss-name', ''); const nm2 = await p.evaluate(() => 0);
  await p.screenshot({ path: SH + '/v7-title-phuc.png' });
  await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  const tag = await p.textContent('#tag-boss'); console.log('tag with empty name:', tag);
  const clip = async (pad = 70) => { const b = await p.evaluate(() => { const e = document.getElementById('actor-boss').getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; }); return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.w + pad * 2, height: b.h + pad * 1.6 }; };
  let typing = false, walk = false; const t0 = Date.now();
  await p.evaluate(() => window.__qf.force('boss', 'cooler'));
  while (Date.now() - t0 < 60000 && !(typing && walk)) {
    const s = await p.evaluate(() => { const a = document.getElementById('actor-boss'), d = a.querySelector('.act').dataset; return { acting: a.classList.contains('acting'), action: d.action, walking: a.classList.contains('walking') }; });
    if (!walk && s.walking && s.acting && s.action === 'walk') { walk = true; await p.screenshot({ path: SH + '/v7-phuc-walk.png', clip: await clip() }); }
    if (!typing && s.acting && s.action === 'type-standing') { typing = true; await p.screenshot({ path: SH + '/v7-phuc-typing.png', clip: await clip() }); }
    await p.waitForTimeout(40);
  }
  console.log({ walk, typing, errs });
  await browser.close();
})();
