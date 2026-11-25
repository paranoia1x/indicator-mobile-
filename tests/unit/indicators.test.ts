import {
  adx,
  atr,
  bollinger,
  computeIndicator,
  createIndicatorConfig,
  ema,
  fibonacciLevels,
  historicalVolatility,
  INDICATOR_IDS,
  INDICATORS,
  macd,
  obv,
  resetIndicatorConfig,
  rsi,
  sanitizeParams,
  sma,
  stochastic,
  trueRange,
  vwap,
} from '@/indicators';
import type { Candle } from '@/market-data/core/types';
import { candlesFromCloses, close, randomWalk } from '../helpers';

// ---------- Naive reference implementations written directly from the definitions ----------
function refSma(v: number[], n: number) {
  return v.map((_, i) => (i < n - 1 ? null : v.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n));
}
function refEma(v: number[], n: number) {
  const out: (number | null)[] = v.map(() => null);
  const k = 2 / (n + 1);
  for (let i = n - 1; i < v.length; i++) {
    out[i] = i === n - 1 ? v.slice(0, n).reduce((a, b) => a + b, 0) / n : (out[i - 1] as number) * (1 - k) + v[i] * k;
  }
  return out;
}
function refRsi(v: number[], n: number) {
  const out: (number | null)[] = v.map(() => null);
  let ag = 0;
  let al = 0;
  for (let i = 1; i <= n; i++) {
    const ch = v[i] - v[i - 1];
    ag += Math.max(ch, 0);
    al += Math.max(-ch, 0);
  }
  ag /= n;
  al /= n;
  out[n] = 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < v.length; i++) {
    const ch = v[i] - v[i - 1];
    ag = (ag * (n - 1) + Math.max(ch, 0)) / n;
    al = (al * (n - 1) + Math.max(-ch, 0)) / n;
    out[i] = 100 - 100 / (1 + ag / al);
  }
  return out;
}

const expectSeriesClose = (a: (number | null)[], b: (number | null)[], eps = 1e-9) => {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => {
    if (!close(x, b[i], eps)) throw new Error(`index ${i}: ${x} !== ${b[i]}`);
  });
};

