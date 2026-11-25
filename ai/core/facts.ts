import { computeIndicator, INDICATORS, indicatorLabel, type IndicatorConfig } from '../../indicators/registry';
import { historicalVolatility } from '../../indicators/volatility';
import { relativeVolume } from '../../indicators/volume';
import type { CandleSeries, Fundamentals, Instrument } from '../../market-data/core/types';
import { periodChange } from '../../research/breadth';
import { detectSwings, supportResistanceAt, trendStateAt, volatilityRegimes } from '../../research/market-structure';
import { maxDrawdown } from '../../research/statistics';
import type { EconomicEvent } from '../../news/core/calendar';
import type { NewsItem } from '../../news/core/types';
import { quarantineExternalText } from './guard';
import type { Fact } from './types';

export interface AssistantContext {
  nowMs: number;
  instrument?: Instrument;
  /** Prefer daily bars for context statistics. */
  series?: CandleSeries;
  news?: NewsItem[];
  events?: EconomicEvent[];
  fundamentals?: Fundamentals | null;
  indicators?: IndicatorConfig[];
}

export const fmtNum = (n: number, digits = 2) =>
  Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });
export const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const fmtDate = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/**
 * Builds the fact sheet — the ONLY data the assistant may treat as verified. Every fact records
 * its source and data status (live/delayed/historical/cached/simulated).
 */
