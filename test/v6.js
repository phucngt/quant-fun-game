const { chromium } = require('playwright');
const path = require('path');
const B = path.resolve(__dirname, '..');
const URL = 'file://' + B + '/out/download/quant-fun.html', SH = B + '/shots';
const errs = [], fails = [], info = {};
const check = (n, ok, i) => { if (!ok) fails.push(n + ' ' + JSON.stringify(i)); };
const COLS = ['front-left', 'front-right', 'rear-left', 'rear-right'];

async function open(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: o.dsf || 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.QF_AMBIENT = true; try { localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })); } catch (e) {} });
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('request', r => { if (!/^(file|data):/.test(r.url())) errs.push('request: ' + r.url()); });
  await p.goto(URL); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  return p;
}
const act = (p, r) => p.evaluate(r => { const a = document.getElementById('actor-' + r), d = a.querySelector('.act').dataset; return { acting: a.classList.contains('acting'), action: d.action || null, frame: d.frame == null ? null : +d.frame, col: d.col == null ? null : +d.col, facing: a.dataset.facing, st: a.dataset.status, walking: a.classList.contains('walking'), icon: a.querySelector('.icon').classList.contains('on'), bodyVis: getComputedStyle(a.querySelector('.body')).visibility, actDisp: getComputedStyle(a.querySelector('.act')).display }; }, r);
async function clip(p, r, pad = 70) {
  const b = await p.evaluate(r => { const e = document.getElementById('actor-' + r).getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; }, r);
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.w + pad * 2, height: b.h + pad * 1.6 };
}
async function waitFor(p, fn, ms, step = 80) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await p.waitForTimeout(step); } return null; }

