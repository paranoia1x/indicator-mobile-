import { bucketStart, isBucketComplete, resampleCandles } from '@/market-data/core/resample';
import { asCached, classifyFreshness, isStale, normalizeSymbol, summarizeIssues, validateCandles } from '@/market-data/core/validate';
import { datasetFingerprint } from '@/market-data/core/random';
import type { Candle, Provenance } from '@/market-data/core/types';

const c = (time: number, o: number, h: number, l: number, cl: number, v: number | null = 10): Candle => ({ time, open: o, high: h, low: l, close: cl, volume: v });

describe('validateCandles', () => {
  it('drops invalid bars, sorts, dedupes and reports issues', () => {
    const input: Candle[] = [
      c(3, 10, 11, 9, 10),
      c(1, 10, 11, 9, 10),
      c(2, NaN, 11, 9, 10),
      c(4, 10, 9, 11, 10), // inverted
      c(5, -1, 11, 9, 10),
      c(6, 12, 11, 9, 10), // open outside range
      c(3, 10, 12, 9, 11), // duplicate time → keep latest
      c(7, 10, 11, 9, 10, -5),
    ];
    const { candles, issues } = validateCandles(input);
    expect(candles.map((x) => x.time)).toEqual([1, 3, 7]);
    expect(candles[1].close).toBe(11);
    expect(candles[2].volume).toBeNull();
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['non-finite', 'high-low-inverted', 'negative-price', 'ohlc-outside-range', 'duplicate-time', 'out-of-order', 'negative-volume']));
    expect(summarizeIssues(issues).length).toBeGreaterThan(3);
  });
  it('handles empty input', () => {
    expect(validateCandles([])).toEqual({ candles: [], issues: [] });
  });
});

describe('freshness labels', () => {
  const now = 1_700_000_000_000;
  it('classifies live, delayed, historical and simulated', () => {
    expect(classifyFreshness({ lastBarTime: now / 1000 - 60, timeframe: '1m', nowMs: now })).toBe('live');
    expect(classifyFreshness({ lastBarTime: now / 1000 - 60, timeframe: '1m', nowMs: now, providerDelayMinutes: 15 })).toBe('delayed');
    expect(classifyFreshness({ lastBarTime: now / 1000 - 86400 * 3, timeframe: '1D', nowMs: now })).toBe('historical');
    expect(classifyFreshness({ lastBarTime: now / 1000, timeframe: '1D', nowMs: now, simulated: true })).toBe('simulated');
    expect(classifyFreshness({ lastBarTime: undefined, timeframe: '1D', nowMs: now })).toBe('historical');
  });
  it('cached status never upgrades simulated data and staleness is measured from asOf', () => {
    const p: Provenance = { providerId: 'x', providerName: 'X', status: 'live', asOf: now - 120_000, fetchedAt: now };
    expect(asCached(p).status).toBe('cached');
    expect(asCached(p).asOf).toBe(p.asOf);
    expect(asCached({ ...p, status: 'simulated' }).status).toBe('simulated');
    expect(isStale(p, now, 60_000)).toBe(true);
    expect(isStale(p, now, 600_000)).toBe(false);
  });
});

describe('symbol validation', () => {
  it('accepts tickers and rejects injection attempts', () => {
    expect(normalizeSymbol(' aapl ')).toBe('AAPL');
    expect(normalizeSymbol('BTC-USD')).toBe('BTC-USD');
    expect(normalizeSymbol('NWSC.SIM')).toBe('NWSC.SIM');
    expect(normalizeSymbol('^GSPC')).toBeNull(); // must start alphanumeric
    expect(normalizeSymbol('A; DROP TABLE')).toBeNull();
    expect(normalizeSymbol('../etc/passwd')).toBeNull();
    expect(normalizeSymbol(42)).toBeNull();
    expect(normalizeSymbol('A'.repeat(30))).toBeNull();
  });
});

describe('resampling', () => {
  const H = 3600;
  it('aggregates 1h into 4h buckets aligned to UTC', () => {
    const bars = Array.from({ length: 8 }, (_, i) => c(i * H, 10 + i, 12 + i, 9 + i, 11 + i, 5));
    const out = resampleCandles(bars, '4h');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ time: 0, open: 10, high: 15, low: 9, close: 14, volume: 20 });
  });
  it('weekly buckets start on Monday and monthly on the 1st (UTC)', () => {
    const wed = Date.UTC(2026, 0, 7) / 1000; // Wednesday
    expect(new Date(bucketStart(wed, '1W') * 1000).getUTCDay()).toBe(1);
    expect(bucketStart(wed, '1M')).toBe(Date.UTC(2026, 0, 1) / 1000);
    expect(isBucketComplete(Date.UTC(2026, 0, 1) / 1000, '1M', Date.UTC(2026, 0, 31) / 1000)).toBe(false);
    expect(isBucketComplete(Date.UTC(2026, 0, 1) / 1000, '1M', Date.UTC(2026, 1, 1) / 1000)).toBe(true);
  });
  it('unknown volume stays unknown after aggregation', () => {
    const out = resampleCandles([c(0, 1, 1, 1, 1, null), c(H, 1, 1, 1, 1, 5)], '4h');
    expect(out[0].volume).toBeNull();
  });
});

describe('dataset fingerprint', () => {
  it('is stable and sensitive to changes', () => {
    expect(datasetFingerprint([1, 2, 3])).toBe(datasetFingerprint([1, 2, 3]));
    expect(datasetFingerprint([1, 2, 3])).not.toBe(datasetFingerprint([1, 2, 3.0001]));
  });
});
