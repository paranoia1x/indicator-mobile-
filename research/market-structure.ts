import { atr } from '../indicators/volatility';
import { historicalVolatility } from '../indicators/volatility';
import type { Candle } from '../market-data/core/types';
import { percentileRank } from './statistics';

/**
 * Historical market-structure detection.
 *
 * LOOK-AHEAD RULE: every detected object carries `confirmedIndex` — the first bar at whose CLOSE
 * the object could have been known using only data up to that bar. Replay, simulation and
 * backtesting must filter with `knownAt(objects, i)` so that nothing is shown before it was
 * knowable. A swing high at bar i with `right` = 5 is only confirmed at bar i + 5.
 */

export type StructureLabel = 'HH' | 'LH' | 'HL' | 'LL';

export interface SwingPoint {
  type: 'high' | 'low';
  index: number;
  time: number;
  price: number;
  confirmedIndex: number;
  confirmedTime: number;
  /** Comparison with the previous confirmed swing of the same type (null for the first). */
  label: StructureLabel | null;
}

export interface SwingOptions {
  left?: number;
  right?: number;
}

export function knownAt<T extends { confirmedIndex: number }>(items: readonly T[], index: number): T[] {
  return items.filter((x) => x.confirmedIndex <= index);
}

/**
 * Fractal swing detection. Bar i is a swing high when its high is strictly greater than the
 * `left` previous highs and greater than or equal to the `right` following highs (ties resolve
 * to the earliest bar). Confirmation requires the `right` bars to have closed.
 */
export function detectSwings(candles: readonly Candle[], opts: SwingOptions = {}): SwingPoint[] {
  const left = opts.left ?? 5;
  const right = opts.right ?? 5;
  const out: SwingPoint[] = [];
  const n = candles.length;
  for (let i = left; i + right < n; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j < i && (isHigh || isLow); j++) {
      if (candles[j].high >= h) isHigh = false;
      if (candles[j].low <= l) isLow = false;
    }
    for (let j = i + 1; j <= i + right && (isHigh || isLow); j++) {
      if (candles[j].high > h) isHigh = false;
      if (candles[j].low < l) isLow = false;
    }
    const ci = i + right;
    if (isHigh) out.push({ type: 'high', index: i, time: candles[i].time, price: h, confirmedIndex: ci, confirmedTime: candles[ci].time, label: null });
    if (isLow) out.push({ type: 'low', index: i, time: candles[i].time, price: l, confirmedIndex: ci, confirmedTime: candles[ci].time, label: null });
  }
  // Labels compare with the previous swing of the same type in confirmation order (causal).
  out.sort((a, b) => a.confirmedIndex - b.confirmedIndex || a.index - b.index);
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;
  for (const s of out) {
    if (s.type === 'high') {
      s.label = lastHigh ? (s.price > lastHigh.price ? 'HH' : 'LH') : null;
      lastHigh = s;
    } else {
      s.label = lastLow ? (s.price > lastLow.price ? 'HL' : 'LL') : null;
      lastLow = s;
    }
  }
  return out;
}

export type TrendState = 'uptrend' | 'downtrend' | 'mixed' | 'insufficient-data';

/** Describes structure from the latest confirmed high and low labels known at `index`. */
export function trendStateAt(swings: readonly SwingPoint[], index: number): TrendState {
  const known = knownAt(swings, index);
  const lastHigh = [...known].reverse().find((s) => s.type === 'high' && s.label);
  const lastLow = [...known].reverse().find((s) => s.type === 'low' && s.label);
  if (!lastHigh || !lastLow) return 'insufficient-data';
  if (lastHigh.label === 'HH' && lastLow.label === 'HL') return 'uptrend';
  if (lastHigh.label === 'LH' && lastLow.label === 'LL') return 'downtrend';
  return 'mixed';
}

export interface StructureEvent {
  kind: 'breakout-up' | 'breakout-down' | 'reversal-up' | 'reversal-down' | 'volatility-expansion' | 'volatility-contraction';
  index: number;
  time: number;
  /** Events are detected at the bar's close, so confirmedIndex === index. */
  confirmedIndex: number;
  price: number;
  detail: string;
}

/**
 * Range breakouts: the close exceeds the highest high (or falls below the lowest low) of the
 * previous `lookback` bars. Only data up to and including bar i is used.
 */
export function detectBreakouts(candles: readonly Candle[], lookback = 20): StructureEvent[] {
  const out: StructureEvent[] = [];
  for (let i = lookback; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - lookback; j < i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    const c = candles[i];
    const prev = candles[i - 1].close;
    if (c.close > hh && prev <= hh) {
      out.push({ kind: 'breakout-up', index: i, time: c.time, confirmedIndex: i, price: c.close, detail: `Closed above the prior ${lookback}-bar high (${fmt(hh)})` });
    } else if (c.close < ll && prev >= ll) {
      out.push({ kind: 'breakout-down', index: i, time: c.time, confirmedIndex: i, price: c.close, detail: `Closed below the prior ${lookback}-bar low (${fmt(ll)})` });
    }
  }
  return out;
}

