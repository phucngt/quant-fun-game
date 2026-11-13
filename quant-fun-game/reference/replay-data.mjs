import { sma } from '../ai-fund/lib/indicators.ts';
import { generateBars } from '../ai-fund/lib/test-fixtures/market-data.ts';

const bars = generateBars({
  count: 160, startPrice: 65000, startTime: Date.UTC(2024, 3, 1), intervalMs: 300000,
});
const closes = bars.map(bar => bar.close);
const fast = sma(closes, 10);
const slow = sma(closes, 30);
const replay = bars.map((bar, i) => {
  const a = fast[i - 9], b = slow[i - 29];
  const previousA = fast[i - 10], previousB = slow[i - 30];
  let signal = null;
  if (previousA <= previousB && a > b) signal = 'buy';
  if (previousA >= previousB && a < b) signal = 'sell';
  return { ...bar, fast: a ?? null, slow: b ?? null, signal };
});
process.stdout.write(JSON.stringify(replay));
