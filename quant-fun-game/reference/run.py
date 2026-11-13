"""Serve the local replay desk using the upstream simulated broker."""
import argparse
import json
import math
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "ai-hedge-fund"))

from hedge_fund.brokers.costs import TradingCosts
from hedge_fund.brokers.models import Order
from hedge_fund.brokers.sim import SimBroker
from hedge_fund.risk.limits import RiskLimits, apply_limits

TICKER = "BTC"
UNITS_PER_BTC = 1000
CAPITAL = 100_000
POSITION_CAP = 0.25
WARMUP = 29


class Desk:
    def __init__(self, bars):
        self.bars = bars
        self.reset()

    def reset(self):
        self.broker = SimBroker(CAPITAL, TradingCosts(spread_bps=5, commission_per_share=0))
        self.index = WARMUP
        self.armed = False
        self.allocation = 20
        self.proposal = None
        self.pending = None
        self.fills = []
        self.log = []
        self.note("boss", "Giao Quant Analyst theo dõi SMA 10/30, rồi bấm Next Candle.")

    def note(self, role, text):
        self.log.append({"role": role, "text": text})

    @property
    def quantity(self):
        position = self.broker.positions().get(TICKER)
        return position.shares if position else 0

    def nav(self, mark):
        return self.broker.cash() + self.quantity * mark / UNITS_PER_BTC

    def order_quantity(self, side, mark, allocation):
        if side == "sell":
            return self.quantity
        return math.floor(self.nav(mark) * allocation / 100 / mark * UNITS_PER_BTC)

    def action(self, action, data):
        if action == "reset":
            self.reset()
        elif action == "assign":
            if self.armed:
                raise ValueError("Quant Analyst đang theo dõi.")
            self.armed = True
            self.note("boss", "Theo dõi BTC 5m và báo tao khi SMA 10 cắt SMA 30.")
            self.note("quant", "Đã nhận việc. Tao sẽ báo khi nến xác nhận giao cắt.")
        elif action == "allocation":
            value = data.get("value")
            if type(value) is not int or not 1 <= value <= 100:
                raise ValueError("Vốn phân bổ phải từ 1% đến 100%.")
            self.allocation = value
        elif action in ("approve", "skip"):
            if self.proposal is None:
                raise ValueError("Không có đề xuất đang chờ duyệt.")
            if action == "approve":
                self.pending = self.proposal
                self.note("boss", "Approve. Khớp mô phỏng tại giá mở cửa nến kế tiếp.")
            else:
                self.note("boss", "Skip đề xuất này.")
            self.proposal = None
        elif action == "next":
            self.next_bar()
        else:
            raise ValueError("Thao tác không hợp lệ.")

    def next_bar(self):
        if self.proposal or self.index >= len(self.bars) - 1:
            raise ValueError("Xử lý đề xuất hoặc reset phiên trước khi đi tiếp.")
        self.index += 1
        bar = self.bars[self.index]
        if self.pending:
            self.fill(bar)
        signal = bar["signal"]
        if not self.armed or self.index == len(self.bars) - 1:
            return
        if (signal == "buy" and self.quantity == 0) or (signal == "sell" and self.quantity > 0):
            self.propose(signal, bar["close"])

    def propose(self, side, mark):
        self.note("quant", f"SMA 10 cắt {'lên' if side == 'buy' else 'xuống'} SMA 30.")
        self.note("trader", f"Đề xuất {'mở' if side == 'buy' else 'đóng'} vị thế BTC.")
        blocked = False
        if side == "buy":
            allocation = self.allocation / 100
            result = apply_limits({TICKER: allocation}, RiskLimits(
                max_position_pct=POSITION_CAP, max_gross_exposure=1,
            ))
            blocked = bool(result.clamps)
        self.note("risk", "Block. Tỷ trọng vượt giới hạn 25% NAV." if blocked else
                  "Pass. Đề xuất nằm trong giới hạn rủi ro.")
        if not blocked:
            self.proposal = {"side": side, "mark": mark, "allocation": self.allocation}
            return
        self.log[-1]["blocked"] = True

    def fill(self, bar):
        proposal, self.pending = self.pending, None
        side, mark = proposal["side"], bar["open"]
        quantity = self.order_quantity(side, mark, proposal["allocation"])
        if not quantity:
            self.note("trader", "Bỏ qua. Khối lượng nhỏ hơn 0,001 BTC.")
            return
        fill = self.broker.place_order(Order(
            ticker=TICKER, side=side, quantity=quantity, price=mark / UNITS_PER_BTC,
        ))
        self.fills.append({"side": side, "quantity": fill.quantity / UNITS_PER_BTC,
                           "price": fill.price * UNITS_PER_BTC, "timestamp": bar["timestamp"]})
        self.note("trader", f"Khớp mô phỏng {quantity / UNITS_PER_BTC:.3f} BTC.")
        self.note("portfolio", "Đã cập nhật cash, exposure và NAV.")

    def snapshot(self):
        bar = self.bars[self.index]
        nav = self.nav(bar["close"])
        return {
            "bars": self.bars[max(0, self.index - 47):self.index + 1],
            "index": self.index, "count": len(self.bars), "cash": self.broker.cash(),
            "nav": nav, "pnl": nav - CAPITAL, "quantity": self.quantity / UNITS_PER_BTC,
            "exposure": self.quantity / UNITS_PER_BTC * bar["close"] / nav,
            "allocation": self.allocation, "armed": self.armed,
            "proposal": self.proposal, "pending": self.pending, "log": self.log, "fills": self.fills,
        }


STATIC = {"/": ("index.html", "text/html; charset=utf-8"),
          "/app.js": ("app.js", "text/javascript; charset=utf-8"),
          "/style.css": ("style.css", "text/css; charset=utf-8")}
STATIC.update({f"/assets/{p.name}": (f"assets/{p.name}", "image/png")
               for p in (ROOT / "assets").glob("*.png")})


class Handler(BaseHTTPRequestHandler):
    def send_data(self, status, data, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy",
                         "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                         "img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data)

    def json(self, data, status=200):
        self.send_data(status, json.dumps(data, allow_nan=False).encode(), "application/json")

    def allowed_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def do_GET(self):
        if not self.allowed_host():
            return self.json({"error": "Local access only."}, 403)
        path = urlsplit(self.path).path
        if path == "/state":
            return self.json(self.server.desk.snapshot())
        if path not in STATIC:
            return self.json({"error": "Not found."}, 404)
        filename, mime = STATIC[path]
        self.send_data(200, (ROOT / filename).read_bytes(), mime)

    def do_POST(self):
        origin = self.headers.get("Origin")
        if (not self.allowed_host() or origin != f"http://{self.headers.get('Host')}"
                or self.path != "/action"):
            return self.json({"error": "Local desk only."}, 403)
        if self.headers.get_content_type() != "application/json":
            return self.json({"error": "Expected JSON."}, 415)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 1024:
                raise ValueError("Invalid request size.")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Invalid request.")
            self.server.desk.action(data.get("action"), data)
        except (ValueError, UnicodeError) as error:
            return self.json({"error": str(error)}, 400)
        return self.json(self.server.desk.snapshot())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    bars = json.loads(subprocess.check_output(
        ["node", str(ROOT / "replay-data.mjs")], text=True,
        env={key: os.environ[key] for key in ("PATH", "SystemRoot") if key in os.environ},
    ))
    with HTTPServer(("127.0.0.1", args.port), Handler) as server:
        server.desk = Desk(bars)
        print(f"Quant Fun: http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
