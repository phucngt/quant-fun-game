# Quant Fun — game build (handoff for coding agents)

Single-file browser game: a fixed-camera isometric pixel-art trading office. The player is the
Boss (custom name) and runs a BTC 5m SMA 10/30 replay with four roles: Quant Analyst, Trader,
Risk Manager, Portfolio Manager. All UI copy is Vietnamese. Simulated data only.

## State at handoff (2026-11-13 17:05 ICT)

- **v4–v7 done (2026-11-13 21:00 ICT):** Vietnam time + simulated HCMC weather in the windows (`/time`, `/weather`, `window.QuantFun`), GOD config block `<script type="application/json" id="god">` in `src/body.html` (owner edits it between publishes), free chat answered by Claude through the Artifact `sample` capability (publish with `capabilities: {sample: {}}`; standalone falls back to canned), real animation frames from `assets/anim.json` (walk, type-standing, coffee, water, notes/phone/book), 22nd legend Phuc Nguyen = default Boss. Tests: `test/v4.js`, `test/v5.js` (fake `window.QF_SAMPLE`), `test/v6.js`.
- **v3 ambient motion done** (leg steps, routines over a waypoint graph, object interactions; `test/ambient.js`).
- **v2 done and verified** (spec `docs/PLAN-v2.md`, delta on `docs/PLAN.md`): Saltline-style boot
  screen -> title screen (name "TÊN CỦA BẠN", Boss legend picker, VÀO PHÒNG / CÀI ĐẶT / CÁCH CHƠI,
  CHẾ ĐỘ, NHỊP) -> game: room left, Slack-style chat right (commands `/giao`, `n`, `/run`,
  `/alloc 50`, `duyệt`, `bỏ`, `/book`, `/status`, `/reset`, `/help`, `/name`; chips; proposal /
  decision / book cards). `dist/quant-fun.html` is the verified standalone build.
- Smoke test passes (4 flows driven through chat), parity 12 scenarios / 0 mismatches.
- Screenshots in `docs/shots/`.
- Not yet exercised by tests: end-of-session result card, `Nhanh` speed, `Tự do` mode, `/` key,
  "Tin mới" pill, reduced motion, safe-area insets on a real phone. Phone tags are small.

## Layout

```
build.py              inlines src/ + assets/ into dist files (see below for output paths)
src/logic.js          game rules: JS port of the repo's Python Desk + SimBroker + TradingCosts
                      + apply_limits. DO NOT change behaviour; parity test must stay green.
src/ui.js             all DOM, room, walking, chat, chart, settings
src/body.html         markup;  src/game.css  styles (one dark look, VT323 display font)
assets/assets.json    data URIs: room (webp), 3 desks, 21 legends x 4 angles (142x240 webp,
                      feet on the bottom edge, centred), VT323 woff2; legend list; facing table
assets/bars.json      160 synthetic BTC 5m bars from the repo's replay-data.mjs (signals at
                      index 42 buy, 81 sell, 122 buy, 141 sell; session starts at index 29)
assets/legends-contact.png  all 84 normalised sprite cuts
tools/make_sprites.py re-cuts sprite-sheets/*.png into assets.json (grid found from alpha gutters)
tools/make_assets.py  original room/desk/font packer (expects the Pixel Agents repo paths)
sprite-sheets/        the six source sheets + SPRITE-MAP.md (row/column meaning)
test/parity.py + parity.mjs + scenarios.json  Python Desk vs QuantLogic.Desk, step by step
test/smoke.js         Playwright end-to-end on the built file (file://, window.QF_FAST=true)
docs/PLAN.md, docs/PLAN-v2.md  full specs;  docs/sample-*.png  v1 screenshots
reference/            run.py and replay-data.mjs from phucngt/quant-fun, licences
```

`build.py` writes to `out/artifact/quant-fun.html` (fragment, no html/head/body, for
the claude.ai Artifact host) and `out/download/quant-fun.html` (full standalone document) relative
to its folder. Paths inside `build.py` and the tests were written for the original workspace —
fix any absolute path you find (search for `/tmp/` and `/home/`).

## Rules that must hold

- Long-only, capital 100,000 USD, default allocation 20%, position cap 25% NAV (proposal with
  allocation > 25% is Blocked, Block has NO Approve button), unit 0.001 BTC, half-spread 5 bps,
  approved order fills at the NEXT candle's open. Show only candles already run (48-bar window).
- Self-contained output: all CSS/JS/images/font/data inline; zero network requests; works from
  `file://`. No CDN, no API keys, no backend.
- Label "Dữ liệu mô phỏng" visible in game. Keep the credits dialog (Pixel Agents MIT notice,
  AI Fund, AI Hedge Fund, VT323 OFL, the 21 legend sprite sheets + the disclaimer that the pixel
  characters are simulated roles, not the real people and not their words).
- Dialogue stays the repo's generic desk lines; never write lines imitating a legend's real views.

## Sprite facing (verified on all 21 legends; opposite of the Pixel Agents source convention)

| key         | shows                                  | moving on screen |
|-------------|----------------------------------------|------------------|
| front-left  | faces viewer, looks screen-left        | down-left        |
| front-right | faces viewer, looks screen-right       | down-right       |
| rear-left   | back to viewer, looks screen-left      | up-left          |
| rear-right  | back to viewer, looks screen-right     | up-right         |

## Verification

```
python3 build.py
python3 test/parity.py && node test/parity.mjs   # expect 12 scenarios, 0 mismatches
node test/smoke.js                               # needs playwright + chromium
```
v1 results: Approve → 1 fill on the next candle, 0.299 BTC @ $66,902.66 (bar 43 open × 1.0005),
cash $79,996.10, exposure 19.98%. Skip → 0 fills, NAV $100,000.00. Allocation 50% → BLOCK, no
Approve. Reset → candle 30/160, NAV $100,000.00, 0 fills, allocation 20.

## Next steps

1. Polish phone layout (tag/bubble size), test the untested items above.
2. Settings portraits grid, end-of-session screen polish, sound (optional).

## Roadmap

Full development plan (real data, plug-in modules, public API, MCP, Claude-powered agents via the Artifact `sample` capability): `docs/ROADMAP.md`. Start at Phase 0.

## Unfinished work

See `TODO-NEXT.md` (night light map, sunless room, station test, screenshots). Then continue `docs/ROADMAP.md`.
