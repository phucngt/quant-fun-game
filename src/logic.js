/* Quant Fun replay logic: a JavaScript port of pixel-agents/run.py (Desk) with the
   pieces it uses from AI Hedge Fund: TradingCosts, SimBroker and apply_limits.
   No DOM in this block. */
const QuantLogic = (() => {
  const TICKER = 'BTC';
  const UNITS_PER_BTC = 1000;      // one simulated unit is 0.001 BTC
  const CAPITAL = 100000;
  const POSITION_CAP = 0.25;       // max |weight| per ticker, share of NAV
  const WARMUP = 29;               // first bar with an SMA 30 value
  const SPREAD_BPS = 5;            // half-spread paid on every side
  const WINDOW = 48;

  // hedge_fund/brokers/costs.py
  class TradingCosts {
    constructor({ spreadBps = 5, commissionPerShare = 0.005, impactCoefficient = 1 } = {}) {
      this.spreadBps = spreadBps;
      this.commissionPerShare = commissionPerShare;
      this.impactCoefficient = impactCoefficient;
    }
    fillPrice(side, mark, participation = 0, volatility = 0) {
      const cost = this.spreadBps / 10000 + this.impact(participation, volatility);
      return side === 'buy' ? mark * (1 + cost) : mark * (1 - cost);
    }
    impact(participation, volatility) {
      return this.impactCoefficient * volatility * Math.sqrt(participation);
    }
    commission(quantity) {
      return quantity * this.commissionPerShare;
    }
  }

  // hedge_fund/brokers/sim.py
  class SimBroker {
    constructor(cash, costs = null) {
      this._cash = cash;
      this._costs = costs;
      this._shares = {};
    }
    positions() {
      const out = {};
      for (const [ticker, shares] of Object.entries(this._shares)) {
        if (shares !== 0) out[ticker] = { ticker, shares };
      }
      return out;
    }
    cash() {
      return this._cash;
    }
    placeOrder(order) {
      if (!Number.isFinite(order.price) || order.price <= 0) {
        throw new Error('cannot fill ' + order.ticker + ' at price ' + order.price);
      }
      if (!Number.isInteger(order.quantity) || order.quantity <= 0) {
        throw new Error('order quantity must be a positive integer');
      }
      // Orders here carry no ADV or volatility, so participation and impact are zero.
      const price = this._costs === null ? order.price
        : this._costs.fillPrice(order.side, order.price, 0, 0);
      const commission = this._costs === null ? 0 : this._costs.commission(order.quantity);
      if (order.side === 'buy') {
        this._shares[order.ticker] = (this._shares[order.ticker] || 0) + order.quantity;
        this._cash -= order.quantity * price + commission;
      } else {
        this._shares[order.ticker] = (this._shares[order.ticker] || 0) - order.quantity;
        this._cash += order.quantity * price - commission;
      }
      if (this._shares[order.ticker] === 0) delete this._shares[order.ticker];
      return { ticker: order.ticker, side: order.side, quantity: order.quantity, price };
    }
  }

  // hedge_fund/risk/limits.py: the two stages the desk configures
  // (per-name cap, then gross cap). Clamps only shrink.
  function applyLimits(weights, limits) {
    const cap = limits.maxPositionPct;
    if (!Number.isFinite(cap) || !Number.isFinite(limits.maxGrossExposure)) {
      throw new Error('risk limits must be finite');
    }
    if (!(cap > 0 && cap <= 1) || limits.maxGrossExposure <= 0) {
      throw new Error('risk limits must be positive, with max_position_pct at most 1');
    }
    let clamped = {};
    const clamps = [];
    for (const ticker of Object.keys(weights).sort()) {
      const w = weights[ticker];
      if (!Number.isFinite(w)) throw new Error(ticker + ': target weight must be finite');
      if (Math.abs(w) > cap) {
        const after = w > 0 ? cap : -cap;
        clamps.push({ limit: 'max_position_pct', ticker, before: w, after });
        clamped[ticker] = after;
      } else {
        clamped[ticker] = w;
      }
    }
    const gross = Object.values(clamped).reduce((sum, w) => sum + Math.abs(w), 0);
    if (gross > limits.maxGrossExposure) {
      const scale = limits.maxGrossExposure / gross;
      clamped = Object.fromEntries(Object.entries(clamped).map(([t, w]) => [t, w * scale]));
      clamps.push({ limit: 'max_gross_exposure', before: gross, after: limits.maxGrossExposure });
    }
    return { weights: clamped, clamps };
  }

  // pixel-agents/run.py
  class Desk {
    constructor(bars) {
      this.bars = bars;
      this.reset();
    }
    reset() {
      this.broker = new SimBroker(CAPITAL, new TradingCosts({ spreadBps: SPREAD_BPS, commissionPerShare: 0 }));
      this.index = WARMUP;
      this.armed = false;
      this.allocation = 20;
      this.proposal = null;
      this.pending = null;
      this.blocked = null;        // display only: the last proposal Risk blocked
      this.fills = [];
      this.log = [];
      this.note('boss', 'Giao Quant Analyst theo dõi SMA 10/30, rồi bấm Next Candle.', 'brief');
    }
    note(role, text, kind) {
      this.log.push({ role, text, kind, index: this.index });
    }
    get quantity() {
      const position = this.broker.positions()[TICKER];
      return position ? position.shares : 0;
    }
    nav(mark) {
      return this.broker.cash() + this.quantity * mark / UNITS_PER_BTC;
    }
    orderQuantity(side, mark, allocation) {
      if (side === 'sell') return this.quantity;
      return Math.floor(this.nav(mark) * allocation / 100 / mark * UNITS_PER_BTC);
    }
    action(action, data = {}) {
      if (action === 'reset') {
        this.reset();
      } else if (action === 'assign') {
        if (this.armed) throw new Error('Quant Analyst đang theo dõi.');
        this.armed = true;
        this.note('boss', 'Theo dõi BTC 5m và báo tao khi SMA 10 cắt SMA 30.', 'assign');
        this.note('quant', 'Đã nhận việc. Tao sẽ báo khi nến xác nhận giao cắt.', 'ack');
      } else if (action === 'allocation') {
        const value = data.value;
        if (!Number.isInteger(value) || value < 1 || value > 100) {
          throw new Error('Vốn phân bổ phải từ 1% đến 100%.');
        }
        this.allocation = value;
      } else if (action === 'approve' || action === 'skip') {
        if (this.proposal === null) throw new Error('Không có đề xuất đang chờ duyệt.');
        if (action === 'approve') {
          this.pending = this.proposal;
          this.note('boss', 'Approve. Khớp mô phỏng tại giá mở cửa nến kế tiếp.', 'approve');
        } else {
          this.note('boss', 'Skip đề xuất này.', 'skip');
        }
        this.proposal = null;
      } else if (action === 'next') {
        this.nextBar();
      } else {
        throw new Error('Thao tác không hợp lệ.');
      }
    }
    nextBar() {
      if (this.proposal || this.index >= this.bars.length - 1) {
        throw new Error('Xử lý đề xuất hoặc reset phiên trước khi đi tiếp.');
      }
      this.index += 1;
      this.blocked = null;
      const bar = this.bars[this.index];
      if (this.pending) this.fill(bar);
      const signal = bar.signal;
      if (!this.armed || this.index === this.bars.length - 1) return;
      if ((signal === 'buy' && this.quantity === 0) || (signal === 'sell' && this.quantity > 0)) {
        this.propose(signal, bar.close);
      }
    }
    propose(side, mark) {
      this.note('quant', 'SMA 10 cắt ' + (side === 'buy' ? 'lên' : 'xuống') + ' SMA 30.', 'cross');
      this.note('trader', 'Đề xuất ' + (side === 'buy' ? 'mở' : 'đóng') + ' vị thế BTC.', 'propose');
      let blocked = false;
      if (side === 'buy') {
        const allocation = this.allocation / 100;
        const result = applyLimits({ [TICKER]: allocation }, {
          maxPositionPct: POSITION_CAP, maxGrossExposure: 1,
        });
        blocked = result.clamps.length > 0;
      }
      this.note('risk', blocked ? 'Block. Tỷ trọng vượt giới hạn 25% NAV.'
        : 'Pass. Đề xuất nằm trong giới hạn rủi ro.', blocked ? 'block' : 'pass');
      if (!blocked) {
        this.proposal = { side, mark, allocation: this.allocation };
        return;
      }
      this.log[this.log.length - 1].blocked = true;
      this.blocked = { side, mark, allocation: this.allocation };
    }
    fill(bar) {
      const proposal = this.pending;
      this.pending = null;
      const side = proposal.side;
      const mark = bar.open;
      const quantity = this.orderQuantity(side, mark, proposal.allocation);
      if (!quantity) {
        this.note('trader', 'Bỏ qua. Khối lượng nhỏ hơn 0,001 BTC.', 'nofill');
        return;
      }
      const fill = this.broker.placeOrder({
        ticker: TICKER, side, quantity, price: mark / UNITS_PER_BTC,
      });
      this.fills.push({
        side, quantity: fill.quantity / UNITS_PER_BTC, price: fill.price * UNITS_PER_BTC,
        timestamp: bar.timestamp, index: this.index,
      });
      this.note('trader', 'Khớp mô phỏng ' + (quantity / UNITS_PER_BTC).toFixed(3) + ' BTC.', 'fill');
      this.note('portfolio', 'Đã cập nhật cash, exposure và NAV.', 'book');
    }
    snapshot() {
      const bar = this.bars[this.index];
      const nav = this.nav(bar.close);
      return {
        bars: this.bars.slice(Math.max(0, this.index - (WINDOW - 1)), this.index + 1),
        index: this.index, count: this.bars.length, cash: this.broker.cash(),
        nav, pnl: nav - CAPITAL, quantity: this.quantity / UNITS_PER_BTC,
        exposure: this.quantity / UNITS_PER_BTC * bar.close / nav,
        allocation: this.allocation, armed: this.armed,
        proposal: this.proposal, pending: this.pending, blocked: this.blocked,
        log: this.log, fills: this.fills,
      };
    }
  }

  return { Desk, SimBroker, TradingCosts, applyLimits, CAPITAL, POSITION_CAP, WARMUP, SPREAD_BPS, UNITS_PER_BTC, WINDOW };
})();
