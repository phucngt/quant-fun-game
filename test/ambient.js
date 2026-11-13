const { chromium } = require('playwright');
const path = require('path');
const B = path.resolve(__dirname, '..');
const URL = 'file://' + B + '/out/download/quant-fun.html', SH = B + '/shots';
const Navigation = require('../src/navigation.js');
const nav = new Navigation(require('../assets/navigation.json'));
const HOME = Object.fromEntries(Object.entries(nav.data.stations).map(([r,s])=>[r,s.spot]));
async function waitHome(p, r) { for (let i = 0; i < 300; i++) { const v = await p.evaluate(r => { const a = document.getElementById('actor-' + r); return !a.classList.contains('walking') && !/^(đi |quay|sang|thôi)/.test(a.dataset.status || ''); }, r); if (v) return; await p.waitForTimeout(100); } }
async function waitFor2(p, r) { await waitHome(p, r); await p.waitForTimeout(300); }
const ROLES = Object.keys(HOME), errs = [], fails = [];
const check = (n, ok, i) => { if (!ok) fails.push(n + ' ' + JSON.stringify(i)); };
// All graph edges must stay inside the generated floor, including furniture clearance.
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.QF_AMBIENT = true; try { localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })); } catch (e) {} });
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('request', r => { if (!/^(file|data):/.test(r.url())) errs.push('request: ' + r.url()); });
  await p.goto(URL); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  const g = await p.evaluate(() => ({ n: window.__qf.nodes, e: window.__qf.edges }));
  for (const [a,b] of g.e) check('edge '+a+'-'+b+' stays on floor',nav.segmentClear(g.n[a],g.n[b]));
  for (const [k,v] of Object.entries(g.n)) check('node '+k+' on floor',nav.contains(v));
  const snapState = () => p.evaluate(() => Object.fromEntries(['boss', 'quant', 'trader', 'risk', 'portfolio'].map(r => { const a = document.getElementById('actor-' + r); const ll = a.querySelector('.fig.on .ll'); return [r, { x: parseFloat(a.style.left), y: parseFloat(a.style.top), walking: a.classList.contains('walking'), st: a.dataset.status, ll: getComputedStyle(ll).transform, lb: getComputedStyle(a.querySelector('.fig.on .lb')).transform, face: a.dataset.facing }]; })));
  const left = {}, back = {}, away = {}; let inRect = [], legT = new Set(), bodyT = new Set(), maxAway = 0, shots = {}, statuses = new Set();
  const t0 = Date.now();
  const SOAK = { chat: [], still: [], tag: [] }, still = {}, bad = {}; const NAMES = { boss: 'Boss', quant: 'Jim Simons', portfolio: 'Ray Dalio', trader: 'Paul Tudor Jones', risk: 'Ed Thorp' };
  const roleByName = n => Object.keys(NAMES).find(r => NAMES[r] === n);
  while (Date.now() - t0 < 60000) {
    const s = await snapState(); let aw = 0;
    const ex = await p.evaluate(() => Object.fromEntries(['boss', 'quant', 'trader', 'risk', 'portfolio'].map(r => { const a = document.getElementById('actor-' + r), b = a.getBoundingClientRect(), tg = document.querySelector('#tag-' + r).getBoundingClientRect(); return [r, { st: a.dataset.status, x: parseFloat(a.style.left), y: parseFloat(a.style.top), mini: !!document.querySelector('#label-' + r + ' .mini.on'), gap: tg.bottom - (b.top + b.height * 0.0125) }]; })));
    const now = Date.now();
    for (const r of ROLES) {
      const e = ex[r], m = /^trao đổi với (.+)$/.exec(e.st || '');
      if (m) { const q = roleByName(m[1]), f = q && ex[q]; const ok = f && new RegExp('^trao đổi với ' + NAMES[r] + '$').test(f.st || '') && Math.hypot(e.x - f.x, e.y - f.y) <= 10; bad[r + '>chat'] = ok ? 0 : (bad[r + '>chat'] || 0) + 1; if (bad[r + '>chat'] > 2) SOAK.chat.push([r, e.st, f && f.st]); } else bad[r + '>chat'] = 0;
      const st = still[r]; if (!st || Math.hypot(e.x - st.x, e.y - st.y) > .05 || !/^(đi |quay về bàn|sang chỗ)/.test(e.st || '')) still[r] = { x: e.x, y: e.y, t: now };
      if (/^(đi |quay về bàn|sang chỗ)/.test(e.st || '') && now - still[r].t > 2300) SOAK.still.push([r, e.st, now - still[r].t]);
      if (Math.abs(e.gap) > 12) SOAK.tag.push([r, Math.round(e.gap)]);
    }
    for (const r of ROLES) {
      const o = s[r], d = Math.hypot(o.x - HOME[r][0], o.y - HOME[r][1]);
      statuses.add(o.st);
      if (!nav.contains([o.x,o.y])) inRect.push([r,o.x,o.y]);
      if (d > 1.5) { left[r] = true; aw++; } else if (left[r]) back[r] = true;
      if (o.walking) { legT.add(o.ll); bodyT.add(o.lb); if (!shots.walk && d > 3) { shots.walk = r; await p.screenshot({ path: SH + '/v3-walk-closeup.png', clip: await clipAround(p, r) }); } }
      if (!shots.cooler && /lấy nước/.test(o.st) && !/đi/.test(o.st)) { shots.cooler = r; await p.locator('#room').screenshot({ path: SH + '/v3-cooler.png' }); }
      if (!shots.chat && /trao đổi/.test(o.st)) { shots.chat = r; await p.locator('#room').screenshot({ path: SH + '/v3-chat.png' }); }
    }
    maxAway = Math.max(maxAway, aw);
    await p.waitForTimeout(100);
  }
  async function clipAround(p, r) {
    const b = await p.$eval('#actor-' + r, e => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
    return { x: Math.max(0, b.x - 120), y: Math.max(0, b.y - 100), width: 300, height: 260 };
  }
  const returned = ROLES.filter(r => left[r] && back[r]);
  out0 = SOAK; const out = { soak: { chat: SOAK.chat.slice(0, 3), still: SOAK.still.slice(0, 3), tag: SOAK.tag.slice(0, 3) }, actorsLeftAndReturned: returned, left: Object.keys(left), maxAway, inRect: inRect.slice(0, 5), legTransforms: legT.size, bodyTransforms: bodyT.size, statuses: [...statuses].sort(), shots };
  check('soak: no lone/mismatched chat', SOAK.chat.length === 0, SOAK.chat.slice(0, 3));
  check('soak: no stationary walking/returning', SOAK.still.length === 0, SOAK.still.slice(0, 3));
  check('soak: tag within 12px of head', SOAK.tag.length === 0, SOAK.tag.slice(0, 3));
  check('>=3 actors left and returned', returned.length >= 3, out);
  check('feet never in desk rect', inRect.length === 0, inRect.slice(0, 5));
  check('<=2 away', maxAway <= 2, maxAway);
  check('legs move', legT.size > 4 && bodyT.size > 4, [legT.size, bodyT.size]);
  // forced shots if natural ones did not happen
  const forceTry = async (role, id) => { for (let i = 0; i < 60; i++) { if (await p.evaluate(([r, i]) => window.__qf.force(r, i), [role, id])) return true; await p.waitForTimeout(500); } return false; };
  if (!shots.cooler) { await forceTry('portfolio', 'cooler'); await p.waitForFunction(() => /lấy nước/.test(document.getElementById('actor-portfolio').dataset.status), null, { timeout: 20000 }); await p.locator('#room').screenshot({ path: SH + '/v3-cooler.png' }); }
  if (!shots.chat) { await forceTry('risk', 'chat:trader'); await p.waitForFunction(() => /trao đổi/.test(document.getElementById('actor-risk').dataset.status), null, { timeout: 20000 }); await p.locator('#room').screenshot({ path: SH + '/v3-chat.png' }); }
  // proposal mid-routine
  await p.waitForTimeout(8000);
  const cmd = async t => { await p.fill('#chat-input', t); await p.press('#chat-input', 'Enter'); };
  await cmd('/giao'); await p.waitForTimeout(1500);
  const forced = await forceTry('trader', 'cooler');
  await p.waitForFunction(() => /đi lấy nước|lấy nước/.test(document.getElementById('actor-trader').dataset.status), null, { timeout: 10000 });
  await p.waitForTimeout(700);
  const midPos = await p.$eval('#actor-trader', e => e.style.left + ',' + e.style.top);
  await cmd('/next 13');
  await p.waitForSelector('.mcard.decision.pass', { timeout: 20000 });
  await p.waitForTimeout(3000);
  out.mid = { forced, midPos, trader: await p.$eval('#actor-trader', e => e.style.left + ',' + e.style.top + ' ' + e.dataset.facing + ' ' + e.dataset.status), boss: await p.$eval('#actor-boss', e => e.style.left + ',' + e.style.top), approveChip: await p.$$eval('#chips button', b => b.map(x => x.textContent + (x.disabled ? '(disabled)' : ''))) };
  check('trader at boss desk', (() => { const m = out.mid.trader.split(',').map(parseFloat),s=nav.data.spots.STOP; return Math.hypot(m[0]-s[0],m[1]-s[1])<.3; })(), out.mid);
  check('Approve enabled', out.mid.approveChip[0] === 'Approve', out.mid.approveChip);
  await p.screenshot({ path: SH + '/v3-mid-proposal.png' });
  // reset puts everyone home
  await cmd('/reset'); await p.click('.mcard.confirm button:has-text("Chơi lại")');
  out.afterReset = await snapState().then(s => Object.fromEntries(ROLES.map(r => [r, Math.hypot(s[r].x - HOME[r][0], s[r].y - HOME[r][1]) < .3])));
  check('reset home', Object.values(out.afterReset).every(Boolean), out.afterReset);

  // ---- deterministic chat reservation + POI facing ----
  await p.evaluate(() => { for (const r of ['boss', 'quant', 'trader', 'risk', 'portfolio']) { const a = window.__qf.state(r); } });
  const st = r => p.evaluate(r => window.__qf.state(r), r);
  const info2 = r => p.evaluate(r => { const a = document.getElementById('actor-' + r); return { st: a.dataset.status, x: parseFloat(a.style.left), y: parseFloat(a.style.top), walking: a.classList.contains('walking'), face: a.dataset.facing, mini: !!document.querySelector('#label-' + r + ' .mini.on') }; }, r);
  const dirF = (dx, dy) => (dy > 0 ? (dx < 0 ? 'front-left' : 'front-right') : (dx < 0 ? 'rear-left' : 'rear-right'));
  const settleHome = async () => { await cmd('/reset now'); await p.waitForTimeout(600); };
  await settleHome(); await p.waitForTimeout(6500);
  check('force chat', await forceTry('quant', 'chat:portfolio'), 0);
  const stB0 = await st('portfolio'); check('B reserved at pick', stB0.reservedBy === 'quant', stB0);
  let both = false, faceOk = false, leftHome = false, alone = false, relAt = 0; const t1 = Date.now();
  while (Date.now() - t1 < 25000) {
    const A = await info2('quant'), Bi = await info2('portfolio'), sb = await st('portfolio');
    if (Math.hypot(Bi.x - HOME.portfolio[0], Bi.y - HOME.portfolio[1]) > .3) leftHome = true;
    if (sb.inRoutine) leftHome = true;
    if (/trao đổi/.test(Bi.st) && A.walking) alone = true;
    if (/trao đổi/.test(A.st) && /trao đổi/.test(Bi.st) && A.mini && Bi.mini) {
      both = true;
      faceOk = Bi.face === dirF((A.x - Bi.x) * 16, (A.y - Bi.y) * 11.95) && A.face === dirF((Bi.x - A.x) * 16, (Bi.y - A.y) * 11.95);
    }
    if (both && !sb.reservedBy && !relAt) relAt = Date.now();
    if (relAt && Date.now() - relAt > 600) break;
    await p.waitForTimeout(80);
  }
  check('B never left home / routine', !leftHome, 0); check('both mini + status together', both, 0); check('face each other', faceOk, 0); check('B not chatting before A arrives', !alone, 0);
  check('B released after chat', relAt > 0, 0);
  // cooldown >= 6 s for both
  let cdBad = false; const t2 = Date.now();
  await waitHome(p, 'quant');
  const tr = relAt; while (Date.now() - tr < 5600) { for (const r of ['quant', 'portfolio']) { if ((await st(r)).inRoutine) cdBad = true; } await p.waitForTimeout(100); }
  check('cooldown 6s', !cdBad, 0);
  // event on B mid-walk of A
  await settleHome(); await p.waitForTimeout(6500);
  check('force chat 2', await forceTry('portfolio', 'chat:quant'), 0);
  for (let i = 0; i < 100; i++) { if ((await info2('portfolio')).walking) break; await p.waitForTimeout(50); }
  await cmd('/giao');   // pulls boss + quant
  let cancelled = false, loneChat = false, wentHome = false; const t3 = Date.now();
  while (Date.now() - t3 < 20000) {
    const A = await info2('portfolio'), Bq = await info2('quant');
    if (A.st === 'thôi để sau') { cancelled = true; check('thôi để sau no bubble', !A.mini, A); }
    if ((/trao đổi/.test(A.st) && !/trao đổi/.test(Bq.st)) || (/trao đổi/.test(Bq.st) && !/trao đổi/.test(A.st))) loneChat = true;
    if (Math.hypot(A.x - HOME.portfolio[0], A.y - HOME.portfolio[1]) < .3 && (await st('portfolio')).inRoutine === false && Date.now() - t3 > 1500) { wentHome = true; break; }
    await p.waitForTimeout(80);
  }
  check('A cancelled + went home', wentHome, 0); check('no lone chat on event', !loneChat, 0); info2.cancelled = cancelled;
  const sq = await st('quant'); check('B released after event', sq.reservedBy === null, sq);
  // event on A releases B at once
  await settleHome(); await p.waitForTimeout(6500);
  check('force chat 3', await forceTry('quant', 'chat:portfolio'), 0);
  for (let i = 0; i < 100; i++) { if ((await info2('quant')).walking) break; await p.waitForTimeout(50); }
  await cmd('/giao'); await p.waitForTimeout(100);
  const sp2 = await st('portfolio'); check('A pulled -> B released at once', sp2.reservedBy === null && sp2.chatWith === null, sp2);
  // POI facing + spot nearer its object than the door
  await settleHome(); await p.waitForTimeout(6500);
  const pois = await p.evaluate(() => ({ list: window.__qf.pois, door: window.__qf.door }));
  const FACE_POI = {};
  let ri = 0; const POLES = ['portfolio', 'trader', 'risk', 'quant', 'boss'];
  for (const po of pois.list) {
    check('spot nearer object than door ' + po.id, Math.hypot(po.spot[0] - po.obj[0], po.spot[1] - po.obj[1]) < Math.hypot(po.spot[0] - pois.door[0], po.spot[1] - pois.door[1]), po);
    let role = null;
    for (let k = 0; k < 80 && !role; k++) { const r = POLES[(ri++) % POLES.length]; if (await p.evaluate(([r, id]) => window.__qf.force(r, id), [r, po.id])) role = r; else await p.waitForTimeout(300); }
    check('force poi ' + po.id, !!role, role);
    let got = null;
    for (let k = 0; k < 500 && role && !got; k++) { const i = await info2(role); if (!i.walking && /lấy nước|ghi chú|chờ bản in|lấy bản in|pha cà phê|lấy bánh|uống cà phê|nhìn phố|nhìn mưa|xem điện|đọc sách/.test(i.st) && Math.hypot(i.x - po.spot[0], i.y - po.spot[1]) < .3) got = i; else await p.waitForTimeout(60); }
    check('arrived ' + po.id, !!got, got);
    if (got) { const exp = dirF((po.look[0] - got.x) * 16, (po.look[1] - got.y) * 11.95); check('facing toward look-at ' + po.id, got.face === exp && /rear/.test(got.face), [got.face, exp]); FACE_POI[po.id] = got.face; }
    await waitFor2(p, role);
  }
  out.poiFacing = FACE_POI;
  await ctx.close();
  // phone
  const c2 = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const m = await c2.newPage();
  await m.addInitScript(() => { window.QF_AMBIENT = true; localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })); });
  m.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await m.goto(URL); await m.waitForSelector('#title:not([hidden])'); await m.click('#deploy'); await m.waitForSelector('#messages .msg');
  await m.waitForTimeout(6000); await m.evaluate(() => window.__qf.force('quant', 'cooler')); await m.waitForTimeout(2500);
  await m.screenshot({ path: SH + '/v3-400.png' });
  await browser.close();
  console.log(JSON.stringify(out, null, 1)); console.log('ERRORS', errs); console.log('FAILS', fails);
  process.exit(errs.length || fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
