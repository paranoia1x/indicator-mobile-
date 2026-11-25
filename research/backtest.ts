import { sma } from '../indicators/moving-averages';
import { rsi } from '../indicators/oscillators';
import type { Candle, DataStatus, Timeframe } from '../market-data/core/types';
import { datasetFingerprint } from '../market-data/core/random';
import { annualizedVolatility, cagr, maxDrawdown, simpleReturns } from './statistics';

/**
 * Historical backtesting laboratory (education/research only).
 *
 * Anti-leakage design:
 * - Strategy signals are evaluated at the CLOSE of bar i using only bars 0..i.
 * - Orders execute at the OPEN of bar i + 1 with adverse slippage and commission.
 * - Long-only, no leverage, no margin, no shorting.
 * - Chronological in-sample / out-of-sample split; the OOS segment is never used for tuning.
 */

export type StrategyId = 'buy-and-hold' | 'sma-cross' | 'rsi-reversion' | 'breakout';

export interface StrategySpec {
  id: StrategyId;
  params: Record<string, number>;
}

export const STRATEGY_INFO: Record<StrategyId, { name: string; description: string; params: { key: string; label: string; default: number; min: number; max: number }[] }> = {
  'buy-and-hold': { name: 'Buy & hold (benchmark)', description: 'Buys at the first available open of the segment (decision at bar close, fill next open) and holds to the end.', params: [] },
  'sma-cross': {
    name: 'Moving-average crossover',
    description: 'Long while the fast SMA is above the slow SMA; otherwise in cash.',
    params: [
      { key: 'fast', label: 'Fast SMA', default: 20, min: 2, max: 200 },
      { key: 'slow', label: 'Slow SMA', default: 50, min: 5, max: 400 },
    ],
  },
  'rsi-reversion': {
    name: 'RSI mean reversion',
    description: 'Enters when RSI closes below the lower threshold; exits when it closes above the upper threshold.',
    params: [
      { key: 'period', label: 'RSI period', default: 14, min: 2, max: 50 },
      { key: 'lower', label: 'Enter below', default: 30, min: 5, max: 50 },
      { key: 'upper', label: 'Exit above', default: 55, min: 40, max: 95 },
    ],
  },
  breakout: {
    name: 'Range breakout',
    description: 'Enters when the close exceeds the prior N-bar high; exits when the close falls below the prior N/2-bar low.',
    params: [{ key: 'lookback', label: 'Lookback (bars)', default: 55, min: 5, max: 250 }],
  },
};

/** Target exposure (0 = cash, 1 = fully invested) decided at the close of each bar. */
export function strategyTargets(candles: readonly Candle[], spec: StrategySpec): number[] {
  const closes = candles.map((c) => c.close);
  const n = candles.length;
  const t = new Array<number>(n).fill(0);
  switch (spec.id) {
    case 'buy-and-hold':
      return t.fill(1);
    case 'sma-cross': {
      const fast = sma(closes, Math.round(spec.params.fast ?? 20));
      const slow = sma(closes, Math.round(spec.params.slow ?? 50));
      for (let i = 0; i < n; i++) t[i] = fast[i] !== null && slow[i] !== null && (fast[i] as number) > (slow[i] as number) ? 1 : 0;
      return t;
    }
    case 'rsi-reversion': {
      const r = rsi(closes, Math.round(spec.params.period ?? 14));
      const lower = spec.params.lower ?? 30;
      const upper = spec.params.upper ?? 55;
      let pos = 0;
      for (let i = 0; i < n; i++) {
        const v = r[i];
        if (v !== null) {
          if (pos === 0 && v < lower) pos = 1;
          else if (pos === 1 && v > upper) pos = 0;
        }
        t[i] = pos;
      }
      return t;
    }
    case 'breakout': {
      const lb = Math.round(spec.params.lookback ?? 55);
      const exitLb = Math.max(2, Math.round(lb / 2));
      let pos = 0;
      for (let i = 0; i < n; i++) {
        if (i >= lb) {
          let hh = -Infinity;
          for (let j = i - lb; j < i; j++) hh = Math.max(hh, candles[j].high);
          let ll = Infinity;
          for (let j = i - exitLb; j < i; j++) ll = Math.min(ll, candles[j].low);
          if (pos === 0 && candles[i].close > hh) pos = 1;
          else if (pos === 1 && candles[i].close < ll) pos = 0;
        }
        t[i] = pos;
      }
      return t;
    }
  }
}

export interface CostModel {
  /** Commission in basis points of traded notional. */
  commissionBps: number;
  /** Adverse slippage in basis points applied to the execution price. */
  slippageBps: number;
}

export interface Trade {
  side: 'buy' | 'sell';
  index: number;
  time: number;
  price: number;
  quantity: number;
  cost: number;
}

