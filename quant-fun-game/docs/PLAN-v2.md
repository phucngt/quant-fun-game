# Quant Fun v2 — Saltline-style shell + chat-only UX (delta on the current sample)

The user played the sample and wants a different shape, modelled on the "Saltline" browser game
(loading screen → title screen → game, all in one full-viewport artifact) and on the Pixel Agents
screenshot (isometric room on the left, Slack-style chat on the right). Inside the game **the only
UI is the chat panel**: the player IS the Boss character, with a custom name, and runs the desk by
chatting. Keep everything in PLAN.md that this file does not change: game rules (`logic.js`
untouched), assets, sprite facing, room positions, walking, tags, bubbles, credits, the two output
files, zero network, Vietnamese copy, repo log lines verbatim.

Reuse the existing code (build.py, room/actor/walk code, chart drawing, Desk wiring, tests).
Remove the old right column (chart card, "Bàn Boss" card, tabs), the mission bar under the room
and the top bar. Their functions move into the screens below.

## 1. App shape

`html, body { height:100% }`, no page scroll on desktop. One root with three screens, only one
visible at a time: `#boot`, `#title`, `#game`. Same dark token palette as now. Display font stays
VT323 (the only embedded face) — use it very large on boot/title, letter-spaced uppercase for
labels, like Saltline's condensed headline. Body text system-ui.

## 2. Boot screen `#boot`

Flat `--bg` ground, centred block:
- "QUANT FUN" in VT323, `font-size: clamp(64px, 12vw, 180px)`, `--ink`, tight letter-spacing.
- Under it, letter-spaced small caps line "XẾP BÀN GIAO DỊCH" in `--muted`.
- A thin 2px track (~280px wide) with an amber (`--accent`) fill = real progress: decode the room,
  the 3 desk images and the sprites the default team needs with `img.decode()` (count done/total).
  Show at least ~900ms, then fade (200ms) to the title. Under reduced motion: no fade.
- Text visible at rest (no opacity-0 start).

## 3. Title screen `#title`

Full-bleed background = the room image, `object-fit: cover`, with a flat dark overlay
(`rgba(10,12,24,.72)`) so the text reads. Content left-aligned in the lower-left two thirds,
like Saltline (side gutter ≥ 16px with the safe-area `max()` padding):
- Kicker row: small amber-bordered chip "BTC" + letter-spaced
  "TRADING DESK · {deskName} · 02:25 UTC" (time = first session bar).
- Giant "QUANT FUN" (VT323, `clamp(72px, 14vw, 220px)`), then a short amber rule (~64px × 3px).
- Mission sentence (body font, ~20px, `--ink`): "Đội desk chờ lệnh của bạn. Bắt giao cắt SMA 10/30,
  duyệt lệnh và kết phiên với NAV trên $100.000."
- **Bạn là Boss**: label "TÊN CỦA BẠN" + text input `#boss-name` (maxlength 18, default from
  settings or "Boss") + a compact Boss legend picker: current portrait (head crop of
  `front-right`) with ◀ ▶ buttons cycling the 21 legends, legend name under it.
- Buttons row: `#deploy` "VÀO PHÒNG" (amber fill, dark text, big), `#title-settings` "CÀI ĐẶT",
  `#title-help` "CÁCH CHƠI" (outlined). Square, letter-spaced, ≥ 48px tall.