/**
 * Structure reversals ("break of structure"): while the known structure is an uptrend
 * (latest HH + HL), a close below the latest confirmed swing low; and vice versa.
 */
export function detectReversals(candles: readonly Candle[], swings: readonly SwingPoint[]): StructureEvent[] {
  const out: StructureEvent[] = [];
  let lastFlagged: number | null = null;
  for (let i = 1; i < candles.length; i++) {
    const state = trendStateAt(swings, i - 1);
    if (state !== 'uptrend' && state !== 'downtrend') continue;
    const known = knownAt(swings, i - 1);
    const c = candles[i];
    if (state === 'uptrend') {
      const lastLow = [...known].reverse().find((s) => s.type === 'low');
      if (lastLow && c.close < lastLow.price && candles[i - 1].close >= lastLow.price && lastFlagged !== lastLow.index) {
        out.push({ kind: 'reversal-down', index: i, time: c.time, confirmedIndex: i, price: c.close, detail: `Uptrend structure broken: closed below the last confirmed swing low (${fmt(lastLow.price)})` });
        lastFlagged = lastLow.index;
      }
    } else {
      const lastHigh = [...known].reverse().find((s) => s.type === 'high');
      if (lastHigh && c.close > lastHigh.price && candles[i - 1].close <= lastHigh.price && lastFlagged !== lastHigh.index) {
        out.push({ kind: 'reversal-up', index: i, time: c.time, confirmedIndex: i, price: c.close, detail: `Downtrend structure broken: closed above the last confirmed swing high (${fmt(lastHigh.price)})` });
        lastFlagged = lastHigh.index;
      }
    }
  }
  return out;
}

export interface ConsolidationZone {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  /** A zone is only knowable once its window has closed. */
  confirmedIndex: number;
}

/**
 * Consolidation: windows of `window` bars whose total high–low range is at most `maxAtrMultiple`
 * times the ATR measured at the window's end. Overlapping windows are merged.
 */
export function detectConsolidation(candles: readonly Candle[], window = 20, maxAtrMultiple = 3.5): ConsolidationZone[] {
  const a = atr(candles, 14);
  const zones: ConsolidationZone[] = [];
  for (let i = window - 1; i < candles.length; i++) {
    const atrv = a[i];
    if (atrv === null || atrv <= 0) continue;
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - window + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    if (hh - ll <= maxAtrMultiple * atrv) {
      const start = i - window + 1;
      const last = zones[zones.length - 1];
      if (last && start <= last.endIndex) {
        last.endIndex = i;
        last.endTime = candles[i].time;
        last.high = Math.max(last.high, hh);
        last.low = Math.min(last.low, ll);
        last.confirmedIndex = i;
      } else {
        zones.push({ startIndex: start, endIndex: i, startTime: candles[start].time, endTime: candles[i].time, high: hh, low: ll, confirmedIndex: i });
      }
    }
  }
  return zones;
}

export type VolRegime = 'low' | 'normal' | 'high';

/**
 * Volatility regime per bar: the percentile of the current 20-bar historical volatility within
 * the trailing `lookback` values (only past data). <20th pct = low, >80th pct = high.
 */
export function volatilityRegimes(candles: readonly Candle[], periodsPerYear = 252, lookback = 120): { regimes: (VolRegime | null)[]; events: StructureEvent[] } {
  const hv = historicalVolatility(candles.map((c) => c.close), 20, periodsPerYear);
  const regimes: (VolRegime | null)[] = new Array(candles.length).fill(null);
  const events: StructureEvent[] = [];
  let prev: VolRegime | null = null;
  for (let i = 0; i < candles.length; i++) {
    const v = hv[i];
    if (v === null) continue;
    const window: number[] = [];
    for (let j = Math.max(0, i - lookback); j < i; j++) if (hv[j] !== null) window.push(hv[j] as number);
    if (window.length < 30) continue;
    const pr = percentileRank(window, v) as number;
    const r: VolRegime = pr < 0.2 ? 'low' : pr > 0.8 ? 'high' : 'normal';
    regimes[i] = r;
    if (prev && r !== prev && (r === 'high' || prev === 'high' || r === 'low')) {
      const kind = r === 'high' ? 'volatility-expansion' : r === 'low' ? 'volatility-contraction' : prev === 'high' ? 'volatility-contraction' : 'volatility-expansion';
      events.push({ kind, index: i, time: candles[i].time, confirmedIndex: i, price: candles[i].close, detail: `Historical volatility ${(v * 100).toFixed(1)}% (annualised) moved from ${prev} to ${r} relative to the prior ${lookback} bars` });
    }
    prev = r;
  }
  return { regimes, events };
}

