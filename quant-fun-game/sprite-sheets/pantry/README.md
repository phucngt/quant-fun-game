# Quant Fun — Pantry sprites

10 PNG nền trong suốt, vẽ theo góc nhìn của tủ bên phải trong ảnh tham chiếu. Các vật dụng là từng lớp riêng, có thể đặt lên trên mặt tủ có sẵn.

- `espresso-idle.png` và `espresso-brewing.png` là hai trạng thái của cùng một máy. Dùng cùng vị trí và kích thước khi chuyển qua lại.
- `coffee-beans.png` và `mug-tray.png` là hũ và túi hạt cà phê, khay cốc.
- `water-pitcher.png` là bình nước và ly.
- `fruit-tray.png` và `pastry-plate.png` là đồ ăn nhẹ.
- `microwave.png` là lò vi sóng.

`pantry-sprites.json` ghi kích thước PNG, điểm neo gần đáy của từng sprite và chiều rộng hiển thị gợi ý nếu khung phòng rộng 737 px. Khi dùng, đặt điểm neo lên mặt tủ, giữ tỷ lệ ảnh và scale theo chiều rộng phòng. Bắt đầu bằng máy cà phê, khay cốc và một đĩa đồ ăn để có khoảng trống trên mặt tủ. Bình nước có thể đặt cạnh máy nước hiện có. Máy pha có thể đổi sang trạng thái brewing trong lúc pha, rồi đổi lại idle khi nhân vật lấy cốc.

## Máy in trên đầu tủ

Đặt máy in ở đầu bên phải của tủ. Dùng chung một điểm neo cho `printer-idle.png` và `printer-printing.png`. Khi Jim đi tới lấy bản in, chuyển sang `printer-printing`. Khi giấy được lấy, chuyển về `printer-idle`. Chiều rộng gợi ý 40 px ở kích thước phòng 737 px.
