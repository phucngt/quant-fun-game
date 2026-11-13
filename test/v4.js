const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const B = path.resolve(__dirname, '..');
const OUT = B + '/out/download/quant-fun.html', SH = B + '/shots';
const errs = [], fails = [], info = {};
const check = (n, ok, i) => { if (!ok) fails.push(n + ' ' + JSON.stringify(i)); };

// GOD test build: patch the built file (exact block)
const BLOCK = '<script type="application/json" id="god">\n{"weather":"auto","time":"auto","announcement":"","ambient":"auto","deskNote":""}\n</script>';
const html = fs.readFileSync(OUT, 'utf8');
check('god block present exactly once', html.split(BLOCK).length === 2, html.split(BLOCK).length);
const GODF = B + '/test/god-test.html';
fs.writeFileSync(GODF, html.replace(BLOCK, '<script type="application/json" id="god">\n{"weather":"dông","time":"21:00","announcement":"Test","ambient":"busy","deskNote":"Ghi chú thử"}\n</script>'));
const BADF = B + '/test/god-bad.html';
fs.writeFileSync(BADF, html.replace(BLOCK, '<script type="application/json" id="god">\n{not json\n</script>'));

async function open(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: o.dsf || 1 });
  const p = await ctx.newPage();
  await p.addInitScript(({ now, ambient }) => { window.QF_FAST = true; if (ambient) window.QF_AMBIENT = true; if (now) window.QF_NOW = now; }, { now: o.now, ambient: o.ambient });
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('request', r => { if (!/^(file|data):/.test(r.url())) errs.push('request: ' + r.url()); });
  await p.goto('file://' + (o.file || OUT)); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  return p;
}
const out = p => p.evaluate(() => window.QuantFun.getOutside());
const skyOp = (p, w) => p.evaluate(w => getComputedStyle(document.getElementById('sky-' + w)).opacity, w);
const send = async (p, t) => { await p.fill('#chat-input', t); await p.press('#chat-input', 'Enter'); await p.waitForTimeout(150); };
const shot = (p, f) => p.locator('#stage').screenshot({ path: SH + '/' + f });