(async () => {
  const browser = await chromium.launch();
  let p = await open(browser, { dsf: 2 });

  // 1. every legend: sheet decodable, rows inside
  const res = await p.evaluate(async () => {
    const out = { legends: 0, bad: [], sheets: [], expected: ASSETS.legends.length, nsheets: ANIM.sheets.length };
    const dims = [];
    for (const s of ANIM.sheets) { const i = new Image(); i.src = s.uri; try { await i.decode(); dims.push([i.naturalWidth, i.naturalHeight]); } catch (e) { dims.push(null); } }
    out.sheets = dims.map((d, k) => d && d[0] === ANIM.sheets[k].w && d[1] === ANIM.sheets[k].h);
    const ids = ASSETS.legends.map(l => l.id);
    for (const id of ids) {
      const L = ANIM.legends[id]; out.legends++;
      if (!L) { out.bad.push(id + ' missing'); continue; }
      const rows = ANIM.sheets[L.sheet].h / 112;
      for (const [k, v] of Object.entries(L.actions)) for (const r of v) if (!(r >= 0 && r < rows && Number.isInteger(r))) out.bad.push(id + ' ' + k + ' ' + r);
      if (!L.actions.walk || L.actions.walk.length !== 4 || !L.actions['type-standing'] || L.actions['type-standing'].length !== 2 || !L.actions.coffee || !L.actions.water) out.bad.push(id + ' actions');
      if (!(L.actions['check-phone'] || L.actions['read-book']) || !(L.actions['take-notes'] || L.actions['open-notebook'])) out.bad.push(id + ' extra');
    }
    return out;
  });
  check('all legends mapped', res.legends >= 22 && res.legends === res.expected && res.bad.length === 0 && res.sheets.every(Boolean), res);
  info.legends = res.legends;

  // 3. anchor: force an action frame, compare feet with idle
  const anchor = await p.evaluate(() => {
    const a = document.getElementById('actor-quant'), r0 = a.getBoundingClientRect();
    const idleFeet = [r0.left + r0.width / 2, r0.top + r0.height * 238 / 240];
    a.classList.add('acting'); const ar = a.querySelector('.act').getBoundingClientRect();
    a.querySelector('.act').style.display = 'block';
    const actFeet = [ar.left + ar.width / 2, ar.top + ar.height * 107 / 112];
    // body heights: idle 235/240 of box vs action 98/112 of cell
    const idleBody = r0.height * 235 / 240, actBody = ar.height * 98 / 112;
    a.classList.remove('acting'); a.querySelector('.act').style.display = '';
    return { dx: Math.abs(idleFeet[0] - actFeet[0]), dy: Math.abs(idleFeet[1] - actFeet[1]), dh: Math.abs(idleBody - actBody), idleBody };
  });
  check('anchor feet within 1px', anchor.dx <= 1 && anchor.dy <= 1 && anchor.dh <= 1, anchor);
  info.anchor = anchor;

  // 2. walking via forced routine: frames 0..3 and column by direction
  const walker = 'boss'; // Longer route: the shortest Quant -> cooler trip can finish in <4 frames.
  const seenFrames = new Set(), colOk = []; let walkShot = false;
  await p.evaluate(r => { window.__rec = []; const a = document.getElementById('actor-'+r), d = a.querySelector('.act'); new MutationObserver(() => { if (a.classList.contains('walking') && d.dataset.action === 'walk') window.__rec.push([+d.dataset.frame, +d.dataset.col, a.dataset.facing]); }).observe(d, { attributes: true, attributeFilter: ['data-frame', 'data-col'] }); },walker);
  const forced = await p.evaluate(r => window.__qf.force(r, 'cooler'),walker);
  check('force cooler', forced, forced);
  const t0 = Date.now(); let sawWalk = false, hid = true;
  while (Date.now() - t0 < 20000) {
    const s = await act(p, walker);
    if (s.walking && s.acting && s.action === 'walk') {
      sawWalk = true; seenFrames.add(s.frame); colOk.push(s.col === COLS.indexOf(s.facing)); hid = hid && s.bodyVis === 'hidden' && s.actDisp === 'block';
      if (!walkShot && seenFrames.size >= 2) { walkShot = true; await p.screenshot({ path: SH + '/v6-walk-closeup.png', clip: await clip(p, walker) }); }
    }
    if (/lấy nước/.test(s.st || '') && s.action === 'water' && !info.water) {
      info.water = true; check('water pose no icon', !s.icon, s);
      await p.waitForTimeout(400); await p.screenshot({ path: SH + '/v6-water.png', clip: await clip(p, walker) });
      break;
    }
    await p.waitForTimeout(40);
  }
  const rec = await p.evaluate(() => window.__rec);
  for (const [f, c] of rec) seenFrames.add(f);
  info.walkRec = rec.length; info.walkSeq = rec.slice(0, 12).map(r => r[0]).join('');
  check('walk col from recorder', rec.length > 8 && rec.every(r => r[1] === COLS.indexOf(r[2])), rec.slice(0, 5));
  check('walk acting seen', sawWalk && hid, [sawWalk, hid]);
  check('walk frames 0..3', [0, 1, 2, 3].every(f => seenFrames.has(f)), [...seenFrames]);
  check('water pose reached', info.water, 0);
  // after routine: back to idle
  await waitFor(p, async () => { const s = await act(p, walker); return !s.acting || s.action === 'type-standing'; }, 25000);

  // 4. typing alternates 2 frames (retry windows: a loop can end mid-observation)
  let tres = null;
  for (let k = 0; k < 8 && !(tres && tres.ok); k++) {
    tres = await p.evaluate(() => new Promise(res => {
      const t0 = performance.now();
      const find = () => {
        const a = [...document.querySelectorAll('.actor.acting')].find(x => x.querySelector('.act').dataset.action === 'type-standing');
        if (!a) { if (performance.now() - t0 > 20000) res({ ok: false, none: true }); else setTimeout(find, 50); return; }
        const d = a.querySelector('.act'), set = new Set([+d.dataset.frame]), face = a.dataset.facing, role = a.id.slice(6);
        const mo = new MutationObserver(() => { if (a.classList.contains('acting') && d.dataset.action === 'type-standing') set.add(+d.dataset.frame); });
        mo.observe(d, { attributes: true });
        setTimeout(() => { mo.disconnect(); res({ ok: set.size === 2 && a.classList.contains('acting'), f: [...set].sort(), face, role }); }, 1100);
      };
      find();
    }));
  }
  check('typing 2 frames', tres && tres.ok && tres.f.join() === '0,1', tres);
  check('typing facing = work facing', tres && /rear/.test(tres.face || ''), tres);
  if (tres && tres.role) { await p.screenshot({ path: SH + '/v6-typing.png', clip: await clip(p, tres.role) }); }
  await p.close();

  // 5. routine poses: coffee, notes, window (phone/book)
  p = await open(browser, { dsf: 2 });
  const want = [['coffee', 'portfolio', /coffee/, /uống cà phê/, 'v6-coffee.png'], ['board', 'trader', /take-notes|open-notebook/, /ghi chú/, 'v6-notes.png'], ['window', 'risk', /check-phone|read-book/, /xem điện thoại|đọc sách/, 'v6-window.png']];
  for (const [poi, role, re, stre, shot] of want) {
    const ok = await waitFor(p, () => p.evaluate(([r, id]) => window.__qf.force(r, id), [role, poi]), 20000, 300);
    check('force ' + poi, ok, ok);
    const got = await waitFor(p, async () => { const s = await act(p, role); return re.test(s.action || '') && s.acting && !s.walking ? s : null; }, 30000, 60);
    check('pose ' + poi, !!got && stre.test(got.st), got);
    if (got) { check('no icon with pose ' + poi, !got.icon, got); await p.waitForTimeout(300); await p.screenshot({ path: SH + '/' + shot, clip: await clip(p, role, 80) }); }
    await waitFor(p, async () => !(await act(p, role)).st.match(/đi |quay về|uống|ghi chú|xem điện|đọc sách/), 25000);
  }
  // desk idle variant (phone/book at desk) occurs sometime
  const variant = await waitFor(p, async () => { for (const r of ['boss', 'quant', 'trader', 'risk', 'portfolio']) { const s = await act(p, r); if (/check-phone|read-book/.test(s.action || '') && !s.walking && /xem điện thoại|đọc sách/.test(s.st) && Math.hypot(0, 0) === 0) return r; } return null; }, 70000, 100);
  info.deskVariant = variant; check('desk variant seen', !!variant, variant);
  await p.screenshot({ path: SH + '/v6-full-1440.png' });
  await p.close();

  // 9. legend change swaps the sheet
  p = await open(browser, {});
  const sw = await p.evaluate(() => {
    const cur = ANIM.legends.phuc.sheet;
    const other = ASSETS.legends.find(l => ANIM.legends[l.id].sheet !== cur && !['gwyneth', 'phuc', 'jim', 'ray', 'paul', 'ed'].includes(l.id));
    return { cur, other: other && other.id, otherSheet: other && ANIM.legends[other.id].sheet };
  });
  await p.click('#menu'); await p.click('[data-pause=settings]');
  await p.selectOption('#set-legend-boss', sw.other); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const forceBoss = await waitFor(p, () => p.evaluate(() => window.__qf.force('boss', 'cooler')), 20000, 300);
  const sheetUsed = await waitFor(p, () => p.evaluate(() => { const a = document.querySelector('#actor-boss .act'); return a.dataset.action ? getComputedStyle(a).backgroundImage.length : 0; }), 15000, 50);
  const bgLen = await p.evaluate(() => getComputedStyle(document.querySelector('#actor-boss .act')).backgroundImage);
  const expected = await p.evaluate(i => 'url(' + ANIM.sheets[i].uri + ')', sw.otherSheet);
  check('legend swap uses its sheet', forceBoss && bgLen.replace(/"/g, '') === expected, [forceBoss, bgLen.length, expected.length]);
  const sc = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check('no h-scroll 1440', sc.sw <= sc.cw, sc);
  await p.close();
  p = await open(browser, { vp: { width: 400, height: 800 } });
  const sc4 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check('no h-scroll 400', sc4.sw <= sc4.cw, sc4);
  await p.close();

  await browser.close();
  console.log('INFO', JSON.stringify(info)); console.log('ERRORS', JSON.stringify(errs)); console.log('FAILS', JSON.stringify(fails));
  process.exit(errs.length || fails.length ? 1 : 0);
})();
