import type { Candle } from '../market-data/core/types';
import { ema, sma, type Out } from './moving-averages';
import { macd, rsi, stochastic } from './oscillators';
import { adx } from './trend';
import { atr, bollinger } from './volatility';
import { obv, vwap } from './volume';

export type IndicatorId = 'sma' | 'ema' | 'bollinger' | 'vwap' | 'rsi' | 'macd' | 'stochastic' | 'atr' | 'adx' | 'obv';

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface LineDef {
  key: string;
  label: string;
  defaultColor: string;
  kind: 'line' | 'histogram';
}

export interface IndicatorMeta {
  id: IndicatorId;
  name: string;
  short: string;
  /** overlay = drawn on the price chart; pane = separate panel below. */
  placement: 'overlay' | 'pane';
  params: ParamDef[];
  lines: LineDef[];
  /** Horizontal guide lines for oscillators (e.g. 30/70 for RSI). */
  guides?: number[];
  description: string;
  howToRead: string;
  example: string;
  historicalBehavior: string;
  limitations: string[];
}

export interface IndicatorConfig {
  uid: string;
  id: IndicatorId;
  params: Record<string, number>;
  colors: Record<string, string>;
  visible: boolean;
}

const C = {
  blue: '#4C8DFF',
  amber: '#F5B544',
  violet: '#A78BFA',
  teal: '#2DD4BF',
  pink: '#F472B6',
  slate: '#94A3B8',
  green: '#22C55E',
  red: '#EF4444',
};

