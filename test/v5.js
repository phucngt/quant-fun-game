const { chromium } = require('playwright');
const path = require('path');
const B = path.resolve(__dirname, '..');
const URL = 'file://' + B + '/out/download/quant-fun.html', SH = B + '/shots';
const errs = [], fails = [];
const check = (n, ok, i) => { if (!ok) fails.push(n + ' ' + JSON.stringify(i)); };

const FAKE = () => {
  window.__calls = []; window.__aborted = 0; window.__next = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__fake = async (input, opts) => {
    window.__calls.push({ input: typeof input === 'string' ? input : JSON.stringify(input), tools: (opts.tools || []).map(t => t.name), cache: opts.cache, tier: opts.modelTier });
    const b = window.__next || { text: '@quant\nOK sếp, tao nghe.' };
    if (b.reject) { await sleep(5); throw b.reject; }
    let acc = '';
    const sig = opts.signal;
    const onAbort = () => { window.__aborted++; };
    sig.addEventListener('abort', onAbort);
    const words = b.text.split(/(?<= )/);
    for (const w of words) {
      if (sig.aborted) throw { code: 'cancelled', text: acc };
      await sleep(b.delay || 8); acc += w; opts.onText({ text: acc, delta: w });
    }
    if (b.hang) await new Promise((_, rej) => sig.addEventListener('abort', () => rej({ code: 'cancelled', text: acc })));
    if (b.tools) { window.__toolOut = await opts.tools[0].execute({ n: 3 }); window.__bookOut = await opts.tools[1].execute({}); window.__rulesOut = await opts.tools[2].execute({}); }
    return { text: b.text, truncated: false };
  };
};
async function open(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.QF_FAST = true; });
  if (o.hook) await p.addInitScript(FAKE), await p.addInitScript(() => { window.QF_SAMPLE = (...a) => window.__fake(...a); });
  if (o.claudeUse) await p.addInitScript(FAKE), await p.addInitScript(() => { window.claude = { use: async n => (n === 'sample' ? (window.__useNull ? null : (...a) => window.__fake(...a)) : null) }; });
  if (o.useNull) await p.addInitScript(() => { window.__useNull = true; });
  if (o.settings) await p.addInitScript(s => { try { localStorage.setItem('quantfun.settings.v1', JSON.stringify(s)); } catch (e) {} }, o.settings);
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('request', r => { if (!/^(file|data):/.test(r.url())) errs.push('request: ' + r.url()); });
  await p.goto(URL); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  return p;
}
const send = async (p, t) => { await p.fill('#chat-input', t); await p.press('#chat-input', 'Enter'); };
const setNext = (p, b) => p.evaluate(b => { window.__next = b; }, b);
const calls = p => p.evaluate(() => window.__calls.length);
const last = (p, role) => p.evaluate(r => { const rows = [...document.querySelectorAll('#messages .msg[data-role="' + r + '"]')]; const x = rows[rows.length - 1]; return x ? x.querySelector('.tx').textContent : null; }, role);
const allRoles = p => p.evaluate(() => [...document.querySelectorAll('#messages .msg')].map(r => r.dataset.role));

