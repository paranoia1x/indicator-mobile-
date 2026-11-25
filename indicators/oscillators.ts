import type { Candle } from '../market-data/core/types';
import { ema, rma, sma, type Out, type Series } from './moving-averages';

/**
 * Relative Strength Index (Wilder). First value appears at index `period`
 * (requires `period` price changes). RSI = 100 when there were no losses.
 */
export function rsi(closes: Series, period = 14): Out {
  const n = closes.length;
  const out: Out = new Array(n).fill(null);
  const gains: (number | null)[] = new Array(n).fill(null);
  const losses: (number | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a === null || b === null) continue;
    const ch = b - a;
    gains[i] = ch > 0 ? ch : 0;
    losses[i] = ch < 0 ? -ch : 0;
  }
  const ag = rma(gains, period);
  const al = rma(losses, period);
  for (let i = 0; i < n; i++) {
    const g = ag[i];
    const l = al[i];
    if (g === null || l === null) continue;
    if (l === 0) out[i] = g === 0 ? 50 : 100;
    else out[i] = 100 - 100 / (1 + g / l);
  }
  return out;
}

export interface MacdResult {
  macd: Out;
  signal: Out;
  histogram: Out;
}

/** MACD = EMA(fast) − EMA(slow); signal = EMA(signalPeriod) of MACD; histogram = MACD − signal. */
export function macd(closes: Series, fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  if (fast >= slow) throw new RangeError('MACD fast period must be shorter than slow period');
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line: Out = f.map((v, i) => (v === null || s[i] === null ? null : v - (s[i] as number)));
  const signal = ema(line, signalPeriod);
  const histogram: Out = line.map((v, i) => (v === null || signal[i] === null ? null : v - (signal[i] as number)));
  return { macd: line, signal, histogram };
}

export interface StochasticResult {
  k: Out;
  d: Out;
}

/**
 * Stochastic oscillator. Raw %K = 100 × (close − lowestLow) / (highestHigh − lowestLow) over
 * `kPeriod` bars; %K is then smoothed with an SMA of `smooth` bars ("slow" stochastic when
 * smooth = 3) and %D is an SMA of %K over `dPeriod` bars. When the range is zero, raw %K = 50.
 */
export function stochastic(candles: readonly Candle[], kPeriod = 14, smooth = 3, dPeriod = 3): StochasticResult {
  const n = candles.length;
  const raw: Out = new Array(n).fill(null);
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > hh) hh = candles[j].high;
      if (candles[j].low < ll) ll = candles[j].low;
    }
    const range = hh - ll;
    raw[i] = range === 0 ? 50 : (100 * (candles[i].close - ll)) / range;
  }
  const k = smooth > 1 ? sma(raw, smooth) : raw;
  const d = sma(k, dPeriod);
  return { k, d };
}
