# Quant Fun — full development plan (for the implementing agent)

Read `AGENTS.md` first (repo layout, rules, sprite facing, how to build and test). This plan
starts from the verified v2 (boot → title → room + chat) plus v3 ambient motion
(`docs/PLAN.md`, `docs/PLAN-v2.md`). Work phase by phase; each phase ends with green tests and a
rebuilt `dist/quant-fun.html`. Do not start a phase before the previous one's acceptance passes.

## Goals

1. **Real data** next to the built-in replay.
2. **Open modules**: data sources, strategies, risk rules, brokers and agent brains are plug-ins
   behind small interfaces, with a public page API, so REST/WebSocket and MCP integrations can be
   added later without touching the game core.
3. **Claude-powered agents on the owner's Claude plan**: when the game runs as a claude.ai
   Artifact, the four roles think and talk with the artifact `sample` capability (no API key).

## Non-negotiables

- The deterministic rule engine stays the authority: fills, cash, NAV, the 25% cap, next-open
  fills. `src/logic.js` behaviour and the Python parity test never change. A model may propose,
  explain and chat; it can never fill an order, bypass Risk, or change numbers.
- **No real orders, ever, in this plan.** Every broker is simulated/paper. Keep the label
  "Dữ liệu mô phỏng" for replay and show "Dữ liệu thật · lệnh mô phỏng" for live data.
- Two build targets from one source:
  - `standalone` (`dist/quant-fun.html`): works from `file://` offline with replay + canned
    agents. Network features are opt-in and degrade to replay when they fail.
  - `artifact` (`out/artifact/quant-fun.html` fragment): published with declared capabilities.
    Everything must still work when `claude.use(name)` resolves `null`.
- Every capability/network call is behind an adapter; the core never calls `fetch`,
  `window.claude` or an SDK directly.
- No secrets in the page, the repo, `localStorage` shared state, or URLs.
- Legends are costumes. Agents speak as their **role** (Quant Analyst, Trader, Risk Manager,
  Portfolio Manager). Prompts must not ask the model to imitate a real person's voice, opinions
  or catchphrases, and must not present text as a real person's words.
- Game copy stays Vietnamese. Not investment advice; keep the credit/disclaimer dialog.

## Target architecture

```
src/
  core/        logic.js (unchanged), session.js (state machine: steps, sequencing), bus.js
  ports/       types.js — JSDoc typedefs for the five interfaces below
  data/        replay.js, csv-import.js, rest-public.js, mcp-source.js
  strategy/    sma-cross.js (current), registry.js
  risk/        position-cap.js (current apply_limits), registry.js
  broker/      sim.js (current SimBroker)
  agents/      canned.js (current lines), sample.js (Claude via artifact), provider.js
  host/        claude-host.js (wraps claude.use: sample, mcp, db, downloads), null-host.js
  ui/          room/, chat/, chart/, title/, settings/
  api/         public.js (window.QuantFun)
build.py       --target standalone|artifact
mcp-server/    (phase 6) Node MCP server that drives a headless desk
```

Interfaces (keep them this small):

- `DataSource`: `{id, label, kind:'replay'|'history'|'live', symbols(), load({symbol, interval,
  limit}) -> Bar[], subscribe?(cb) -> unsubscribe}`. `Bar = {timestamp, open, high, low, close,
  volume}`; indicators (`fast`, `slow`, `signal`) are computed by the strategy, not the source.
- `Strategy`: `{id, label, params, warmup, annotate(bars) -> bars with signal fields,
  describe(bar) -> short facts for chat}`.
- `RiskRule`: `{id, label, check({side, allocation, nav, position}) -> {pass, reason, clamps}}`.
- `Broker`: `{cash(), position(), place(order) -> fill}` — sim only.
- `AgentBrain`: `{id, available(), speak({role, event, facts, history}) -> Promise<{text}>,
  chat({role, text, facts, tools}) -> Promise<{text, command?}>}`.

