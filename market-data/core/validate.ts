import type { Candle, DataIssue, DataStatus, Provenance, Timeframe } from './types';
import { TIMEFRAME_SECONDS } from './types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates and normalises a candle array:
 * - drops bars with non-finite or non-positive prices, inverted high/low, or OHLC outside [low, high]
 * - sorts ascending by time; for duplicate timestamps keeps the LAST occurrence (latest revision)
 * - negative / non-finite volume becomes null (unknown), never 0
 * Returns the clean candles and a list of issues so the UI can disclose data-quality problems.
 */
export function validateCandles(input: readonly Candle[]): { candles: Candle[]; issues: DataIssue[] } {
  const issues: DataIssue[] = [];
  const kept: { c: Candle; i: number }[] = [];
  let outOfOrder = false;
  let prevTime = -Infinity;

  input.forEach((raw, index) => {
    const { time, open, high, low, close } = raw;
    if (![time, open, high, low, close].every(isNum)) {
      issues.push({ index, kind: 'non-finite', detail: 'Bar contains a missing or non-numeric field' });
      return;
    }
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      issues.push({ index, kind: 'negative-price', detail: 'Bar contains a zero or negative price' });
      return;
    }
    if (high < low) {
      issues.push({ index, kind: 'high-low-inverted', detail: `high ${high} < low ${low}` });
      return;
    }
    const eps = Math.max(1e-9, high * 1e-9);
    if (open > high + eps || open < low - eps || close > high + eps || close < low - eps) {
      issues.push({ index, kind: 'ohlc-outside-range', detail: 'Open/close outside the high-low range' });
      return;
    }
    let volume: number | null = raw.volume;
    if (volume !== null && (!isNum(volume) || volume < 0)) {
      issues.push({ index, kind: 'negative-volume', detail: 'Volume invalid; treated as unknown' });
      volume = null;
    }
    if (time < prevTime) outOfOrder = true;
    prevTime = time;
    kept.push({ c: { time, open, high, low, close, volume }, i: index });
  });

  if (outOfOrder) {
    issues.push({ index: -1, kind: 'out-of-order', detail: 'Bars were not in chronological order and were sorted' });
  }
  kept.sort((a, b) => a.c.time - b.c.time || a.i - b.i);

  const out: Candle[] = [];
  for (const { c, i } of kept) {
    const last = out[out.length - 1];
    if (last && last.time === c.time) {
      issues.push({ index: i, kind: 'duplicate-time', detail: `Duplicate bar at ${c.time}; latest kept` });
      out[out.length - 1] = c;
    } else {
      out.push(c);
    }
  }
  return { candles: out, issues };
}

/** Summarises issues into short warnings suitable for provenance.warnings. */
export function summarizeIssues(issues: DataIssue[]): string[] {
  const counts = new Map<DataIssue['kind'], number>();
  for (const i of issues) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${n} bar(s): ${k.replace(/-/g, ' ')}`);
}

/**
 * Classifies freshness of real provider data. Simulated data always stays 'simulated'.
 * A series is 'live' when its last bar is within ~2 bar lengths (min 5 minutes) of `now`,
 * 'delayed' when the provider declares a delay, otherwise 'historical'.
 */
export function classifyFreshness(args: {
  lastBarTime: number | undefined;
  timeframe: Timeframe;
  nowMs: number;
  providerDelayMinutes?: number;
  simulated?: boolean;
}): DataStatus {
  if (args.simulated) return 'simulated';
  if (args.lastBarTime === undefined) return 'historical';
  const ageSec = args.nowMs / 1000 - args.lastBarTime;
  const window = Math.max(300, 2 * TIMEFRAME_SECONDS[args.timeframe]);
  if (ageSec <= window) {
    return args.providerDelayMinutes && args.providerDelayMinutes > 0 ? 'delayed' : 'live';
  }
  return 'historical';
}

/** Marks a provenance as served from cache, preserving the original asOf timestamp. */
export function asCached(p: Provenance): Provenance {
  if (p.status === 'simulated') return p;
  return { ...p, status: 'cached' };
}

/** True when data is older than `maxAgeMs` relative to now — used to warn about stale prices. */
export function isStale(p: Provenance, nowMs: number, maxAgeMs: number): boolean {
  return nowMs - p.asOf > maxAgeMs;
}

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-^=]{0,19}$/;
/** Strict input validation for user-typed / route-param symbols. */
export function normalizeSymbol(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toUpperCase();
  return SYMBOL_RE.test(s) ? s : null;
}
