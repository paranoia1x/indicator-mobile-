/**
 * Moving averages. All functions return an array aligned with the input where
 * warm-up positions (not enough data yet) are `null` — never a fabricated value.
 * A `null` in the input propagates: the average restarts once enough valid values follow.
 */
export type Series = readonly (number | null)[];
export type Out = (number | null)[];

function assertPeriod(period: number): void {
  if (!Number.isInteger(period) || period < 1) throw new RangeError(`period must be a positive integer, got ${period}`);
}

/** Simple moving average using a rolling sum (O(n)). */
export function sma(values: Series, period: number): Out {
  assertPeriod(period);
  const out: Out = new Array(values.length).fill(null);
  let sum = 0;
  let count = 0; // consecutive valid values in window
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) {
      sum = 0;
      count = 0;
      continue;
    }
    sum += v;
    count++;
    if (count > period) {
      sum -= values[i - period] as number;
      count = period;
    }
    if (count === period) out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential moving average, alpha = 2 / (period + 1), seeded with the SMA of the first
 * `period` valid values (the convention used by most charting references, e.g. StockCharts).
 */
export function ema(values: Series, period: number): Out {
  return expSmooth(values, period, 2 / (period + 1));
}

/** Wilder's smoothing (RMA): alpha = 1 / period, SMA seed. Used by RSI, ATR, ADX. */
export function rma(values: Series, period: number): Out {
  return expSmooth(values, period, 1 / period);
}

function expSmooth(values: Series, period: number, alpha: number): Out {
  assertPeriod(period);
  const out: Out = new Array(values.length).fill(null);
  let prev: number | null = null;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) {
      prev = null;
      seedSum = 0;
      seedCount = 0;
      continue;
    }
    if (prev === null) {
      seedSum += v;
      seedCount++;
      if (seedCount === period) {
        prev = seedSum / period;
        out[i] = prev;
      }
    } else {
      prev = prev + alpha * (v - prev);
      out[i] = prev;
    }
  }
  return out;
}

/** Rolling population standard deviation over `period` values. */
export function rollingStdDev(values: Series, period: number): Out {
  assertPeriod(period);
  const out: Out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v === null || !Number.isFinite(v)) {
        ok = false;
        break;
      }
      sum += v;
    }
    if (!ok) continue;
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += ((values[j] as number) - mean) ** 2;
    out[i] = Math.sqrt(sq / period);
  }
  return out;
}
