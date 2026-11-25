import type { Candle } from '../market-data/core/types';
import { mean, median, stdev } from './statistics';

export interface EventWindowResult {
  eventTime: number;
  /** Index of the last bar that closed BEFORE the event (baseline). */
  baselineIndex: number;
  returns: Record<number, number | null>; // offset (bars after baseline) → cumulative return
}

export interface EventStudySummary {
  offsets: number[];
  samples: number;
  perOffset: { offset: number; mean: number | null; median: number | null; stdev: number | null; positive: number; negative: number; n: number; min: number | null; max: number | null }[];
  windows: EventWindowResult[];
  caveats: string[];
}

/**
 * Historical event study: for each past event, measures the cumulative return from the last close
 * strictly before the event to `offset` bars later. Uses only bars that exist; offsets beyond the
 * available data are null (never extrapolated).
 */
export function eventStudy(candles: readonly Candle[], eventTimesSec: readonly number[], offsets: readonly number[] = [1, 3, 5, 10]): EventStudySummary {
  const windows: EventWindowResult[] = [];
  for (const t of eventTimesSec) {
    let b = -1;
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time < t) b = i;
      else break;
    }
    if (b < 0) continue;
    const base = candles[b].close;
    const returns: Record<number, number | null> = {};
    for (const o of offsets) {
      const j = b + o;
      returns[o] = j < candles.length ? candles[j].close / base - 1 : null;
    }
    windows.push({ eventTime: t, baselineIndex: b, returns });
  }
  const perOffset = offsets.map((o) => {
    const xs = windows.map((w) => w.returns[o]).filter((x): x is number => x !== null);
    return {
      offset: o,
      mean: mean(xs),
      median: median(xs),
      stdev: stdev(xs),
      positive: xs.filter((x) => x > 0).length,
      negative: xs.filter((x) => x < 0).length,
      n: xs.length,
      min: xs.length ? Math.min(...xs) : null,
      max: xs.length ? Math.max(...xs) : null,
    };
  });
  const caveats = [
    'Past reactions describe what happened, not what will happen next time.',
    'Other news and market-wide moves overlap these windows; the event is not the only cause.',
  ];
  if (windows.length < 10) caveats.unshift(`Small sample (${windows.length} events): averages are highly uncertain.`);
  return { offsets: [...offsets], samples: windows.length, perOffset, windows, caveats };
}