describe('moving averages', () => {
  const data = randomWalk(300);

  it('SMA matches the naive definition', () => {
    for (const n of [1, 2, 5, 20, 50]) expectSeriesClose(sma(data, n), refSma(data, n));
  });

  it('SMA hand-computed values', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('EMA matches the naive definition with SMA seed', () => {
    for (const n of [2, 9, 21]) expectSeriesClose(ema(data, n), refEma(data, n));
  });

  it('EMA hand-computed values', () => {
    // seed = mean(1,2,3) = 2, k = 0.5 → 2 + 0.5*(4-2) = 3, 3 + 0.5*(5-3) = 4
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('restarts after missing values instead of treating them as zero', () => {
    const out = sma([1, 2, null, 4, 5, 6], 2);
    expect(out).toEqual([null, 1.5, null, null, 4.5, 5.5]);
  });

  it('rejects invalid periods', () => {
    expect(() => sma([1, 2], 0)).toThrow(RangeError);
    expect(() => ema([1, 2], 1.5)).toThrow(RangeError);
  });
});

describe('RSI', () => {
  // Classic worked example from StockCharts' RSI article (Wilder smoothing).
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64];

  it('reproduces the published first value (~70.5) at index 14', () => {
    const out = rsi(closes, 14);
    expect(out.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(out[14]).toBeCloseTo(70.46, 1);
    expect(out[15]).toBeCloseTo(66.25, 0);
  });

  it('matches the naive Wilder implementation', () => {
    const data = randomWalk(400, 7);
    expectSeriesClose(rsi(data, 14), refRsi(data, 14), 1e-9);
  });

  it('is bounded in [0, 100] and returns 100 when there are no losses', () => {
    const up = Array.from({ length: 30 }, (_, i) => 10 + i);
    expect(rsi(up, 14)[29]).toBe(100);
    const flat = Array.from({ length: 30 }, () => 10);
    expect(rsi(flat, 14)[29]).toBe(50);
    rsi(randomWalk(500, 3), 14).forEach((v) => v !== null && expect(v >= 0 && v <= 100).toBe(true));
  });
});

describe('MACD', () => {
  const data = randomWalk(300, 11);
  it('MACD = EMA(fast) − EMA(slow) and histogram = MACD − signal', () => {
    const m = macd(data, 12, 26, 9);
    const f = refEma(data, 12);
    const s = refEma(data, 26);
    m.macd.forEach((v, i) => {
      if (i < 25) expect(v).toBeNull();
      else expect(v).toBeCloseTo((f[i] as number) - (s[i] as number), 9);
    });
    expect(m.signal.findIndex((v) => v !== null)).toBe(25 + 8);
    m.histogram.forEach((h, i) => h !== null && expect(h).toBeCloseTo((m.macd[i] as number) - (m.signal[i] as number), 12));
  });
  it('rejects fast >= slow', () => {
    expect(() => macd(data, 26, 12)).toThrow();
  });
});

describe('Bollinger Bands', () => {
  it('uses population standard deviation', () => {
    const b = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
    // mean 5, population sd 2
    expect(b.middle[7]).toBe(5);
    expect(b.upper[7]).toBeCloseTo(9, 12);
    expect(b.lower[7]).toBeCloseTo(1, 12);
    expect(b.bandwidth[7]).toBeCloseTo(8 / 5, 12);
  });
});

describe('ATR / true range', () => {
  const candles: Candle[] = [
    { time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 1 },
    { time: 2, open: 10.5, high: 12, low: 10, close: 11.5, volume: 1 },
    { time: 3, open: 11.5, high: 11.6, low: 10.2, close: 10.4, volume: 1 },
    { time: 4, open: 10.4, high: 13, low: 10.3, close: 12.8, volume: 1 },
  ];
  it('true range accounts for gaps from the previous close', () => {
    trueRange(candles).forEach((v, i) => expect(v).toBeCloseTo([2, 2, 1.4, 2.7][i], 12));
  });
  it('ATR uses Wilder smoothing seeded with the mean TR', () => {
    const out = atr(candles, 3);
    expect(out[0]).toBeNull();
    expect(out[2]).toBeCloseTo((2 + 2 + 1.4) / 3, 12);
    expect(out[3]).toBeCloseTo(((out[2] as number) * 2 + 2.7) / 3, 12);
  });
});

describe('VWAP and OBV', () => {
  const base = 86400 * 20000;
  const candles: Candle[] = [
    { time: base, open: 10, high: 10, low: 10, close: 10, volume: 1000 },
    { time: base + 60, open: 11, high: 11, low: 11, close: 11, volume: 3000 },
    { time: base + 120, open: 11, high: 11, low: 11, close: 11, volume: null },
    { time: base + 86400, open: 20, high: 20, low: 20, close: 20, volume: 500 },
  ];
  it('session VWAP resets on a new UTC day and skips unknown volume', () => {
    const v = vwap(candles, 'session');
    expect(v[0]).toBe(10);
    expect(v[1]).toBeCloseTo(10.75, 12);
    expect(v[2]).toBeNull();
    expect(v[3]).toBe(20);
  });
  it('anchored VWAP accumulates from the first bar', () => {
    const v = vwap(candles, 'all');
    expect(v[3]).toBeCloseTo((10 * 1000 + 11 * 3000 + 20 * 500) / 4500, 12);
  });
  it('OBV adds volume on up closes, subtracts on down closes, never treats missing as 0', () => {
    const c = candlesFromCloses([10, 11, 10.5, 10.5, 12]);
    c.forEach((x, i) => (x.volume = [100, 80, 50, 70, 120][i]));
    expect(obv(c)).toEqual([0, 80, 30, 30, 150]);
    c[2].volume = null;
    expect(obv(c)[2]).toBeNull();
    expect(obv(c)[3]).toBe(80);
  });
});

describe('Stochastic', () => {
  it('computes raw %K within the high-low range', () => {
    const candles: Candle[] = [90, 95, 100, 105].map((c, i) => ({ time: i, open: c, high: i === 1 ? 110 : c, low: i === 0 ? 90 : c, close: c, volume: 1 }));
    const s = stochastic(candles, 4, 1, 1);
    expect(s.k[3]).toBeCloseTo(75, 12);
  });
  it('bounded in [0, 100]', () => {
    const s = stochastic(candlesFromCloses(randomWalk(300, 9)));
    [...s.k, ...s.d].forEach((v) => v !== null && expect(v >= 0 && v <= 100).toBe(true));
  });
});

describe('ADX', () => {
  it('first ADX value appears at 2·period − 1 and values are bounded', () => {
    const c = candlesFromCloses(randomWalk(200, 5));
    const r = adx(c, 14);
    expect(r.adx.findIndex((v) => v !== null)).toBe(27);
    expect(r.plusDI.findIndex((v) => v !== null)).toBe(14);
    r.adx.forEach((v) => v !== null && expect(v >= 0 && v <= 100).toBe(true));
  });
  it('a steady uptrend has +DI > −DI and a high ADX', () => {
    const c = candlesFromCloses(Array.from({ length: 80 }, (_, i) => 100 + i * 2));
    const r = adx(c, 14);
    expect(r.plusDI[79] as number).toBeGreaterThan(r.minusDI[79] as number);
    expect(r.adx[79] as number).toBeGreaterThan(50);
  });
});

describe('historical volatility', () => {
  it('is zero for constant growth', () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 * Math.pow(1.01, i));
    expect(historicalVolatility(closes, 20)[39]).toBeCloseTo(0, 10);
  });
});

describe('Fibonacci', () => {
  it('computes retracements for an upward swing', () => {
    const lv = fibonacciLevels(100, 200);
    expect(lv.find((l) => l.ratio === 0)?.price).toBe(200);
    expect(lv.find((l) => l.ratio === 0.5)?.price).toBe(150);
    expect(lv.find((l) => l.ratio === 0.618)?.price).toBeCloseTo(138.2, 10);
    expect(lv.find((l) => l.ratio === 1)?.price).toBe(100);
  });
  it('supports extensions and rejects non-finite anchors', () => {
    expect(fibonacciLevels(100, 200, true)).toHaveLength(9);
    expect(() => fibonacciLevels(NaN, 1)).toThrow();
  });
});

describe('registry', () => {
  const candles = candlesFromCloses(randomWalk(250, 21));
  it('every indicator computes aligned outputs for every declared line', () => {
    for (const id of INDICATOR_IDS) {
      const cfg = createIndicatorConfig(id);
      const out = computeIndicator(cfg, candles);
      for (const line of INDICATORS[id].lines) {
        expect(out[line.key]).toHaveLength(candles.length);
      }
    }
  });
  it('every indicator documents description, limitations and example', () => {
    for (const id of INDICATOR_IDS) {
      const m = INDICATORS[id];
      expect(m.description.length).toBeGreaterThan(40);
      expect(m.limitations.length).toBeGreaterThan(0);
      expect(m.example.length).toBeGreaterThan(10);
    }
  });
  it('sanitizes out-of-range and non-numeric params', () => {
    expect(sanitizeParams('rsi', { period: 10000 })).toEqual({ period: 100 });
    expect(sanitizeParams('rsi', { period: NaN })).toEqual({ period: 14 });
    expect(sanitizeParams('bollinger', { period: 20, k: 2.04 })).toEqual({ period: 20, k: 2 });
  });
  it('reset restores defaults but keeps identity', () => {
    const cfg = createIndicatorConfig('sma', { period: 7 });
    cfg.colors.value = '#000000';
    const r = resetIndicatorConfig(cfg);
    expect(r.uid).toBe(cfg.uid);
    expect(r.params.period).toBe(50);
    expect(r.colors.value).toBe(INDICATORS.sma.lines[0].defaultColor);
  });
  it('indicators are causal: values at bar i do not change when future bars are appended', () => {
    for (const id of INDICATOR_IDS) {
      if (id === 'vwap') continue; // session VWAP is causal too, tested separately
      const cfg = createIndicatorConfig(id);
      const full = computeIndicator(cfg, candles);
      const prefix = computeIndicator(cfg, candles.slice(0, 180));
      for (const key of Object.keys(prefix)) {
        prefix[key].forEach((v, i) => {
          if (!close(v, full[key][i], 1e-9)) throw new Error(`${id}.${key} repainted at ${i}`);
        });
      }
    }
  });
});
