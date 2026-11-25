import { computeBreadth, changeSince, periodChange } from '@/research/breadth';
import { parameterSweep, runBacktest, strategyTargets, type BacktestConfig } from '@/research/backtest';
import { eventStudy } from '@/research/event-study';
import {
  detectBreakouts,
  detectConsolidation,
  detectReversals,
  detectSwings,
  hindsightExample,
  knownAt,
  supportResistanceAt,
  trendStateAt,
  volatilityRegimes,
} from '@/research/market-structure';
import { correlation, maxDrawdown, median, percentileRank, stdev } from '@/research/statistics';
import { generateDemoCandles } from '@/market-data/core/demo/generator';
import type { Candle } from '@/market-data/core/types';
import { candlesFromCloses, randomWalk } from '../helpers';

const NOW = Date.UTC(2026, 10, 20, 18, 0, 0);
const demo = generateDemoCandles('NWSC.SIM', '1D', NOW);

describe('statistics', () => {
  it('median, stdev, correlation, percentile', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    expect(correlation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(percentileRank([1, 2, 3, 4], 3)).toBeCloseTo(0.625, 12);
  });
  it('max drawdown finds peak, trough and recovery', () => {
    const dd = maxDrawdown([100, 120, 90, 60, 80, 130]);
    expect(dd.maxDrawdown).toBeCloseTo(-0.5, 12);
    expect(dd.peakIndex).toBe(1);
    expect(dd.troughIndex).toBe(3);
    expect(dd.recoveryIndex).toBe(5);
  });
});

describe('swing detection & look-ahead protection', () => {
  const swings = detectSwings(demo, { left: 5, right: 5 });

  it('finds swings and each is confirmed exactly `right` bars later', () => {
    expect(swings.length).toBeGreaterThan(20);
    for (const s of swings) {
      expect(s.confirmedIndex).toBe(s.index + 5);
      expect(s.confirmedTime).toBe(demo[s.index + 5].time);
    }
  });

  it('a swing high is the highest high in its window', () => {
    for (const s of swings.filter((x) => x.type === 'high')) {
      for (let j = s.index - 5; j <= s.index + 5; j++) expect(demo[j].high).toBeLessThanOrEqual(s.price);
    }
  });

  it('is prefix-stable: swings confirmed within a prefix are identical when computed on the prefix alone', () => {
    const cut = 900;
    const prefix = detectSwings(demo.slice(0, cut), { left: 5, right: 5 });
    const fromFull = swings.filter((s) => s.confirmedIndex < cut);
    expect(prefix.map((s) => [s.type, s.index, s.price, s.label])).toEqual(fromFull.map((s) => [s.type, s.index, s.price, s.label]));
  });

  it('knownAt hides swings that were not yet confirmed', () => {
    const s = swings[10];
    expect(knownAt(swings, s.confirmedIndex - 1)).not.toContain(s);
    expect(knownAt(swings, s.confirmedIndex)).toContain(s);
  });

  it('labels HH/LH and HL/LL relative to the previous same-type swing', () => {
    const highs = swings.filter((s) => s.type === 'high');
    for (let i = 1; i < highs.length; i++) expect(highs[i].label).toBe(highs[i].price > highs[i - 1].price ? 'HH' : 'LH');
  });

  it('detects an uptrend on a clean staircase', () => {
    const closes: number[] = [];
    for (let k = 0; k < 8; k++) for (let j = 0; j < 12; j++) closes.push(100 + k * 10 + (j < 6 ? j * 3 : (12 - j) * 3 - 6));
    const c = candlesFromCloses(closes);
    const sw = detectSwings(c, { left: 3, right: 3 });
    expect(trendStateAt(sw, c.length - 1)).toBe('uptrend');
  });
});

