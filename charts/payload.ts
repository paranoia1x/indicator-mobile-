import { fibonacciLevels } from '../indicators/fibonacci';
import { computeIndicator, INDICATORS, indicatorLabel, type IndicatorConfig } from '../indicators/registry';
import type { Candle } from '../market-data/core/types';
import type { EconomicEvent } from '../news/core/calendar';
import { detectBreakouts, detectReversals, detectSwings, knownAt, supportResistanceAt } from '../research/market-structure';

/** JSON payload consumed by the chart renderer inside the WebView (see charts/html.ts). */
export type ChartType = 'candles' | 'line' | 'area' | 'ohlc';

export interface ChartColors {
  bg: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  accent: string;
  muted: string;
  crosshair: string;
}

export interface LinePoint {
  time: number;
  value: number;
}
export interface HistPoint extends LinePoint {
  color?: string;
}

export interface PayloadLine {
  id: string;
  label: string;
  color: string;
  kind: 'line' | 'histogram';
  data: (LinePoint | HistPoint)[];
}

export interface PayloadPane {
  id: string;
  title: string;
  lines: PayloadLine[];
  guides: number[];
}

export interface PayloadMarker {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  color: string;
  text?: string;
}

export interface PayloadPriceLine {
  price: number;
  color: string;
  title: string;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface PayloadSegment {
  id: string;
  color: string;
  a: LinePoint;
  b: LinePoint;
}

export interface ChartPayload {
  viewKey: string;
  resetView: boolean;
  chartType: ChartType;
  logScale: boolean;
  timeVisible: boolean;
  colors: ChartColors;
  candles: Candle[];
  volume: HistPoint[] | null;
  overlays: PayloadLine[];
  panes: PayloadPane[];
  markers: PayloadMarker[];
  priceLines: PayloadPriceLine[];
  segments: PayloadSegment[];
  watermark: string | null;
}

export interface ChartDrawing {
  id: string;
  kind: 'hline' | 'trend' | 'fib' | 'note';
  color: string;
  price?: number;
  time?: number;
  text?: string;
  label?: string;
  a?: { time: number; price: number };
  b?: { time: number; price: number };
}

export interface BuildArgs {
  viewKey: string;
  resetView?: boolean;
  candles: readonly Candle[];
  chartType: ChartType;
  logScale: boolean;
  intraday: boolean;
  showVolume: boolean;
  showStructure: boolean;
  indicators: IndicatorConfig[];
  events?: EconomicEvent[];
  drawings?: ChartDrawing[];
  colors: ChartColors;
  /** When set, only bars 0..replayIndex are shown and only information known by then. */
  replayIndex?: number | null;
  watermark?: string | null;
  maxBars?: number;
}

const EVENT_TAG: Record<string, string> = { earnings: 'E', fomc: 'FOMC', cpi: 'CPI', ppi: 'PPI', employment: 'JOBS', gdp: 'GDP', company: 'CO', other: '•' };

function toLine(candles: readonly Candle[], values: (number | null)[], offset: number): LinePoint[] {
  const out: LinePoint[] = [];
  for (let i = offset; i < candles.length; i++) {
    const v = values[i];
    if (v !== null && Number.isFinite(v)) out.push({ time: candles[i].time, value: v });
  }
  return out;
}

/** Snaps a timestamp (seconds) to the last bar time at or before it; null if before the data. */
export function snapToBar(candles: readonly Candle[], tSec: number): number | null {
  let lo = 0;
  let hi = candles.length - 1;
  if (hi < 0 || tSec < candles[0].time) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (candles[mid].time <= tSec) lo = mid;
    else hi = mid - 1;
  }
  return candles[lo].time;
}