export const INDICATORS: Record<IndicatorId, IndicatorMeta> = {
  sma: {
    id: 'sma',
    name: 'Simple Moving Average',
    short: 'SMA',
    placement: 'overlay',
    params: [{ key: 'period', label: 'Period', min: 2, max: 400, step: 1, default: 50 }],
    lines: [{ key: 'value', label: 'SMA', defaultColor: C.amber, kind: 'line' }],
    description: 'The arithmetic mean of the last N closing prices. It smooths day-to-day noise so the general direction of past prices is easier to see.',
    howToRead: 'Price above a rising average means recent prices have been higher than the average of the window; price below a falling average means the opposite. Longer periods react more slowly.',
    example: 'A 50-day SMA of 102.40 means the average close over the previous 50 sessions was 102.40.',
    historicalBehavior: 'Because it equally weights every bar in the window, the SMA lags turning points by roughly half the period. Crossovers of short and long averages occur after a move has already started.',
    limitations: ['Always lags price — it describes the past, not the future.', 'Produces many false crossover signals in sideways markets.', 'Needs N bars of history before the first value appears.'],
  },
  ema: {
    id: 'ema',
    name: 'Exponential Moving Average',
    short: 'EMA',
    placement: 'overlay',
    params: [{ key: 'period', label: 'Period', min: 2, max: 400, step: 1, default: 21 }],
    lines: [{ key: 'value', label: 'EMA', defaultColor: C.teal, kind: 'line' }],
    description: 'A moving average that gives more weight to recent prices using a smoothing factor of 2 / (N + 1). It is seeded with a simple average of the first N closes.',
    howToRead: 'Reacts faster than an SMA of the same period, so it turns sooner — and also gets whipsawed more often.',
    example: 'With N = 21, the newest close gets about 9.1% weight (2 / 22) and older closes decay geometrically.',
    historicalBehavior: 'Less lag than the SMA, but it still confirms trends only after they are under way.',
    limitations: ['Still a lagging, backward-looking measure.', 'Early values depend on the seeding method, so different software can differ slightly at the start.'],
  },
  bollinger: {
    id: 'bollinger',
    name: 'Bollinger Bands',
    short: 'BB',
    placement: 'overlay',
    params: [
      { key: 'period', label: 'Period', min: 5, max: 200, step: 1, default: 20 },
      { key: 'k', label: 'Std. deviations', min: 0.5, max: 4, step: 0.1, default: 2 },
    ],
    lines: [
      { key: 'upper', label: 'Upper', defaultColor: C.violet, kind: 'line' },
      { key: 'middle', label: 'Middle', defaultColor: C.slate, kind: 'line' },
      { key: 'lower', label: 'Lower', defaultColor: C.violet, kind: 'line' },
    ],
    description: 'A moving average with bands placed k standard deviations above and below it. The bands widen when recent prices have been volatile and narrow when they have been calm.',
    howToRead: 'Narrow bands ("squeeze") describe a period of low recent volatility. Touching a band only means the close was far from its recent average relative to recent volatility.',
    example: 'Middle 100, standard deviation 2.5, k = 2 → upper 105, lower 95.',
    historicalBehavior: 'Low-volatility periods have often been followed by higher volatility, but the direction of the subsequent move is not indicated by the bands.',
    limitations: ['A close outside the bands is not by itself a buy or sell signal.', 'Assumes a symmetric spread that real returns often do not have.', 'Uses past volatility, which can change abruptly.'],
  },
  vwap: {
    id: 'vwap',
    name: 'Volume-Weighted Average Price',
    short: 'VWAP',
    placement: 'overlay',
    params: [{ key: 'anchorAll', label: 'Anchor to first bar (0 = session)', min: 0, max: 1, step: 1, default: 0 }],
    lines: [{ key: 'value', label: 'VWAP', defaultColor: C.pink, kind: 'line' }],
    description: 'The average price weighted by volume, using the typical price (high + low + close) / 3. Intraday VWAP resets at each new session (UTC day).',
    howToRead: 'Shows where most volume traded on average since the anchor. Institutions often use it as a benchmark for execution quality.',
    example: 'If 1,000 shares trade at 10 and 3,000 at 11, VWAP = (10·1,000 + 11·3,000) / 4,000 = 10.75.',
    historicalBehavior: 'Price often oscillates around session VWAP intraday; on daily charts an anchored VWAP drifts toward the long-run average traded price.',
    limitations: ['Requires reliable volume data — unavailable for indices and some feeds.', 'Session boundaries here use UTC days, which may differ from exchange sessions.', 'Volume from a single venue (e.g. IEX) may not represent the whole market.'],
  },
  rsi: {
    id: 'rsi',
    name: 'Relative Strength Index',
    short: 'RSI',
    placement: 'pane',
    params: [{ key: 'period', label: 'Period', min: 2, max: 100, step: 1, default: 14 }],
    lines: [{ key: 'value', label: 'RSI', defaultColor: C.violet, kind: 'line' }],
    guides: [30, 50, 70],
    description: "J. Welles Wilder's momentum oscillator: 100 − 100 / (1 + average gain / average loss) over N periods, using Wilder's smoothing. Ranges 0–100.",
    howToRead: 'Readings above 70 are conventionally called "overbought" and below 30 "oversold" — these describe how one-sided recent changes were, not what will happen next.',
    example: 'Average gain 0.24 and average loss 0.10 → RS 2.4 → RSI ≈ 70.6.',
    historicalBehavior: 'In strong trends RSI can stay above 70 (or below 30) for long periods while price keeps moving in the same direction.',
    limitations: ['"Overbought" does not mean price must fall.', 'Thresholds that worked in one market or period may not work in another.', 'Needs N + 1 closes before the first value.'],
  },
  macd: {
    id: 'macd',
    name: 'Moving Average Convergence Divergence',
    short: 'MACD',
    placement: 'pane',
    params: [
      { key: 'fast', label: 'Fast EMA', min: 2, max: 100, step: 1, default: 12 },
      { key: 'slow', label: 'Slow EMA', min: 3, max: 200, step: 1, default: 26 },
      { key: 'signal', label: 'Signal EMA', min: 2, max: 50, step: 1, default: 9 },
    ],
    lines: [
      { key: 'histogram', label: 'Histogram', defaultColor: C.slate, kind: 'histogram' },
      { key: 'macd', label: 'MACD', defaultColor: C.blue, kind: 'line' },
      { key: 'signal', label: 'Signal', defaultColor: C.amber, kind: 'line' },
    ],
    guides: [0],
    description: 'The difference between a fast and slow EMA of closing prices, plus a signal line (EMA of MACD) and a histogram of their difference.',
    howToRead: 'MACD above zero means the fast average is above the slow average (recent prices have risen relative to older ones). The histogram shows whether that gap is widening or narrowing.',
    example: 'EMA12 = 105.2, EMA26 = 103.9 → MACD = 1.3.',
    historicalBehavior: 'Crossovers lag price turns because they are built from two lagging averages, and they produce frequent false signals in ranges.',
    limitations: ['Values are in price units, so they cannot be compared across assets of different prices.', 'Lagging by construction.', 'Divergences can persist for a long time without a reversal.'],
  },
  stochastic: {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    short: 'Stoch',
    placement: 'pane',
    params: [
      { key: 'k', label: '%K period', min: 2, max: 100, step: 1, default: 14 },
      { key: 'smooth', label: '%K smoothing', min: 1, max: 10, step: 1, default: 3 },
      { key: 'd', label: '%D period', min: 1, max: 10, step: 1, default: 3 },
    ],
    lines: [
      { key: 'k', label: '%K', defaultColor: C.blue, kind: 'line' },
      { key: 'd', label: '%D', defaultColor: C.amber, kind: 'line' },
    ],
    guides: [20, 50, 80],
    description: "Where the close sits within the recent high–low range: 100 × (close − lowest low) / (highest high − lowest low). %D is a moving average of %K.",
    howToRead: 'High readings mean closes near the top of the recent range; low readings mean closes near the bottom.',
    example: 'Range 90–110 over 14 bars and close 105 → raw %K = 75.',
    historicalBehavior: 'Like RSI, it can remain at extremes during persistent trends.',
    limitations: ['Very sensitive in volatile markets.', 'When the high–low range is zero the value is undefined; this app shows 50.'],
  },
  atr: {
    id: 'atr',
    name: 'Average True Range',
    short: 'ATR',
    placement: 'pane',
    params: [{ key: 'period', label: 'Period', min: 2, max: 100, step: 1, default: 14 }],
    lines: [{ key: 'value', label: 'ATR', defaultColor: C.teal, kind: 'line' }],
    description: "Wilder's measure of volatility: the smoothed average of the true range (the largest of high − low, |high − previous close|, |low − previous close|).",
    howToRead: 'Higher ATR means bars have recently covered a wider price range. It says nothing about direction.',
    example: 'ATR 2.5 on a 100 stock means bars recently spanned about 2.5% on average.',
    historicalBehavior: 'Volatility tends to cluster — calm periods and turbulent periods each tend to persist for a while, then change.',
    limitations: ['Measured in price units; compare across assets as a percentage of price instead.', 'Backward-looking.'],
  },
  adx: {
    id: 'adx',
    name: 'Average Directional Index',
    short: 'ADX',
    placement: 'pane',
    params: [{ key: 'period', label: 'Period', min: 2, max: 100, step: 1, default: 14 }],
    lines: [
      { key: 'adx', label: 'ADX', defaultColor: C.amber, kind: 'line' },
      { key: 'plusDI', label: '+DI', defaultColor: C.green, kind: 'line' },
      { key: 'minusDI', label: '−DI', defaultColor: C.red, kind: 'line' },
    ],
    guides: [20, 25],
    description: "Wilder's trend-strength indicator built from directional movement (+DI and −DI). ADX measures how strong the recent directional movement was, not its direction.",
    howToRead: 'ADX above ~25 is often described as a "trending" condition; below ~20 as "range-bound". +DI above −DI means upward movement has dominated recently.',
    example: '+DI 28, −DI 12 → DX = 100 × 16 / 40 = 40; ADX is a smoothed average of DX.',
    historicalBehavior: 'ADX rises during sustained moves in either direction and is slow to react — it needs about 2 × N bars to start.',
    limitations: ['Very lagging (double smoothing).', 'Thresholds such as 25 are conventions, not laws.'],
  },
  obv: {
    id: 'obv',
    name: 'On-Balance Volume',
    short: 'OBV',
    placement: 'pane',
    params: [],
    lines: [{ key: 'value', label: 'OBV', defaultColor: C.blue, kind: 'line' }],
    description: 'A running total that adds the bar volume on up-closes and subtracts it on down-closes.',
    howToRead: 'The slope matters, not the absolute level. Rising OBV means more volume has occurred on up days than down days over the window shown.',
    example: 'Volumes 100 (up), 80 (down), 120 (up) → OBV 0 → 100 → 20 → 140.',
    historicalBehavior: 'Sometimes moves before price, sometimes after; the relationship is inconsistent.',
    limitations: ['The absolute value depends on the starting bar.', 'Requires volume data; bars with unknown volume are skipped.', 'A single huge-volume day can dominate.'],
  },
};

