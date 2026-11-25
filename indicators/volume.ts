import type { Candle } from '../market-data/core/types';
import type { Out } from './moving-averages';

export type VwapAnchor = 'session' | 'all';

/** UTC calendar-day key used for session resets. */
export function utcDayKey(timeSec: number): number {
  return Math.floor(timeSec / 86400);
}

/**
 * Volume-Weighted Average Price using typical price (H+L+C)/3.
 * - anchor 'session': resets at each new session (UTC day by default; pass `sessionKey` for exchanges)
 * - anchor 'all': cumulative from the first bar (anchored VWAP)
 * Bars with unknown volume produce `null` and do not contribute.
 */
export function vwap(
  candles: readonly Candle[],
  anchor: VwapAnchor = 'session',
  sessionKey: (timeSec: number) => number = utcDayKey,
): Out {
  const out: Out = new Array(candles.length).fill(null);
  let pv = 0;
  let vol = 0;
  let key: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (anchor === 'session') {
      const k = sessionKey(c.time);
      if (k !== key) {
        key = k;
        pv = 0;
        vol = 0;
      }
    }
    if (c.volume === null) continue;
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    vol += c.volume;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

/**
 * On-Balance Volume. Starts at 0 on the first bar. A bar with unknown volume outputs null and
 * leaves the running total unchanged (missing data is never treated as zero volume).
 */
export function obv(candles: readonly Candle[]): Out {
  const out: Out = new Array(candles.length).fill(null);
  let total = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.volume === null) continue;
    if (i > 0) {
      const prev = candles[i - 1].close;
      if (c.close > prev) total += c.volume;
      else if (c.close < prev) total -= c.volume;
    }
    out[i] = total;
  }
  return out;
}

/** Ratio of each bar's volume to the average of the previous `period` bars (excludes current bar). */
export function relativeVolume(candles: readonly Candle[], period = 20): Out {
  const out: Out = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    const v = candles[i].volume;
    if (v === null) continue;
    let sum = 0;
    let ok = true;
    for (let j = i - period; j < i; j++) {
      const pv = candles[j].volume;
      if (pv === null) {
        ok = false;
        break;
      }
      sum += pv;
    }
    if (ok && sum > 0) out[i] = v / (sum / period);
  }
  return out;
}
