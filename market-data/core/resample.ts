import type { Candle, Timeframe } from './types';
import { TIMEFRAME_SECONDS } from './types';

/** Bucket start (UNIX seconds, UTC) for a bar time at the given target timeframe. */
export function bucketStart(time: number, tf: Timeframe): number {
  if (tf === '1M') {
    const d = new Date(time * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  }
  if (tf === '1W') {
    // ISO weeks start on Monday (UTC).
    const d = new Date(time * 1000);
    const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) / 1000;
  }
  const s = TIMEFRAME_SECONDS[tf];
  return Math.floor(time / s) * s;
}

/**
 * Aggregates ascending candles into a coarser timeframe. Open = first open, close = last close,
 * high/low = extremes, volume = sum (null if any constituent volume is unknown).
 * The final bucket may be incomplete; callers can detect that with `isBucketComplete`.
 */
export function resampleCandles(candles: readonly Candle[], target: Timeframe): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let volUnknown = false;
  for (const c of candles) {
    const b = bucketStart(c.time, target);
    if (!cur || cur.time !== b) {
      if (cur) out.push({ ...cur, volume: volUnknown ? null : cur.volume });
      cur = { time: b, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 };
      volUnknown = c.volume === null;
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      if (c.volume === null) volUnknown = true;
      else cur.volume = (cur.volume ?? 0) + c.volume;
    }
  }
  if (cur) out.push({ ...cur, volume: volUnknown ? null : cur.volume });
  return out;
}

/** Whether a bucket starting at `bucketTime` has closed by `nowSec`. */
export function isBucketComplete(bucketTime: number, tf: Timeframe, nowSec: number): boolean {
  if (tf === '1M') {
    const d = new Date(bucketTime * 1000);
    return nowSec >= Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
  }
  return nowSec >= bucketTime + TIMEFRAME_SECONDS[tf];
}