export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];

let uidCounter = 0;
export function createIndicatorConfig(id: IndicatorId, overrides?: Partial<Record<string, number>>): IndicatorConfig {
  const meta = INDICATORS[id];
  const params: Record<string, number> = {};
  for (const p of meta.params) params[p.key] = overrides?.[p.key] ?? p.default;
  const colors: Record<string, string> = {};
  for (const l of meta.lines) colors[l.key] = l.defaultColor;
  uidCounter = (uidCounter + 1) % 1e6;
  return { uid: `${id}-${Date.now().toString(36)}-${uidCounter}`, id, params, colors, visible: true };
}

/** Resets parameters and colours to their documented defaults, preserving identity/visibility. */
export function resetIndicatorConfig(cfg: IndicatorConfig): IndicatorConfig {
  const fresh = createIndicatorConfig(cfg.id);
  return { ...fresh, uid: cfg.uid, visible: cfg.visible };
}

/** Clamps user-provided params to their documented ranges (input validation). */
export function sanitizeParams(id: IndicatorId, params: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of INDICATORS[id].params) {
    const raw = Number(params[p.key]);
    const v = Number.isFinite(raw) ? raw : p.default;
    const stepped = p.step >= 1 ? Math.round(v) : Math.round(v / p.step) * p.step;
    out[p.key] = Math.min(p.max, Math.max(p.min, stepped));
  }
  return out;
}