(async () => {
  const browser = await chromium.launch();
  // day clear: 10:00 ICT = 03:00Z on 2026-11-13; find a clear day via /weather quang for the screenshot
  let p = await open(browser, { now: '2026-11-13T03:00:00Z', dsf: 2 });
  let o = await out(p);
  check('ict 10:00', o.time === '10:00' && o.phase === 'day', o);
  await send(p, '/weather quang'); await p.waitForTimeout(700);
  check('day sky transparent', (await skyOp(p, 'left')) === '0' && (await skyOp(p, 'back')) === '0', await skyOp(p, 'left'));
  check('plate shows time', (await p.textContent('#wx-time')) === '10:00', await p.textContent('#wx-time'));
  await shot(p, 'v4-day-clear.png');
  await send(p, '/weather auto');
  const w1 = (await out(p)).weather;
  // golden
  await send(p, '/time 17:00'); await send(p, '/weather quang'); await p.waitForTimeout(700);
  check('golden phase', (await out(p)).phase === 'golden', await out(p)); await shot(p, 'v4-golden.png');
  // night clear
  await send(p, '/time 21:00'); await p.waitForTimeout(700);
  o = await out(p); check('night phase', o.phase === 'night' && o.levels.night > .9, o);
  check('night sky opaque', (await skyOp(p, 'left')) === '1', 0);
  await shot(p, 'v4-night-clear.png');
  // night dong
  await send(p, '/weather dong'); await p.waitForTimeout(700);
  o = await out(p); check('dong set', o.weather === 'dông' && o.levels.storm === 1, o);
  const rain = await p.evaluate(() => [...document.querySelectorAll('.skyfx .rain')].map(e => getComputedStyle(e).opacity));
  check('rain elements visible', rain.length === 4 && rain.every(v => +v > .2), rain);
  check('label shows', /Dông/.test(await p.textContent('#wx-lab')), await p.textContent('#wx-lab'));
  const lastSys = await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].pop().textContent);
  check('weather sys line', /Đã đặt trời: Dông/.test(lastSys), lastSys);
  await shot(p, 'v4-night-dong.png');
  // z-order: roomlight below labels, flick above roomlight, HUD above
  const z = await p.evaluate(() => { const g = s => +getComputedStyle(document.querySelector(s)).zIndex; return { light: g('#roomlight'), label: g('#label-boss'), flick: g('.flick'), sky: g('#sky-left'), hud: g('.overlays'), prop: g('.prop') }; });
  check('z order', z.light < z.label && z.flick > z.light && z.hud > z.label && z.sky < z.prop, z);
  // day rain
  await send(p, '/time 10:30'); await send(p, '/weather mua'); await p.waitForTimeout(700);
  check('day rain', (await out(p)).weather === 'mưa', await out(p)); await shot(p, 'v4-day-rain.png');
  // bad inputs
  await send(p, '/time 25:00'); await send(p, '/weather bao');
  const errsys = await p.evaluate(() => [...document.querySelectorAll('#messages .sys.err')].map(e => e.textContent));
  check('invalid time/weather errors', errsys.length >= 2, errsys);
  // reports
  await send(p, '/time'); await send(p, '/weather');
  const sysAll = await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].map(e => e.textContent));
  check('/time report', sysAll.some(t => /^Giờ ở TP\.HCM \(UTC\+7\): 10:30/.test(t)), sysAll.slice(-4));
  check('/weather report', sysAll.some(t => /^Ngoài cửa sổ: Mưa\./.test(t)), sysAll.slice(-3));
  // auto restore
  await send(p, '/weather auto'); await send(p, '/time auto'); await p.waitForTimeout(700);
  o = await out(p); check('auto restore', o.timeSource === 'real' && o.weatherSource === 'auto' && o.time === '10:00' && o.weather === w1, o);
  // settings day lock wins
  await send(p, '/time 21:00');
  await p.evaluate(() => document.getElementById('menu').click()); await p.click('[data-pause=settings]');
  await p.click('#set-segs button[data-key=sky][data-value=day]'); await p.waitForTimeout(700);
  o = await out(p); check('settings day lock', o.phase === 'day' && o.weather === 'quang' && o.timeSource === 'day', o);
  check('sky transparent under lock', (await skyOp(p, 'left')) === '0', 0);
  await p.click('#set-segs button[data-key=sky][data-value=auto]'); await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  check('lock released', (await out(p)).phase === 'night', await out(p));
  // frozen seam + bad input
  const seam = await p.evaluate(() => { 'use strict'; try { window.QuantFun.x = 1; } catch (e) { return 'threw'; } return Object.isFrozen(window.QuantFun) ? 'frozen' : 'open'; });
  check('seam frozen', seam === 'frozen' || seam === 'threw', seam);
  check('setWeather bad', await p.evaluate(() => window.QuantFun.setWeather('bão') === false && window.QuantFun.setWeather('mưa') === true), 0);
  await p.close();

  // determinism: same QF_NOW -> same weather; and a rainy/overcast sample over a day
  const seqs = [];
  for (let i = 0; i < 2; i++) {
    const q = await open(browser, { now: '2026-11-13T09:15:00Z' });
    seqs.push(await q.evaluate(() => { const r = []; for (let m = 0; m < 1440; m += 30) { window.QuantFun.setTime(m); r.push(window.QuantFun.getOutside().weather[0]); } return r.join(''); }));
    await q.close();
  }
  check('deterministic weather', seqs[0] === seqs[1], seqs); info.day = seqs[0];
  const dist = {}; for (const ch of seqs[0]) dist[ch] = (dist[ch] || 0) + 1; info.dist = dist;

  // QF_NOW checks
  p = await open(browser, { now: '2026-11-13T13:30:00Z' });
  o = await out(p); check('20:30 ICT night', o.phase === 'night' && o.time === '20:30' && (await skyOp(p, 'left')) === '1', o);
  await p.close();
  p = await open(browser, { now: Date.parse('2026-11-13T03:00:00Z') });
  check('numeric QF_NOW', (await out(p)).time === '10:00', await out(p)); await p.close();

  // phone 400 night, no horizontal scroll
  p = await open(browser, { now: '2026-11-13T14:00:00Z', vp: { width: 400, height: 800 }, dsf: 2 });
  await send(p, '/weather dong');
  const sc = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check('no h-scroll 400', sc.sw <= sc.cw, sc);
  await p.waitForTimeout(500); await p.screenshot({ path: SH + '/v4-400-night.png' });
  await p.close();

  // GOD
  p = await open(browser, { file: GODF });
  o = await out(p);
  check('god night+dong', o.time === '21:00' && o.phase === 'night' && o.weather === 'dông' && o.timeSource === 'god' && o.weatherSource === 'god', o);
  check('god in getOutside', o.god.announcement === 'Test' && o.god.ambient === 'busy', o.god);
  const first = await p.evaluate(() => { const s = document.querySelector('#messages .sys'); return s && s.textContent; });
  check('god announcement line', first === 'Lệnh từ trên cao: Test', first);
  check('banner visible', await p.evaluate(() => !document.getElementById('banner').hidden && document.getElementById('banner').textContent === 'Test'), 0);
  check('desk note', await p.evaluate(() => { const d = document.getElementById('desknote'); return !d.hidden && d.textContent === 'Ghi chú thử'; }), 0);
  check('rain visible god', (await p.evaluate(() => getComputedStyle(document.querySelector('.skyfx .rain')).opacity)) > .2, 0);
  await shot(p, 'v4-god-banner.png');
  await send(p, '/weather quang'); o = await out(p); check('player overrides god', o.weather === 'quang' && o.weatherSource === 'player', o);
  await send(p, '/weather auto'); o = await out(p); check('auto returns to god', o.weather === 'dông' && o.weatherSource === 'god', o);
  await send(p, '/time 10:00'); await send(p, '/time auto'); o = await out(p); check('time auto returns to god', o.time === '21:00', o);
  await p.waitForTimeout(6300);
  check('banner hides', await p.evaluate(() => document.getElementById('banner').hidden), 0);
  await p.close();
  // god ambient off: no routines in 12s
  const g2 = fs.readFileSync(GODF, 'utf8').replace('"ambient":"busy"', '"ambient":"off"'); fs.writeFileSync(GODF, g2);
  p = await open(browser, { file: GODF, ambient: true });
  await p.evaluate(() => localStorage.setItem('quantfun.settings.v1', JSON.stringify({ speed: 'fast' })));
  await p.waitForTimeout(9000);
  const moved = await p.evaluate(() => ['boss', 'quant', 'trader', 'risk', 'portfolio'].filter(r => /đi |lấy|ghi chú|trao đổi|ngắm|nhìn phố|nhìn mưa/.test(document.getElementById('actor-' + r).dataset.status || '')));
  check('ambient off no routines', moved.length === 0, moved);
  await p.close();
  // invalid JSON -> defaults
  p = await open(browser, { file: BADF, now: '2026-11-13T03:00:00Z' });
  o = await out(p); check('bad json defaults', o.timeSource === 'real' && o.god.weather === 'auto' && o.god.announcement === '', o);
  const firstBad = await p.evaluate(() => document.querySelector('#messages .sys') && document.querySelector('#messages .sys').textContent);
  check('bad json no announcement', !/Lệnh từ trên cao/.test(firstBad || ''), firstBad);
  await p.close();
  // default block unchanged behaviour
  p = await open(browser, { now: '2026-11-13T03:00:00Z' });
  o = await out(p); check('default god', o.timeSource === 'real' && o.weatherSource === 'auto' && o.god.ambient === 'auto', o);
  check('no banner/note by default', await p.evaluate(() => document.getElementById('banner').hidden && document.getElementById('desknote').hidden), 0);
  await p.close();

  // ambient window tie-in under rain
  p = await open(browser, { ambient: true });
  await p.evaluate(() => window.QuantFun.setWeather('mưa'));
  const forced = await p.evaluate(() => { for (const r of ['quant', 'portfolio', 'trader']) if (window.__qf.force(r, 'window')) return r; return null; });
  await p.waitForTimeout(2500);
  const st = forced && await p.evaluate(r => document.getElementById('actor-' + r).dataset.status, forced);
  check('nhìn mưa', /ngắm mưa|nhìn mưa/.test(st || ''), [forced, st]);
  await p.close();

  await browser.close();
  console.log('INFO', JSON.stringify(info));
  console.log('ERRORS', JSON.stringify(errs)); console.log('FAILS', JSON.stringify(fails));
  process.exit(errs.length || fails.length ? 1 : 0);
})();
