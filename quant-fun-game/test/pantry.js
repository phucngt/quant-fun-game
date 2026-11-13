const { chromium } = require('playwright');
const path = require('path');
const B = path.resolve(__dirname, '..');
const URL = 'file://' + B + '/out/download/quant-fun.html', SH = B + '/shots';
const fails = [], errs = [], info = {};
const check = (n, ok, i) => { if (!ok) fails.push(n + ' ' + JSON.stringify(i)); };
// mặt quầy (% phòng): A trái, B sau-trái, C sau-phải, D trước-phải
const POLY = [[72.3, 47.7], [77, 45.3], [90.2, 52.4], [86.2, 56.2]];
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) errs.push('NET ' + r.url()); });
  await p.addInitScript(() => { window.QF_AMBIENT = true; window.QF_NOW = Date.parse('2026-11-13T10:00:00+07:00'); try { localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })); } catch (e) {} });
  await p.goto(URL); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  const room = p.locator('#room');
  const clip = async (x0, y0, x1, y1) => { const b = await room.boundingBox(); return { x: b.x + b.width * x0 / 100, y: b.y + b.height * y0 / 100, width: b.width * (x1 - x0) / 100, height: b.height * (y1 - y0) / 100 }; };
  const props = await p.evaluate(() => [...document.querySelectorAll('.room>img.pantry')].map(e => ({ id: e.dataset.prop, x: parseFloat(e.style.left), y: parseFloat(e.style.top), hidden: e.hidden, z: +getComputedStyle(e).zIndex, w: e.getBoundingClientRect().width })));
  info.props = props.map(o => o.id + '@' + o.x + ',' + o.y);
  for (const o of props) check('anchor on counter ' + o.id, inPoly(o.x, o.y, POLY), o);
  check('10 prop images minus 5 hidden alt', props.length === 7 && props.filter(o => o.hidden).length === 2, props.length);
  const tagZ = await p.evaluate(() => Math.min(...[...document.querySelectorAll('.label')].map(e => +e.style.zIndex)));
  check('props below tags and bubbles', props.every(o => o.z < tagZ), [props.map(o => o.z), tagZ]);
  const actorZ = await p.evaluate(() => Math.min(...[...document.querySelectorAll('.actor')].map(e => +e.style.zIndex)));
  check('props below actors', props.every(o => o.z < actorZ), [props[0].z, actorZ]);
  await p.waitForTimeout(400);
  // chờ cả phòng yên: không ai ở quầy
  await p.evaluate(() => { window.__qf.__t = 1; });
  await p.locator('#room').screenshot({ path: SH + '/v9-pantry-full.png' });
  await p.screenshot({ path: SH + '/v9-pantry-counter-idle.png', clip: await clip(68, 36, 98, 70) });
  const vis = id => p.evaluate(id => { const e = document.querySelector('.room>img.pantry[data-prop="' + id + '"]'); return e && !e.hidden; }, id);
  const pois = await p.evaluate(() => window.__qf.pois);
  const info2 = r => p.evaluate(r => { const a = document.getElementById('actor-' + r); const im = a.querySelector('.body img:not([hidden])') || a; return { st: a.dataset.status, x: parseFloat(a.style.left), y: parseFloat(a.style.top), w: a.classList.contains('walking'), face: a.dataset.facing, pose: a.querySelector('.act') && a.querySelector('.act').dataset.action || null }; }, r);
  const dirF = (dx, dy) => (dx <= 0 ? (dy <= 0 ? 'rear-left' : 'front-left') : (dy <= 0 ? 'rear-right' : 'front-right'));
  const forceRole = async (id, roles) => { for (let k = 0; k < 120; k++) { for (const r of roles) { if (await p.evaluate(([r, id]) => window.__qf.force(r, id), [r, id])) return r; } await p.waitForTimeout(250); } return null; };
  // ---- cà phê
  const cf = pois.find(o => o.id === 'coffee');
  const rc = await forceRole('coffee', ['quant', 'trader', 'risk']);
  check('force coffee', !!rc, rc);
  let sawBrew = false, sawDrink = false, brewShot = false, drinkShot = false, brewStart = 0, brewMs = 0, faceOk = null, atSpot = null;
  for (let k = 0; k < 800 && rc && !(sawBrew && sawDrink); k++) {
    const i = await info2(rc), b = await vis('espresso-brewing'), idle = await vis('espresso-idle');
    if (/^pha cà phê/.test(i.st) && !i.w) {
      if (!sawBrew) { sawBrew = true; brewStart = Date.now(); atSpot = Math.hypot(i.x - cf.spot[0], i.y - cf.spot[1]); faceOk = [i.face, dirF((cf.look[0] - i.x) * 16, (cf.look[1] - i.y) * 11.95)]; }
      check('brewing image swapped', b && !idle, [b, idle]);
      if (!brewShot) { brewShot = true; await p.screenshot({ path: SH + '/v9-pantry-brewing.png', clip: await clip(68, 36, 98, 70) }); }
    }
    if (/^uống cà phê/.test(i.st) && !i.w) { if (!sawDrink) brewMs = Date.now() - brewStart; sawDrink = true; check('idle image back while drinking', idle && !b, [b, idle]); if (!drinkShot && i.pose === 'coffee') { drinkShot = true; await p.screenshot({ path: SH + '/v9-pantry-coffee-drinking.png', clip: await clip(68, 36, 98, 70) }); } }
    await p.waitForTimeout(80);
  }
  check('coffee: brewing then drinking', sawBrew && sawDrink, [sawBrew, sawDrink]);
  check('coffee: standing at spot', atSpot != null && atSpot < 0.6, atSpot);
  check('coffee: facing toward espresso', faceOk && faceOk[0] === faceOk[1] && /rear/.test(faceOk[0]), faceOk);
  info.coffee = { role: rc, brewToDrinkMs: brewMs, face: faceOk, spotDist: atSpot };
  for (let k = 0; k < 200; k++) { if (!(await p.evaluate(r => window.__qf.state(r).inRoutine, rc))) break; await p.waitForTimeout(100); }
  check('idle espresso restored', (await vis('espresso-idle')) && !(await vis('espresso-brewing')), 0);
  // ---- máy in
  const pr = pois.find(o => o.id === 'printer');
  const rp = await forceRole('printer', ['portfolio', 'trader', 'risk', 'quant']);
  check('force printer', !!rp, rp);
  let sawPrint = false, sawTake = false, printShot = false, pf = null, ptake = null;
  for (let k = 0; k < 800 && rp && !(sawPrint && sawTake); k++) {
    const i = await info2(rp), pv = await vis('printer-printing'), idle = await vis('printer-idle');
    if (/^chờ bản in/.test(i.st) && !i.w) { if (!sawPrint) { sawPrint = true; pf = [i.face, dirF((pr.look[0] - i.x) * 16, (pr.look[1] - i.y) * 11.95), Math.hypot(i.x - pr.spot[0], i.y - pr.spot[1])]; } check('printing image swapped', pv && !idle, [pv, idle]); if (!printShot) { printShot = true; await p.screenshot({ path: SH + '/v9-pantry-printing.png', clip: await clip(68, 36, 98, 70) }); } }
    if (/^lấy bản in/.test(i.st) && !i.w) { sawTake = true; ptake = [idle, pv, i.pose]; check('idle printer while taking', idle && !pv, [idle, pv]); }
    await p.waitForTimeout(80);
  }
  check('printer: printing then taking', sawPrint && sawTake, [sawPrint, sawTake]);
  check('printer: facing + spot', pf && pf[0] === pf[1] && /rear/.test(pf[0]) && pf[2] < 0.6, pf);
  info.printer = { role: rp, face: pf, take: ptake };
  for (let k = 0; k < 200; k++) { if (!(await p.evaluate(r => window.__qf.state(r).inRoutine, rp))) break; await p.waitForTimeout(100); }
  // ---- bánh
  const sn = pois.find(o => o.id === 'snack');
  await p.evaluate(() => window.__qf.snackOk && window.__qf.snackOk());
  const rs = await forceRole('snack', ['trader', 'risk', 'quant', 'portfolio']);
  if (rs) {
    let ss = null, t0 = 0, t1 = 0;
    for (let k = 0; k < 400; k++) { const i = await info2(rs); if (/^lấy bánh/.test(i.st) && !i.w) { if (!ss) { t0 = Date.now(); ss = [i.face, dirF((sn.look[0] - i.x) * 16, (sn.look[1] - i.y) * 11.95)]; } t1 = Date.now(); } else if (ss) break; await p.waitForTimeout(60); }
    check('snack facing', ss && ss[0] === ss[1], ss); info.snack = { role: rs, ms: t1 - t0 };
  } else info.snack = 'skipped (gate: at most 1 in 6 routines)';
  for (let k = 0; k < 200; k++) { if (!(await p.evaluate(() => ['quant', 'trader', 'risk', 'portfolio', 'boss'].some(r => window.__qf.state(r).inRoutine)))) break; await p.waitForTimeout(100); }
  // ---- sau mỗi lệnh khớp: PM ra máy in
  const cmd = async t => { await p.fill('#chat-input', t); await p.press('#chat-input', 'Enter'); };
  await cmd('/giao');
  for (let i = 0; i < 13; i++) await cmd('/next');
  await p.waitForSelector('.mcard.decision');
  await p.getByText('Approve').filter({ visible: true }).first().click();
  await cmd('/next');
  let trip = { walked: false, printing: false, taking: false, home: false, face: null };
  const t0 = Date.now();
  for (let k = 0; k < 600 && Date.now() - t0 < 50000; k++) {
    const i = await info2('portfolio'), pv = await vis('printer-printing');
    if (/^đi lấy bản in/.test(i.st)) trip.walked = true;
    if (/^chờ bản in/.test(i.st) && !i.w) { trip.printing = pv; trip.face = i.face; }
    if (/^lấy bản in/.test(i.st) && !i.w) trip.taking = true;
    if (trip.taking && /^(nhìn quanh|giữ sổ|gõ phím)/.test(i.st)) { trip.home = Math.hypot(i.x - 36.1, i.y - 63.5) < 0.6; break; }
    await p.waitForTimeout(80);
  }
  check('PM fetches slip after fill', trip.walked && trip.printing === true && trip.taking && trip.home, trip);
  info.slip = trip;
  await browser.close();
  console.log(JSON.stringify(info, null, 1)); console.log('ERRORS', JSON.stringify(errs)); console.log('FAILS', JSON.stringify(fails, null, 1));
})();