Event bus topics (also the public API's event names): `session:reset`, `bar`, `signal`,
`proposal`, `risk`, `decision`, `fill`, `book`, `chat:message`, `settings:change`.

Public API `window.QuantFun` (frozen object): `version`, `getState()` (serialisable snapshot),
`command(text)` (same parser as the chat composer, returns the result), `on(topic, fn)`,
`register({dataSource|strategy|riskRule|agentBrain})`, `export()` (session JSON).
This is the seam for future REST/WebSocket bridges and for the MCP server.

## Phases

### Phase 0 — Refactor into modules (no behaviour change)
Split `ui.js` along the tree above, introduce the bus, ports and `build.py --target`.
Acceptance: parity 12/12, smoke flows identical, both outputs within ±5% of current size,
zero network on standalone.

### Phase 1 — Data layer and real data
- `replay` (current 160 bars) stays the default and the offline fallback.
- `csv-import`: file input / drag-drop / paste of OHLCV CSV or JSON (columns auto-detected,
  timestamps in ms/s/ISO). Works in both targets.
- `rest-public` (standalone only; an Artifact's CSP blocks `fetch` to other hosts): public,
  key-less klines endpoints with CORS — implement Binance `GET /api/v3/klines` first, then one
  fallback exchange. History mode loads N bars then the player still steps candle by candle
  ("replay real history"); live mode appends closed candles by polling (no WebSocket yet).
  Timeouts, one retry, clear error line in chat, automatic fallback to replay.
- `mcp-source` (artifact only): reads candles through the viewer's connectors with the `mcp`
  capability (`watchTool` for display data). Ship one concrete mapping the owner already has:
  connector "YSVN MCP", tool `price_history` (Vietnamese equities, prices in VND, long-only fits)
  — read the tool's input schema in the session before coding, never guess argument names.
  A crypto connector can be mapped the same way later.
- Symbol/interval/source picker on the title screen ("NGUỒN DỮ LIỆU") and `/data` chat command.
  Currency and unit come from the source (USD/0.001 BTC vs VND/lot size) — move unit size and
  formatting out of constants into a `market` descriptor; logic.js math stays the same.
- Chart, HUD and cards show source + freshness ("cập nhật 14:05"), and the data label rule above.
Acceptance: unit tests for CSV parsing and the kline mapper with recorded fixtures (no live
network in tests); smoke: import a CSV fixture and complete Approve → fill; standalone with
network blocked falls back to replay with a visible notice; artifact build declares `mcp` only
with the exact tools used.

### Phase 2 — Strategy and risk plug-ins
- Registry + params UI in Settings (`/strategy`, `/risk`). Ship SMA cross (current), EMA cross
  and RSI threshold as examples; risk rules: position cap (current), max daily loss, cooldown
  after a loss. Rules chain; the Risk message lists each rule's pass/block and reason.
- A proposal blocked by any rule has no Approve button (existing invariant).
Acceptance: unit tests per strategy/rule; parity still green when SMA cross + position cap are
selected (default); smoke Block flow passes with a second rule enabled.

### Phase 3 — Claude agents through the Artifact (`sample`)
- `host/claude-host.js`: `const sample = await claude.use("sample")`; `null` → `canned` brain.
  Declare `capabilities: {sample: {}}` (and `mcp` from phase 1) on publish. First call only
  after a player action (consent prompt), never on load. Handle `not_granted` (hide, stay
  canned), `rate_limited` (back off, canned for that turn), never loop.
- `agents/sample.js`:
  - `speak`: one short Vietnamese line per event in the role's voice, from **facts only**
    (numbers passed in the prompt: SMA values, price, allocation, cap, NAV, fill). The rule
    engine's verdict is included in the facts; the model explains it, never decides it.
    Use `sample.json` with a strict shape `{text}`; max ~40 words; `modelTier:"quick"`.
  - `chat`: free-text Boss messages. Give the model page tools (`get_snapshot`, `get_bars(n)`,
    `get_book`, `explain_rule`) and let it return `{text, command?}` where `command` is one of
    the existing chat commands; the page shows it as a suggestion chip — the Boss must tap it.
    `@quant/@trader/@risk/@pm` routes to that role; default routing by topic.
  - Memoryless calls: send role card + rules of the desk + last ~8 chat turns + facts each time.
  - Role cards are about the job (what the role watches, how it reports), not about the legend.
  - Stream with `onText` into the chat bubble; "đang soạn…" indicator; abort on reset.
  - Settings: "Bộ não agent": Kịch bản (offline) | Claude. Budget guard: at most one model call
    per event, at most N (default 30) calls per session, counter visible in Settings.
- Canned brain remains complete, so standalone and denied-consent behave like v2.
Acceptance: tests run with a fake `sample` (deterministic stub injected through the host
adapter): lines appear, verdicts and numbers in chat always equal the rule engine's, a model
reply containing a different verdict/number is rejected and replaced by the canned line,
`null`/`not_granted`/`rate_limited` paths fall back, no model call on load.

### Phase 4 — Autonomy modes (still player-controlled)
- "Trợ lý Boss": optional auto-skip/auto-approve policies written by the player in plain rules
  (e.g. approve when allocation ≤ 20% and PnL ≥ 0) — evaluated by code, not by the model.
- Agent debate card: Quant, Risk and Portfolio each give one line before the Boss decides
  (three `speak` calls, budget-guarded).
- End-of-session review: Portfolio Manager summarises the session (one `sample` call with the
  fills and equity curve) + deterministic stats (win rate, max drawdown).
Acceptance: policy unit tests; smoke for one auto-approve run.

### Phase 5 — Persistence and sharing (artifact)
- `db` capability: per-viewer saved sessions and settings under `data/users/<id>/…`; optional
  shared leaderboard collection (`rules`: all read, each writes own row). `downloads`
  capability for "Tải phiên (.json/.csv)". Standalone uses `localStorage` + file export.
- Page works with an empty or unavailable db (designed empty state, 10 s loading timeout).
Acceptance: after first publish, list each collection once and check a lower access level
cannot read private rows.

### Phase 6 — Open API and MCP
- Document `window.QuantFun` in `docs/API.md` with examples for adding a data source, a
  strategy and an agent brain.
- `mcp-server/` (Node, stdio): runs the same core headless and exposes tools `get_state`,
  `command`, `load_data`, `list_strategies`, `export_session`, so Claude Code / Claude Desktop
  can play or test a desk. No broker credentials, no network by default.
- Optional bridges behind the ports, off by default: `agents/anthropic-api.js` (user-supplied
  key kept in memory only, standalone only), `data/ws.js` (exchange WebSocket), page-side `mcp`
  tools for other connectors. Paper-trading against an exchange testnet is out of scope until
  the owner asks; real orders are out of scope entirely.
Acceptance: MCP server integration test (spawn, call tools, compare with the page's logic on
the same commands); API examples run in the smoke test.

## Testing and delivery rules (every phase)

- Keep: `test/parity.*` (0 mismatches), `test/smoke.js` four flows (Approve → fill next candle,
  Skip → no fill, 50% → Block without Approve, Reset → initial), zero console errors, standalone
  makes no request unless a network source is selected.
- Add unit tests beside each new module (`node --test`), fixtures under `test/fixtures/`.
- Screenshots at 1440×900 and 400×860 for every UI change; look at them.
- Update `AGENTS.md` "State at handoff" and this file's checklist at the end of each phase.
- Publishing the artifact: same file path/URL as before; pass the full `capabilities` set each
  time it changes; tell the owner which capabilities are declared and what was exercised.

## Open questions for the owner (ask once, then proceed with the default)

1. First real market: BTC via public klines (default) or Vietnamese equities via the YSVN
   connector first?
2. Should Claude agents be on by default in the Artifact (default: off until the player turns
   them on in Settings, to save plan usage)?
3. Leaderboard shared with others, or private saves only (default: private)?
