# Phuc Nguyen — Boss của Quant Fun

Bốn cột theo thứ tự front-left, front-right, rear-left, rear-right.
Mỗi ô 96 × 112 px. Điểm neo chân là (48, 107) tính từ góc trên trái.
SPRITE-MAP.json dùng chỉ số hàng và frame bắt đầu từ 0.

| Hàng trên ảnh | Action | Frame |
|---|---|---|
| 1 | `idle` | 0 |
| 2 | `walk` | 0 |
| 3 | `walk` | 1 |
| 4 | `walk` | 2 |
| 5 | `walk` | 3 |
| 6 | `type-sitting` | 0 |
| 7 | `type-sitting` | 1 |
| 8 | `type-standing` | 0 |
| 9 | `type-standing` | 1 |
| 10 | `coffee` | 0 |
| 11 | `water` | 0 |
| 12 | `open-notebook` | 0 |
| 13 | `check-phone` | 0 |
| 14 | `read-book` | 0 |
| 15 | `take-notes` | 0 |

Walk chạy 4 frame. Ngồi gõ và đứng gõ mỗi tư thế chạy 2 frame theo hướng.
Các động tác cầm đồ có một pose theo mỗi hướng, có thể phát idle → pose → idle.
Bộ này chỉ chứa sprite nhân vật, ghế và bàn là layer của game.
