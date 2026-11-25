import type { Candle } from '../market-data/core/types';
import { rma, rollingStdDev, sma, type Out, type Series } from './moving-averages';

export interface BollingerResult {
  middle: Out;
  upper: Out;
  lower: Out;
  /** (upper − lower) / middle — a common "squeeze" measure. */
  bandwidth: Out;
}

/** Bollinger Bands: SMA(period) ± k × population standard deviation(period). */
export function bollinger(closes: Series, period = 20, k = 2): BollingerResult {
  const middle = sma(closes, period);
  const sd = rollingStdDev(closes, period);
  const upper: Out = middle.map((m, i) => (m === null || sd[i] === null ? null : m + k * (sd[i] as number)));
  const lower: Out = middle.map((m, i) => (m === null || sd[i] === null ? null : m - k * (sd[i] as number)));
  const bandwidth: Out = middle.map((m, i) =>
    m === null || upper[i] === null || m === 0 ? null : ((upper[i] as number) - (lower[i] as number)) / m,
  );
  return { middle, upper, lower, bandwidth };
}

/** True range. The first bar has no previous close, so TR = high − low. */
export function trueRange(candles: readonly Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
}

/** Average True Range using Wilder's smoothing; first value at index period − 1. */
export function atr(candles: readonly Candle[], period = 14): Out {
  return rma(trueRange(candles), period);
}

/** Annualised close-to-close historical volatility over a rolling window of log returns. */
export function historicalVolatility(closes: readonly number[], period = 20, periodsPerYear = 252): Out {
  const rets: (number | null)[] = closes.map((c, i) => (i === 0 || closes[i - 1] <= 0 || c <= 0 ? null : Math.log(c / closes[i - 1])));
  const out: Out = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (rets[j] === null) {
        ok = false;
        break;
      }
      sum += rets[j] as number;
    }
    if (!ok) continue;
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += ((rets[j] as number) - mean) ** 2;
    // Sample standard deviation (n − 1) is conventional for return volatility.
    out[i] = Math.sqrt(sq / (period - 1)) * Math.sqrt(periodsPerYear);
  }
  return out;
}