export function buildFacts(ctx: AssistantContext): Fact[] {
  const facts: Fact[] = [];
  const inst = ctx.instrument;
  const s = ctx.series;
  const src = s
    ? { name: s.provenance.providerName, status: s.provenance.status, asOf: s.provenance.asOf, url: s.provenance.sourceUrl }
    : { name: 'Indicator Mobile', status: 'reference' as const };

  if (inst) {
    facts.push({
      id: 'f:instrument',
      kind: 'verified',
      text: `${inst.name} (${inst.symbol}) is classified as ${inst.assetClass}${inst.sector ? ` in the ${inst.sector} sector` : ''}${inst.industry ? ` (${inst.industry})` : ''}.${inst.isSimulated ? ' It is a FICTIONAL simulated instrument used for education.' : ''}`,
      source: { ...src },
    });
  }

  if (s && s.candles.length >= 2) {
    const c = s.candles;
    const n = c.length;
    const last = c[n - 1];
    const prev = c[n - 2];
    const statusNote = s.provenance.status === 'simulated' ? ' (SIMULATED data)' : ` (data status: ${s.provenance.status})`;
    facts.push({ id: 'f:price', kind: 'verified', text: `Latest ${s.timeframe} close of ${s.symbol} was ${fmtNum(last.close, 4)} on ${fmtDate(last.time)}${statusNote}.`, source: src });
    facts.push({ id: 'f:change', kind: 'verified', text: `${s.symbol} changed ${fmtPct(last.close / prev.close - 1)} versus the prior close (${fmtNum(prev.close, 4)} → ${fmtNum(last.close, 4)}).`, source: src });
    facts.push({ id: 'f:range', kind: 'verified', text: `The latest bar traded between ${fmtNum(last.low, 4)} and ${fmtNum(last.high, 4)} after opening at ${fmtNum(last.open, 4)}.`, source: src });

    const rv = relativeVolume(c, 20)[n - 1];
    if (rv !== null && last.volume !== null) {
      facts.push({ id: 'f:volume', kind: 'verified', text: `Volume on the latest bar was ${fmtNum(last.volume, 0)}, which is ${rv.toFixed(2)}× the average of the previous 20 bars.`, source: src });
    } else {
      facts.push({ id: 'f:volume', kind: 'verified', text: `Volume for ${s.symbol} on the latest bar is unavailable from this data source.`, source: src });
    }

    const ppy = s.timeframe === '1D' ? (inst?.assetClass === 'crypto' ? 365 : 252) : s.timeframe === '1W' ? 52 : 252;
    for (const [bars, label] of [
      [21, 'about 1 month'],
      [63, 'about 3 months'],
      [252, 'about 1 year'],
    ] as const) {
      if (s.timeframe !== '1D') break;
      const ch = periodChange(c, bars);
      if (ch !== null) facts.push({ id: `f:ret${bars}`, kind: 'historical', text: `Over the last ${bars} bars (${label}), ${s.symbol} changed ${fmtPct(ch)}.`, source: src });
    }
    const window = c.slice(Math.max(0, n - 252));
    const dd = maxDrawdown(window.map((x) => x.close));
    facts.push({ id: 'f:maxdd', kind: 'historical', text: `The largest peak-to-trough decline in the last ${window.length} bars was ${fmtPct(dd.maxDrawdown)} (closing prices).`, source: src });

    const hv = historicalVolatility(c.map((x) => x.close), 20, ppy)[n - 1];
    const regime = volatilityRegimes(c, ppy).regimes[n - 1];
    if (hv !== null) facts.push({ id: 'f:vol', kind: 'historical', text: `20-bar historical volatility is ${(hv * 100).toFixed(1)}% annualised${regime ? `, which is ${regime} relative to the prior 120 bars` : ''}.`, source: src });

    const swings = detectSwings(c);
    const trend = trendStateAt(swings, n - 1);
    const trendText: Record<string, string> = {
      uptrend: 'the most recent confirmed swings form higher highs and higher lows (a historical uptrend structure)',
      downtrend: 'the most recent confirmed swings form lower highs and lower lows (a historical downtrend structure)',
      mixed: 'the most recent confirmed swings are mixed (no consistent higher-high/higher-low or lower-high/lower-low sequence)',
      'insufficient-data': 'there are not enough confirmed swing points to describe the structure',
    };
    facts.push({ id: 'f:structure', kind: 'historical', text: `On this ${s.timeframe} chart, ${trendText[trend]}. Swing points are confirmed 5 bars after they form.`, source: src });

    const zones = supportResistanceAt(c, swings, n - 1, { maxZones: 3 });
    zones.forEach((z, i) =>
      facts.push({
        id: `f:zone${i}`,
        kind: 'historical',
        text: `A previously established ${z.kind} area lies near ${fmtNum(z.price, 4)} (${z.touches} prior swing reactions between ${fmtNum(z.low, 4)} and ${fmtNum(z.high, 4)}).`,
        source: src,
      }),
    );

    for (const cfg of ctx.indicators ?? []) {
      const out = computeIndicator(cfg, c);
      const parts = INDICATORS[cfg.id].lines
        .map((l) => {
          const v = out[l.key]?.[n - 1];
          return v === null || v === undefined ? null : `${l.label} ${fmtNum(v, 2)}`;
        })
        .filter(Boolean);
      facts.push({
        id: `f:ind:${cfg.id}`,
        kind: 'verified',
        text: parts.length ? `${indicatorLabel(cfg)} on the latest bar: ${parts.join(', ')}.` : `${indicatorLabel(cfg)} has not enough data to compute on the latest bar.`,
        source: src,
      });
    }
  }

  for (const item of (ctx.news ?? []).slice(0, 8)) {
    const q = quarantineExternalText(`${item.headline}. ${item.summary}`, 400);
    facts.push({
      id: `f:news:${item.id}`,
      kind: 'verified',
      text: `${item.publisher} published on ${new Date(item.publishedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC (${item.status}): “${q.text}”`,
      source: { name: item.publisher, url: item.url, status: item.provenance.status, asOf: item.publishedAt },
    });
  }

  for (const e of (ctx.events ?? []).filter((x) => x.scheduledAt >= ctx.nowMs).slice(0, 5)) {
    facts.push({
      id: `f:event:${e.id}`,
      kind: 'verified',
      text: `Scheduled: ${e.title} on ${new Date(e.scheduledAt).toISOString().slice(0, 10)}${e.previous && e.previous.value !== null ? ` (previous reading ${e.previous.value}${e.previous.unit} for ${e.previous.period})` : ''}. The outcome is not known in advance.`,
      source: { name: e.source.name, url: e.source.url, status: e.provenance.status, asOf: e.provenance.asOf },
    });
  }

  const f = ctx.fundamentals;
  if (f) {
    const latest = [...f.periods].filter((p) => p.kind === 'annual').sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
    const fsrc = { name: f.provenance.providerName, url: f.provenance.sourceUrl, status: f.provenance.status, asOf: f.provenance.asOf };
    if (latest) {
      const val = (v: number | null, unit = '') => (v === null ? 'not available' : `${fmtNum(v, 2)}${unit}`);
      facts.push({
        id: 'f:fund:annual',
        kind: 'verified',
        text: `For ${latest.label} (period ending ${latest.periodEnd}): revenue ${val(latest.revenue)} ${f.currency}, net income ${val(latest.netIncome)} ${f.currency}, EPS ${val(latest.eps)}, operating cash flow ${val(latest.operatingCashFlow)} ${f.currency}.`,
        source: fsrc,
      });
    }
  }
  return facts;
}