(async () => {
  const browser = await chromium.launch();
  let p = await open(browser, { hook: true });
  check('chip on', (await p.textContent('#brainchip')) === 'Claude · bật', await p.textContent('#brainchip'));
  // 1. addressed by name, streaming
  await setNext(p, { text: '@portfolio\nSếp ơi, tao thấy sổ đang trống, chưa có gì để bàn nhiều. Chờ SMA cắt đã nhé.', delay: 60 });
  await send(p, 'ray dalio ông có ý tưởng gì ko');
  await p.waitForTimeout(250);
  const mid = await last(p, 'portfolio');
  check('streamed partial', mid && mid.length > 3 && mid.length < 80 || mid === 'đang soạn…', mid);
  const st = await p.evaluate(() => document.getElementById('actor-portfolio').dataset.status);
  check('seat status while answering', st === 'đang trả lời Boss', st);
  await p.locator('#stage').screenshot({ path: SH + '/v5-streaming-room.png' });
  await p.screenshot({ path: SH + '/v5-streaming-1440.png' });
  await p.waitForTimeout(1500);
  const fin = await last(p, 'portfolio');
  check('final portfolio reply', /Chờ SMA cắt đã nhé\.$/.test(fin || ''), fin);
  const c1 = await p.evaluate(() => window.__calls[0]);
  check('prompt addressed', /Người trả lời đã được chọn: @portfolio \(Ray Dalio\)/.test(c1.input) && /Nến 30\/160/.test(c1.input) && /TIN CỦA BOSS/.test(c1.input) && /ray dalio ông có ý tưởng gì ko/.test(c1.input), c1.input.slice(-400));
  check('prompt rules+outside', /long-only/.test(c1.input) && /Ngoài cửa sổ phòng/.test(c1.input) && /xưng "tao"/.test(c1.input), 0);
  check('opts', c1.tools.join() === 'get_bars,get_book,get_rules' && c1.cache === false && c1.tier === 'default', c1);
  const st2 = await p.evaluate(() => document.getElementById('actor-portfolio').dataset.status);
  check('seat status restored', st2 !== 'đang trả lời Boss', st2);
  // 2. @risk
  await setNext(p, { text: '@risk\nTrần 25% NAV vẫn đứng đó sếp.' });
  await send(p, '@risk sếp hỏi chút về hạn mức'); await p.waitForTimeout(500);
  check('@risk answers', /Trần 25%/.test(await last(p, 'risk') || ''), await last(p, 'risk'));
  const c2 = await p.evaluate(() => window.__calls[1].input);
  check('@risk speaker told', /đã được chọn: @risk/.test(c2) && !/TIN CỦA BOSS[^\n]*\n@risk/.test(c2), 0);
  // 3. unaddressed -> model picks role; placeholder first
  await setNext(p, { text: '@trader\nTao thấy khối lượng đang mỏng, chưa vội vào lệnh.', delay: 200 });
  await send(p, 'thị trường lúc này thế nào'); await p.waitForSelector('#messages .sys.ph', { timeout: 3000 }).catch(() => {});
  const ph = await p.evaluate(() => { const e = document.querySelector('#messages .sys.ph'); return e ? e.textContent : ''; });
  check('placeholder', /đang soạn/.test(ph), ph);
  await p.waitForTimeout(1500);
  check('model-picked role', /khối lượng đang mỏng/.test(await last(p, 'trader') || ''), await last(p, 'trader'));
  check('no placeholder left', await p.evaluate(() => ![...document.querySelectorAll('#messages .sys')].some(e => /đang soạn/.test(e.textContent))), 0);
  // 4. suggestion chip
  await setNext(p, { text: '@quant\nTao nghĩ hạ phân bổ cho an toàn.\n>> /alloc 25' });
  await send(p, 'quant ơi nên làm gì'); await p.waitForTimeout(500);
  const sg = await p.evaluate(() => [...document.querySelectorAll('#messages .sugg button')].map(b => b.textContent));
  check('suggest chip', sg.length === 1 && sg[0] === 'Chạy /alloc 25', sg);
  check('>> line hidden from text', !/>>/.test(await last(p, 'quant') || ''), await last(p, 'quant'));
  await p.click('#messages .sugg button'); await p.waitForTimeout(300);
  check('chip runs command', await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].some(e => /Đã áp dụng phân bổ 25%/.test(e.textContent))), 0);
  // 5. invalid >> dropped
  for (const bad of ['>> /bay het tien', '>> /reset', '>> rm -rf', '>> /name Hack']) {
    const n0 = await p.evaluate(() => document.querySelectorAll('#messages .sugg').length);
    await setNext(p, { text: '@risk\nThử nhé.\n' + bad });
    await send(p, 'hỏi vu vơ số ' + bad.length); await p.waitForTimeout(400);
    const n1 = await p.evaluate(() => document.querySelectorAll('#messages .sugg').length);
    check('invalid >> dropped ' + bad, n1 === n0, [n0, n1]);
  }
  // 6. commands never call the model
  const before = await calls(p);
  for (const c of ['/giao', 'n', '/next 3', '/weather mua', '/time 10:00', '/status', '/book', '/help', '/alloc 20', '/weather auto', '/time auto']) { await send(p, c); await p.waitForTimeout(120); }
  check('commands skip model', (await calls(p)) === before, [before, await calls(p)]);
  // tools executed
  await setNext(p, { text: '@quant\nĐã xem nến.', tools: true });
  await send(p, 'quant xem giúp mấy nến gần đây'); await p.waitForTimeout(500);
  const tl = await p.evaluate(() => ({ bars: window.__toolOut, book: window.__bookOut, rules: window.__rulesOut }));
  check('tools return data', Array.isArray(tl.bars) && tl.bars.length === 3 && tl.bars[2].close > 0 && tl.book.nav > 0 && /25%/.test(tl.rules), tl);
  // 7. rate_limited
  await setNext(p, { reject: { code: 'rate_limited', message: 'x' } });
  const cb = await calls(p);
  await send(p, 'ed ơi sao rồi'); await p.waitForTimeout(400);
  const sl = await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].map(e => e.textContent));
  check('rate_limited line', sl.includes('Claude đang bận, thử lại sau.'), sl.slice(-3));
  check('rate_limited canned to addressed seat', /Tao đang theo dõi|chưa giao|Bấm|tao/i.test(await last(p, 'risk') || ''), await last(p, 'risk'));
  check('rate_limited feature stays on', (await p.textContent('#brainchip')) === 'Claude · bật', 0);
  await setNext(p, { text: '@risk\nOK lại rồi.' }); await send(p, 'ed thử lại'); await p.waitForTimeout(400);
  check('call after rate_limited', (await calls(p)) === cb + 2 && /OK lại rồi/.test(await last(p, 'risk')), await calls(p));
  // 8. reset aborts in flight
  await setNext(p, { text: '@quant\nĐây là câu trả lời rất dài để còn đang chạy khi reset xảy ra nên sẽ bị hủy giữa chừng, chưa hết đâu nhé.', delay: 150 });
  await send(p, 'quant kể chuyện đi'); await p.waitForTimeout(400);
  const ab0 = await p.evaluate(() => window.__aborted);
  await send(p, '/reset'); await p.waitForTimeout(150); await send(p, '/reset now'); await p.waitForTimeout(500);
  check('abort called', (await p.evaluate(() => window.__aborted)) > ab0, 0);
  const leftover = await p.evaluate(() => [...document.querySelectorAll('#messages .msg')].some(r => /rất dài/.test(r.textContent)) || [...document.querySelectorAll('#messages .tx.typing')].length);
  check('reset leaves no in-flight reply', !leftover, leftover);
  await p.waitForTimeout(2500);
  check('late text not resurrected', !(await p.evaluate(() => /rất dài/.test(document.getElementById('messages').textContent))), 0);
  // new message aborts previous
  await setNext(p, { text: '@quant\nCâu một dài dòng dài dòng dài dòng dài dòng dài dòng.', delay: 200 });
  await send(p, 'quant câu một'); await p.waitForTimeout(300);
  await setNext(p, { text: '@quant\nCâu hai.' }); await send(p, 'quant câu hai'); await p.waitForTimeout(1500);
  const txt = await p.evaluate(() => document.getElementById('messages').textContent);
  check('new message supersedes', /Câu hai\./.test(txt) && !/Câu một dài dòng dài dòng dài dòng dài dòng dài dòng\./.test(txt), 0);
  // settings counter + toggle
  await p.click('#menu'); await p.click('[data-pause=settings]');
  const note = await p.textContent('#brain-note');
  check('settings counter', /^Claude đã trả lời \d+\/40$/.test(note), note);
  await p.uncheck('#brain-on'); await p.keyboard.press('Escape');
  check('chip scripted when off', (await p.textContent('#brainchip')) === 'Kịch bản', 0);
  const cOff = await calls(p); await send(p, 'ray ơi nghĩ sao'); await p.waitForTimeout(300);
  check('toggle off no call', (await calls(p)) === cOff && !!(await last(p, 'portfolio')), 0);
  await p.close();

  // 9. budget
  p = await open(browser, { hook: true });
  await setNext(p, { text: '@quant\nOK.' });
  for (let i = 0; i < 41; i++) { await send(p, 'quant hỏi lần ' + i); await p.waitForTimeout(i < 40 ? 90 : 300); }
  check('budget 40 calls', (await calls(p)) === 40, await calls(p));
  const sl2 = await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].map(e => e.textContent));
  check('budget line', sl2.some(t => /đủ 40 lượt/.test(t)), sl2.slice(-2));
  check('chip scripted at budget', (await p.textContent('#brainchip')) === 'Kịch bản', 0);
  await p.click('#menu'); await p.click('[data-pause=settings]');
  check('settings 40/40', (await p.textContent('#brain-note')) === 'Claude đã trả lời 40/40', await p.textContent('#brain-note'));
  await p.close();

  // 10. not_granted via claude.use
  p = await open(browser, { claudeUse: true });
  check('chip on with window.claude', (await p.textContent('#brainchip')) === 'Claude · bật', 0);
  await p.evaluate(() => { window.__next = { reject: { code: 'not_granted', message: 'no' } }; });
  await send(p, 'jim ơi nghĩ sao'); await p.waitForTimeout(400);
  check('not_granted silent canned', /tao|Gõ|Bấm/i.test(await last(p, 'quant') || '') && !(await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].some(e => /Claude/.test(e.textContent)))), await last(p, 'quant'));
  check('not_granted feature off', (await p.textContent('#brainchip')) === 'Kịch bản', 0);
  const c3 = await calls(p); await send(p, 'jim lần nữa'); await p.waitForTimeout(300);
  check('no further calls', (await calls(p)) === c3, 0);
  await p.close();
  // use() resolves null
  p = await open(browser, { claudeUse: true, useNull: true });
  await send(p, 'trader ơi'); await p.waitForTimeout(400);
  check('use null canned', !!(await last(p, 'trader')) && (await p.textContent('#brainchip')) === 'Kịch bản', 0);
  await p.close();

  // 11. standalone, no hook
  p = await open(browser, {});
  check('standalone chip', (await p.textContent('#brainchip')) === 'Kịch bản', 0);
  await send(p, 'ray dalio ông có ý tưởng gì ko'); await p.waitForTimeout(300);
  const t = await last(p, 'portfolio');
  check('standalone canned routed to addressed seat', !!t && /Sếp chưa giao việc|tao/i.test(t), t);
  await send(p, 'blah blah'); await p.waitForTimeout(200);
  check('standalone unaddressed uses hint role', (await allRoles(p)).slice(-1)[0] === 'quant', await allRoles(p));
  await p.click('#menu'); await p.click('[data-pause=settings]');
  check('standalone settings note', (await p.textContent('#brain-note')) === 'Không khả dụng ở bản tải về.' && await p.isDisabled('#brain-on'), await p.textContent('#brain-note'));
  await p.keyboard.press('Escape'); await p.close();
  p = await open(browser, { settings: { mode: 'free' } });
  await send(p, 'ray dalio gì đó'); await p.waitForTimeout(200);
  check('free mode canned sys', await p.evaluate(() => [...document.querySelectorAll('#messages .sys')].pop().textContent) === 'Không hiểu lệnh. Gõ /help.', 0);
  await p.close();

  // 12. phone layout: header fits
  p = await open(browser, { hook: true, vp: { width: 400, height: 800 } });
  const sc = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check('no h-scroll 400', sc.sw <= sc.cw, sc);
  await p.close();

  await browser.close();
  console.log('ERRORS', JSON.stringify(errs)); console.log('FAILS', JSON.stringify(fails));
  process.exit(errs.length || fails.length ? 1 : 0);
})();
