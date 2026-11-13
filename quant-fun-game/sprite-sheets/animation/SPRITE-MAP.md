# Quant Fun — Sprite hành động

Mỗi sheet PNG có bốn cột, lần lượt front-left, front-right, rear-left, rear-right.
Mỗi ô 96 × 112 px. Điểm neo chân là (48, 107), tính từ góc trên trái của ô.
SPRITE-MAP.json dùng chỉ số hàng và frame bắt đầu từ 0.

| Action | Frame mỗi hướng |
|---|---|
| walk | 4 |
| type-sitting | 2 |
| type-standing | 2 |
| coffee | 1 |
| water | 1 |
| open-notebook, check-phone | 1 mỗi động tác, cho nhóm trẻ |
| read-book, take-notes | 1 mỗi động tác, cho nhóm kỳ cựu |

Mỗi persona có 12 hàng liên tiếp. Chạy walk, type-sitting và type-standing theo thứ tự frame. Có thể phát động tác một pose theo nhịp idle → pose → idle.
Dùng bộ idle hiện có để đứng yên. Độ cao mặt bàn hoặc điểm neo hông khi ngồi cần khớp với đồ vật trong game.

## animation-01.png

- Hàng 1–12 · Arthur Hayes
- Hàng 13–24 · Jim Simons
- Hàng 25–36 · Cathie Wood
- Hàng 37–48 · Warren Buffett

## animation-02.png

- Hàng 1–12 · George Soros
- Hàng 13–24 · Stanley Druckenmiller
- Hàng 25–36 · Paul Tudor Jones
- Hàng 37–48 · Ray Dalio

## animation-03.png

- Hàng 1–12 · Ed Thorp
- Hàng 13–24 · Jesse Livermore
- Hàng 25–36 · Michael Saylor
- Hàng 37–48 · Raoul Pal

## animation-04.png

- Hàng 1–12 · PlanB
- Hàng 13–24 · Willy Woo
- Hàng 25–36 · CZ

## animation-05.png

- Hàng 1–12 · GCR
- Hàng 13–24 · Cobie
- Hàng 25–36 · Ansem

## animation-06.png

- Hàng 1–12 · Hsaka
- Hàng 13–24 · Tetranode
- Hàng 25–36 · Gwyneth Chen