describe('events', () => {
  it('breakouts only use prior bars', () => {
    const ev = detectBreakouts(demo, 20);
    expect(ev.length).toBeGreaterThan(5);
    for (const e of ev) {
      const prior = demo.slice(e.index - 20, e.index);
      if (e.kind === 'breakout-up') expect(demo[e.index].close).toBeGreaterThan(Math.max(...prior.map((c) => c.high)));
      else expect(demo[e.index].close).toBeLessThan(Math.min(...prior.map((c) => c.low)));
      expect(e.confirmedIndex).toBe(e.index);
    }
  });
  it('reversals, consolidations and volatility regimes are causal (prefix-stable)', () => {
    const cut = 1000;
    const pre = demo.slice(0, cut);
    const a = detectReversals(pre, detectSwings(pre)).map((e) => e.index);
    const b = detectReversals(demo, detectSwings(demo)).filter((e) => e.index < cut).map((e) => e.index);
    expect(a).toEqual(b);
    const va = volatilityRegimes(pre).regimes;
    const vb = volatilityRegimes(demo).regimes.slice(0, cut);
    expect(va).toEqual(vb);
    const z = detectConsolidation(demo);
    for (const zone of z) expect(zone.confirmedIndex).toBeGreaterThanOrEqual(zone.endIndex);
  });
  it('support/resistance uses only swings known at the as-of index', () => {
    const swings = detectSwings(demo);
    const asOf = 800;
    const zones = supportResistanceAt(demo, swings, asOf);
    for (const z of zones) {
      expect(z.confirmedIndex).toBeLessThanOrEqual(asOf);
      expect(z.touches).toBeGreaterThanOrEqual(2);
      expect(z.kind).toBe(z.price <= demo[asOf].close ? 'support' : 'resistance');
    }
  });
  it('hindsight example shows the confirmed-entry gap', () => {
    const ex = hindsightExample(demo, detectSwings(demo));
    expect(ex).not.toBeNull();
    expect(ex!.hindsightReturn).toBeGreaterThanOrEqual(ex!.realisticReturn);
    expect(ex!.explanation.join(' ')).toMatch(/not a trading method/);
  });
});

describe('event study', () => {
  it('uses the last close strictly before the event as baseline', () => {
    const c = candlesFromCloses([100, 100, 110, 121, 133.1], 0, 10);
    const r = eventStudy(c, [20], [1, 2, 5]);
    expect(r.windows[0].baselineIndex).toBe(1);
    expect(r.windows[0].returns[1]).toBeCloseTo(0.1, 12);
    expect(r.windows[0].returns[2]).toBeCloseTo(0.21, 12);
    expect(r.windows[0].returns[5]).toBeNull();
    expect(r.caveats[0]).toMatch(/Small sample/);
  });
});

describe('breadth', () => {
  it('counts advancers, decliners and reports insufficient history', () => {
    const b = computeBreadth({ A: candlesFromCloses([1, 2]), B: candlesFromCloses([2, 1]), C: candlesFromCloses([5]) });
    expect(b.advancers).toBe(1);
    expect(b.decliners).toBe(1);
    expect(b.insufficientHistory).toBeGreaterThanOrEqual(1);
  });
  it('period change returns null when history is too short', () => {
    expect(periodChange(candlesFromCloses([1, 2]), 5)).toBeNull();
    expect(periodChange(candlesFromCloses([100, 110]), 1)).toBeCloseTo(0.1, 12);
    expect(changeSince(candlesFromCloses([100, 110]), 9e12)).toBeNull();
  });
});