/** Computes all output lines of an indicator for the given candles. */
export function computeIndicator(cfg: Pick<IndicatorConfig, 'id' | 'params'>, candles: readonly Candle[]): Record<string, Out> {
  const p = sanitizeParams(cfg.id, cfg.params);
  const closes = candles.map((c) => c.close);
  switch (cfg.id) {
    case 'sma':
      return { value: sma(closes, p.period) };
    case 'ema':
      return { value: ema(closes, p.period) };
    case 'bollinger': {
      const b = bollinger(closes, p.period, p.k);
      return { upper: b.upper, middle: b.middle, lower: b.lower };
    }
    case 'vwap':
      return { value: vwap(candles, p.anchorAll === 1 ? 'all' : 'session') };
    case 'rsi':
      return { value: rsi(closes, p.period) };
    case 'macd': {
      const fast = Math.min(p.fast, p.slow - 1);
      const m = macd(closes, fast, Math.max(p.slow, fast + 1), p.signal);
      return { macd: m.macd, signal: m.signal, histogram: m.histogram };
    }
    case 'stochastic': {
      const s = stochastic(candles, p.k, p.smooth, p.d);
      return { k: s.k, d: s.d };
    }
    case 'atr':
      return { value: atr(candles, p.period) };
    case 'adx': {
      const a = adx(candles, p.period);
      return { adx: a.adx, plusDI: a.plusDI, minusDI: a.minusDI };
    }
    case 'obv':
      return { value: obv(candles) };
  }
}

/** Short label such as "RSI 14" or "MACD 12 26 9". */
export function indicatorLabel(cfg: Pick<IndicatorConfig, 'id' | 'params'>): string {
  const meta = INDICATORS[cfg.id];
  const vals = meta.params.filter((p) => p.key !== 'anchorAll').map((p) => cfg.params[p.key] ?? p.default);
  return [meta.short, ...vals].join(' ');
}
