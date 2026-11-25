import { sma } from '../indicators/moving-averages';
import type { Candle } from '../market-data/core/types';

export interface BreadthSnapshot {
  total: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  aboveSma50: number;
  aboveSma200: number;
  newHighs52w: number;
  newLows52w: number;
  /** Instruments lacking enough history for a given measure (reported, not hidden). */
  insufficientHistory: number;
}

/** Market breadth across a set of instruments using their latest completed bar. */
export function computeBreadth(seriesBySymbol: Record<string, readonly Candle[]>): BreadthSnapshot {
  const snap: BreadthSnapshot = { total: 0, advancers: 0, decliners: 0, unchanged: 0, aboveSma50: 0, aboveSma200: 0, newHighs52w: 0, newLows52w: 0, insufficientHistory: 0 };
  for (const candles of Object.values(seriesBySymbol)) {
    if (candles.length < 2) {
      snap.insufficientHistory++;
      continue;
    }
    snap.total++;
    const n = candles.length;
    const last = candles[n - 1].close;
    const prev = candles[n - 2].close;
    if (last > prev) snap.advancers++;
    else if (last < prev) snap.decliners++;
    else snap.unchanged++;
    const closes = candles.map((c) => c.close);
    const s50 = sma(closes, 50)[n - 1];
    const s200 = sma(closes, 200)[n - 1];
    if (s50 !== null && last > s50) snap.aboveSma50++;
    if (s200 !== null && last > s200) snap.aboveSma200++;
    if (s200 === null) snap.insufficientHistory++;
    const window = candles.slice(Math.max(0, n - 252), n - 1);
    if (window.length >= 200) {
      if (candles[n - 1].high > Math.max(...window.map((c) => c.high))) snap.newHighs52w++;
      if (candles[n - 1].low < Math.min(...window.map((c) => c.low))) snap.newLows52w++;
    }
  }
  return snap;
}

/** Percentage change between the close `bars` ago and the latest close (null if unavailable). */
export function periodChange(candles: readonly Candle[], bars: number): number | null {
  const n = candles.length;
  if (n <= bars) return null;
  return candles[n - 1].close / candles[n - 1 - bars].close - 1;
}

/** Change since the first bar on or after `sinceSec` (e.g. year-to-date). */
export function changeSince(candles: readonly Candle[], sinceSec: number): number | null {
  const base = candles.find((c) => c.time >= sinceSec);
  if (!base || candles.length === 0) return null;
  return candles[candles.length - 1].close / base.open - 1;
}