export function buildChartPayload(args: BuildArgs): ChartPayload {
  const full = args.candles;
  const end = args.replayIndex != null ? Math.min(full.length - 1, Math.max(0, args.replayIndex)) : full.length - 1;
  const visible = full.slice(0, end + 1);
  const maxBars = args.maxBars ?? 2500;
  // Indicators are computed on all KNOWN bars (prefix) so warm-up is correct, then trimmed.
  const offset = Math.max(0, visible.length - maxBars);
  const shown = visible.slice(offset);
  const c = args.colors;

  const overlays: PayloadLine[] = [];
  const panes: PayloadPane[] = [];
  for (const cfg of args.indicators.filter((x) => x.visible)) {
    const meta = INDICATORS[cfg.id];
    const out = computeIndicator(cfg, visible);
    const lines: PayloadLine[] = meta.lines.map((l) => {
      const color = cfg.colors[l.key] ?? l.defaultColor;
      const pts = toLine(visible, out[l.key], offset);
      return {
        id: `${cfg.uid}:${l.key}`,
        label: `${meta.short} ${l.label}`,
        color,
        kind: l.kind,
        data: l.kind === 'histogram' ? pts.map((p) => ({ ...p, color: p.value >= 0 ? c.up + 'AA' : c.down + 'AA' })) : pts,
      };
    });
    if (meta.placement === 'overlay') overlays.push(...lines);
    else panes.push({ id: cfg.uid, title: indicatorLabel(cfg), lines, guides: meta.guides ?? [] });
  }

  const markers: PayloadMarker[] = [];
  const priceLines: PayloadPriceLine[] = [];
  const firstShown = shown[0]?.time ?? 0;

  if (args.showStructure && visible.length > 20) {
    const last = visible.length - 1;
    const swings = knownAt(detectSwings(visible), last);
    for (const s of swings) {
      if (s.time < firstShown) continue;
      const isHigh = s.type === 'high';
      const col = s.label === 'HH' || s.label === 'HL' ? c.up : s.label === 'LH' || s.label === 'LL' ? c.down : c.muted;
      markers.push({ time: s.time, position: isHigh ? 'aboveBar' : 'belowBar', shape: isHigh ? 'arrowDown' : 'arrowUp', color: col, text: s.label ?? (isHigh ? 'SH' : 'SL') });
    }
    for (const e of detectBreakouts(visible, 20).slice(-30)) {
      if (e.time < firstShown) continue;
      markers.push({ time: e.time, position: e.kind === 'breakout-up' ? 'belowBar' : 'aboveBar', shape: 'circle', color: c.accent, text: e.kind === 'breakout-up' ? 'BO↑' : 'BO↓' });
    }
    for (const e of detectReversals(visible, detectSwings(visible)).slice(-20)) {
      if (e.time < firstShown) continue;
      markers.push({ time: e.time, position: e.kind === 'reversal-up' ? 'belowBar' : 'aboveBar', shape: 'square', color: c.text, text: e.kind === 'reversal-up' ? 'BOS↑' : 'BOS↓' });
    }
    for (const z of supportResistanceAt(visible, detectSwings(visible), last, { maxZones: 4 })) {
      priceLines.push({ price: z.price, color: z.kind === 'support' ? c.up : c.down, title: `${z.kind === 'support' ? 'S' : 'R'} ×${z.touches}`, style: 'dashed' });
    }
  }

  const lastTime = visible[visible.length - 1]?.time ?? 0;
  for (const ev of args.events ?? []) {
    const t = Math.floor(ev.scheduledAt / 1000);
    if (t > lastTime + 86400 || t < firstShown) continue; // no future markers beyond the known data
    const snapped = snapToBar(shown, t);
    if (snapped === null) continue;
    markers.push({ time: snapped, position: 'belowBar', shape: 'circle', color: c.muted, text: EVENT_TAG[ev.kind] ?? '•' });
  }

  const segments: PayloadSegment[] = [];
  for (const d of args.drawings ?? []) {
    if (d.kind === 'hline' && d.price !== undefined) priceLines.push({ price: d.price, color: d.color, title: d.label ?? '', style: 'solid' });
    if (d.kind === 'trend' && d.a && d.b && d.a.time !== d.b.time) {
      const [a, b] = d.a.time < d.b.time ? [d.a, d.b] : [d.b, d.a];
      const sa = snapToBar(shown, a.time);
      const sb = snapToBar(shown, b.time);
      if (sa !== null && sb !== null && sa !== sb) segments.push({ id: d.id, color: d.color, a: { time: sa, value: a.price }, b: { time: sb, value: b.price } });
    }
    if (d.kind === 'fib' && d.a && d.b) {
      const [start, finish] = d.a.time <= d.b.time ? [d.a, d.b] : [d.b, d.a];
      for (const lv of fibonacciLevels(start.price, finish.price)) priceLines.push({ price: lv.price, color: d.color, title: `Fib ${lv.label}`, style: 'dotted' });
    }
    if (d.kind === 'note' && d.time !== undefined) {
      const t = snapToBar(shown, d.time);
      if (t !== null) markers.push({ time: t, position: 'aboveBar', shape: 'square', color: d.color, text: (d.text ?? 'Note').slice(0, 24) });
    }
  }
  markers.sort((a, b) => a.time - b.time);

  return {
    viewKey: args.viewKey,
    resetView: !!args.resetView,
    chartType: args.chartType,
    logScale: args.logScale,
    timeVisible: args.intraday,
    colors: c,
    candles: shown,
    volume: args.showVolume && shown.some((x) => x.volume !== null) ? shown.filter((x) => x.volume !== null).map((x) => ({ time: x.time, value: x.volume as number, color: (x.close >= x.open ? c.up : c.down) + '55' })) : null,
    overlays,
    panes,
    markers,
    priceLines,
    segments,
    watermark: args.watermark ?? null,
  };
}