export interface SegmentResult {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  observations: number;
  equity: number[];
  trades: Trade[];
  totalReturn: number;
  cagr: number | null;
  annualizedVolatility: number | null;
  maxDrawdown: number;
  exposure: number;
  roundTrips: number;
  winningRoundTrips: number;
  totalCosts: number;
}

/**
 * Simulates a strategy over candles[start..end] (inclusive). Indicators may use earlier bars
 * (warm-up from the past is legitimate) but no bar after the current one.
 */
export function runSegment(
  candles: readonly Candle[],
  targets: readonly number[],
  start: number,
  end: number,
  costs: CostModel,
  initialCapital: number,
  periodsPerYear: number,
): SegmentResult {
  let cash = initialCapital;
  let qty = 0;
  const equity: number[] = [];
  const trades: Trade[] = [];
  let investedBars = 0;
  let entryValue = 0;
  let roundTrips = 0;
  let wins = 0;
  let totalCosts = 0;
  const slip = costs.slippageBps / 10_000;
  const comm = costs.commissionBps / 10_000;

  for (let i = start; i <= end; i++) {
    // Execute yesterday's decision at today's open. For the first bar of the segment the
    // decision of bar start-1 is used only if it exists within the segment; we start flat.
    const decision = i > start ? targets[i - 1] : 0;
    const open = candles[i].open;
    if (decision === 1 && qty === 0) {
      const px = open * (1 + slip);
      const q = cash / (px * (1 + comm));
      const c = q * px * comm;
      qty = q;
      cash -= q * px + c;
      totalCosts += c + q * open * slip;
      entryValue = q * px + c;
      trades.push({ side: 'buy', index: i, time: candles[i].time, price: px, quantity: q, cost: c });
    } else if (decision === 0 && qty > 0) {
      const px = open * (1 - slip);
      const proceeds = qty * px;
      const c = proceeds * comm;
      cash += proceeds - c;
      totalCosts += c + qty * open * slip;
      roundTrips++;
      if (proceeds - c > entryValue) wins++;
      trades.push({ side: 'sell', index: i, time: candles[i].time, price: px, quantity: qty, cost: c });
      qty = 0;
    }
    if (qty > 0) investedBars++;
    equity.push(cash + qty * candles[i].close);
  }
  const totalReturn = equity[equity.length - 1] / initialCapital - 1;
  const years = (candles[end].time - candles[start].time) / (365.25 * 86400);
  return {
    startIndex: start,
    endIndex: end,
    startTime: candles[start].time,
    endTime: candles[end].time,
    observations: end - start + 1,
    equity,
    trades,
    totalReturn,
    cagr: years > 0.25 ? cagr(totalReturn, years) : null,
    annualizedVolatility: annualizedVolatility(simpleReturns(equity), periodsPerYear),
    maxDrawdown: maxDrawdown(equity).maxDrawdown,
    exposure: investedBars / (end - start + 1),
    roundTrips,
    winningRoundTrips: wins,
    totalCosts,
  };
}

export interface BacktestConfig {
  symbol: string;
  timeframe: Timeframe;
  dataStatus: DataStatus;
  strategy: StrategySpec;
  costs: CostModel;
  initialCapital: number;
  /** Fraction of bars used for in-sample (0.5–0.9). The rest is out-of-sample. */
  inSampleFraction: number;
  /** Bars reserved at the start for indicator warm-up (not traded). */
  warmupBars: number;
}

export interface ExperimentRecord {
  id: string;
  createdAt: number;
  config: BacktestConfig;
  dataset: { fingerprint: string; bars: number; firstTime: number; lastTime: number; status: DataStatus };
  inSample: SegmentResult;
  outOfSample: SegmentResult;
  benchmarkInSample: SegmentResult;
  benchmarkOutOfSample: SegmentResult;
  cashBenchmarkReturn: 0;
  /** Out-of-sample excess return vs buy & hold. Negative values are recorded, never hidden. */
  oosExcessReturn: number;
  outcome: 'outperformed-benchmark' | 'underperformed-benchmark' | 'matched-benchmark';
  assumptions: string[];
  limitations: string[];
  notes: string;
}

export const PERIODS_PER_YEAR: Record<Timeframe, number> = {
  '1m': 252 * 390,
  '5m': 252 * 78,
  '15m': 252 * 26,
  '30m': 252 * 13,
  '1h': 252 * 7,
  '4h': 252 * 2,
  '1D': 252,
  '1W': 52,
  '1M': 12,
};

