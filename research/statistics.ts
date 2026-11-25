/** Descriptive statistics helpers. Pure functions; no look-ahead (callers pass only known data). */

export function simpleReturns(prices: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) out.push(prices[i] / prices[i - 1] - 1);
  return out;
}

export function logReturns(prices: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) out.push(Math.log(prices[i] / prices[i - 1]));
  return out;
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Sample standard deviation (n − 1). */
export function stdev(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs) as number;
  let sq = 0;
  for (const x of xs) sq += (x - m) ** 2;
  return Math.sqrt(sq / (xs.length - 1));
}

export function annualizedVolatility(returns: readonly number[], periodsPerYear: number): number | null {
  const s = stdev(returns);
  return s === null ? null : s * Math.sqrt(periodsPerYear);
}

/** Pearson correlation of two equal-length series; null if undefined (n < 3 or zero variance). */
export function correlation(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}

export interface DrawdownResult {
  maxDrawdown: number; // as a negative fraction, e.g. -0.23
  peakIndex: number;
  troughIndex: number;
  recoveryIndex: number | null;
  series: number[];
}

/** Maximum peak-to-trough decline of an equity or price curve. */
export function maxDrawdown(values: readonly number[]): DrawdownResult {
  let peak = -Infinity;
  let peakIdx = 0;
  let best = 0;
  let bestPeak = 0;
  let bestTrough = 0;
  const series: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIdx = i;
    }
    const dd = peak > 0 ? values[i] / peak - 1 : 0;
    series.push(dd);
    if (dd < best) {
      best = dd;
      bestPeak = peakIdx;
      bestTrough = i;
    }
  }
  let recovery: number | null = null;
  if (best < 0) {
    for (let i = bestTrough + 1; i < values.length; i++) {
      if (values[i] >= values[bestPeak]) {
        recovery = i;
        break;
      }
    }
  }
  return { maxDrawdown: best, peakIndex: bestPeak, troughIndex: bestTrough, recoveryIndex: recovery, series };
}

/** Percentile rank (0–1) of `value` within `sample`. */
export function percentileRank(sample: readonly number[], value: number): number | null {
  if (sample.length === 0) return null;
  let below = 0;
  let equal = 0;
  for (const x of sample) {
    if (x < value) below++;
    else if (x === value) equal++;
  }
  return (below + 0.5 * equal) / sample.length;
}

/** Compound annual growth rate given a total return over `years`. */
export function cagr(totalReturn: number, years: number): number | null {
  if (years <= 0 || 1 + totalReturn <= 0) return null;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}
