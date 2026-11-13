# Quant Fun

Game văn phòng giao dịch isometric, giao diện tiếng Việt và dữ liệu BTC mô phỏng.
Mở **`dist/quant-fun.html`** bằng trình duyệt để chơi; bản này tự chứa toàn bộ
ảnh, font, CSS, JavaScript và dữ liệu, không cần máy chủ hay kết nối mạng.

## Cài môi trường phát triển trên Windows

Cần Python 3.10+ và Node.js. Chạy trong thư mục gốc của repo:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm.cmd install
.\node_modules\.bin\playwright.cmd install chromium
npm.cmd run build
```

`npm run build` tự chọn Python trong `.venv` nếu có. Trên macOS/Linux, dùng
`.venv/bin/python` cho bước pip và `npm` thay cho `npm.cmd`.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `src/` | Giao diện, logic giao dịch, bộ tìm đường |
| `tools/room-layout.json` | Sàn, footprint chân đồ vật, bàn và vị trí tương tác |
| `tools/gen_navigation.py` | Sinh vùng sàn, điểm đứng và ảnh kiểm tra |
| `assets/navigation.json` | Dữ liệu đường đi được tạo khi build |
| `dist/quant-fun.html` | Bản độc lập để mở hoặc chia sẻ |
| `out/download/quant-fun.html` | Bản độc lập dùng khi kiểm thử |
| `out/artifact/quant-fun.html` | Fragment cho Artifact host |
| `test/` | Kiểm thử giao diện, hoạt cảnh và so sánh logic |
| `gen/`, `shots/` | Ảnh, báo cáo và log kiểm tra ở máy, không đưa vào Git |

## Kiểm thử

```powershell
npm.cmd test
npm.cmd run test:navigation
npm.cmd run test:all
```

`test:navigation` kiểm tra hình học của toàn bộ đồ thị và mọi điểm đến, chụp
5 trạm ở trạng thái làm việc/nghỉ, rồi chạy 120 giây với `QF_AMBIENT` và tốc độ
Nhanh. Mỗi 100 ms kiểm tra chân cả 5 người nằm trên sàn đi được, ngoài footprint
đồ vật, và cách nhau ít nhất 0,8 ô. Một ô tương ứng 32 pixel trên ảnh phòng gốc;
khoảng cách tính trong không gian pixel, có tính tỷ lệ rộng/cao của ảnh.

Log từng bộ test nằm trong `gen/test-*.log`. Báo cáo soak nằm ở
`shots/navigation-soak.json`; ảnh kiểm tra sàn ở `gen/navigation-overlay.png`.

### So sánh với Python gốc

```powershell
$env:QF_REFERENCE_ROOT = 'C:\path\to\quant-fun\ai-hedge-fund'
npm.cmd run test:parity
```

`QF_REFERENCE_ROOT` trỏ đến thư mục chứa package `hedge_fund` của repo gốc
`phucngt/quant-fun`. Nếu không đặt biến này, test tìm trong `.python-deps/`.
Các module Python gốc dùng để đối chiếu không được đóng gói vào game.
Lần xác minh cho thay đổi đường đi dùng commit gốc
`a9a94058daaf4bb036ef288bc1c3a3e2b6410c0d`: 12 kịch bản, 1.107 bước, 0 sai khác.

Xem `AGENTS.md` để biết các quy tắc phải giữ và `TODO-NEXT.md` cho phần còn lại.