- Two segmented controls (Saltline's MODE/DIFFICULTY rows), labels letter-spaced:
  - "CHẾ ĐỘ": `Có hướng dẫn` (default) | `Tự do` — guided mode posts coach messages in chat.
  - "NHỊP": `Thường` (default) | `Nhanh` — animation speed ×1 / ×2.5.
- Small note under them: "Dữ liệu mô phỏng. Mọi hình, dữ liệu và logic chạy ngay trong trình
  duyệt, không tải gì từ mạng."
- Bottom-right key legend (keycaps like Saltline): `N` NẾN KẾ · `A` APPROVE · `S` SKIP ·
  `/` GÕ LỆNH · `ESC` TẠM DỪNG. Hide on narrow screens.
- Small "Credit" text button bottom-left.
- `#title-help` opens a dialog "Cách chơi": the 6-step loop in one short list and the chat
  commands table (section 5).
- Enter in the name field = VÀO PHÒNG. VÀO PHÒNG saves settings and shows `#game`; the session
  itself is NOT reset by going back and forth (only Reset/Chơi lại resets).

## 4. Game screen `#game`

Desktop (≥ 900px): grid `minmax(0,1fr) clamp(340px, 30vw, 440px)`, full height.

**Left: stage.** Room centred and aspect-fitted (keep the current container-query sizing) on the
backdrop colour. Overlays on the stage, Saltline-HUD style (small, letter-spaced, square plates):
- Top-left **objective tracker**: "MỤC TIÊU · NAV cuối phiên > $100.000" then the current step as
  one line, e.g. "2/6 · Chạy nến tới khi SMA 10 cắt SMA 30", and a thin candle progress bar with
  "Nến 43/160 · 03:30 UTC". Steps as in PLAN.md section 6 (Giao việc, Chạy nến, Quant báo giao cắt,
  Risk Pass/Block, Boss quyết, Khớp nến sau).
- Top-right **HUD**: NAV, PnL (signed, ▲/▼), Cash, Exposure in one row of small tiles, plus the
  "Dữ liệu mô phỏng" chip, plus a `≡` button `#menu` (aria-label "Tạm dừng") that opens the pause
  menu: Tiếp tục · Cài đặt · Chơi lại · Về màn hình chính · Credit.
- Room content as now (desks, 5 actors, tags, bubbles, walking). The Boss tag shows the custom
  name + "BẠN". **Fix:** while the Trader stands at the Boss's desk, place his bubble to the
  right of the Trader (anchor at the bubble's left edge) so it never covers the Boss's tag;
  generally keep every bubble inside the room box.

**Right: chat panel `#chat`** (Pixel Agents / Slack look, dark, square):
- Header: "# {deskName lowercased with dashes, e.g. #quant-fun-desk}" + 5 presence dots with
  the role colours + a toggle "Chart BTC ▾/▸".
- **Pinned chart** under the header (collapsible, open by default; ~170px desktop, ~120px phone):
  the existing chart drawing (48-bar window, SMA 10/30, fill markers, last-price tag) with a
  one-line legend. Canvas keeps id `chart`.
- **Message list** `#messages` (`role="log"`, `aria-live="polite"`), auto-scrolls to newest unless
  the player scrolled up (then show a "Tin mới ↓" pill).
- **Quick replies** `#chips`: 2–4 buttons that change with state; first is the primary
  (amber). Each chip just sends its command (so it shows up as the Boss's message).
- **Composer**: `<form id="composer">` with `<input id="chat-input">` placeholder
  "Nhắn #… · gõ /help" and a send button. Enter sends, ↑ recalls the previous command,
  `/` anywhere (not in an input) focuses it.

Phone (< 900px): column — stage on top taking `flex: 0 0 auto` with the room at full width
(HUD shrinks to NAV + PnL + menu; objective tracker shrinks to the step line), chat below filling
the rest (`flex:1; min-height:0`), composer stays at the bottom of the screen (respect the
bottom safe-area inset). Chart collapsed by default on phone. Tags/bubbles get a slightly larger
minimum size (`clamp(9px, 2.2cqw, 15px)`) and bubbles max-width 46cqw so they stay readable.

## 5. Chat model

Message shape: avatar (28–32px head crop of the seat's legend, `front-right` sprite,
`object-fit: cover; object-position: 50% 8%`), display name (role colour), role label, time
(= current replay bar `HH:MM`), body. Consecutive messages from the same author within one candle
group under one header. The Boss's own messages show the custom name + "BẠN" badge. System
lines (centred, muted, small) have no avatar.

**Desk log → chat.** Every new `desk.log` entry becomes a message from that role, text verbatim,
in order, with the same visual sequencing as now (Quant → Trader walks → on arrival Trader message
+ room bubble → Risk). Boss entries (kinds `brief, assign, approve, skip`) are the player's own
messages. Enrich with cards (rendered under the message text):
- `cross` (Quant): small mono line "SMA 10 {fast} · SMA 30 {slow} · Close {close}".
- `propose` (Trader) → **proposal card**: side (Mua / Đóng vị thế), giá tham chiếu, phân bổ % NAV
  (buy) or "Bán hết {qty} BTC" (sell), "Khớp dự kiến: giá mở nến kế + 5 bps".
- `pass` / `block` (Risk) → **decision card** attached to the Risk message: PASS ✓ / BLOCK ✕
  badge + reason (same reason texts as now). PASS: buttons `Approve` (amber, `data-cmd="/approve"`)
  and `Skip`. BLOCK: **no Approve button anywhere**, line "Không duyệt được. Gõ /alloc 25 rồi chờ
  tín hiệu kế." Once decided (approve/skip/next/reset), the card's buttons are removed and the
  card shows "Đã duyệt" / "Đã bỏ qua".
- `fill` (Trader) + `book` (Portfolio) → **book card** on the Portfolio message: NAV, PnL, Cash,
  Exposure after the fill and the fill row (UTC, Mua/Bán, BTC, giá khớp, giá trị).
- `nofill`: plain message.

**Candles.** Next Candle with no new log entries does not post a message per candle: it updates
one system line in place, "Đã chạy tới nến 41/160 · 03:20 UTC", starting a new such line after
any other message.

**Commands** (case-insensitive, Vietnamese without diacritics accepted too; chips send the same):

| typed                                               | action                                      | Boss message shown          |
|-----------------------------------------------------|---------------------------------------------|-----------------------------|
| `/giao`, `giao viec`, `giao việc`                   | `assign`                                    | the repo log lines          |
| `/next`, `n`, `next`, `nến`, `nen`                  | `next`                                      | none (candle system line)   |
| `/next 10`                                          | up to 10 nexts, stop at any new log entry    | "Chạy 10 nến."              |
| `/run`, `tua`                                       | nexts until a proposal/block/end (existing run loop, ~110ms/candle, ×speed) | "Tua tới tín hiệu." |
| `/approve`, `approve`, `duyệt`, `duyet`, `ok`, `a`  | `approve`                                   | repo log line               |
| `/skip`, `skip`, `bỏ`, `bo`, `s`                    | `skip`                                      | repo log line               |
| `/alloc 50`, `phân bổ 50`, `phan bo 50`, `50%`      | `allocation` {value}                        | "Phân bổ 50% cho SMA 10/30." then system "Đã áp dụng phân bổ 50%. Hạn mức vẫn là 25% NAV." |
| `/book`, `sổ`, `so lenh`                            | Portfolio posts a book card (all fills + current NAV/PnL/Cash/Exposure) | the typed text |
| `/status`                                           | Portfolio posts NAV/PnL/Cash/Exposure + position | the typed text           |
| `/reset`, `chơi lại`, `choi lai`                    | system confirm card [Chơi lại] [Hủy] (never `confirm()`); Chơi lại → `reset` | the typed text |
| `/name Phúc`                                        | rename the Boss (saved)                     | system "Tên mới: Phúc."     |
| `/help`, `?`                                        | system help card with this table (short)    | the typed text              |

Errors from `desk.action` (e.g. "Không có đề xuất đang chờ duyệt.", "Vốn phân bổ phải từ 1% đến
100%.") appear as a system line in `--block` colour. Unknown text: the Boss message is posted;
in guided mode the most relevant teammate answers with the current coach sentence (the same
next-action text as the current coach line, phrased by that role, e.g. Quant: "Tao đang theo dõi
SMA 10/30. Gõ /next để chạy nến."); in free mode a system line "Không hiểu lệnh. Gõ /help.".
`@quant`, `@trader`, `@risk`, `@pm` at the start route that unknown-text reply to that role.
No free-form AI replies: everything is offline and canned.

**Guided mode** additionally posts, as coach messages from the relevant role, the next-action
sentence when the step changes (once per change, not per candle). First message after VÀO PHÒNG:
the repo brief line from the Boss (already in the log) and then Quant: "Chào {bossName}. Gõ /giao
hoặc bấm Giao việc cho Quant để bắt đầu."

**Chips by state:** not armed → [Giao việc cho Quant] [/help]; armed, idle → [Next Candle]
[Tua tới tín hiệu] [/alloc …]* ; proposal waiting → [Approve] [Skip]; blocked → [/alloc 25]
[Next Candle]; pending order → [Next Candle · khớp lệnh]; end of session → [Chơi lại] [/book].
(*`/alloc …` chip fills the composer with "/alloc " and focuses it instead of sending.)
While a visual sequence is playing, chips are disabled.

**Keys** (ignored when typing in an input or when a dialog is open): `N` next, `A` approve,
`S` skip, `/` focus composer, `Esc` pause menu.

**End of session:** Portfolio posts a result card (NAV cuối, PnL, số lệnh khớp, "Đạt mục tiêu" /
"Chưa đạt mục tiêu") and the objective tracker shows the result.

## 6. Settings

One dialog used from the title and the pause menu: Tên Boss, legend Boss, legend + name for each
of the 4 roles (select + portrait preview is fine; swap rule as now), Tên bàn giao dịch, Chế độ,
Nhịp, Hoạt cảnh on/off, "Về đội mặc định". Persist in `localStorage` key `quantfun.settings.v1`
inside try/catch (game works if storage throws). Reset / Chơi lại never clears settings.
Changing a name or legend updates room, chat avatars/names (also on past messages) immediately.

## 7. Tests and screenshots (update `test/smoke.js`, keep parity test as is)

Drive everything through the UI on `out/download/quant-fun.html` (`file://`, `QF_FAST` via
`addInitScript`; QF_FAST also skips the boot minimum). Fail on console/page errors or any
non-`file:`/`data:` request.
- Boot → title → type name "Phúc", pick another Boss legend, VÀO PHÒNG → Boss tag in the room
  and the Boss's chat messages show "Phúc".
- **Approve → fill next candle**: type `/giao`, then `/next` ×13 (typed) → decision card PASS with
  an Approve button; 0 fills, cash $100,000.00; click Approve in the card → still 0 fills; type
  `n` → Portfolio book card with 1 fill at bar 43 open × 1.0005, qty 0.299, cash $79,996.10.
- **Skip → no fill**: `/reset` → Chơi lại; `/giao`; `/run`; chip Skip; `/next 3` → 0 fills, NAV
  $100,000.00.
- **50% → Block**: Chơi lại; `/alloc 50`; `/giao`; `/run` → decision card BLOCK, no element with
  text "Approve" visible anywhere, chips are [/alloc 25] [Next Candle]; two more candles → 0 fills.
- **Reset → initial**: after a fill, `/reset` → Chơi lại → nến 30/160, NAV/Cash $100,000.00, PnL
  $0.00, exposure 0.00%, allocation 20, 0 fills, chat cleared to the opening lines, Trader home,
  settings (name "Phúc") kept.
- Keys N/A/S work; `/help` posts the help card; unknown text gets a coach reply in guided mode.
- Real-time (no QF_FAST) walk check as before (rear-left then front-left, bubble after arrival,
  bubble does not overlap the Boss tag's bounding box).
- Screenshots to `B/shots/v2-*.png`, look at each and fix real problems: boot (1440×900),
  title (1440×900 and 400×860), game with the Trader at the Boss's desk and the decision card
  visible (1440×900), game after a fill, game at 400×860, settings open. Also one 1440×900 shot of
  the artifact fragment in a bare shell.

Report as before: paths and sizes, each flow with observed numbers, deviations, screenshot paths.
