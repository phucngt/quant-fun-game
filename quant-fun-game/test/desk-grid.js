const { chromium } = require('playwright'); const path = require('path'); const B = path.resolve(__dirname, '..');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2.5 })).newPage();
  await p.addInitScript(() => { window.QF_FAST = true; });
  await p.goto('file://' + B + '/out/download/quant-fun.html'); await p.waitForSelector('#title:not([hidden])'); await p.click('#deploy'); await p.waitForSelector('#messages .msg');
  await p.addStyleTag({ content: '.actor,.label,.flick,.sky,.skyfx,.roomlight{display:none!important}' });
  await p.waitForTimeout(300);
  await p.locator('#room').screenshot({ path: B + '/shots/room-clean.png' }); await b.close(); })();
