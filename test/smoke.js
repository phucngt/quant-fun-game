const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const B = path.resolve(__dirname, '..');
const URL = 'file://' + B + '/out/download/quant-fun.html';
const SH = B + '/shots';
const bars = require('../assets/bars.json');
const errs = [], fails = [];
const check = (name, ok, info) => { if (!ok) fails.push(name + ' ' + (info === undefined ? '' : JSON.stringify(info))); };
(async () => {
  const browser = await chromium.launch();
  async function open(w, h, fast = true, url = URL) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    if (fast) await p.addInitScript(() => { window.QF_FAST = true; });
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('request', r => { if (!/^(file|data):/.test(r.url())) errs.push('request: ' + r.url()); });
    await p.goto(url);
    return p;
  }
  const cmd = async (p, t) => { await p.fill('#chat-input', t); await p.press('#chat-input', 'Enter'); };
  const txt = (p, sel) => p.$eval(sel, e => e.textContent.trim());
  const toTitle = async p => p.waitForSelector('#title:not([hidden])');
  const enter = async p => { await toTitle(p); await p.click('#deploy'); await p.waitForSelector('#game:not([hidden])'); await p.waitForSelector('#messages .msg'); };
  const toProposal = async p => { await cmd(p, '/giao'); for (let i = 0; i < 13; i++) await cmd(p, '/next'); await p.waitForSelector('.mcard.decision'); };
  const lastBook = async p => p.evaluate(() => { const c = [...document.querySelectorAll('.mcard.book')].pop(); return c ? { rows: [...c.querySelectorAll('.row-fill')].map(r => [...r.children].map(x => x.textContent.trim())), cash: c.querySelector('.book-cash').textContent, text: c.textContent } : null; });
  const approveVisible = p => p.getByText('Approve').filter({ visible: true }).count();
  const chipTexts = p => p.$$eval('#chips button', b => b.map(x => x.textContent.trim()));
  const out = {};

  /* boot -> title */
  let p = await open(1440, 900, false);
  await p.screenshot({ path: SH + '/v2-boot.png' });
  out.bootTextVisible = await p.$eval('.boot-title', e => getComputedStyle(e).opacity);
  await toTitle(p);
  await p.waitForTimeout(300);
  await p.screenshot({ path: SH + '/v2-title-1440.png' });
  await p.context().close();

  p = await open(1440, 900);
  await toTitle(p);
  await p.fill('#boss-name', 'Phúc');
  const before = await txt(p, '#boss-legend-name');
  await p.click('#boss-next');
  const after = await txt(p, '#boss-legend-name');
  check('legend picker changes', before !== after, [before, after]);
  await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  out.bossTag = await txt(p, '#tag-boss .nm');
  check('boss tag Phúc', out.bossTag.startsWith('Phúc'), out.bossTag);
  await cmd(p, '/giao');
  out.bossWho = await p.$$eval('.msg[data-role=boss] .who', e => [...new Set(e.map(x => x.textContent))]);
  check('boss chat Phúc', out.bossWho.length === 1 && out.bossWho[0] === 'Phúc', out.bossWho);
  out.openingMsgs = await p.$$eval('#messages .msg', m => m.map(x => x.textContent.slice(0, 60)));

  /* Approve -> fill next candle */
  for (let i = 0; i < 13; i++) await cmd(p, '/next');
  await p.waitForSelector('.mcard.decision.pass');
  out.approve = { badge: await txt(p, '.mcard.decision .badge'), approveBtn: await p.locator('.mcard.decision button:has-text("Approve")').count(), cashBefore: await txt(p, '#cash'), fillsBefore: (await lastBook(p)) };
  await p.screenshot({ path: SH + '/v2-game-proposal-1440.png' });
  out.traderAtBoss = await p.$eval('#actor-trader', e => e.style.left + ',' + e.style.top + ' ' + e.dataset.facing);
  await p.click('.mcard.decision button:has-text("Approve")');
  await cmd(p, '/status');
  const st = await lastBook(p);
  out.approve.afterApprove = { fillRows: st.rows.length, cash: st.cash, doneText: await txt(p, '.mcard.decision .done'), coach: await p.$$eval('#messages .msg .tx', t => t.slice(-3).map(x => x.textContent)) };
  await cmd(p, 'n');
  await p.waitForSelector('.mcard.book .row-fill');
  const bk = await lastBook(p);
  const open43 = bars[43].open, price = open43 * 1.0005, qty = Math.floor(100000 * 0.2 / open43 * 1000) / 1000;
  out.approve.fill = { rows: bk.rows, cash: bk.cash, expectPrice: price, expectQty: qty, expectCash: 100000 - qty * price };
  check('fill qty', bk.rows.length === 1 && bk.rows[0][2] === qty.toFixed(3), bk.rows);
  check('fill price', bk.rows[0][3] === '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bk.rows[0]);
  check('fill cash', bk.cash === '$' + (100000 - qty * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bk.cash);
  await p.screenshot({ path: SH + '/v2-game-fill-1440.png' });

  /* keys, help, unknown */
  await cmd(p, '/help'); out.helpCard = await p.locator('.mcard.help').count();
  await cmd(p, 'xin chào'); out.unknownReply = await p.$$eval('#messages .msg', m => { const l = m[m.length - 1]; return l.dataset.role + ': ' + l.querySelector('.tx').textContent; });
  check('help card', out.helpCard === 1); check('unknown coach reply', /^(quant|trader|risk|portfolio):/.test(out.unknownReply), out.unknownReply);
  await p.click('#room', { position: { x: 5, y: 5 } });
  const idx0 = await txt(p, '#progress-text'); await p.keyboard.press('n'); const idx1 = await txt(p, '#progress-text');
  check('key N', idx0 !== idx1, [idx0, idx1]);
  await p.keyboard.press('Escape'); check('Esc opens pause', await p.$eval('#pause', d => d.open)); await p.click('[data-pause=resume]');

  /* Reset -> initial (after a fill) */
  await cmd(p, '/reset'); await p.click('.mcard.confirm button:has-text("Chơi lại")');
  out.reset = { progress: await txt(p, '#progress-text'), nav: await txt(p, '#nav'), cash: await txt(p, '#cash'), pnl: await txt(p, '#pnl'), exp: await txt(p, '#exposure'),
    msgs: await p.$$eval('#messages .msg', m => m.length), trader: await p.$eval('#actor-trader', e => e.style.left + ',' + e.style.top), boss: await txt(p, '#tag-boss .nm') };
  check('reset values', out.reset.nav === '$100,000.00' && out.reset.cash === '$100,000.00' && out.reset.pnl === '$0.00' && out.reset.exp === '0.00%' && out.reset.progress.startsWith('Nến 30/160'), out.reset);
  check('reset trader home', await p.evaluate(() => { const a=document.getElementById('actor-trader'),h=window.__qf.stations.trader.spot; return Math.hypot(parseFloat(a.style.left)-h[0],parseFloat(a.style.top)-h[1])<.001; })); check('reset keeps name', out.reset.boss.startsWith('Phúc'));
  await toProposal(p);
  out.reset.allocationInProposal = await txt(p, '.mcard.proposal');
  check('allocation 20 after reset', /20% NAV/.test(out.reset.allocationInProposal), out.reset.allocationInProposal);

  /* Skip -> no fill */
  await cmd(p, '/reset'); await p.click('.mcard.confirm button:has-text("Chơi lại")');
  await cmd(p, '/giao'); await cmd(p, '/run');
  await p.waitForSelector('.mcard.decision.pass'); await p.waitForSelector('#chips button:has-text("Skip")');
  await p.click('#chips button:has-text("Skip")');
  await cmd(p, '/next 3'); await cmd(p, '/book');
  const sk = await lastBook(p);
  out.skip = { rows: sk.rows.length, nav: await txt(p, '#nav'), cash: await txt(p, '#cash'), decision: await txt(p, '.mcard.decision .done') };
  check('skip', out.skip.rows === 0 && out.skip.nav === '$100,000.00' && out.skip.cash === '$100,000.00', out.skip);

  /* 50% -> Block */
  await cmd(p, '/reset'); await p.click('.mcard.confirm button:has-text("Chơi lại")');
  await cmd(p, '/alloc 50'); await cmd(p, '/giao'); await cmd(p, '/run');
  await p.waitForSelector('.mcard.decision.block');
  out.block = { badge: await txt(p, '.mcard.decision.block .badge'), text: await txt(p, '.mcard.decision.block'), approveVisible: await approveVisible(p), chips: await chipTexts(p) };
  check('block no approve', out.block.approveVisible === 0, out.block);
  check('block chips', JSON.stringify(out.block.chips) === JSON.stringify(['/alloc 25', 'Next Candle']), out.block.chips);
  await cmd(p, '/next'); await cmd(p, '/next'); await cmd(p, '/book');
  out.block.fillsAfter = (await lastBook(p)).rows.length;
  check('block 0 fills', out.block.fillsAfter === 0);
  await p.screenshot({ path: SH + '/v2-game-block-1440.png' });

  /* errors + settings persistence */
  await cmd(p, '/alloc 101'); out.err = await p.$$eval('.sys.err', e => e.pop().textContent);
  check('error line', out.err === 'Vốn phân bổ phải từ 1% đến 100%.', out.err);
  await cmd(p, '/approve'); out.err2 = await p.$$eval('.sys.err', e => e.pop().textContent);
  check('error 2', out.err2 === 'Không có đề xuất đang chờ duyệt.', out.err2);
  await p.click('#menu'); await p.click('[data-pause=settings]');
  await p.selectOption('#set-legend-trader', 'cz');
  out.settings = { name: await txt(p, '#tag-trader .nm'), sprite: await p.$eval('#actor-trader img', e => e.naturalWidth), chat: await p.$$eval('.msg[data-role=trader] .who', e => e.pop() && e.pop() ? 1 : 1) };
  check('settings trader CZ', out.settings.name === 'CZ' && out.settings.sprite === 142, out.settings);
  await p.screenshot({ path: SH + '/v2-settings-1440.png' });
  await p.press('#set-name-boss', 'End'); await p.keyboard.press('Escape');
  await p.reload(); await toTitle(p);
  out.persist = { name: await p.inputValue('#boss-name'), legend: await txt(p, '#boss-legend-name') };
  check('persist name', out.persist.name === 'Phúc', out.persist);
  // all legends x 4 angles decode
  out.sprites = await p.evaluate(async (ids) => { return 'skip'; }, []);
  await p.context().close();

  /* all legends load */
  p = await open(1440, 900); await enter(p);
  await p.click('#menu'); await p.click('[data-pause=settings]');
  const ids = await p.$$eval('#set-legend-trader option', o => o.map(x => x.value));
  let bad = 0;
  for (const id of ids) {
    await p.selectOption('#set-legend-trader', id);
    const w = await p.$$eval('#actor-trader img', imgs => Promise.all(imgs.map(i => i.decode().then(() => i.naturalWidth).catch(() => 0))));
    if (!w.every(x => x === 142)) bad++;
  }
  out.legends = { count: ids.length, bad }; check('all legends x4 sprites 142', ids.length >= 22 && bad === 0, out.legends);
  await p.context().close();

  /* phone */
  const m = await open(400, 860, false);
  await toTitle(m); await m.waitForTimeout(300);
  await m.screenshot({ path: SH + '/v2-title-400.png' });
  out.titleH = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.click('#deploy'); await m.waitForSelector('#messages .msg');
  await cmd(m, '/giao'); await m.waitForTimeout(900); for (let i = 0; i < 13; i++) await cmd(m, '/next');
  await m.waitForSelector('.mcard.decision', { timeout: 8000 }); await m.waitForTimeout(500);
  out.hscroll = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  out.pageScroll = await m.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  await m.screenshot({ path: SH + '/v2-game-400.png' });
  await m.context().close();

  /* real-time walk */
  const r = await open(1440, 900, false);
  await toTitle(r); await r.click('#deploy'); await r.waitForSelector('#messages .msg');
  await cmd(r, '/giao'); await r.waitForTimeout(1000);
  for (let i = 0; i < 13; i++) await cmd(r, '/next');
  const samples = [];
  for (let i = 0; i < 60; i++) { const sample=await r.evaluate(() => { const a=document.getElementById('actor-trader');return {point:[parseFloat(a.style.left),parseFloat(a.style.top)],face:a.dataset.facing,walking:a.classList.contains('walking'),bubble:document.getElementById('bubble-trader').classList.contains('show')}; });samples.push(sample);if(sample.bubble)break;await r.waitForTimeout(100); }
  out.walk = samples;
  out.overlap = null;
  for (let i = 0; i < 40 && !out.overlap; i++) {
    out.overlap = await r.evaluate(() => { const bb = document.getElementById('bubble-trader'); if (!bb.classList.contains('show')) return null;
      const a = bb.getBoundingClientRect(), b = document.getElementById('tag-boss').getBoundingClientRect(), room = document.getElementById('room').getBoundingClientRect();
      return { overlap: !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom), inside: a.left >= room.left && a.right <= room.right && a.top >= room.top }; });
    if (!out.overlap) await r.waitForTimeout(100);
  }
  check('trader bubble clear of boss tag', out.overlap && !out.overlap.overlap && out.overlap.inside, out.overlap);
  const stop=await r.evaluate(()=>window.__qf.stop);
  check('walk faces', samples.some(s=>s.walking&&s.face==='rear-left') && samples.some(s=>!s.walking&&s.bubble),samples);
  check('bubble after arrival', samples.filter(s=>s.bubble).every(s=>Math.hypot(s.point[0]-stop[0],s.point[1]-stop[1])<.01&&!s.walking),samples);
  await r.screenshot({ path: SH + '/v2-game-realtime-1440.png' });
  await r.context().close();

  /* fragment in a bare shell */
  const frag = fs.readFileSync(B + '/out/artifact/quant-fun.html', 'utf8');
  fs.writeFileSync(B + '/out/artifact-shell.html', '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width, initial-scale=1"><body>' + frag + '</body>');
  const f = await open(1440, 900, true, 'file://' + B + '/out/artifact-shell.html');
  await enter(f); await cmd(f, '/giao');
  await f.screenshot({ path: SH + '/v2-fragment-1440.png' });
  await f.context().close();

  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS', errs); console.log('FAILS', fails);
  process.exit(errs.length || fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