export function runBacktest(candles: readonly Candle[], config: BacktestConfig, nowMs = Date.now()): ExperimentRecord {
  const n = candles.length;
  const warm = Math.max(0, Math.round(config.warmupBars));
  if (n - warm < 40) throw new Error(`Not enough data: ${n} bars (need at least ${warm + 40}).`);
  const frac = Math.min(0.9, Math.max(0.5, config.inSampleFraction));
  const splitIdx = warm + Math.floor((n - warm) * frac);
  const isStart = warm;
  const isEnd = splitIdx - 1;
  const oosStart = splitIdx;
  const oosEnd = n - 1;
  const ppy = config.dataStatus === 'simulated' && config.timeframe === '1D' ? 252 : PERIODS_PER_YEAR[config.timeframe];

  const targets = strategyTargets(candles, config.strategy);
  const bh = strategyTargets(candles, { id: 'buy-and-hold', params: {} });
  const inSample = runSegment(candles, targets, isStart, isEnd, config.costs, config.initialCapital, ppy);
  const outOfSample = runSegment(candles, targets, oosStart, oosEnd, config.costs, config.initialCapital, ppy);
  const benchmarkInSample = runSegment(candles, bh, isStart, isEnd, config.costs, config.initialCapital, ppy);
  const benchmarkOutOfSample = runSegment(candles, bh, oosStart, oosEnd, config.costs, config.initialCapital, ppy);
  const excess = outOfSample.totalReturn - benchmarkOutOfSample.totalReturn;

  const fp = datasetFingerprint(candles.flatMap((c) => [c.time, c.open, c.high, c.low, c.close]));
  return {
    id: `exp-${nowMs.toString(36)}-${fp.slice(0, 6)}`,
    createdAt: nowMs,
    config,
    dataset: { fingerprint: fp, bars: n, firstTime: candles[0].time, lastTime: candles[n - 1].time, status: config.dataStatus },
    inSample,
    outOfSample,
    benchmarkInSample,
    benchmarkOutOfSample,
    cashBenchmarkReturn: 0,
    oosExcessReturn: excess,
    outcome: Math.abs(excess) < 1e-4 ? 'matched-benchmark' : excess > 0 ? 'outperformed-benchmark' : 'underperformed-benchmark',
    assumptions: [
      'Signals use only information available at each bar close; orders fill at the next bar open.',
      `Commission ${config.costs.commissionBps} bps and adverse slippage ${config.costs.slippageBps} bps per trade.`,
      'Long-only, fully invested when in a position, no leverage, no dividends or interest on cash.',
      `Chronological split: first ${(frac * 100).toFixed(0)}% in-sample, remaining ${((1 - frac) * 100).toFixed(0)}% out-of-sample.`,
      `${warm} warm-up bars reserved for indicator initialisation.`,
    ],
    limitations: [
      config.dataStatus === 'simulated'
        ? 'Dataset is SIMULATED demo data — results say nothing about any real market.'
        : 'Survivorship bias: the instrument list only contains assets that exist today; delisted assets are absent.',
      'A single historical path; results can change materially with a different period or market.',
      'Fills at the open assume enough liquidity; gaps and partial fills are not modelled.',
      'Past simulated performance does not predict future results.',
    ],
    notes: '',
  };
}

export interface SweepResult {
  tried: { params: Record<string, number>; inSampleReturn: number }[];
  best: Record<string, number>;
  bestInSampleReturn: number;
  bestOutOfSampleReturn: number;
  benchmarkOutOfSampleReturn: number;
  /** Difference between the best in-sample and its out-of-sample return (overfitting indicator). */
  degradation: number;
}

/**
 * Parameter sweep on the IN-SAMPLE segment only, then evaluates the chosen parameters once on the
 * out-of-sample segment. Demonstrates how optimisation tends to overstate expected performance.
 */
export function parameterSweep(candles: readonly Candle[], base: BacktestConfig, grid: Record<string, number[]>): SweepResult {
  const keys = Object.keys(grid);
  const combos: Record<string, number>[] = [{}];
  for (const k of keys) {
    const next: Record<string, number>[] = [];
    for (const c of combos) for (const v of grid[k]) next.push({ ...c, [k]: v });
    combos.splice(0, combos.length, ...next);
  }
  const tried: SweepResult['tried'] = [];
  let best: Record<string, number> = combos[0];
  let bestR = -Infinity;
  for (const params of combos) {
    if (base.strategy.id === 'sma-cross' && params.fast >= params.slow) continue;
    const rec = runBacktest(candles, { ...base, strategy: { id: base.strategy.id, params } });
    tried.push({ params, inSampleReturn: rec.inSample.totalReturn });
    if (rec.inSample.totalReturn > bestR) {
      bestR = rec.inSample.totalReturn;
      best = params;
    }
  }
  const final = runBacktest(candles, { ...base, strategy: { id: base.strategy.id, params: best } });
  return {
    tried,
    best,
    bestInSampleReturn: bestR,
    bestOutOfSampleReturn: final.outOfSample.totalReturn,
    benchmarkOutOfSampleReturn: final.benchmarkOutOfSample.totalReturn,
    degradation: bestR - final.outOfSample.totalReturn,
  };
}