export interface PriceZone {
  price: number;
  low: number;
  high: number;
  touches: number;
  kind: 'support' | 'resistance';
  firstIndex: number;
  lastIndex: number;
  confirmedIndex: number;
}

/**
 * Previously established support/resistance regions known at `asOfIndex`: clusters of confirmed
 * swing prices within `tolerance` × ATR. Classified relative to the close at `asOfIndex`.
 * These are areas where price reacted IN THE PAST; they are not predictions.
 */
export function supportResistanceAt(
  candles: readonly Candle[],
  swings: readonly SwingPoint[],
  asOfIndex: number,
  opts: { tolerance?: number; minTouches?: number; maxZones?: number } = {},
): PriceZone[] {
  if (asOfIndex < 0 || asOfIndex >= candles.length) return [];
  const tolerance = opts.tolerance ?? 0.6;
  const minTouches = opts.minTouches ?? 2;
  const a = atr(candles.slice(0, asOfIndex + 1), 14);
  const atrNow = a[asOfIndex] ?? candles[asOfIndex].close * 0.02;
  const band = atrNow * tolerance;
  const known = knownAt(swings, asOfIndex).sort((x, y) => x.price - y.price);
  const clusters: SwingPoint[][] = [];
  for (const s of known) {
    const last = clusters[clusters.length - 1];
    if (last && s.price - last[0].price <= band * 2) last.push(s);
    else clusters.push([s]);
  }
  const close = candles[asOfIndex].close;
  const zones: PriceZone[] = clusters
    .filter((c) => c.length >= minTouches)
    .map((c) => {
      const prices = c.map((s) => s.price);
      const price = prices.reduce((x, y) => x + y, 0) / prices.length;
      return {
        price,
        low: Math.min(...prices),
        high: Math.max(...prices),
        touches: c.length,
        kind: price <= close ? 'support' : 'resistance',
        firstIndex: Math.min(...c.map((s) => s.index)),
        lastIndex: Math.max(...c.map((s) => s.index)),
        confirmedIndex: Math.max(...c.map((s) => s.confirmedIndex)),
      } as PriceZone;
    });
  zones.sort((x, y) => Math.abs(x.price - close) - Math.abs(y.price - close));
  return zones.slice(0, opts.maxZones ?? 6);
}

export interface HindsightExample {
  entry: SwingPoint;
  exit: SwingPoint;
  hindsightReturn: number;
  /** Price available when the swing low was first CONFIRMED (the earliest a rule could act). */
  confirmationEntryPrice: number;
  confirmationExitPrice: number;
  realisticReturn: number;
  /** Swing lows in the same lookback that looked similar but were later undercut. */
  failedLowsBefore: number;
  explanation: string[];
}

/**
 * Educational hindsight example: the largest confirmed swing-low → swing-high advance in the
 * data, contrasted with what a rule acting only on confirmed information could have captured.
 */
export function hindsightExample(candles: readonly Candle[], swings: readonly SwingPoint[]): HindsightExample | null {
  const lows = swings.filter((s) => s.type === 'low');
  const highs = swings.filter((s) => s.type === 'high');
  let best: { lo: SwingPoint; hi: SwingPoint; r: number } | null = null;
  for (const lo of lows) {
    const hi = highs.find((h) => h.index > lo.index);
    if (!hi) continue;
    const r = hi.price / lo.price - 1;
    if (!best || r > best.r) best = { lo, hi, r };
  }
  if (!best) return null;
  const { lo, hi, r } = best;
  const entryPx = candles[lo.confirmedIndex].close;
  const exitPx = candles[Math.min(hi.confirmedIndex, candles.length - 1)].close;
  const realistic = exitPx / entryPx - 1;
  const failed = lows.filter((l) => l.index < lo.index && lows.some((l2) => l2.index > l.index && l2.price < l.price)).length;
  return {
    entry: lo,
    exit: hi,
    hindsightReturn: r,
    confirmationEntryPrice: entryPx,
    confirmationExitPrice: exitPx,
    realisticReturn: realistic,
    failedLowsBefore: failed,
    explanation: [
      `With hindsight, buying exactly at the low (${fmt(lo.price)}) and selling exactly at the high (${fmt(hi.price)}) would have returned ${(r * 100).toFixed(1)}%.`,
      `But the low was only recognisable as a swing low ${lo.confirmedIndex - lo.index} bars later, when price was ${fmt(entryPx)}. Likewise the high was only confirmed at ${fmt(exitPx)}.`,
      `Acting only on confirmed information would have returned ${(realistic * 100).toFixed(1)}% — before costs, slippage, and the uncertainty of whether the pattern would hold.`,
      `Before this low, ${failed} earlier swing low(s) in this data were later broken. In real time there is no reliable way to know which low will hold.`,
      'This is an educational illustration of hindsight bias, not a trading method.',
    ],
  };
}

function fmt(p: number): string {
  return p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p.toPrecision(4);
}
