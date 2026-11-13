/* Quant Fun UI v2: boot -> title -> game (room + chat). Globals from build.py: BARS, ASSETS, QuantLogic. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const W = 1600, H = 1195, RATIO = H / W;
  const ANGLES = ['front-left', 'front-right', 'rear-left', 'rear-right'];
  const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money = v => MONEY.format(v);
  const num2 = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const utc = ts => new Date(ts).toISOString().slice(11, 16);
  const ROLES = ['boss', 'quant', 'trader', 'risk', 'portfolio'];
  const ROLE_LABEL = { boss: 'Boss', quant: 'Quant Analyst', trader: 'Trader', risk: 'Risk Manager', portfolio: 'Portfolio Manager' };
  const ROLE_COLOR = { boss: '#ffc56b', quant: '#a8b9fa', trader: '#7fd1e8', risk: '#f2a37a', portfolio: '#c79bf2' };
  const DEFAULT_TEAM = { boss: 'phuc', quant: 'jim', portfolio: 'ray', trader: 'paul', risk: 'ed' };
  /* trạm làm việc: spot = chỗ đứng phía màn hình của bàn, look = tâm cụm màn hình (đo trên ảnh phóng) */
  const STATIONS = {
    boss: { desk: 'rear@31.4,64.8', spot: [26.8, 60.8], look: [30.7, 52.3] },
    portfolio: { desk: 'left@35.4,67.5', spot: [36.1, 63.5], look: [36.5, 53.0] },
    quant: { desk: 'left@46.7,53.0', spot: [47.4, 49.0], look: [46.8, 39.3] },
    trader: { desk: 'right@55.4,78.7', spot: [52.6, 80.2], look: [54.5, 64.0] },
    risk: { desk: 'left@62.6,76.0', spot: [63.4, 79.4], look: [62.2, 62.5] },
  };
  const HOME = Object.fromEntries(Object.entries(STATIONS).map(([r, v]) => [r, v.spot]));
  function dirFace(dx, dy) { return dy > 0 ? (dx < 0 ? 'front-left' : 'front-right') : (dx < 0 ? 'rear-left' : 'rear-right'); }
  const TALK = { boss: 'front-right', quant: 'front-left', portfolio: 'front-left', trader: 'front-left', risk: 'front-left' };
  const WORK = Object.fromEntries(Object.entries(STATIONS).map(([r, v]) => [r, dirFace((v.look[0] - v.spot[0]) * 1600 / 100, (v.look[1] - v.spot[1]) * 1195 / 100)]));
  const WP1 = [34, 70.5], STOP = [30.2, 66.8];
  const TAG_SHIFT = { boss: '-40%', quant: '28%', portfolio: '32%', risk: '26%' };
  const IDLE = { boss: 'bạn', quant: 'chờ giao việc', trader: 'chờ tín hiệu', risk: 'trực hạn mức 25% NAV', portfolio: 'giữ sổ danh mục' };
  const DESKS = [['rear', 31.4, 64.8, 64], ['left', 35.4, 67.5, 68], ['rear', 42.4, 50.4, 50],
    ['left', 46.7, 53.0, 53], ['left', 62.6, 76.0, 76], ['right', 55.4, 78.7, 79]];
  const LEG = Object.fromEntries(ASSETS.legends.map(l => [l.id, l.name]));
  const CANCEL = { cancel: true };
  const KEY = 'quantfun.settings.v1';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phoneMQ = window.matchMedia('(max-width: 899px)');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const copy = s => JSON.parse(JSON.stringify(s));
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();

  /* ================= settings ================= */
  const settings = { deskName: 'Quant Fun Desk', team: { ...DEFAULT_TEAM }, names: {}, motion: true, mode: 'guided', speed: 'normal', sky: 'auto', brain: true };
  function defaultNames() { for (const r of ROLES) settings.names[r] = r === 'boss' ? 'Boss' : LEG[settings.team[r]]; }
  defaultNames();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') {
      if (typeof o.deskName === 'string' && o.deskName.trim()) settings.deskName = o.deskName.slice(0, 18);
      if (o.team && ROLES.every(r => LEG[o.team[r]]) && new Set(ROLES.map(r => o.team[r])).size === ROLES.length) settings.team = { ...o.team };
      if (o.names) for (const r of ROLES) if (typeof o.names[r] === 'string') settings.names[r] = o.names[r].slice(0, 18);
      else settings.names[r] = settings.names[r] || (r === 'boss' ? 'Boss' : LEG[settings.team[r]]);
      if (typeof o.motion === 'boolean') settings.motion = o.motion;
      if (o.mode === 'free' || o.mode === 'guided') settings.mode = o.mode;
      if (typeof o.brain === 'boolean') settings.brain = o.brain;
      if (o.sky === 'day' || o.sky === 'auto') settings.sky = o.sky;
      if (o.speed === 'fast' || o.speed === 'normal') settings.speed = o.speed;
    }
  } catch (e) { /* storage unavailable: defaults */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  const nameOf = r => (settings.names[r] || '').trim() || LEG[settings.team[r]];
  const speed = () => (settings.speed === 'fast' ? 2.5 : 1);
  const instant = () => window.QF_FAST === true || reduce.matches || !settings.motion;
  const slug = () => '#' + (norm(settings.deskName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'desk');
  const sprite = (role, ang = 'front-right') => ASSETS.sprites[settings.team[role]][ang];
  function portrait(legendId, cls) {
    const p = el('span', 'portrait' + (cls ? ' ' + cls : '')), i = el('img'); i.alt = ''; i.src = ASSETS.sprites[legendId]['front-right']; p.append(i); return p;
  }

  /* ================= screens, dialogs ================= */
  function showScreen(name) {
    for (const s of ['boot', 'title', 'game']) $(s).hidden = s !== name;
    if (name === 'game') requestAnimationFrame(drawChart);
  }
  let opener = null;
  function openDlg(d, from) {
    opener = from || null;
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else { d.setAttribute('open', ''); d.classList.add('fallback'); }
  }
  function closeDlg(d, refocus = true) {
    if (d.close) d.close(); else d.removeAttribute('open');
    if (refocus && opener && opener.isConnected && opener.offsetParent !== null) opener.focus();
  }
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', e => { if (e.target === d) closeDlg(d); });
    const c = d.querySelector('[data-close]'); if (c) c.onclick = () => closeDlg(d);
  }
  const dialogOpen = () => !!document.querySelector('dialog[open]');

  /* ================= room ================= */
  const room = $('room');
  const bg = el('img', 'bg'); bg.alt = ''; bg.src = ASSETS.room; bg.draggable = false; room.prepend(bg);
  /* ===== đồ pantry trên mặt quầy tường phải (toạ độ % phòng, chân đồ nằm trên mặt quầy) ===== */
  const PANTRY_AT = { 'water-pitcher': [75.0, 47.7], 'espresso-idle': [78.8, 49.2], 'mug-tray': [83.7, 52.6], 'printer-idle': [87.6, 54.5] };
  const PANTRY_ALT = { 'espresso-idle': 'espresso-brewing', 'printer-idle': 'printer-printing' };
  const pantryEl = {};
  function addPantry(id, x, y, hidden) {
    const sp = PANTRY.sprites[id], d = el('img', 'pantry'); d.alt = ''; d.src = sp.uri; d.draggable = false; d.dataset.prop = id;
    d.style.cssText = `left:${x}%;top:${y}%;width:${sp.widthFrac * 100}%;transform:translate(${-sp.anchor.x / sp.w * 100}%,${-sp.anchor.y / sp.h * 100}%)`;
    if (hidden) d.hidden = true;
    room.append(d); pantryEl[id] = d;
  }
  for (const [id, [x, y]] of Object.entries(PANTRY_AT)) { addPantry(id, x, y, false); if (PANTRY_ALT[id]) addPantry(PANTRY_ALT[id], x, y, true); }
  function pantryState(base, on) { const alt = PANTRY_ALT[base]; if (!alt) return; pantryEl[base].hidden = !!on; pantryEl[alt].hidden = !on; }
  for (const [kind, x, y, z] of DESKS) {
    const d = el('img', 'prop'); d.alt = ''; d.src = ASSETS.desks[kind];
    d.style.cssText = `left:${x}%;top:${y}%;z-index:${z};aspect-ratio:${ASSETS.desks[kind + '_ratio']}`;
    room.append(d);
  }
  const actors = {};
  for (const role of ROLES) {
    const a = { role, x: 0, y: 0, facing: null, hideTimer: 0 };
    a.el = el('div', 'actor'); a.el.id = 'actor-' + role; a.el.append(el('div', 'shadow'));
    a.body = el('div', 'body'); a.imgs = {}; a.layers = {};
    for (const ang of ANGLES) {
      const fig = el('div', 'fig'); a.imgs[ang] = fig;
      a.layers[ang] = ['lb', 'll', 'lr'].map(k => { const i = el('img', 'l ' + k); i.alt = ''; i.draggable = false; fig.append(i); return i; });
      a.body.append(fig);
    }
    a.el.append(a.body);
    a.act = el('div', 'act'); a.el.append(a.act); a.cur = null; a.pose = null; a.poseTimer = 0; a.walkAct = false; a.actSheet = null; a.variant = false;
    a.icon = el('span', 'icon'); a.el.append(a.icon);
    a.mini = el('div', 'mini', '…');
    a.free = true; a.inRoutine = false; a.away = false; a.rtok = 0; a.chatWith = null; a.working = false; a.nextAt = 0; a.cycleAt = 0;
    a.label = el('div', 'label'); a.label.id = 'label-' + role;
    a.bubble = el('div', 'bubble'); a.bubble.id = 'bubble-' + role;
    a.tagbox = el('div', 'tagbox'); if (TAG_SHIFT[role]) a.tagbox.style.setProperty('--tx', TAG_SHIFT[role]);
    a.tag = el('div', 'tag'); a.tag.id = 'tag-' + role;
    a.nm = el('span', 'nm'); a.st = el('span', 'st'); a.tag.append(a.nm, a.st); a.tagbox.append(a.tag);
    a.label.append(a.bubble, a.mini, a.tagbox); room.append(a.el, a.label);
    actors[role] = a;
  }
  function setPos(a, x, y) {
    a.x = x; a.y = y;
    a.el.style.left = x + '%'; a.el.style.top = y + '%'; a.el.style.zIndex = Math.round(y) + 17;
    a.label.style.left = x + '%'; a.label.style.top = `calc(${y}% - 14%)`; a.label.style.zIndex = 400 + Math.round(y);
  }
  function setFace(a, key) {
    if (a.facing) a.imgs[a.facing].classList.remove('on');
    a.facing = key; a.imgs[key].classList.add('on'); a.el.dataset.facing = key;
    if (a.cur && a.el.classList.contains('acting')) paintAct(a);
  }
  function setStatus(a, text, tone = 'idle') {
    a.status = text; a.el.dataset.status = text; a.st.replaceChildren();
    a.st.append(el('i', 'dot ' + tone), el('span', 'rl', ROLE_LABEL[a.role] + ' · '), document.createTextNode(text));
  }
  function renderTags() {
    for (const r of ROLES) {
      const a = actors[r]; a.nm.textContent = nameOf(r);
      if (r === 'boss') a.nm.append(el('span', 'you', 'BẠN'));
    }
  }
  /* ================= v6: khung hoạt cảnh thật ================= */
  const sheetState = {};
  function loadSheet(idx) {
    sheetStyle(idx);
    if (sheetState[idx] === true) return Promise.resolve(true);
    if (sheetState[idx] && sheetState[idx].then) return sheetState[idx];
    const i = new Image(); i.src = ANIM.sheets[idx].uri; sheetImgs.push(i);
    sheetState[idx] = (i.decode ? i.decode() : new Promise((res, rej) => { i.onload = res; i.onerror = rej; })).then(() => (sheetState[idx] = true), () => (sheetState[idx] = false));
    return sheetState[idx];
  }
  const sheetImgs = [], sheetCss = {};
  function sheetStyle(idx) {
    if (sheetCss[idx]) return; sheetCss[idx] = true;
    const st = document.createElement('style'); st.textContent = `.actor .act.s${idx}{background-image:url(${ANIM.sheets[idx].uri})}`; document.head.append(st);
  }
  const animOf = a => ANIM.legends[settings.team[a.role]];
  const animReady = a => { const L = animOf(a); return !!L && sheetState[L.sheet] === true; };
  const motionOk = () => !reduce.matches && settings.motion;
  function paintAct(a) {
    const L = animOf(a); if (!L || !a.cur) return;
    const rows = L.actions[a.cur.action]; if (!rows) return;
    const sh = ANIM.sheets[L.sheet], R = Math.round(sh.h / 112), fi = a.cur.i % rows.length, row = rows[fi], col = Math.max(0, ANGLES.indexOf(a.facing));
    if (a.actSheet !== L.sheet) { sheetStyle(L.sheet); a.act.className = 'act s' + L.sheet; a.act.style.backgroundSize = `400% ${R * 100}%`; a.actSheet = L.sheet; }
    a.act.style.backgroundPosition = `${col / 3 * 100}% ${R > 1 ? row / (R - 1) * 100 : 0}%`;
    const d = a.act.dataset; d.action = a.cur.action; d.frame = String(fi); d.col = String(col); d.row = String(row);
  }
  function endWalkAct(a) { a.walkAct = false; if (!a.pose) a.el.classList.remove('acting'); }
  function clearPose(a) { clearInterval(a.poseTimer); a.poseTimer = 0; a.pose = null; a.act.classList.remove('hold'); if (!a.walkAct) a.el.classList.remove('acting'); }
  function setPose(a, action, fps = 3) {
    clearPose(a);
    if (!motionOk() || !animReady(a)) return false;
    const rows = animOf(a).actions[action]; if (!rows) return false;
    a.pose = action; a.cur = { action, i: 0 }; a.el.classList.add('acting'); paintAct(a);
    if (rows.length > 1) a.poseTimer = setInterval(() => { a.cur.i++; paintAct(a); }, 1000 / (fps * speed())); else a.act.classList.add('hold');
    return true;
  }
  function poseFor(a, kind) {
    const A_ = animOf(a) ? animOf(a).actions : {};
    if (kind === 'notes') return A_['take-notes'] ? ['take-notes', 'ghi chú'] : ['open-notebook', 'ghi chú'];
    if (kind === 'phone') return A_['check-phone'] ? ['check-phone', 'xem điện thoại'] : ['read-book', 'đọc sách'];
    return [kind, null];
  }
  function applyLooks() {
    for (const r of ROLES) for (const ang of ANGLES) for (const im of actors[r].layers[ang]) im.src = ASSETS.sprites[settings.team[r]][ang];
    for (const r of ROLES) { actors[r].actSheet = null; const L = animOf(actors[r]); if (L) loadSheet(L.sheet); }
    renderTags();
    const s = slug();
    $('chat-title').textContent = s; $('chat-input').placeholder = 'Nhắn ' + s + ' · gõ /help';
    $('kicker-text').textContent = 'TRADING DESK · ' + settings.deskName.toUpperCase() + ' · ' + utc(BARS[QuantLogic.WARMUP - 0].timestamp) + ' UTC';
    renderPresence();
  }
  function renderPresence() {
    $('presence').replaceChildren(...ROLES.map(r => { const i = el('i'); i.style.background = ROLE_COLOR[r]; i.title = nameOf(r); return i; }));
  }
  function clampBubble(a) {
    a.bubble.style.setProperty('--bx', '0px');
    const rr = room.getBoundingClientRect(), br = a.bubble.getBoundingClientRect();
    if (!rr.width) return;
    let sh = 0;
    if (br.left < rr.left + 4) sh = rr.left + 4 - br.left; else if (br.right > rr.right - 4) sh = rr.right - 4 - br.right;
    a.bubble.style.setProperty('--bx', sh + 'px');
  }
  function say(role, text, hold = false, side = null) {
    const a = actors[role];
    for (const r of ROLES) if (r !== role) { clearTimeout(actors[r].hideTimer); actors[r].bubble.classList.remove('show'); }
    clearTimeout(a.hideTimer);
    a.bubble.classList.remove('show'); void a.bubble.offsetWidth;
    a.bubble.classList.toggle('right', side === 'right');
    a.bubble.textContent = text; a.bubble.classList.add('show');
    clampBubble(a);
    if (!hold) release(a);
  }
  function release(a) { clearTimeout(a.hideTimer); a.hideTimer = setTimeout(() => a.bubble.classList.remove('show'), 4500); }
  function hideBubbles() { for (const r of ROLES) { clearTimeout(actors[r].hideTimer); actors[r].bubble.classList.remove('show'); } }

  /* ================= world: giờ Việt Nam + thời tiết mô phỏng ================= */
  const pad2 = n => String(n).padStart(2, '0');
  const hhmm = m => pad2(Math.floor(m / 60) % 24) + ':' + pad2(Math.floor(m) % 60);
  const WXS = ['quang', 'mây', 'mưa', 'dông'];
  const WX_LAB = { quang: 'Quang', 'mây': 'Nhiều mây', 'mưa': 'Mưa', 'dông': 'Dông' };
  const WX_KEY = { quang: 'quang', nang: 'quang', may: 'mây', mua: 'mưa', dong: 'dông', 'nhieu may': 'mây' };
  const parseWx = s => { const n = norm(String(s)); return n === 'auto' ? 'auto' : (WX_KEY[n] || null); };
  function parseTime(s) {
    const m = /^(\d{1,2})\s*(?:[:h]\s*(\d{1,2})?)?$/i.exec(String(s).trim());
    if (!m) return null;
    const h = +m[1], mi = m[2] == null ? 0 : +m[2];
    return h < 24 && mi < 60 ? h * 60 + mi : null;
  }
  const god = { weather: 'auto', time: 'auto', announcement: '', ambient: 'auto', deskNote: '' };
  let godTime = null;
  try {
    const g = JSON.parse(($('god') || {}).textContent || 'null');
    if (g && typeof g === 'object') {
      if (typeof g.weather === 'string' && parseWx(g.weather)) god.weather = parseWx(g.weather);
      if (typeof g.time === 'string' && parseTime(g.time) != null) { godTime = parseTime(g.time); god.time = hhmm(godTime); }
      if (typeof g.announcement === 'string') god.announcement = g.announcement.trim().slice(0, 200);
      if (g.ambient === 'off' || g.ambient === 'busy') god.ambient = g.ambient;
      if (typeof g.deskNote === 'string') god.deskNote = g.deskNote.trim().slice(0, 240);
    }
  } catch (e) { /* invalid JSON: defaults */ }
  let playerTime = null, playerWx = null;
  function clockMs() {
    const q = window.QF_NOW;
    if (q != null) { const v = typeof q === 'number' ? q : Date.parse(q instanceof Date ? q.toISOString() : q); if (isFinite(v)) return v; }
    return Date.now();
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const RAIN_M = [.05, .03, .05, .12, .30, .40, .42, .42, .45, .40, .22, .10];
  const hourMul = h => (h >= 13 && h < 19 ? 2.1 : h >= 19 ? .9 : h < 6 ? .8 : .45);
  function simWeather(base, mo, slot) {
    const pm = RAIN_M[mo];
    let st = mulberry(base)() < .3 + pm * .6 ? 'mây' : 'quang';
    for (let s = 1; s <= slot; s++) {
      const r = mulberry(base * 64 + s), a = r(), b = r(), h = s / 2, pm2 = Math.min(.9, pm * hourMul(h)), aft = h >= 13 && h < 19;
      if (st === 'mưa' || st === 'dông') st = a < .55 ? (b < (aft ? .35 : .12) ? 'dông' : (st === 'dông' && b < .5 ? 'dông' : 'mưa')) : 'mây';
      else if (a < pm2 * .45) st = b < (aft ? .3 : .1) ? 'dông' : 'mưa';
      else st = st === 'quang' ? (b < .15 + pm * .5 ? 'mây' : 'quang') : (b < .4 + pm * .4 ? 'mây' : 'quang');
    }
    return st;
  }
  const periodOf = m => { const h = m / 60; return h < 4.9 || h >= 22 ? 'đêm' : h < 6.8 ? 'bình minh' : h < 11 ? 'sáng' : h < 14 ? 'trưa' : h < 17 ? 'chiều' : h < 18.8 ? 'hoàng hôn' : 'tối'; };
  const phaseOf = m => { const h = m / 60; return h < 4.9 || h >= 19.4 ? 'night' : h < 6.8 ? 'dawn' : h < 16.3 ? 'day' : h < 17.6 ? 'golden' : 'dusk'; };
  function outside() {
    const d = new Date(clockMs() + 7 * 3600e3);
    let minute = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60, tsrc = 'real', wx, wsrc;
    const day = settings.sky === 'day';
    if (day) { minute = 720; tsrc = 'day'; } else if (playerTime != null) { minute = playerTime; tsrc = 'player'; } else if (godTime != null) { minute = godTime; tsrc = 'god'; }
    if (day) { wx = 'quang'; wsrc = 'day'; } else if (playerWx) { wx = playerWx; wsrc = 'player'; } else if (god.weather !== 'auto') { wx = god.weather; wsrc = 'god'; }
    else { wx = simWeather(d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(), d.getUTCMonth(), Math.floor(minute / 30)); wsrc = 'auto'; }
    return { minute, hhmm: hhmm(minute), phase: phaseOf(minute), period: periodOf(minute), weather: wx, tsrc, wsrc };
  }
  /* màu theo giờ: [giờ, trời trên, trời dưới, ánh sáng phòng] (nhân vào kính / nền phòng) */
  const WH = [255, 255, 255], NT = [[22, 30, 66], [40, 50, 92], [120, 130, 185]];
  const SKYK = [[0, ...NT], [4.9, ...NT], [5.8, [150, 140, 190], [255, 190, 150], [245, 215, 205]], [6.8, [225, 232, 250], [255, 235, 215], [255, 250, 245]],
    [8, WH, WH, WH], [15.8, WH, WH, WH], [17, [255, 236, 200], [255, 196, 120], [255, 232, 190]], [17.9, [215, 150, 150], [255, 150, 100], [240, 185, 150]],
    [18.6, [90, 80, 140], [200, 110, 110], [170, 155, 195]], [19.4, ...NT], [24, ...NT]];
  function colorsAt(minute) {
    const h = minute / 60;
    let i = 0; while (i < SKYK.length - 2 && h >= SKYK[i + 1][0]) i++;
    const a = SKYK[i], b = SKYK[i + 1];
    let k = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))); k = k * k * (3 - 2 * k);
    return [1, 2, 3].map(j => a[j].map((v, c) => v + (b[j][c] - v) * k));
  }
  const LV_T = { quang: [0, 0, 0], 'mây': [.7, 0, 0], 'mưa': [1, .6, 0], 'dông': [1, 1, 1] };
  const lv = { cloud: 0, rain: 0, storm: 0 };
  const cur = { top: null, bot: null, room: null };
  let lvAt = performance.now(), worldFirst = true, lastWxKey = '', nextBolt = 0;
  const world = { o: null, night: 0 };

  /* kính cửa sổ (đo trên ảnh phòng, % của khung phòng) */
  const GLASS_L = [[10, 14.8], [15.8, 20.7], [21.7, 27.0], [27.8, 33.0], [34.0, 38.4]].map(([x0, x1]) => {
    const t = x => 25.8 - .6056 * (x - 10), b = x => 57.0 - .6901 * (x - 10);
    return [[x0, t(x0)], [x1, t(x1)], [x1, b(x1)], [x0, b(x0)]];
  });
  const GLASS_B = [[[44.0, 10.3], [58.3, 17.8], [58.3, 31.0], [54.5, 31.0], [54.5, 37.4], [53.7, 37.4], [53.7, 40.4], [44.0, 34.3]]];
  const ROOM_HEX = [[43.4, 2.3], [96.2, 31.0], [96.2, 64.4], [54.2, 95.2], [2.4, 63.8], [2.4, 27.2]];
  const polyStr = pts => pts.map(p => (p[0] / 100).toFixed(4) + ',' + (p[1] / 100).toFixed(4)).join(' ');
  const clipDef = (id, polys) => `<clipPath id="${id}" clipPathUnits="objectBoundingBox">${polys.map(p => `<polygon points="${polyStr(p)}"/>`).join('')}</clipPath>`;
  room.insertAdjacentHTML('beforeend', `<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${clipDef('qf-clip-l', GLASS_L)}${clipDef('qf-clip-b', GLASS_B)}${clipDef('qf-clip-room', [ROOM_HEX])}</defs></svg>`);
  /* mặt nạ bầu trời theo từng điểm ảnh: chỉ phần kính trời, không đè lên thanh đèn / khung */
  { const st = document.createElement('style'), m = `url(${SKYMASK})`;
    st.textContent = `.room .sky,.room .skyfx{-webkit-mask-image:${m};mask-image:${m};-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}`;
    document.head.append(st); }
  const sky = {}, fx = {};
  const wr = mulberry(20261113);
  const inBand = (wall, x, y) => (wall === 'l' ? (y > 21.5 + .45 * (x - 22) && y < 29.5 + .45 * (x - 22) && x > 21 && x < 38.5) : (y > 12.4 + .56 * (x - 44) - .6 && y < 17.1 + .62 * (x - 44) + .9));
  for (const [w, box, nStars, nCity, cy] of [['l', [10, 38.4, 9, 36], 26, 34, [38, 55]], ['b', [44.2, 58.2, 11, 27], 12, 6, [27, 37]]]) {
    const s = el('div', 'sky ' + w); s.id = 'sky-' + (w === 'l' ? 'left' : 'back'); room.append(s); sky[w] = s;
    const f = el('div', 'skyfx ' + w); f.id = 'skyfx-' + (w === 'l' ? 'left' : 'back');
    const stars = el('div', 'stars'), city = el('div', 'city'), clouds = el('div', 'clouds');
    const put = (parent, n, x0, x1, y0, y1, init) => {
      for (let i = 0; i < n; i++) { const x = x0 + wr() * (x1 - x0), y = y0 + wr() * (y1 - y0), d = el('i'); if (inBand(w, x, y)) continue; d.style.left = x + '%'; d.style.top = y + '%'; if (init) init(d); parent.append(d); }
    };
    put(stars, nStars, box[0], box[1], box[2], box[2] + (box[3] - box[2]) * .7, d => { d.style.animationDelay = (-wr() * 3).toFixed(2) + 's'; d.style.animationDuration = (2 + wr() * 3).toFixed(1) + 's'; });
    put(city, nCity, box[0], box[1], cy[0], cy[1]);
    for (let i = 0; i < 4; i++) { const c = el('i'); c.style.left = (box[0] - 4 + wr() * (box[1] - box[0])) + '%'; c.style.top = (box[2] - 2 + wr() * (box[3] - box[2] - 8)) + '%'; c.style.setProperty('--cd', (45 + wr() * 50).toFixed(0) + 's'); c.style.animationDelay = (-wr() * 40).toFixed(0) + 's'; clouds.append(c); }
    f.append(stars, city, clouds, el('div', 'rain'), el('div', 'rain r2'), el('div', 'flash'));
    room.append(f); fx[w] = f;
  }
  const light = el('div', 'roomlight'); light.id = 'roomlight'; room.append(light);
  const WXI = {
    sun: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.2" fill="#ffc56b"/><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="#ffc56b" stroke-width="1.4"/></svg>',
    moon: '<svg viewBox="0 0 16 16"><path d="M11.5 2.5a6 6 0 1 0 2 9.5A5 5 0 0 1 11.5 2.5z" fill="#c9d3f5"/></svg>',
    cloud: '<svg viewBox="0 0 16 16"><path d="M4.5 12.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.6 1 2.500 2.500 0 0 1-.3 5z" fill="#c9d3f5"/></svg>',
    rain: '<svg viewBox="0 0 16 16"><path d="M4.5 10a3 3 0 0 1-.3-5.8 4 4 0 0 1 7.6 1 2.400 2.400 0 0 1-.3 4.8z" fill="#9fb2e8"/><path d="M5 12l-1 2.5M8.5 12l-1 2.5M12 12l-1 2.5" stroke="#7fd1e8" stroke-width="1.4"/></svg>',
    bolt: '<svg viewBox="0 0 16 16"><path d="M4.5 9.5a3 3 0 0 1-.3-5.8 4 4 0 0 1 7.6 1 2.400 2.400 0 0 1-.3 4.8z" fill="#8a96c8"/><path d="M8.8 8.5L6.5 12h2l-1 3.5L11 11H9l1.2-2.5z" fill="#ffc56b"/></svg>',
  };
  const rgbs = c => 'rgb(' + c.map(Math.round).join(',') + ')';
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function worldTick() {
    const o = outside(), now = performance.now(), dt = now - lvAt; lvAt = now;
    const snapNow = instant() || worldFirst, step = dt / 20000, tg = LV_T[o.weather];
    ['cloud', 'rain', 'storm'].forEach((k, i) => { lv[k] = snapNow ? tg[i] : lv[k] + Math.max(-step, Math.min(step, tg[i] - lv[k])); });
    let [top, bot, rm] = colorsAt(o.minute);
    const night = clamp01((200 - (top[0] + top[1] + top[2]) / 3) / 160);
    const c = lv.cloud * .5 + lv.rain * .5 + lv.storm * .6, wm = [1 - .12 * c, 1 - .1 * c, 1 - .05 * c], wl = [1 - .08 * c, 1 - .07 * c, 1 - .03 * c];
    top = top.map((v, i) => v * wm[i]); bot = bot.map((v, i) => v * wm[i]); rm = rm.map((v, i) => v * wl[i]);
    const a = snapNow ? 1 : .3, ease = (cu, t) => (cu ? cu.map((v, i) => (Math.abs(t[i] - v) < .6 ? t[i] : v + (t[i] - v) * a)) : t);
    cur.top = ease(cur.top, top); cur.bot = ease(cur.bot, bot); cur.room = ease(cur.room, rm);
    const clear = arr => arr.every(v => v >= 252);
    const g = `linear-gradient(to bottom,${rgbs(cur.top)} 8%,${rgbs(cur.bot)} 50%)`;
    for (const w of ['l', 'b']) { sky[w].style.background = g; sky[w].style.opacity = clear(cur.top) && clear(cur.bot) ? '0' : '1'; }
    light.style.background = rgbs(cur.room); light.style.opacity = clear(cur.room) ? '0' : '1';
    const cl = [250, 252, 255].map((v, i) => (v + ([140, 150, 168][i] - v) * clamp01(lv.rain + lv.storm * .5)) * (1 - .75 * night));
    const st = room.style;
    st.setProperty('--stars', clamp01((night - .35) / .45).toFixed(3)); st.setProperty('--lights', clamp01(night * 1.4).toFixed(3));
    st.setProperty('--cloud', lv.cloud.toFixed(3)); st.setProperty('--rain', lv.rain.toFixed(3)); st.setProperty('--storm', lv.storm.toFixed(3));
    st.setProperty('--cloudlight', (1 - .8 * night).toFixed(3)); st.setProperty('--clrgb', cl.map(Math.round).join(','));
    room.dataset.phase = o.phase; room.dataset.wx = o.weather; room.dataset.night = night.toFixed(2); room.dataset.time = o.hhmm;
    for (const w of ['l', 'b']) { sky[w].dataset.phase = o.phase; fx[w].dataset.wx = o.weather; }
    worldFirst = false; world.o = o; world.night = night;
    const key = o.hhmm + o.weather + o.period + o.wsrc;
    if (key !== lastWxKey) {
      lastWxKey = key;
      $('wx-time').textContent = o.hhmm;
      $('wx-lab').textContent = o.period + ' · ' + WX_LAB[o.weather] + (o.wsrc === 'day' ? ' (cố định)' : '');
      $('wx-icon').innerHTML = WXI[o.weather === 'quang' ? (o.phase === 'night' ? 'moon' : 'sun') : o.weather === 'mây' ? 'cloud' : o.weather === 'mưa' ? 'rain' : 'bolt'];
    }
    if (lv.storm > .5 && !reduce.matches && settings.motion && (window.QF_FAST !== true || window.QF_AMBIENT === true)) {
      if (!nextBolt) nextBolt = now + 4000 + Math.random() * 6000;
      else if (now >= nextBolt) {
        nextBolt = now + 5000 + Math.random() * 9000;
        for (const w of ['l', 'b']) { fx[w].classList.remove('bolt'); void fx[w].offsetWidth; fx[w].classList.add('bolt'); }
        light.classList.remove('bolt'); void light.offsetWidth; light.classList.add('bolt');
      }
    } else nextBolt = 0;
  }
  const rainy = () => !!world.o && (world.o.weather === 'mưa' || world.o.weather === 'dông');
  function setTime(v) {
    if (typeof v === 'number' && v >= 0 && v < 1440) { playerTime = Math.floor(v); worldTick(); return true; }
    const s = String(v).trim().toLowerCase();
    if (s === 'auto') { playerTime = null; worldTick(); return true; }
    const m = parseTime(s); if (m == null) return false;
    playerTime = m; worldTick(); return true;
  }
  function setWeather(v) {
    const w = parseWx(v); if (!w) return false;
    playerWx = w === 'auto' ? null : w; worldTick(); return true;
  }
  function getOutside() {
    const o = outside();
    return { time: o.hhmm, minutes: Math.floor(o.minute), timezone: 'UTC+7', phase: o.phase, period: o.period, weather: o.weather, timeSource: o.tsrc, weatherSource: o.wsrc, sky: settings.sky,
      overrides: { time: playerTime == null ? null : hhmm(playerTime), weather: playerWx }, levels: { night: +world.night.toFixed(2), cloud: +lv.cloud.toFixed(2), rain: +lv.rain.toFixed(2), storm: +lv.storm.toFixed(2) }, god: { ...god } };
  }
  window.QuantFun = Object.freeze({ setWeather, setTime, getOutside });
  worldTick(); setInterval(worldTick, 500);
  if (god.deskNote) { $('desknote').textContent = god.deskNote; $('desknote').hidden = false; }
  let bannerTimer = 0;
  function showBanner(text) { const b = $('banner'); b.textContent = text; b.hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, 6000); }
  const busyK = () => (god.ambient === 'busy' ? 2 : 1);

  /* ================= motion ================= */
  let seq = 0, playing = false, phase = 'idle'; // phase: idle | cross | risk
  const sleep = (ms, tok) => new Promise((res, rej) => {
    const go = () => (tok === seq ? res() : rej(CANCEL));
    if (!ms || instant()) go(); else setTimeout(go, ms / speed());
  });
  function walk(a, pts, ctl, mul = 1) {
    const alive = typeof ctl === 'function' ? ctl : () => ctl === seq;
    return new Promise((res, rej) => {
      if (!pts.length) { res(); return; }
      if (instant()) { const p = pts[pts.length - 1]; setPos(a, p[0], p[1]); res(); return; }
      let i = 0, from = [a.x, a.y];
      a.el.classList.add('walking'); const wt0 = performance.now();
      if (motionOk() && animReady(a)) { a.walkAct = true; a.el.classList.add('acting'); }
      const seg = () => {
        if (i >= pts.length) { a.el.classList.remove('walking'); endWalkAct(a); res(); return; }
        const to = pts[i], f = from;
        const dx = (to[0] - f[0]) * W / 100, dy = (to[1] - f[1]) * H / 100;
        setFace(a, dirFace(dx, dy));
        const dur = Math.hypot(to[0] - f[0], (to[1] - f[1]) * RATIO) / (22 * speed() * mul) * 1000;
        let t0 = null;
        const frame = t => { try {
          if (!alive()) { a.el.classList.remove('walking'); endWalkAct(a); rej(CANCEL); return; }
          if (t0 === null) t0 = t;
          const k = dur <= 0 ? 1 : Math.min(1, (t - t0) / dur);
          setPos(a, f[0] + (to[0] - f[0]) * k, f[1] + (to[1] - f[1]) * k);
          if (a.walkAct) { a.cur = { action: 'walk', i: Math.floor((performance.now() - wt0) / 1000 * 7.5 * speed()) % 4 }; paintAct(a); }
          if (k < 1) requestAnimationFrame(frame); else { from = to; i++; seg(); }
        } catch (err) { a.el.classList.remove('walking'); endWalkAct(a); rej(err); } };
        requestAnimationFrame(frame);
      };
      seg();
    });
  }
  function settle(s) {
    resetAmbient();
    for (const r of ROLES) { actors[r].el.classList.remove('walking', 'nod'); endWalkAct(actors[r]); clearPose(actors[r]); setPos(actors[r], ...HOME[r]); setFace(actors[r], TALK[r]); setStatus(actors[r], IDLE[r]); }
    actors.trader.tagbox.style.removeProperty('--tx');
    if (s.armed) { setFace(actors.quant, WORK.quant); setStatus(actors.quant, 'theo dõi SMA 10/30', 'busy'); }
    const t = actors.trader;
    if (s.proposal) { setPos(t, ...STOP); t.tagbox.style.setProperty('--tx', '34%'); setStatus(t, 'chờ Boss quyết', 'busy'); setStatus(actors.risk, 'Pass', 'pass'); }
    else if (s.pending) { setFace(t, WORK.trader); setStatus(t, 'chờ khớp ở nến kế', 'busy'); }
    else if (s.blocked) setStatus(actors.risk, 'Block', 'block');
  }
  const backFromBoss = tok => { actors.trader.tagbox.style.removeProperty('--tx'); return walk(actors.trader, [WP1, HOME.trader], tok); };
  const goStop = tok => walk(actors.trader, [WP1, STOP], tok);


  /* ================= ambient world: routines, desk poses ================= */
  const NODES = {
    Hb: HOME.boss, Hp: HOME.portfolio, Hq: HOME.quant, Ht: HOME.trader, Hr: HOME.risk, STOP, WP1,
    BW: [26.5, 72.5], WLa: [22.5, 64], WIN: [21, 55], VB: [29.5, 68.5],
    P1: [36.5, 69], VP: [42.5, 67], C1: [44, 60], C2: [49, 60], C3: [47, 71], C4: [69.5, 57.5], C5: [70.5, 66], C7: [58, 83.5],
    Q1: [47.4, 54.5], VQ: [52.5, 53.5], VT: [49, 76.5], VR: [68.5, 75],
    WC: [54.5, 50.5], WB: [72.5, 58.5], CO: [77.0, 61.0], SN: [83.4, 64.3], PR: [87.4, 64.6],
  };
  const EDGES = [['Hb', 'WLa'], ['WLa', 'WIN'], ['WLa', 'BW'], ['BW', 'VB'], ['VB', 'STOP'], ['BW', 'WP1'], ['STOP', 'WP1'], ['WP1', 'P1'], ['Hp', 'P1'], ['P1', 'VP'],
    ['VP', 'C3'], ['VP', 'C1'], ['C1', 'Q1'], ['Hq', 'Q1'], ['Q1', 'VQ'], ['Q1', 'C2'], ['VQ', 'WC'], ['VQ', 'C4'], ['C1', 'C2'], ['C2', 'C4'], ['C2', 'C3'],
    ['C3', 'VT'], ['VT', 'Ht'], ['C3', 'C7'], ['C4', 'C5'], ['C5', 'CO'], ['CO', 'SN'], ['SN', 'PR'], ['C5', 'WB'], ['WB', 'WC'], ['C5', 'VR'], ['VR', 'Hr'], ['VR', 'C7']];
  const ADJ = {}; for (const [p, q] of EDGES) { (ADJ[p] = ADJ[p] || []).push(q); (ADJ[q] = ADJ[q] || []).push(p); }
  const HOMEN = { boss: 'Hb', quant: 'Hq', trader: 'Ht', risk: 'Hr', portfolio: 'Hp' };
  const CHATSPOT = { boss: 'VB', quant: 'VQ', trader: 'VT', risk: 'VR', portfolio: 'VP' };
  function bfs(from, to) {
    if (from === to) return [from];
    const prev = { [from]: null }, q = [from];
    while (q.length) { const n = q.shift(); for (const m of ADJ[n] || []) if (!(m in prev)) { prev[m] = n; if (m === to) { const path = [m]; let k = n; while (k) { path.unshift(k); k = prev[k]; } return path; } q.push(m); } }
    return [from, to];
  }
  const nearestNode = (x, y) => Object.keys(NODES).reduce((b, k) => (Math.hypot(NODES[k][0] - x, NODES[k][1] - y) < Math.hypot(NODES[b][0] - x, NODES[b][1] - y) ? k : b), 'C1');
  const ICONS = {
    cup: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h9v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#eef1fb"/><path d="M12 5h1.5a1.5 1.5 0 0 1 0 4H12" fill="none" stroke="#eef1fb" stroke-width="1.5"/><rect x="3" y="4" width="9" height="2" fill="#7fd1e8"/></svg>',
    marker: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14l1-4 8-8 3 3-8 8z" fill="#ffc56b"/><path d="M2 14l1-4 3 3z" fill="#eef1fb"/></svg>',
  };
  /* mỗi điểm: node = chỗ đứng trên sàn ngay trước vật; look = tâm vật (% phòng); obj = chân vật trên sàn */
  const POIS = [
    { id: 'cooler', node: 'WC', look: [56, 36], obj: [56.5, 45], walk: 'đi lấy nước', phases: [{ status: 'lấy nước', pose: 'water', icon: 'cup' }] },
    { id: 'board', node: 'WB', look: [80.3, 33.8], obj: [80, 56], walk: 'đi ghi chú bảng', phases: [{ status: 'ghi chú', pose: 'notes', icon: 'marker' }] },
    { id: 'printer', node: 'PR', look: [87.6, 52.3], obj: [87.6, 54.5], walk: 'đi lấy bản in', phases: [{ status: 'chờ bản in', prop: 'printer-idle', on: true, ms: 2000 }, { status: 'lấy bản in', prop: 'printer-idle', on: false, pose: 'notes', keep: true, ms: 2000 }] },
    { id: 'coffee', node: 'CO', look: [78.8, 46.6], obj: [78.8, 49.2], walk: 'đi pha cà phê', phases: [{ status: 'pha cà phê', prop: 'espresso-idle', on: true, ms: 2500 }, { status: 'uống cà phê', prop: 'espresso-idle', on: false, pose: 'coffee', ms: [3000, 5000] }] },
    { id: 'window', node: 'WIN', look: [18.2, 36], obj: [18.2, 51.3], walk: 'đi ngắm phố', phases: [{ status: 'nhìn phố', pose: 'phone' }] },
  ];
  const DOOR = [69.5, 46];
  const lookFace = (a, look) => setFace(a, dirFace((look[0] - a.x) * W / 100, (look[1] - a.y) * H / 100));
  const FLICK = Object.fromEntries(Object.entries(STATIONS).map(([r, v]) => [r, [v.look[0] - 3.6, v.look[1] - 3, 7.2, 5.6]]));
  const flick = {};
  for (const r of ROLES) { const f = el('div', 'flick'); f.style.cssText = `left:${FLICK[r][0]}%;top:${FLICK[r][1]}%;width:${FLICK[r][2]}%;height:${FLICK[r][3]}%`; room.append(f); flick[r] = f; }
  const takenSpots = new Set();
  const rand = (a, b) => a + Math.random() * (b - a);
  const nowMs = () => performance.now();
  const atHome = a => Math.hypot(a.x - HOME[a.role][0], a.y - HOME[a.role][1]) < 0.3;
  const awayCount = () => ROLES.filter(r => actors[r].away).length;
  const WORKST = { boss: 'xem màn hình', quant: 'gõ phím', trader: 'gõ phím', risk: 'xem màn hình', portfolio: 'gõ phím' };
  function ambientOn() { return !$('game').hidden && !reduce.matches && settings.motion && (window.QF_FAST !== true || window.QF_AMBIENT === true); }
  function clearFx(a) { if (a.role !== 'trader') { if (TAG_SHIFT[a.role]) a.tagbox.style.setProperty('--tx', TAG_SHIFT[a.role]); else a.tagbox.style.removeProperty('--tx'); } else if (!snap.proposal) a.tagbox.style.removeProperty('--tx'); a.el.classList.remove('typing'); clearPose(a); flick[a.role].classList.remove('on'); a.icon.classList.remove('on'); a.mini.classList.remove('on'); }
  function deskPose(a) {
    const r = a.role;
    clearFx(a);
    if (a.working) {
      setFace(a, WORK[r]); setStatus(a, r === 'quant' && snap.armed ? 'theo dõi SMA 10/30' : WORKST[r], 'busy');
      a.el.classList.add('typing'); flick[r].classList.add('on'); setPose(a, 'type-standing', 3);
    } else if (a.variant && animReady(a)) {
      const [act, st] = poseFor(a, 'phone'); setFace(a, TALK[r]);
      if (setPose(a, act)) setStatus(a, st, 'busy'); else { a.variant = false; setStatus(a, 'nhìn quanh'); }
    } else { setFace(a, TALK[r]); setStatus(a, 'nhìn quanh'); }
  }
  function deskGate(a) {
    if (playing) return false;
    if (a.role === 'trader') return !snap.proposal && !snap.pending;
    if (a.role === 'risk') return !snap.proposal && !snap.blocked;
    if (a.role === 'boss') return !snap.proposal;
    return true;
  }
  function resetAmbient() {
    const t = nowMs();
    for (const r of ROLES) {
      const a = actors[r]; a.rtok++; a.inRoutine = false; a.away = false; a.free = true; a.chatWith = null; a.reservedBy = null; a.healing = false; a.working = false; a.variant = false;
      clearFx(a); a.nextAt = t + rand(3000, 9000) / speed(); a.cycleAt = t + rand(2000, 5000) / speed();
    }
    takenSpots.clear(); pantryState('espresso-idle', false); pantryState('printer-idle', false);
  }
  const asleep = (ms, alive) => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(CANCEL)), ms / speed()));
  async function routeTo(a, target, alive, mul = 1, from) {
    const start = from || nearestNode(a.x, a.y);
    const pts = bfs(start, target).map(n => NODES[n]).filter((p, i) => !(i === 0 && Math.hypot(p[0] - a.x, p[1] - a.y) < 0.3));
    await walk(a, pts, alive, mul);
  }
  function makeOpt(a, id) {
    if (id.startsWith('chat:')) {
      const g = actors[id.slice(5)];
      if (!g || g === a || !g.free || g.chatWith || g.reservedBy || g.inRoutine || g.variant || g.el.classList.contains('walking') || (g.pose && g.pose !== 'type-standing') || !atHome(g) || !deskGate(g) || takenSpots.has(CHATSPOT[g.role])) return null;
      return { kind: 'chat', guest: g, node: CHATSPOT[g.role], walk: 'sang chỗ ' + nameOf(g.role) };
    }
    const p = POIS.find(x => x.id === id);
    if (!p || takenSpots.has(p.node)) return null;
    const o = { kind: 'poi', ...p };
    if (p.id === 'window' && rainy()) { o.walk = 'đi ngắm mưa'; o.phases = [{ status: 'nhìn mưa' }]; }
    if (p.id === 'snack' && !(routineN - lastSnack >= 6)) return null;
    return o;
  }
  let routineN = 0, lastSnack = -9;
  function pickOpt(a) {
    const ids = [...POIS.map(p => p.id), ...ROLES.filter(r => r !== a.role).map(r => 'chat:' + r)];
    const opts = ids.map(id => makeOpt(a, id)).filter(Boolean);
    if (!opts.length) return null;
    const wts = opts.map(o => (o.id === 'window' && world.night > .5 ? .5 : o.kind === 'chat' ? (Math.hypot(o.guest.x - a.x, o.guest.y - a.y) < 25 ? 2.5 : 1) : 1)), tot = wts.reduce((x, y) => x + y, 0);
    let r = Math.random() * tot;
    for (let i = 0; i < opts.length; i++) { r -= wts[i]; if (r <= 0) return opts[i]; }
    return opts[opts.length - 1];
  }
  function releaseGuest(g, a) {
    if (!g || (a && g.reservedBy !== a && g.chatWith !== a)) return;
    const was = g.chatWith; g.reservedBy = null; g.chatWith = null; g.mini.classList.remove('on');
    g.nextAt = Math.max(g.nextAt, nowMs() + 6000);
    if (was && g.free && !g.inRoutine && atHome(g)) { g.working = false; deskPose(g); }
  }
  const waitChat = (ms, ok) => new Promise(res => { const t0 = nowMs(), iv = setInterval(() => { if (!ok()) { clearInterval(iv); res(false); } else if (nowMs() - t0 >= ms / speed()) { clearInterval(iv); res(true); } }, 80); });
  const asleepRaw = (ms, alive) => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(CANCEL)), ms));
  async function runPhases(a, opt, alive) {
    for (const ph of opt.phases) {
      lookFace(a, opt.look); setStatus(a, ph.status, 'busy');
      if (ph.prop) pantryState(ph.prop, ph.on);
      let posed = false;
      if (ph.pose) { const [act, st] = poseFor(a, ph.pose); posed = setPose(a, act); if (posed && st && !ph.keep) setStatus(a, st, 'busy'); }
      if (!posed && ph.icon) { a.icon.innerHTML = ICONS[ph.icon]; a.icon.classList.add('on'); }
      await asleep(Array.isArray(ph.ms) ? rand(ph.ms[0], ph.ms[1]) : ph.ms != null ? ph.ms : posed ? rand(2500, 5000) : rand(3000, 6000), alive);
      a.icon.classList.remove('on'); clearPose(a);
    }
  }
  async function routine(a, opt) {
    a.inRoutine = true; a.away = true; a.variant = false; const rt = ++a.rtok; const g = opt.guest || null;
    routineN++; if (opt.id === 'snack') lastSnack = routineN;
    const alive = () => a.rtok === rt && ambientOn();
    const chatAlive = () => alive() && g.reservedBy === a && g.free;
    takenSpots.add(opt.node);
    if (g) g.reservedBy = a;                       // đặt chỗ B ngay lúc chọn
    try {
      clearFx(a); setStatus(a, opt.walk, 'busy');
      if (g) {
        let cancelled = false;
        try { await routeTo(a, opt.node, chatAlive, 1, HOMEN[a.role]); } catch (e) { if (e === CANCEL && alive()) cancelled = true; else throw e; }
        if (!cancelled && !alive()) throw CANCEL;
        if (!cancelled && !chatAlive()) cancelled = true;
        if (!cancelled) {
          g.chatWith = a; clearFx(g);
          const gp = [g.x, g.y], sp = [a.x, a.y];
          setFace(a, dirFace((gp[0] - sp[0]) * W / 100, (gp[1] - sp[1]) * H / 100));
          setFace(g, dirFace((sp[0] - gp[0]) * W / 100, (sp[1] - gp[1]) * H / 100));
          setStatus(a, 'trao đổi với ' + nameOf(g.role), 'busy'); setStatus(g, 'trao đổi với ' + nameOf(a.role), 'busy');
          a.mini.classList.add('on'); g.mini.classList.add('on');
          const sgn = sp[0] >= gp[0] ? 1 : -1; a.tagbox.style.setProperty('--tx', (sgn * 38) + '%'); g.tagbox.style.setProperty('--tx', (-sgn * 38) + '%');
          const ok = await waitChat(rand(3000, 6000), () => chatAlive() && g.chatWith === a);
          a.mini.classList.remove('on'); g.mini.classList.remove('on');
          if (!alive()) throw CANCEL;
          if (!ok) cancelled = true;
        }
        releaseGuest(g, a);
        if (cancelled) { clearFx(a); setStatus(a, 'thôi để sau'); await asleepRaw(1000, alive); }
      } else {
        await routeTo(a, opt.node, alive, 1, HOMEN[a.role]);
        await runPhases(a, opt, alive);
      }
      setStatus(a, 'quay về bàn');
      await routeTo(a, HOMEN[a.role], alive);
    } catch (e) { if (e !== CANCEL) console.warn('routine', e); }
    finally {
      takenSpots.delete(opt.node); if (opt.id === 'coffee') pantryState('espresso-idle', false); else if (opt.id === 'printer') pantryState('printer-idle', false);
      if (g) releaseGuest(g, a);
      if (a.rtok === rt) {
        a.inRoutine = false; a.away = false; setPos(a, ...HOME[a.role]); a.working = false; clearFx(a); deskPose(a);
        a.nextAt = Math.max(nowMs() + rand(8000, 20000) / speed() / busyK(), g ? nowMs() + 6000 : 0); a.cycleAt = nowMs() + rand(3000, 6000) / speed();
      }
    }
  }
  /* tự chữa: đang "quay về bàn"/"đi …" mà đứng yên quá 2 giây */
  async function recover(a) {
    const second = a.healing; a.healing = true;
    a.rtok++; const my = a.rtok;
    for (const o of ROLES) if (actors[o].reservedBy === a || actors[o].chatWith === a) releaseGuest(actors[o], a);
    a.el.classList.remove('walking'); endWalkAct(a); clearPose(a); a.icon.classList.remove('on'); a.mini.classList.remove('on');
    if (!second) { for (const o of POIS) takenSpots.delete(o.node); pantryState('espresso-idle', false); pantryState('printer-idle', false); }
    a.inRoutine = true; a.away = true; setStatus(a, 'quay về bàn', 'busy');
    if (!second) { try { await routeTo(a, HOMEN[a.role], () => a.rtok === my && ambientOn()); } catch (e) { if (e !== CANCEL) { /* hỏng đường đi: dịch tức thời */ } } }
    if (a.rtok === my) {
      a.healing = false; a.inRoutine = false; a.away = false; setPos(a, ...HOME[a.role]); a.working = false; clearFx(a); deskPose(a);
      a.nextAt = nowMs() + rand(8000, 20000) / speed(); a.cycleAt = nowMs() + rand(3000, 6000) / speed();
    }
  }
  function watchdog() {
    if (document.hidden || !ambientOn()) return;
    const t = nowMs();
    for (const r of ROLES) {
      const a = actors[r];
      const moved = !a.wd || Math.hypot(a.x - a.wd.x, a.y - a.wd.y) > .05;
      if (moved) a.wd = { x: a.x, y: a.y, t };
      if (a.free && a.inRoutine && /^(đi |quay về bàn|sang chỗ)/.test(a.status || '') && t - a.wd.t > 2000) { a.wd = null; recover(a); }
    }
  }
  setInterval(watchdog, 500);
  function ambientTick() {
    if (!ambientOn()) { if (ambientTick.was) { ambientTick.was = false; if (!playing) settle(snap); else resetAmbient(); } return; }
    ambientTick.was = true;
    const t = nowMs();
    for (const r of ROLES.slice().sort(() => Math.random() - .5)) {
      const a = actors[r];
      if (!a.free || a.chatWith || a.inRoutine || playing || !atHome(a)) continue;
      if (!a.reservedBy && god.ambient !== 'off' && t >= a.nextAt && deskGate(a) && awayCount() < 2) {
        const opt = pickOpt(a);
        if (opt) { routine(a, opt); continue; }
        a.nextAt = t + 2000;
      }
      if (deskGate(a) && t >= a.cycleAt) {
        if (a.variant) { a.variant = false; a.working = true; }
        else { a.working = !a.working; if (!a.working && animReady(a) && !a.reservedBy && Math.random() < .35) a.variant = true; }
        deskPose(a); a.cycleAt = t + (a.variant ? rand(3000, 5000) : rand(4000, 8000)) / speed();
      }
    }
  }
  setInterval(ambientTick, 250);
  /* game events win: pull the roles they need back to their desks */
  function rolesFor(ents) {
    const set = new Set();
    for (const e of ents) {
      if (e.kind === 'cross') ['quant', 'trader', 'risk', 'boss'].forEach(r => set.add(r));
      else if (e.kind === 'approve' || e.kind === 'skip') { set.add('boss'); set.add('trader'); }
      else set.add(e.role);
      if (e.kind === 'fill' || e.kind === 'nofill') set.add('portfolio');
    }
    return [...set];
  }
  async function claimRoles(roles) {
    const jobs = [], all = [];
    for (const r of roles) {
      const a = actors[r]; a.free = false; const was = a.inRoutine || !atHome(a);
      a.rtok++; a.inRoutine = false; a.away = false; a.chatWith = null; a.reservedBy = null; a.variant = false; clearFx(a);
      for (const o of ROLES) if (actors[o].reservedBy === a || actors[o].chatWith === a) releaseGuest(actors[o], a);
      if (was) {
        const my = a.rtok; all.push(a);
        jobs.push(routeTo(a, HOMEN[r], () => a.rtok === my, 1.6).catch(e => { if (e !== CANCEL) throw e; }));
      }
    }
    if (!jobs.length) return;
    await Promise.race([Promise.all(jobs), new Promise(res => setTimeout(res, 1500))]);
    for (const a of all) { a.rtok++; a.el.classList.remove('walking'); endWalkAct(a); clearPose(a); setPos(a, ...HOME[a.role]); setFace(a, TALK[a.role]); }
  }
  window.__qf = { work(r) { const a = actors[r]; a.working = true; deskPose(a); }, stations: STATIONS, stop: STOP, state: r => { const a = actors[r]; return { reservedBy: a.reservedBy ? a.reservedBy.role : null, chatWith: a.chatWith ? a.chatWith.role : null, inRoutine: a.inRoutine, free: a.free }; }, nodes: NODES, edges: EDGES, pois: POIS.map(p => ({ id: p.id, node: p.node, spot: NODES[p.node], look: p.look, obj: p.obj })), door: DOOR, force(role, id) { const a = actors[role]; if (!a || !a.free || a.inRoutine || a.reservedBy) return false; const o = makeOpt(a, id); if (!o) return false; routine(a, o); return true; } };

  /* ================= chat model ================= */
  let msgs = [], nextId = 1, lastCount = 0, forceBottom = false;
  const curTime = () => utc(BARS[desk.index].timestamp);
  function post(role, text, extra = {}) {
    const bi = extra.bi != null ? extra.bi : desk.index;
    const m = { id: nextId++, role, text, bi, t: utc(BARS[bi].timestamp), ...extra };
    if (role === 'boss') forceBottom = true;
    msgs.push(m); renderChat(); return m;
  }
  const sys = (text, err) => post('system', text, { err: !!err });
  function avatar(role) { const d = el('div', 'av'), i = el('img'); i.alt = ''; i.src = sprite(role); d.append(i); return d; }
  function badge(kind) {
    const b = el('span', 'badge ' + kind);
    b.innerHTML = kind === 'block' ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>BLOCK'
      : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 7.5l4 4 7-9" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>PASS';
    return b;
  }
  function cardEl(m) {
    const c = m.card; if (!c) return null;
    const box = el('div', 'mcard ' + c.type + (c.verdict ? ' ' + c.verdict : ''));
    if (c.type === 'cross') {
      box.append(el('div', 'mono', `SMA 10 ${num2(c.fast)} · SMA 30 ${num2(c.slow)} · Close ${num2(c.close)}`));
    } else if (c.type === 'proposal') {
      box.append(el('div', 'ttl', (c.side === 'buy' ? 'Mua' : 'Đóng vị thế') + ' BTC'));
      box.append(el('div', '', 'Giá tham chiếu ' + money(c.mark)));
      box.append(el('div', '', c.side === 'buy' ? 'Phân bổ ' + c.allocation + '% NAV' : 'Bán hết ' + c.qty.toFixed(3) + ' BTC'));
      box.append(el('div', 'k', 'Khớp dự kiến: giá mở nến kế + 5 bps'));
    } else if (c.type === 'decision') {
      box.append(badge(c.verdict));
      const buy = c.side === 'buy';
      box.append(el('div', '', c.verdict === 'block' ? `Tỷ trọng ${c.allocation}% > hạn mức 25% NAV. Giảm phân bổ rồi chờ tín hiệu kế.`
        : buy ? `Tỷ trọng ${c.allocation}% ≤ hạn mức 25% NAV.` : 'Đóng vị thế không làm tăng rủi ro.'));
      if (c.verdict === 'block') box.append(el('div', 'k', 'Không duyệt được. Gõ /alloc 25 rồi chờ tín hiệu kế.'));
      else if (c.state === 'open') {
        const acts = el('div', 'acts');
        const a = el('button', 'btn primary', 'Approve'); a.type = 'button'; a.dataset.cmd = '/approve';
        const s = el('button', 'btn', 'Skip'); s.type = 'button'; s.dataset.cmd = '/skip';
        acts.append(a, s); box.append(acts);
      } else box.append(el('div', 'done', c.state === 'approved' ? 'Đã duyệt' : c.state === 'skipped' ? 'Đã bỏ qua' : 'Đã đóng'));
    } else if (c.type === 'book') {
      const kv = el('div', 'kv');
      for (const [k, v, cls] of [['NAV', c.nav], ['PnL', c.pnl, c.pnlCls], ['Cash', c.cash, 'book-cash'], ['Exposure', c.exposure]]) {
        const d = el('div'); d.append(el('span', 'k', k), el('b', 'num ' + (cls || ''), v)); kv.append(d);
      }
      box.append(kv);
      if (c.pos) box.append(el('div', 'k', c.pos));
      if (c.fills && c.fills.length) {
        const t = el('table'); t.innerHTML = '<thead><tr><th>UTC</th><th>Side</th><th class="r">BTC</th><th class="r">Giá khớp</th><th class="r">Giá trị</th></tr></thead>';
        const tb = el('tbody');
        for (const f of c.fills) {
          const tr = el('tr', 'row-fill'), buy = f.side === 'buy';
          const sd = el('td', buy ? 'up-c' : 'down-c'); sd.append(el('i', 'tri ' + (buy ? 'up' : 'down')), document.createTextNode(buy ? 'Mua' : 'Bán'));
          tr.append(el('td', 'num', utc(f.timestamp)), sd, el('td', 'num r', f.quantity.toFixed(3)), el('td', 'num r', money(f.price)), el('td', 'num r', money(f.quantity * f.price)));
          tb.append(tr);
        }
        t.append(tb); box.append(t);
      } else if (c.fills) box.append(el('div', 'k', 'Chưa có lệnh.'));
    } else if (c.type === 'result') {
      box.append(el('div', 'ttl', 'Kết phiên'));
      const kv = el('div', 'kv');
      for (const [k, v] of [['NAV cuối', c.nav], ['PnL', c.pnl], ['Số lệnh khớp', String(c.fills)], ['Mục tiêu', c.ok ? 'Đạt mục tiêu' : 'Chưa đạt mục tiêu']]) {
        const d = el('div'); d.append(el('span', 'k', k), el('b', 'num', v)); kv.append(d);
      }
      box.append(kv);
    } else if (c.type === 'confirm') {
      box.append(el('div', '', 'Chơi lại từ đầu? Phiên hiện tại sẽ bị xóa. Cài đặt vẫn giữ.'));
      if (c.state === 'open') {
        const acts = el('div', 'acts');
        const a = el('button', 'btn primary', 'Chơi lại'); a.type = 'button'; a.dataset.cmd = '/reset now';
        const b = el('button', 'btn', 'Hủy'); b.type = 'button'; b.dataset.cancel = String(m.id);
        acts.append(a, b); box.append(acts);
      } else box.append(el('div', 'done', 'Đã hủy'));
    } else if (c.type === 'help') {
      box.append(helpTable(true));
    }
    return box;
  }
  function renderChat() {
    const box = $('messages');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 48, saved = box.scrollTop;
    const frag = document.createDocumentFragment();
    let prev = null;
    for (const m of msgs) {
      if (m.role === 'system') {
        const d = el('div', 'sys' + (m.err ? ' err' : '') + (m.muted ? ' muted' : '') + (m.ph ? ' ph' : '')); d.dataset.id = m.id;
        d.append(document.createTextNode(m.text));
        if (m.card) { const c = cardEl(m); d.append(c); c.style.textAlign = 'left'; c.style.marginTop = '6px'; }
        frag.append(d); prev = null; continue;
      }
      const cont = prev && prev.role === m.role && prev.bi === m.bi;
      const row = el('div', 'msg' + (cont ? ' cont' : '')); row.dataset.role = m.role; row.dataset.id = m.id;
      row.append(cont ? el('div') : avatar(m.role));
      const mb = el('div', 'mb');
      if (!cont) {
        const h = el('div', 'mh'), w = el('span', 'who', nameOf(m.role)); w.style.color = ROLE_COLOR[m.role];
        h.append(w);
        if (m.role === 'boss') h.append(el('span', 'you', 'BẠN'));
        h.append(el('span', 'rl', ROLE_LABEL[m.role]), el('span', 'tm', m.t));
        mb.append(h);
      }
      mb.append(el('div', 'tx' + (m.typing && !m.text ? ' typing' : ''), m.typing && !m.text ? 'đang soạn…' : m.text));
      if (m.suggest) { const sg = el('div', 'sugg'), bt = el('button', 'btn', 'Chạy ' + m.suggest); bt.type = 'button'; bt.dataset.cmd = m.suggest; sg.append(bt); mb.append(sg); }
      if (m.card) mb.append(cardEl(m));
      row.append(mb); frag.append(row); prev = m;
    }
    box.replaceChildren(frag);
    const grew = msgs.length > lastCount; lastCount = msgs.length;
    if (atBottom || forceBottom) { box.scrollTop = box.scrollHeight; $('newpill').hidden = true; }
    else { box.scrollTop = saved; if (grew) $('newpill').hidden = false; }
    forceBottom = false;
  }
  $('messages').addEventListener('scroll', () => {
    const b = $('messages'); if (b.scrollHeight - b.scrollTop - b.clientHeight < 48) $('newpill').hidden = true;
  });
  $('newpill').onclick = () => { const b = $('messages'); b.scrollTop = b.scrollHeight; $('newpill').hidden = true; };
  $('messages').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cmd) submit(b.dataset.cmd);
    else if (b.dataset.cancel) { const m = msgs.find(x => String(x.id) === b.dataset.cancel); if (m && m.card) { m.card.state = 'cancelled'; renderChat(); } }
  });
  function decideLast(state) {
    for (let i = msgs.length - 1; i >= 0; i--) { const c = msgs[i].card; if (c && c.type === 'decision' && c.state === 'open') { c.state = state; return; } }
  }
  function bookCard(s, allFills, extra) {
    const pnl = (s.pnl > 0 ? '+' : s.pnl < 0 ? '-' : '') + money(Math.abs(s.pnl));
    return { type: 'book', nav: money(s.nav), pnl, pnlCls: s.pnl > 0 ? 'up-c' : s.pnl < 0 ? 'down-c' : '', cash: money(s.cash), exposure: (s.exposure * 100).toFixed(2) + '%', ...extra, fills: allFills };
  }
  /* desk log entry -> chat message (text verbatim) */
  function postEntry(e, s) {
    if (e._posted) return; e._posted = true;
    const p = s.proposal || s.blocked, bi = e.index;
    switch (e.kind) {
      case 'brief': case 'assign': post('boss', e.text, { bi }); break;
      case 'approve': decideLast('approved'); post('boss', e.text, { bi }); break;
      case 'skip': decideLast('skipped'); post('boss', e.text, { bi }); break;
      case 'ack': post('quant', e.text, { bi }); break;
      case 'cross': { const b = BARS[bi]; post('quant', e.text, { bi, card: { type: 'cross', fast: b.fast, slow: b.slow, close: b.close } }); break; }
      case 'propose': post('trader', e.text, { bi, card: { type: 'proposal', side: p.side, mark: p.mark, allocation: p.allocation, qty: s.quantity } }); break;
      case 'pass': case 'block':
        post('risk', e.text, { bi, card: { type: 'decision', verdict: e.kind, side: p.side, allocation: p.allocation, state: e.kind === 'block' ? 'block' : 'open' } }); break;
      case 'book': post('portfolio', e.text, { bi, card: bookCard(s, s.fills.slice(-1)) }); break;
      default: post(e.role, e.text, { bi });
    }
  }

  /* ================= game state ================= */
  const desk = new QuantLogic.Desk(BARS);
  let snap = copy(desk.snapshot()), logLen = 0, running = false, runTimer = 0, started = false;
  let curEntries = [], curS = null, endPosted = false, lastCoachKey = null;
  const history = []; let histPos = 0;

  const flushPending = () => { for (const e of curEntries) postEntry(e, curS); curEntries = []; };

  async function playProposal(tok, e3, s) {
    const [cross, prop, verdict] = e3, blocked = verdict.kind === 'block';
    const quant = actors.quant, trader = actors.trader, risk = actors.risk;
    phase = 'cross'; renderAll();
    setFace(quant, TALK.quant); setStatus(quant, 'báo giao cắt', 'busy'); say('quant', cross.text, true); postEntry(cross, s);
    await sleep(650, tok);
    release(quant);
    setStatus(trader, 'mang đề xuất tới Boss', 'busy');
    setFace(risk, WORK.risk); setStatus(risk, 'kiểm tra hạn mức', 'busy');
    await goStop(tok);
    setFace(trader, 'front-left'); setStatus(trader, 'trình đề xuất', 'busy'); trader.tagbox.style.setProperty('--tx', '34%');
    const p = s.proposal || s.blocked;
    const detail = p.side === 'buy' ? ` ${p.allocation}% NAV, giá tham chiếu ${money(p.mark)}.`
      : ` Bán hết ${s.quantity.toFixed(3)} BTC, giá tham chiếu ${money(p.mark)}.`;
    say('trader', prop.text + detail, true, 'right'); postEntry(prop, s);
    phase = 'risk'; renderAll();
    await sleep(900, tok);
    setFace(risk, TALK.risk); setStatus(risk, blocked ? 'Block' : 'Pass', blocked ? 'block' : 'pass');
    say('risk', verdict.text, true); postEntry(verdict, s);
    await sleep(500, tok);
    phase = 'idle'; release(trader); release(risk); renderAll();
    if (blocked) {
      setStatus(trader, 'đề xuất bị chặn', 'block');
      await sleep(2500, tok);
      await backFromBoss(tok);
      setFace(trader, TALK.trader); setStatus(trader, IDLE.trader); setStatus(risk, IDLE.risk);
    } else setStatus(trader, 'chờ Boss quyết', 'busy');
  }
  /* sau mỗi lệnh khớp: Portfolio Manager ra máy in lấy phiếu */
  const slipOk = () => (window.QF_FAST !== true || window.QF_AMBIENT === true) && !reduce.matches && settings.motion && !document.hidden && !takenSpots.has('PR') && !actors.portfolio.el.classList.contains('walking');
  async function slipTrip(tok) {
    const a = actors.portfolio, alive = () => tok === seq;
    takenSpots.add('PR');
    try {
      setStatus(a, 'đi lấy bản in', 'busy');
      await routeTo(a, 'PR', alive, 1, HOMEN.portfolio);
      const ph = POIS.find(p => p.id === 'printer');
      await runPhases(a, { ...ph, phases: ph.phases.map(x => ({ ...x, ms: 2000 })) }, alive);
      setStatus(a, 'quay về bàn'); await routeTo(a, HOMEN.portfolio, alive);
      setFace(a, TALK.portfolio); setStatus(a, IDLE.portfolio);
    } catch (e) { if (e !== CANCEL) console.warn('slip', e); }
    finally { takenSpots.delete('PR'); pantryState('printer-idle', false); clearPose(a); a.icon.classList.remove('on'); }
  }
  async function playEntries(tok, ents, s) {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.kind === 'brief') { say('boss', e.text); postEntry(e, s); }
      else if (e.kind === 'assign') { say('boss', e.text); postEntry(e, s); await sleep(650, tok); }
      else if (e.kind === 'ack') { setFace(actors.quant, WORK.quant); setStatus(actors.quant, 'theo dõi SMA 10/30', 'busy'); say('quant', e.text); postEntry(e, s); }
      else if (e.kind === 'cross') { await playProposal(tok, ents.slice(i, i + 3), s); i += 2; }
      else if (e.kind === 'approve' || e.kind === 'skip') {
        say('boss', e.text); postEntry(e, s); await sleep(500, tok);
        await backFromBoss(tok);
        const t = actors.trader;
        if (e.kind === 'approve') { setFace(t, WORK.trader); setStatus(t, 'chờ khớp ở nến kế', 'busy'); }
        else { setFace(t, TALK.trader); setStatus(t, IDLE.trader); }
        setStatus(actors.risk, IDLE.risk);
      } else if (e.kind === 'fill' || e.kind === 'nofill') {
        const f = s.fills[s.fills.length - 1];
        say('trader', e.kind === 'fill' && f ? `${e.text} Giá ${money(f.price)}.` : e.text); postEntry(e, s);
        setFace(actors.trader, TALK.trader); setStatus(actors.trader, IDLE.trader);
        const b = ents[i + 1] && ents[i + 1].kind === 'book' ? ents[i + 1] : null;
        if (b) {
          i++; await sleep(650, tok);
          setFace(actors.portfolio, WORK.portfolio); setStatus(actors.portfolio, 'cập nhật sổ', 'busy'); say('portfolio', b.text); postEntry(b, s);
          await sleep(2000, tok);
          setFace(actors.portfolio, TALK.portfolio); setStatus(actors.portfolio, IDLE.portfolio);
          if (e.kind === 'fill' && slipOk()) await slipTrip(tok);
        }
      } else postEntry(e, s);
    }
  }
  async function play(ents, s) {
    const tok = ++seq; playing = true; curEntries = ents; curS = s;
    const roles = rolesFor(ents);
    try { await claimRoles(roles); if (tok !== seq) throw CANCEL; await playEntries(tok, ents, s); } catch (e) { if (e !== CANCEL) throw e; }
    if (tok === seq) {
      playing = false; phase = 'idle'; curEntries = [];
      for (const r of roles) { const a = actors[r]; a.free = true; a.nextAt = performance.now() + rand(3000, 7000) / speed() / busyK(); a.cycleAt = a.nextAt; }
      renderAll(); afterSettled();
    }
  }
  function cancelVisuals(old) { seq++; playing = false; phase = 'idle'; flushPending(); settle(old); }

  /* run one desk action; returns true if it succeeded */
  function act(name, data) {
    const old = snap;
    try { desk.action(name, data || {}); }
    catch (e) { sys(e.message, true); return false; }
    if (playing) cancelVisuals(old);
    const s = copy(desk.snapshot());
    const fresh = s.log.slice(logLen); logLen = s.log.length; snap = s;
    if (name === 'next' && s.armed) { const q = actors.quant.el; q.classList.remove('nod'); void q.offsetWidth; q.classList.add('nod'); }
    if (name === 'next' && !fresh.length) candleLine(s);
    renderAll();
    if (fresh.length) play(fresh, s); else afterSettled();
    return true;
  }
  function candleLine(s) {
    const text = `Đã chạy tới nến ${s.index + 1}/${s.count} · ${utc(BARS[s.index].timestamp)} UTC`;
    const last = msgs[msgs.length - 1];
    if (last && last.kind === 'candle') { last.text = text; last.bi = s.index; renderChat(); }
    else post('system', text, { kind: 'candle' });
  }
  function startSession() {
    stopRun(); brainAbort(); seq++; playing = false; phase = 'idle'; curEntries = [];
    snap = copy(desk.snapshot()); logLen = snap.log.length;
    msgs = []; lastCount = 0; endPosted = false; lastCoachKey = null; histPos = history.length;
    hideBubbles(); settle(snap); renderChat(); renderAll();
    if (god.announcement) { post('system', 'Lệnh từ trên cao: ' + god.announcement); showBanner(god.announcement); }
    play(snap.log, snap);
  }
  function doReset() { desk.action('reset'); startSession(); }

  /* step, coach, hints */
  function stepNow(s, ph = phase) {
    if (!s.armed) return 1;
    if (playing && ph === 'cross') return 3;
    if (playing && ph === 'risk') return 4;
    if (s.proposal) return 5;
    if (s.pending) return 6;
    return 2;
  }
  const STEP_TEXT = { 1: 'Giao việc cho Quant', 2: 'Chạy nến tới khi SMA 10 cắt SMA 30', 3: 'Quant báo giao cắt', 4: 'Risk kiểm tra hạn mức: Pass hay Block', 5: 'Boss quyết: Approve hoặc Skip', 6: 'Bấm Next Candle để khớp lệnh ở nến sau' };
  function coachFor(s) {
    if (s.index === s.count - 1) return { key: 'end', role: 'portfolio', text: 'Hết phiên replay. NAV phản ánh vị thế còn mở nếu có.' };
    if (!s.armed) return { key: 's1', role: 'quant', text: `Chào ${nameOf('boss')}. Gõ /giao hoặc bấm Giao việc cho Quant để bắt đầu.` };
    if (s.proposal) return { key: 's5', role: 'trader', text: 'Trader đang ở bàn bạn. Approve hoặc Skip.' };
    if (s.pending) return { key: 's6', role: 'trader', text: 'Đã duyệt. Bấm Next Candle để khớp ở giá mở nến kế.' };
    if (s.blocked) return { key: 's2b', role: 'risk', text: 'Risk đã Block. Giảm phân bổ xuống 25% trở xuống (/alloc 25), rồi Next Candle chờ tín hiệu kế.' };
    return { key: 's2', role: 'quant', text: 'Bấm Next Candle (N) hoặc gõ /next cho tới khi SMA 10 cắt SMA 30.' };
  }
  function hintFor(s) {
    if (s.index === s.count - 1) return { role: 'portfolio', text: 'Hết phiên. Gõ /book xem sổ lệnh hoặc /reset để chơi lại.' };
    if (!s.armed) return { role: 'quant', text: 'Sếp chưa giao việc. Gõ /giao để tao bắt đầu theo dõi SMA 10/30.' };
    if (s.proposal) return { role: 'trader', text: 'Đề xuất đang chờ sếp. Gõ /approve để duyệt hoặc /skip để bỏ.' };
    if (s.pending) return { role: 'trader', text: 'Lệnh đã duyệt. Gõ /next, tao khớp ở giá mở nến kế.' };
    if (s.blocked) return { role: 'risk', text: 'Tao đã Block. Gõ /alloc 25 để giảm phân bổ rồi /next chờ tín hiệu kế.' };
    return { role: 'quant', text: 'Tao đang theo dõi SMA 10/30. Gõ /next để chạy nến.' };
  }
  function afterSettled() {
    const s = snap, ended = s.index === s.count - 1;
    if (ended && !endPosted) {
      endPosted = true;
      post('portfolio', 'Kết phiên.', { card: { type: 'result', nav: money(s.nav), pnl: (s.pnl >= 0 ? '+' : '-') + money(Math.abs(s.pnl)), fills: s.fills.length, ok: s.nav > QuantLogic.CAPITAL } });
    }
    const c = coachFor(s);
    if (c.key !== lastCoachKey) {
      lastCoachKey = c.key;
      if (settings.mode === 'guided' && !(c.key === 'end' && false)) post(c.role, c.text);
    }
    renderAll();
  }

  /* ================= brain: trả lời tự do bằng Claude (capability sample) ================= */
  const brain = { fn: undefined, off: false, used: 0, MAX: 40, ctl: null, cur: null, noTools: false, warned: false };
  const SEATS = ['quant', 'trader', 'risk', 'portfolio'];
  const brainAvail = () => !!(window.QF_SAMPLE || (window.claude && typeof window.claude.use === 'function'));
  const brainActive = () => settings.brain && !brain.off && brainAvail();
  function updateBrainUI() {
    const chip = $('brainchip'); if (chip) { const on = brainActive() && brain.used < brain.MAX; chip.textContent = on ? 'Claude · bật' : 'Kịch bản'; chip.classList.toggle('on', on); chip.title = on ? 'Câu hỏi tự do được Claude trả lời' : 'Câu hỏi tự do dùng câu trả lời kịch bản'; }
    const cb = $('brain-on'), note = $('brain-note'); if (!cb) return;
    cb.checked = settings.brain && brainAvail() && !brain.off; cb.disabled = !brainAvail() || brain.off;
    note.textContent = !brainAvail() ? 'Không khả dụng ở bản tải về.' : brain.off ? 'Claude chưa được cấp quyền, đang dùng kịch bản.' : `Claude đã trả lời ${brain.used}/${brain.MAX}`;
  }
  async function getSample() {
    if (window.QF_SAMPLE) return window.QF_SAMPLE;
    if (brain.fn !== undefined) return brain.fn;
    try { brain.fn = (await window.claude.use('sample')) || null; } catch (e) { brain.fn = null; }
    if (!brain.fn) { brain.off = true; updateBrainUI(); }
    return brain.fn;
  }
  /* ai được hỏi: @mention, tên hiển thị (hoặc một phần), tên legend, tên vai */
  function addressed(text, mention) {
    const MAP = { quant: 'quant', trader: 'trader', risk: 'risk', pm: 'portfolio' };
    if (mention && MAP[mention]) return MAP[mention];
    const n = ' ' + norm(text).replace(/[^a-z0-9]+/g, ' ') + ' ';
    const STOP = new Set(['de', 'la', 'van', 'von', 'jr', 'the', 'boss']);
    let best = null, pos = 1e9;
    for (const r of SEATS) {
      const words = new Set();
      for (const nm of [nameOf(r), LEG[settings.team[r]]]) for (const w of norm(nm).split(/[^a-z0-9]+/)) if (w.length >= 2 && !STOP.has(w)) words.add(w);
      for (const w of words) { const i = n.indexOf(' ' + w + ' '); if (i >= 0 && i < pos) { pos = i; best = r; } }
    }
    if (best) return best;
    const RW = { quant: ['quant', 'analyst'], trader: ['trader'], risk: ['risk'], portfolio: ['portfolio', 'pm'] };
    for (const r of SEATS) for (const w of RW[r]) { const i = n.indexOf(' ' + w + ' '); if (i >= 0 && i < pos) { pos = i; best = r; } }
    return best;
  }
  const RULES_TEXT = 'Chỉ mua (long-only), không bán khống. Một vị thế tối đa 25% NAV: Risk Block nếu vượt, Boss giảm phân bổ rồi chờ tín hiệu kế. Chiến lược SMA 10/30: SMA 10 cắt lên SMA 30 thì đề xuất mua, cắt xuống thì đề xuất đóng vị thế. Lệnh đã duyệt khớp ở giá mở của nến kế tiếp, có spread và phí mô phỏng. Vốn $100.000, dữ liệu BTC 5 phút là mô phỏng, không phải tiền thật.';
  const r2 = v => (v == null ? null : Math.round(v * 100) / 100);
  function barRows(n) {
    const s = snap, from = Math.max(0, s.index - Math.max(1, Math.min(48, Math.floor(+n) || 12)) + 1);
    return BARS.slice(from, s.index + 1).map(b => ({ utc: utc(b.timestamp), open: r2(b.open), high: r2(b.high), low: r2(b.low), close: r2(b.close), sma10: r2(b.fast), sma30: r2(b.slow) }));
  }
  const fillRows = (k) => snap.fills.slice(-k).map(f => `${utc(f.timestamp)} UTC ${f.side === 'buy' ? 'mua' : 'bán'} ${f.quantity.toFixed(3)} BTC giá ${num2(f.price)}`);
  function factsText() {
    const s = snap, b = BARS[s.index], o = outside();
    const st = s.proposal ? `Trader đang chờ Boss duyệt đề xuất ${s.proposal.side === 'buy' ? 'mua' : 'đóng vị thế'}` : s.blocked ? 'Risk vừa Block đề xuất' : s.pending ? 'Có lệnh đã duyệt, chờ khớp ở nến kế' : s.armed ? 'Quant đang theo dõi SMA 10/30' : 'Boss chưa giao việc cho Quant';
    return [
      `Bước hiện tại: ${st}.`, `Nến ${s.index + 1}/${s.count}, ${utc(b.timestamp)} UTC. Giá đóng ${num2(b.close)}. SMA 10: ${b.fast == null ? 'chưa có' : num2(b.fast)}; SMA 30: ${b.slow == null ? 'chưa có' : num2(b.slow)}.`,
      `Phân bổ đang đặt: ${s.allocation}% NAV. NAV ${money(s.nav)}, PnL ${money(s.pnl)}, Cash ${money(s.cash)}, Exposure ${(s.exposure * 100).toFixed(2)}%, vị thế ${s.quantity.toFixed(3)} BTC.`,
      `Lệnh đã khớp gần nhất: ${s.fills.length ? fillRows(5).join('; ') : 'chưa có'}.`,
      `Ngoài cửa sổ phòng: ${o.hhmm} giờ TP.HCM (${o.period}), trời ${WX_LAB[o.weather].toLowerCase()} (mô phỏng).`,
    ].join('\n');
  }
  function buildPrompt(raw, fixed) {
    const roster = ['boss', ...SEATS].map(r => `- ${r}: ${ROLE_LABEL[r]}, tên hiển thị "${nameOf(r)}"${r === 'boss' ? ' (người chơi)' : ''}`).join('\n');
    const recent = msgs.slice(-11, -1).filter(m => !m.typing && m.text).map(m => `${m.role === 'system' ? 'Hệ thống' : nameOf(m.role) + ' (' + ROLE_LABEL[m.role] + ')'}: ${String(m.text).slice(0, 240)}`).join('\n') || '(chưa có)';
    return [
      'Bạn đang nhập vai MỘT nhân viên hư cấu trong trò chơi mô phỏng "Quant Fun": một desk giao dịch BTC nến 5 phút. Người chơi là Boss của desk. Đây là mô phỏng, không phải tư vấn đầu tư cho tiền thật.',
      '', 'LUẬT DESK:', RULES_TEXT,
      '', 'DANH SÁCH GHẾ:', roster,
      '', 'GIỌNG VÀ GIỚI HẠN:',
      '- Trả lời bằng tiếng Việt, giọng desk thân mật như các câu có sẵn: xưng "tao", gọi Boss là "sếp" hoặc bằng tên Boss. 1 đến 4 câu ngắn.',
      '- Được tự do bàn ý tưởng, bức tranh thị trường trong dữ liệu, chiến lược, rủi ro, đùa vui, thời tiết ngoài cửa sổ.',
      `- Người nói là nhân viên hư cấu của game, nói với tư cách VAI TRÒ đó trên desk này. Không bắt chước hay trích lời người thật có tên trùng ghế, không nhận ý kiến, quá khứ hay danh mục thật của họ. Nếu bị hỏi thẳng, nói mình chỉ là nhân viên của desk trong game, đúng vai trò của ghế mình.`,
      '- Không bịa số liệu: chỉ dùng số trong phần dữ kiện bên dưới hoặc do công cụ trả về (get_bars, get_book, get_rules).',
      '- Không bao giờ nói một lệnh đã được đặt, duyệt, khớp, hay Risk đã Pass/Block: chỉ game engine làm việc đó. Chỉ được gợi ý.',
      '- Không viết gì trước khi gọi công cụ; chỉ câu trả lời cuối cùng được hiển thị.',
      '', 'ĐỊNH DẠNG TRẢ LỜI (văn bản thuần, không markdown):',
      'Dòng đầu chỉ có @role, role là một trong quant, trader, risk, portfolio.',
      'Các dòng sau là lời nhắn.',
      'Dòng cuối (tùy chọn) bắt đầu bằng ">> " theo sau là đúng MỘT lệnh chat có sẵn, ví dụ ">> /alloc 25" hoặc ">> /next". Chỉ gợi ý khi thật hợp lý.',
      fixed ? `Người trả lời đã được chọn: @${fixed} (${nameOf(fixed)}). Dòng đầu phải là @${fixed}.` : 'Chọn role phù hợp nhất với câu hỏi của Boss.',
      '', 'DỮ KIỆN HIỆN TẠI:', factsText(),
      '', 'TIN NHẮN GẦN ĐÂY:', recent,
      '', `TIN CỦA BOSS (${nameOf('boss')}):`, raw,
    ].join('\n');
  }
  function parseReply(full, fixed) {
    const text = full.replace(/\r/g, '');
    const re = /^@(quant|trader|risk|portfolio|pm)\b[^\n]*$/gim; let m, last = null;
    while ((m = re.exec(text))) last = m;
    let role = fixed || null, body = text;
    if (last) { if (!fixed) role = last[1].toLowerCase() === 'pm' ? 'portfolio' : last[1].toLowerCase(); body = text.slice(last.index + last[0].length); }
    else if (!fixed) return { role: null, body: '', cmd: null };
    else if (/^\s*@\w*$/.test(text)) body = '';
    let cmd = null; const keep = [];
    for (const ln of body.split('\n')) { const t = ln.trim(); if (t.startsWith('>>')) cmd = t.slice(2).trim(); else if (t.startsWith('>')) { /* dòng gợi ý đang gõ dở */ } else keep.push(ln); }
    return { role, body: keep.join('\n').trim(), cmd };
  }
  const BAD_SUGG = new Set(['reset', 'resetnow', 'name', 'unknown', 'help', 'stop']);
  function validCmd(c) {
    if (!c) return null;
    let t = c.trim().replace(/^`+|`+$/g, ''); if (!t) return null;
    if (!t.startsWith('/')) t = '/' + t;
    const p = parse(t);
    return BAD_SUGG.has(p.c) ? null : t;
  }
  let chatRaf = 0;
  const chatSoon = () => { if (!chatRaf) chatRaf = requestAnimationFrame(() => { chatRaf = 0; renderChat(); }); };
  function speakStart(role) {
    const a = actors[role];
    claimRoles([role]).then(() => {
      if (!brain.cur || brain.cur.role !== role) return;
      clearFx(a); setFace(a, TALK[role]); setStatus(a, 'đang trả lời Boss', 'busy'); a.mini.classList.add('on');
    });
  }
  function speakEnd(role) {
    const a = actors[role]; if (!a) return;
    a.mini.classList.remove('on');
    if (!a.inRoutine && !playing) { a.free = true; a.working = false; clearFx(a); setFace(a, TALK[role]); setStatus(a, IDLE[role]); a.nextAt = nowMs() + rand(3000, 7000) / speed() / busyK(); a.cycleAt = a.nextAt; }
  }
  function brainAbort() {
    const c = brain.cur; brain.cur = null;
    if (brain.ctl) { try { brain.ctl.abort(); } catch (e) { /* ignore */ } brain.ctl = null; }
    if (c) { if (c.role) speakEnd(c.role); if (c.m && !c.m.text) { const i = msgs.indexOf(c.m); if (i >= 0) msgs.splice(i, 1); } if (c.m) c.m.typing = false; renderChat(); }
  }
  function canned(seat) {
    if (settings.mode === 'guided') { const h = hintFor(snap); post(seat || h.role, h.text); } else sys('Không hiểu lệnh. Gõ /help.');
  }
  async function askBrain(raw, seat, mention, useTools = true) {
    if (!brainActive()) { canned(seat); return; }
    if (brain.used >= brain.MAX) {
      if (!brain.warned) { brain.warned = true; sys(`Claude đã trả lời đủ ${brain.MAX} lượt trong phiên này, quay về câu trả lời kịch bản.`); }
      canned(seat); return;
    }
    brainAbort();
    const sample = await getSample();
    if (!sample) { canned(seat); return; }
    const ctl = new AbortController(), c = { role: seat, m: null, tok: ++brain.tok };
    brain.ctl = ctl; brain.cur = c;
    const m = post(seat || 'system', seat ? '' : 'Desk đang soạn câu trả lời…', { typing: true, ph: !seat }); c.m = m;
    if (seat) speakStart(seat);
    const tools = useTools && !brain.noTools ? [
      { name: 'get_bars', description: 'Trả về tối đa n nến BTC 5 phút gần nhất tới nến hiện tại (n tối đa 48), mỗi nến có utc, open, high, low, close, sma10, sma30.', inputSchema: { type: 'object', properties: { n: { type: 'number', description: 'Số nến, 1 đến 48' } } }, execute: i => barRows(i && i.n) },
      { name: 'get_book', description: 'Trả về sổ lệnh và danh mục hiện tại: NAV, PnL, Cash, Exposure, vị thế BTC, phân bổ và các lệnh đã khớp.', execute: () => ({ nav: r2(snap.nav), pnl: r2(snap.pnl), cash: r2(snap.cash), exposure_pct: r2(snap.exposure * 100), position_btc: +snap.quantity.toFixed(3), allocation_pct: snap.allocation, fills: fillRows(10) }) },
      { name: 'get_rules', description: 'Trả về luật chơi của desk (long-only, trần 25% NAV, khớp ở giá mở nến kế).', execute: () => RULES_TEXT },
    ] : undefined;
    const opts = { modelTier: 'default', cache: false, signal: ctl.signal, onText: ({ text }) => {
      if (brain.cur !== c) return;
      const p = parseReply(text, seat);
      if (p.role && !c.role) { c.role = p.role; m.role = p.role; m.ph = false; speakStart(p.role); }
      if (c.role) { m.text = p.body; m.typing = !p.body; }
      c.cmd = p.cmd; chatSoon();
    } };
    if (tools) opts.tools = tools;
    try {
      const res = await sample(buildPrompt(raw, seat), opts);
      if (brain.cur !== c) return;
      const p = parseReply(res.text, seat);
      const role = c.role || p.role || seat || 'quant';
      m.role = role; m.ph = false; m.typing = false; m.text = p.body || res.text.trim();
      const vc = validCmd(p.cmd); if (vc) m.suggest = vc;
      brain.used++; brain.cur = null; brain.ctl = null; speakEnd(c.role || role); updateBrainUI(); renderChat();
    } catch (e) {
      const code = e && e.code;
      if (brain.cur !== c) return;               // đã bị thay bằng tin mới hoặc reset
      brain.cur = null; brain.ctl = null; if (c.role) speakEnd(c.role);
      const partial = e && typeof e.text === 'string' ? parseReply(e.text, seat).body : '';
      const drop = () => { const i = msgs.indexOf(m); if (i >= 0) msgs.splice(i, 1); };
      if (partial && code !== 'rate_limited' && code !== 'not_granted') { m.typing = false; m.text = partial; renderChat(); return; }
      drop(); renderChat();
      if (code === 'cancelled') return;
      if (code === 'tools_unavailable' && useTools) { brain.noTools = true; return askBrain(raw, seat, mention, false); }
      if (code === 'not_granted') { brain.off = true; updateBrainUI(); canned(seat); return; }
      if (code === 'rate_limited') { canned(seat); post('system', 'Claude đang bận, thử lại sau.', { muted: true }); return; }
      canned(seat);
    }
    updateBrainUI();
  }
  brain.tok = 0;
  const brainCb = $('brain-on'); if (brainCb) brainCb.onchange = e => { settings.brain = e.target.checked; save(); updateBrainUI(); };
  updateBrainUI();

  /* ================= commands ================= */
  function parse(text) {
    let t = text.trim(), mention = null, m;
    if ((m = /^@(quant|trader|risk|pm|boss)\b\s*(.*)$/i.exec(t))) { mention = m[1].toLowerCase(); t = m[2]; }
    const nm = /^\/?name\s+(.+)$/i.exec(t);
    if (nm) return { c: 'name', v: nm[1].trim().slice(0, 18) };
    const n = norm(t).replace(/^\//, '');
    if (/^(giao|giao viec)$/.test(n)) return { c: 'assign' };
    if (/^(next|n|nen)$/.test(n)) return { c: 'next' };
    if ((m = /^(?:next|n|nen)\s+(\d+)$/.exec(n))) return { c: 'nextn', n: +m[1] };
    if (/^(run|tua|tua toi tin hieu)$/.test(n)) return { c: 'run' };
    if (/^(stop|dung)$/.test(n)) return { c: 'stop' };
    if (/^(approve|duyet|ok|a)$/.test(n)) return { c: 'approve' };
    if (/^(skip|bo|s)$/.test(n)) return { c: 'skip' };
    if ((m = /^(?:alloc|phan bo)\s*(\S*)$/.exec(n))) return { c: 'alloc', v: m[1] };
    if ((m = /^(\d+(?:\.\d+)?)%$/.exec(n))) return { c: 'alloc', v: m[1] };
    if (/^(book|so|so lenh)$/.test(n)) return { c: 'book' };
    if (/^status$/.test(n)) return { c: 'status' };
    if (n === 'reset now') return { c: 'resetnow' };
    if (/^(reset|choi lai)$/.test(n)) return { c: 'reset' };
    if ((m = /^time(?:\s+(.*))?$/.exec(n))) return { c: 'time', v: m[1] };
    if ((m = /^(?:weather|troi)(?:\s+(.*))?$/.exec(n))) return { c: 'weather', v: m[1] };
    if (/^(help|\?)$/.test(n)) return { c: 'help' };
    return { c: 'unknown', mention };
  }
  function submit(raw) {
    const text = (raw || '').trim(); if (!text) return;
    if (history[history.length - 1] !== text) history.push(text);
    histPos = history.length;
    exec(parse(text), text);
  }
  function exec(cmd, raw) {
    if (cmd.c !== 'run') stopRun();
    const s = snap;
    switch (cmd.c) {
      case 'assign': act('assign'); break;
      case 'next': act('next'); break;
      case 'nextn': {
        if (cmd.n < 1) { sys('Số nến phải từ 1 trở lên.', true); break; }
        post('boss', `Chạy ${cmd.n} nến.`);
        for (let i = 0; i < cmd.n; i++) { const before = logLen; if (!act('next') || logLen > before) break; }
        break;
      }
      case 'run': {
        if (!s.armed) { sys('Giao việc cho Quant trước. Gõ /giao.', true); break; }
        if (running) break;
        if (s.proposal || s.index === s.count - 1) { sys('Không tua được: xử lý đề xuất hoặc chơi lại trước.', true); break; }
        post('boss', 'Tua tới tín hiệu.'); startRun(); break;
      }
      case 'stop': break;
      case 'approve': act('approve'); break;
      case 'skip': act('skip'); break;
      case 'alloc': {
        const v = cmd.v === '' ? NaN : Number(cmd.v);
        if (act('allocation', { value: v })) {
          post('boss', `Phân bổ ${v}% cho SMA 10/30.`);
          sys(`Đã áp dụng phân bổ ${v}%. Hạn mức vẫn là 25% NAV.`);
        }
        break;
      }
      case 'book': post('boss', raw); post('portfolio', 'Sổ lệnh của desk.', { card: bookCard(s, s.fills) }); break;
      case 'status':
        post('boss', raw);
        post('portfolio', 'Báo cáo nhanh.', { card: bookCard(s, null, { pos: 'Vị thế ' + s.quantity.toFixed(3) + ' BTC' }) }); break;
      case 'reset': post('boss', raw); post('system', 'Xác nhận chơi lại.', { card: { type: 'confirm', state: 'open' } }); break;
      case 'resetnow': doReset(); break;
      case 'name':
        settings.names.boss = cmd.v; save(); renderTags(); renderPresence(); renderChat();
        sys(`Tên mới: ${cmd.v}.`); break;
      case 'time': {
        post('boss', raw);
        const note = o => (o.tsrc === 'player' ? ' Đang đặt tay, gõ /time auto để trả về.' : o.tsrc === 'god' ? ' Giờ cài sẵn của desk.' : o.tsrc === 'day' ? ' Cài đặt đang cố định ban ngày nên cửa sổ không đổi.' : '');
        if (cmd.v == null) { const o = outside(); sys(`Giờ ở TP.HCM (UTC+7): ${o.hhmm}, ${o.period}.` + note(o)); break; }
        if (!setTime(cmd.v)) { sys('Giờ không hợp lệ. Gõ /time 21:00 hoặc /time auto.', true); break; }
        { const o = outside(); sys(cmd.v === 'auto' ? `Giờ ngoài trời về ${godTime != null ? 'giờ cài sẵn' : 'giờ thật'}: ${o.hhmm}.` : `Đã đặt giờ ngoài trời: ${o.hhmm}, ${o.period}.` + note(o)); }
        break;
      }
      case 'weather': {
        post('boss', raw);
        const note = o => (o.wsrc === 'player' ? ' Đang đặt tay, gõ /weather auto để trả về.' : o.wsrc === 'god' ? ' Trời cài sẵn của desk.' : o.wsrc === 'day' ? ' Cài đặt đang cố định ban ngày nên cửa sổ không đổi.' : '');
        if (cmd.v == null) { const o = outside(); sys(`Ngoài cửa sổ: ${WX_LAB[o.weather]}. Thời tiết mô phỏng theo mùa ở TP.HCM, không phải dữ liệu thật.` + note(o)); break; }
        if (!setWeather(cmd.v)) { sys('Gõ /weather quang, mây, mưa, dông hoặc auto.', true); break; }
        { const o = outside(); sys(cmd.v === 'auto' ? `Trời ngoài cửa sổ về ${god.weather !== 'auto' ? 'giá trị cài sẵn' : 'mô phỏng'}: ${WX_LAB[o.weather]}.` : `Đã đặt trời: ${WX_LAB[o.weather]}.` + note(o)); }
        break;
      }
      case 'help': post('boss', raw); post('system', 'Lệnh trong chat:', { card: { type: 'help' } }); break;
      default: {
        post('boss', raw);
        const body = cmd.mention ? raw.trim().replace(/^@\S+\s*/, '') : raw;
        const seat = addressed(raw, cmd.mention);
        askBrain(body || raw, seat, cmd.mention);
      }
    }
  }
  const CMDS = [
    ['/giao · giao viec', 'Giao việc cho Quant'], ['/next · n · nen', 'Chạy 1 nến'], ['/next 10', 'Chạy tối đa 10 nến, dừng khi có tin mới'],
    ['/run · tua', 'Tua tới tín hiệu'], ['/approve · a · ok · duyet', 'Duyệt đề xuất'], ['/skip · s · bo', 'Bỏ đề xuất'],
    ['/alloc 20 · 20%', 'Đặt vốn phân bổ (1 đến 100)'], ['/book · so', 'Sổ lệnh đã khớp'], ['/status', 'NAV, PnL, Cash, Exposure'],
    ['/time · /time 21:00 · /time auto', 'Xem hoặc đặt giờ ngoài cửa sổ (UTC+7)'], ['/weather · /weather mưa · auto', 'Xem hoặc đặt trời: quang, mây, mưa, dông'],
    ['/reset · choi lai', 'Chơi lại (có xác nhận)'], ['/name Phúc', 'Đổi tên Boss'], ['/help · ?', 'Bảng này'],
  ];
  function helpTable(short) {
    const t = el('table', 'helptab');
    t.innerHTML = '<thead><tr><th>Gõ</th><th>Việc</th></tr></thead>';
    const tb = el('tbody');
    for (const [a, b] of CMDS) { const tr = el('tr'); const c1 = el('td'); c1.append(el('code', '', a)); tr.append(c1, el('td', '', b)); tb.append(tr); }
    t.append(tb);
    if (short) return t;
    return t;
  }
  $('help-table').append(helpTable(false));

  /* run loop */
  function stopRun() { running = false; clearInterval(runTimer); runTimer = 0; if (typeof renderChips === 'function') renderChips(); }
  function startRun() {
    running = true; renderChips();
    runTimer = setInterval(() => {
      const s = snap;
      if (s.proposal || s.index === s.count - 1) { stopRun(); return; }
      if (!act('next') || snap.proposal || snap.blocked || snap.index === snap.count - 1) stopRun();
    }, instant() ? 15 : 110 / speed());
  }

  /* ================= render: HUD, objective, chips ================= */
  const prevText = {};
  function flash(n) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
  function setNum(id, text) { if (prevText[id] !== undefined && prevText[id] !== text) flash($(id)); prevText[id] = text; $(id).textContent = text; }
  function renderAll() {
    const s = snap, bar = s.bars[s.bars.length - 1], ended = s.index === s.count - 1;
    setNum('nav', money(s.nav)); setNum('cash', money(s.cash)); setNum('exposure', (s.exposure * 100).toFixed(2) + '%');
    const pnl = $('pnl'), txt = (s.pnl < 0 ? '-' : s.pnl > 0 ? '+' : '') + money(Math.abs(s.pnl));
    if (prevText.pnl !== undefined && prevText.pnl !== txt) flash(pnl);
    prevText.pnl = txt;
    pnl.className = 'num ' + (s.pnl > 0 ? 'up-c' : s.pnl < 0 ? 'down-c' : '');
    pnl.replaceChildren(...(s.pnl === 0 ? [] : [el('i', 'tri ' + (s.pnl > 0 ? 'up' : 'down'))]), document.createTextNode(txt));
    $('time').textContent = utc(bar.timestamp) + ' UTC · ' + (s.index + 1) + '/' + s.count;
    $('progress-text').textContent = 'Nến ' + (s.index + 1) + '/' + s.count + ' · ' + utc(bar.timestamp) + ' UTC';
    $('progress-bar').style.width = ((s.index + 1) / s.count * 100) + '%';
    const step = stepNow(s), ob = $('ob-step');
    if (ended) {
      const ok = s.nav > QuantLogic.CAPITAL;
      ob.replaceChildren(el('b', '', (ok ? 'Đạt mục tiêu' : 'Chưa đạt mục tiêu') + ' · '), document.createTextNode(`NAV ${money(s.nav)} · ${s.fills.length} lệnh khớp`));
    } else ob.textContent = step + '/6 · ' + STEP_TEXT[step] + (step === 2 && s.blocked ? ' (Risk đã Block, giảm phân bổ)' : '');
    renderChips(); drawChart();
  }
  function chipsFor(s) {
    if (running) return [{ t: 'Dừng', cmd: '/stop' }];
    if (s.index === s.count - 1) return [{ t: 'Chơi lại', cmd: '/reset now' }, { t: '/book', cmd: '/book' }];
    if (!s.armed) return [{ t: 'Giao việc cho Quant', cmd: '/giao' }, { t: '/help', cmd: '/help' }];
    if (s.proposal) return [{ t: 'Approve', cmd: '/approve' }, { t: 'Skip', cmd: '/skip' }];
    if (s.pending) return [{ t: 'Next Candle · khớp lệnh', cmd: '/next' }];
    if (s.blocked) return [{ t: '/alloc 25', cmd: '/alloc 25' }, { t: 'Next Candle', cmd: '/next' }];
    return [{ t: 'Next Candle', cmd: '/next' }, { t: 'Tua tới tín hiệu', cmd: '/run' }, { t: '/alloc …', fill: '/alloc ' }];
  }
  function renderChips() {
    const box = $('chips'); if (!snap) return;
    const locked = phase !== 'idle';
    box.replaceChildren(...chipsFor(snap).map((c, i) => {
      const b = el('button', 'btn' + (i === 0 ? ' primary' : ''), c.t); b.type = 'button'; b.disabled = locked && !running;
      if (c.cmd) b.dataset.cmd = c.cmd; if (c.fill) b.dataset.fill = c.fill;
      return b;
    }));
  }
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.fill) { const i = $('chat-input'); i.value = b.dataset.fill; i.focus(); }
    else if (b.dataset.cmd === '/stop') stopRun();
    else submit(b.dataset.cmd);
  });

  /* composer */
  $('composer').addEventListener('submit', e => { e.preventDefault(); const i = $('chat-input'); const v = i.value; i.value = ''; submit(v); });
  $('chat-input').addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { if (histPos > 0) { histPos--; e.target.value = history[histPos] || ''; e.preventDefault(); } }
    else if (e.key === 'ArrowDown') { if (histPos < history.length) { histPos++; e.target.value = history[histPos] || ''; e.preventDefault(); } }
  });
  $('chart-toggle').onclick = () => setChart($('chart-wrap').hidden);
  function setChart(open) {
    $('chart-wrap').hidden = !open; $('chart-toggle').setAttribute('aria-expanded', String(open));
    $('chart-toggle').textContent = open ? 'Chart BTC ▾' : 'Chart BTC ▸';
    if (open) requestAnimationFrame(drawChart);
  }

  /* ================= chart ================= */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function drawChart() {
    if (!snap) return;
    const canvas = $('chart'), { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1, small = height < 150;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const bars = snap.bars, start = snap.index - (bars.length - 1);
    const vals = bars.flatMap(b => [b.low, b.high, b.fast, b.slow]).filter(Number.isFinite);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const top = small ? 12 : 20, bottom = height - (small ? 12 : 22), pw = width - 56, dx = pw / QuantLogic.WINDOW;
    const x = i => 4 + dx * (i + .5), y = v => bottom - (v - lo) / Math.max(1, hi - lo) * (bottom - top);
    const cUp = css('--up'), cDown = css('--down'), cAcc = css('--accent'), cSlow = css('--sma-slow'), cInk = css('--ink');
    ctx.font = '10px system-ui'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const m = lo + (hi - lo) * i / 3;
      ctx.strokeStyle = '#2a3260'; ctx.beginPath(); ctx.moveTo(0, Math.round(y(m)) + .5); ctx.lineTo(pw + 6, Math.round(y(m)) + .5); ctx.stroke();
      ctx.fillStyle = '#a3add0'; ctx.fillText(Math.round(m).toLocaleString('en-US'), pw + 9, y(m) + 3);
    }
    bars.forEach((b, i) => {
      ctx.fillStyle = ctx.strokeStyle = b.close >= b.open ? cUp : cDown;
      ctx.beginPath(); ctx.moveTo(x(i), y(b.high)); ctx.lineTo(x(i), y(b.low)); ctx.stroke();
      ctx.fillRect(x(i) - dx * .3, Math.min(y(b.open), y(b.close)), dx * .6, Math.max(1, Math.abs(y(b.open) - y(b.close))));
    });
    ctx.lineWidth = 1.5;
    for (const [k, c] of [['fast', cAcc], ['slow', cSlow]]) {
      ctx.beginPath(); ctx.strokeStyle = c; let on = false;
      bars.forEach((b, i) => { if (b[k] === null) return; if (on) ctx.lineTo(x(i), y(b[k])); else ctx.moveTo(x(i), y(b[k])); on = true; });
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    bars.forEach((b, i) => {
      if (!b.signal) return;
      const cy = b.signal === 'buy' ? y(b.low) + 6 : y(b.high) - 6;
      ctx.strokeStyle = cInk; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x(i), cy - 3.5); ctx.lineTo(x(i) + 3.5, cy); ctx.lineTo(x(i), cy + 3.5); ctx.lineTo(x(i) - 3.5, cy); ctx.closePath(); ctx.stroke();
    });
    for (const f of snap.fills) {
      const i = f.index - start; if (i < 0 || i >= bars.length) continue;
      const b = bars[i], buy = f.side === 'buy';
      ctx.fillStyle = buy ? cUp : cDown;
      const cy = buy ? y(b.low) + 13 : y(b.high) - 13;
      ctx.beginPath();
      if (buy) { ctx.moveTo(x(i), cy - 5); ctx.lineTo(x(i) + 5, cy + 4); ctx.lineTo(x(i) - 5, cy + 4); }
      else { ctx.moveTo(x(i), cy + 5); ctx.lineTo(x(i) + 5, cy - 4); ctx.lineTo(x(i) - 5, cy - 4); }
      ctx.closePath(); ctx.fill();
      if (!small) { ctx.font = '11px system-ui'; ctx.fillText(buy ? 'Mua' : 'Bán', x(i), buy ? cy + 15 : cy - 8); }
    }
    const last = bars[bars.length - 1], ly = y(last.close);
    ctx.textAlign = 'left'; ctx.fillStyle = cAcc; ctx.fillRect(pw + 4, ly - 7, 50, 14);
    ctx.fillStyle = '#1b1405'; ctx.font = '600 10px system-ui'; ctx.fillText(Math.round(last.close).toLocaleString('en-US'), pw + 7, ly + 3.5);
  }
  new ResizeObserver(drawChart).observe($('chart'));

  /* ================= settings dialog + title controls ================= */
  function pickLegend(role, id) {
    const other = ROLES.find(r => r !== role && settings.team[r] === id), old = settings.team[role];
    settings.team[role] = id; if (role !== 'boss') settings.names[role] = LEG[id];
    if (other) { settings.team[other] = old; if (other !== 'boss') settings.names[other] = LEG[old]; }
    applyLooks(); renderChat(); save(); refreshTitle();
  }
  function refreshTitle() {
    const id = settings.team.boss;
    $('boss-portrait').replaceChildren(portrait(id)); $('boss-legend-name').textContent = LEG[id];
    $('boss-name').value = settings.names.boss;
  }
  $('boss-name').addEventListener('input', e => { settings.names.boss = e.target.value; renderTags(); renderChat(); save(); });
  function cycle(d) {
    const ids = ASSETS.legends.map(l => l.id), i = ids.indexOf(settings.team.boss);
    pickLegend('boss', ids[(i + d + ids.length) % ids.length]);
  }
  $('boss-prev').onclick = () => cycle(-1);
  $('boss-next').onclick = () => cycle(1);
  function segs(container) {
    container.replaceChildren();
    const defs = [['CHẾ ĐỘ', 'mode', [['guided', 'Có hướng dẫn'], ['free', 'Tự do']]], ['NHỊP', 'speed', [['normal', 'Thường'], ['fast', 'Nhanh']]]];
    if (container.id === 'set-segs') defs.push(['TRỜI BÊN NGOÀI', 'sky', [['auto', 'Tự động'], ['day', 'Cố định ban ngày']]]);
    for (const [label, key, opts] of defs) {
      const g = el('div', 'seg'); g.append(el('span', '', label));
      const row = el('div'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', label);
      for (const [v, t] of opts) {
        const b = el('button', '', t); b.type = 'button'; b.dataset.key = key; b.dataset.value = v; b.setAttribute('aria-pressed', String(settings[key] === v));
        b.onclick = () => { settings[key] = v; save(); refreshSegs(); if (key === 'sky') worldTick(); };
        row.append(b);
      }
      g.append(row); container.append(g);
    }
    if (container.id !== 'set-segs') return;
    const live = [['THỜI TIẾT', v => setWeather(v), () => playerWx || 'auto', [['auto', 'Tự động'], ['quang', 'Quang'], ['mây', 'Nhiều mây'], ['mưa', 'Mưa'], ['dông', 'Dông']]],
      ['GIỜ', v => setTime(v), () => (playerTime == null ? 'auto' : hhmm(playerTime)), [['auto', 'Giờ thật'], ['07:00', 'Sáng'], ['12:00', 'Trưa'], ['17:00', 'Chiều'], ['19:00', 'Tối'], ['23:00', 'Đêm']]]];
    for (const [label, apply, cur, opts] of live) {
      const g = el('div', 'seg'); g.append(el('span', '', label));
      const row = el('div'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', label); row.style.flexWrap = 'wrap';
      for (const [v, t] of opts) {
        const b = el('button', '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(cur() === v));
        b.onclick = () => { apply(v); refreshSegs(); };
        row.append(b);
      }
      g.append(row); container.append(g);
    }
  }
  const refreshSegs = () => { segs($('title-segs')); segs($('set-segs')); };

  function buildSettings(focusId) {
    updateBrainUI();
    const main = $('set-main'), team = $('set-team');
    main.replaceChildren(); team.replaceChildren();
    const mk = (label, input) => { const l = el('label', '', label); l.append(input); return l; };
    const txt = (id, val, on) => { const i = el('input'); i.type = 'text'; i.maxLength = 18; i.id = id; i.value = val; i.autocomplete = 'off'; i.oninput = () => on(i.value); return i; };
    const sel = (id, role) => {
      const s = el('select'); s.id = id;
      for (const lg of ASSETS.legends) { const o = el('option', '', lg.name); o.value = lg.id; if (lg.id === settings.team[role]) o.selected = true; s.append(o); }
      s.onchange = () => { pickLegend(role, s.value); buildSettings(id); };
      return s;
    };
    main.append(mk('Tên Boss (bạn)', txt('set-name-boss', settings.names.boss, v => { settings.names.boss = v; renderTags(); renderChat(); save(); refreshTitle(); })));
    const bl = el('div', 'set-row'); bl.append(portrait(settings.team.boss)); const bc = el('div', 'col'); bc.append(mk('Legend của Boss', sel('set-legend-boss', 'boss'))); bl.append(bc); main.append(bl);
    main.append(mk('Tên bàn giao dịch', txt('set-desk', settings.deskName, v => { settings.deskName = v.trim() || 'Quant Fun Desk'; applyLooks(); save(); })));
    for (const r of ROLES.filter(x => x !== 'boss')) {
      const row = el('div', 'set-row'); row.append(portrait(settings.team[r]));
      const col = el('div', 'col');
      col.append(mk(ROLE_LABEL[r] + ' · tên', txt('set-name-' + r, nameOf(r), v => { settings.names[r] = v; renderTags(); renderChat(); save(); })));
      col.append(mk(ROLE_LABEL[r] + ' · legend', sel('set-legend-' + r, r)));
      row.append(col); team.append(row);
    }
    segs($('set-segs')); $('motion').checked = settings.motion;
    if (focusId && $(focusId)) $(focusId).focus();
  }
  $('motion').onchange = e => { settings.motion = e.target.checked; document.body.classList.toggle('nomotion', !settings.motion); save(); };
  $('team-default').onclick = () => {
    settings.team = { ...DEFAULT_TEAM }; for (const r of ROLES) if (r !== 'boss') settings.names[r] = LEG[DEFAULT_TEAM[r]];
    applyLooks(); renderChat(); save(); refreshTitle(); buildSettings();
  };
  function openSettings(from) { for (const r of ROLES) { const g = actors[r]; if (g.reservedBy) releaseGuest(g, g.reservedBy); } buildSettings(); openDlg($('settings'), from); }
  $('title-settings').onclick = () => openSettings($('title-settings'));
  $('title-help').onclick = () => openDlg($('help'), $('title-help'));
  $('credits-open').onclick = () => openDlg($('credits'), $('credits-open'));

  /* pause menu */
  function openPause() { stopRun(); openDlg($('pause'), $('menu')); }
  $('menu').onclick = openPause;
  $('pause').addEventListener('click', e => {
    const b = e.target.closest('[data-pause]'); if (!b) return;
    const k = b.dataset.pause; closeDlg($('pause'), k === 'resume');
    if (k === 'settings') openSettings($('menu'));
    else if (k === 'restart') doReset();
    else if (k === 'home') { stopRun(); showScreen('title'); refreshTitle(); $('deploy').focus(); }
    else if (k === 'credits') openDlg($('credits'), $('menu'));
  });

  /* enter the game */
  function enterGame() {
    settings.names.boss = $('boss-name').value; save();
    showScreen('game'); renderTags(); renderChat();
    if (!started) { started = true; startSession(); }
    else { renderAll(); }
    if (!phoneMQ.matches) $('chat-input').focus({ preventScroll: true });
  }
  $('deploy').onclick = enterGame;
  $('boss-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enterGame(); } });

  /* keys */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || $('game').hidden) return;
    const tg = e.target && e.target.tagName, typing = tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT';
    if (dialogOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); openPause(); return; }
    if (typing) return;
    const k = e.key.toLowerCase();
    if (k === '/') { e.preventDefault(); $('chat-input').focus(); }
    else if (k === 'n') { if (!snap.proposal && snap.index < snap.count - 1) submit('/next'); }
    else if (k === 'a') { if (snap.proposal) submit('/approve'); }
    else if (k === 's') { if (snap.proposal) submit('/skip'); }
  });

  /* ================= boot ================= */
  async function boot() {
    const urls = [ASSETS.room, ...Object.values(ASSETS.desks).filter(v => typeof v === 'string'), ...ROLES.flatMap(r => ANGLES.map(a => ASSETS.sprites[DEFAULT_TEAM[r]][a]))];
    let done = 0; const t0 = performance.now();
    const fill = $('boot-fill'), track = fill.parentElement;
    const sheetIdx = [...new Set(ROLES.map(r => ANIM.legends[DEFAULT_TEAM[r]].sheet))], total = urls.length + sheetIdx.length;
    const tick = () => { done++; const p = Math.round(done / total * 100); fill.style.width = p + '%'; track.setAttribute('aria-valuenow', String(p)); };
    await Promise.all([...urls.map(u => { const i = new Image(); i.src = u; return (i.decode ? i.decode() : Promise.resolve()).catch(() => {}).then(tick); }), ...sheetIdx.map(k => loadSheet(k).then(tick))]);
    const fast = window.QF_FAST === true;
    if (!fast) { const wait = 900 - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait)); }
    if (fast || reduce.matches) showScreen('title');
    else { $('boot').classList.add('fade'); await new Promise(r => setTimeout(r, 200)); showScreen('title'); }
    $('boot').hidden = true; $('title').dataset.ready = '1';
  }

  /* init */
  $('title-bg').src = ASSETS.room;
  applyLooks(); refreshTitle(); refreshSegs();
  document.body.classList.toggle('nomotion', !settings.motion);
  setChart(!phoneMQ.matches);
  settle(snap); renderAll();
  boot();
})();