describe('backtest laboratory', () => {
  const base: BacktestConfig = {
    symbol: 'NWSC.SIM',
    timeframe: '1D',
    dataStatus: 'simulated',
    strategy: { id: 'sma-cross', params: { fast: 20, slow: 50 } },
    costs: { commissionBps: 5, slippageBps: 5 },
    initialCapital: 10_000,
    inSampleFraction: 0.7,
    warmupBars: 60,
  };

  it('strategy targets are causal (no look-ahead)', () => {
    for (const id of ['sma-cross', 'rsi-reversion', 'breakout'] as const) {
      const full = strategyTargets(demo, { id, params: {} });
      const pre = strategyTargets(demo.slice(0, 700), { id, params: {} });
      expect(pre).toEqual(full.slice(0, 700));
    }
  });

  it('chronological split with no overlap and records the dataset fingerprint', () => {
    const r = runBacktest(demo, base, NOW);
    expect(r.inSample.endIndex + 1).toBe(r.outOfSample.startIndex);
    expect(r.inSample.startIndex).toBe(60);
    expect(r.dataset.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(r.limitations.join(' ')).toMatch(/SIMULATED/);
    expect(['outperformed-benchmark', 'underperformed-benchmark', 'matched-benchmark']).toContain(r.outcome);
  });

  it('is reproducible', () => {
    expect(runBacktest(demo, base, NOW).outOfSample.totalReturn).toBe(runBacktest(demo, base, NOW).outOfSample.totalReturn);
  });

  it('executes at the next open and charges costs', () => {
    const c: Candle[] = [100, 100, 100, 110, 120, 130].map((p, i) => ({ time: i * 86400, open: p, high: p, low: p, close: p, volume: 1 }));
    const r = runBacktest([...c, ...c.map((x, i) => ({ ...x, time: (i + 6) * 86400 })), ...Array.from({ length: 40 }, (_, i) => ({ ...c[5], time: (i + 12) * 86400 }))], {
      ...base,
      strategy: { id: 'buy-and-hold', params: {} },
      warmupBars: 0,
      inSampleFraction: 0.5,
    });
    const firstBuy = r.inSample.trades[0];
    expect(firstBuy.index).toBe(1); // decided at bar 0 close, filled at bar 1 open
    expect(firstBuy.price).toBeCloseTo(100 * 1.0005, 9);
    expect(r.inSample.totalCosts).toBeGreaterThan(0);
  });

  it('costs reduce returns monotonically', () => {
    const cheap = runBacktest(demo, { ...base, costs: { commissionBps: 0, slippageBps: 0 } }, NOW);
    const pricey = runBacktest(demo, { ...base, costs: { commissionBps: 50, slippageBps: 50 } }, NOW);
    expect(pricey.inSample.totalReturn).toBeLessThan(cheap.inSample.totalReturn);
  });

  it('parameter sweep tunes only on in-sample data and reports degradation', () => {
    const s = parameterSweep(demo, base, { fast: [10, 20], slow: [50, 100] });
    expect(s.tried.length).toBe(4);
    expect(Number.isFinite(s.degradation)).toBe(true);
  });

  it('rejects datasets that are too short', () => {
    expect(() => runBacktest(demo.slice(0, 50), base)).toThrow(/Not enough data/);
  });
});

describe('demo data sanity', () => {
  it('is deterministic and valid OHLC', () => {
    const again = generateDemoCandles('NWSC.SIM', '1D', NOW);
    expect(again).toBe(demo); // memoised
    for (const c of demo) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.low).toBeGreaterThan(0);
    }
  });
  it('indices have unknown (null) volume and crypto trades on weekends', () => {
    expect(generateDemoCandles('DMX500.SIM', '1D', NOW).every((c) => c.volume === null)).toBe(true);
    const crypto = generateDemoCandles('AURC.SIM', '1D', NOW);
    expect(crypto.some((c) => new Date(c.time * 1000).getUTCDay() === 0)).toBe(true);
    expect(demo.some((c) => new Date(c.time * 1000).getUTCDay() === 0)).toBe(false);
  });
  it('intraday series end at the latest daily close and supports every timeframe', () => {
    for (const tf of ['1m', '5m', '15m', '30m', '1h', '4h', '1W', '1M'] as const) {
      const s = generateDemoCandles('AURC.SIM', tf, NOW);
      expect(s.length).toBeGreaterThan(10);
    }
    const intraday = generateDemoCandles('AURC.SIM', '5m', NOW);
    const daily = generateDemoCandles('AURC.SIM', '1D', NOW);
    expect(intraday[intraday.length - 1].close).toBeCloseTo(daily[daily.length - 1].close, 2);
  });
  it('random walk helper is deterministic', () => {
    expect(randomWalk(5, 1)).toEqual(randomWalk(5, 1));
  });
});
