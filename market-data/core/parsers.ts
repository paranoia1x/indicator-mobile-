import type { EconomicEvent } from '../../news/core/calendar';
import type { Candle, Fundamentals, Instrument, Provenance } from './types';
import { validateCandles } from './validate';

/**
 * Defensive parsers for provider payloads. They never trust shape or types and return
 * `ParseError` on anything unexpected so the UI can show a data-quality error instead of
 * rendering fabricated or partial values.
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

/**
 * Coinbase Exchange public candles: an array of
 * [time(sec), low, high, open, close, volume] rows, newest first (per Coinbase Exchange docs;
 * re-verify on upgrade — see DATA_PROVIDERS.md).
 */
export function parseCoinbaseCandles(payload: unknown): { candles: Candle[]; dropped: number } {
  if (!Array.isArray(payload)) throw new ParseError('Coinbase candles: expected an array');
  const raw: Candle[] = [];
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 6) throw new ParseError('Coinbase candles: unexpected row shape');
    const [t, low, high, open, close, volume] = row.map(num);
    raw.push({ time: t, open, high, low, close, volume: Number.isFinite(volume) ? volume : null });
  }
  const { candles, issues } = validateCandles(raw);
  return { candles, dropped: issues.filter((i) => i.index >= 0 && i.kind !== 'negative-volume').length };
}

export interface CoinbaseTicker {
  price: number;
  time: number; // ms
  volume24h: number | null;
}

export function parseCoinbaseTicker(payload: unknown): CoinbaseTicker {
  if (!payload || typeof payload !== 'object') throw new ParseError('Coinbase ticker: expected an object');
  const p = payload as Record<string, unknown>;
  const price = num(p.price);
  const time = Date.parse(String(p.time));
  if (!(price > 0) || !Number.isFinite(time)) throw new ParseError('Coinbase ticker: missing price or time');
  const vol = num(p.volume);
  return { price, time, volume24h: Number.isFinite(vol) ? vol : null };
}

export function parseCoinbaseStats(payload: unknown): { open: number | null; last: number | null } {
  if (!payload || typeof payload !== 'object') throw new ParseError('Coinbase stats: expected an object');
  const p = payload as Record<string, unknown>;
  const open = num(p.open);
  const last = num(p.last);
  return { open: open > 0 ? open : null, last: last > 0 ? last : null };
}

/** Backend (self-hosted FastAPI) bars contract: { bars: [{t,o,h,l,c,v}], provenance }. */
export function parseBackendBars(payload: unknown): { candles: Candle[]; provenance: Partial<Provenance>; warnings: string[] } {
  if (!payload || typeof payload !== 'object') throw new ParseError('Backend bars: expected an object');
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.bars)) throw new ParseError('Backend bars: missing bars array');
  const raw: Candle[] = p.bars.map((b) => {
    const r = (b ?? {}) as Record<string, unknown>;
    const v = r.v === null || r.v === undefined ? null : num(r.v);
    return { time: num(r.t), open: num(r.o), high: num(r.h), low: num(r.l), close: num(r.c), volume: v !== null && Number.isFinite(v) ? v : null };
  });
  const { candles, issues } = validateCandles(raw);
  const prov = (p.provenance ?? {}) as Partial<Provenance>;
  return { candles, provenance: prov, warnings: issues.length ? [`${issues.length} bar(s) failed validation and were removed or corrected`] : [] };
}

const ASSET_CLASSES = new Set(['stock', 'etf', 'index', 'crypto']);

export function parseBackendInstruments(payload: unknown): Instrument[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { results?: unknown }).results)) throw new ParseError('Backend search: missing results');
  return ((payload as { results: unknown[] }).results)
    .map((r) => (r ?? {}) as Record<string, unknown>)
    .filter((r) => typeof r.symbol === 'string' && typeof r.name === 'string' && ASSET_CLASSES.has(String(r.assetClass)))
    .slice(0, 50)
    .map((r) => ({
      symbol: String(r.symbol).toUpperCase().slice(0, 20),
      name: String(r.name).slice(0, 120),
      assetClass: r.assetClass as Instrument['assetClass'],
      exchange: typeof r.exchange === 'string' ? r.exchange.slice(0, 20) : undefined,
      sector: typeof r.sector === 'string' ? r.sector.slice(0, 60) : undefined,
      industry: typeof r.industry === 'string' ? r.industry.slice(0, 80) : undefined,
      currency: typeof r.currency === 'string' ? r.currency.slice(0, 5) : 'USD',
      isSimulated: false,
      cik: typeof r.cik === 'string' && /^\d{1,10}$/.test(r.cik) ? r.cik : undefined,
      marketCap: typeof r.marketCap === 'number' && Number.isFinite(r.marketCap) ? r.marketCap : null,
    }));
}

const optNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(num(v)) ? num(v) : null);

export function parseBackendFundamentals(payload: unknown): Omit<Fundamentals, 'provenance'> & { provenance: Partial<Provenance> } {
  if (!payload || typeof payload !== 'object') throw new ParseError('Backend fundamentals: expected an object');
  const p = payload as Record<string, unknown>;
  if (typeof p.symbol !== 'string' || !Array.isArray(p.periods)) throw new ParseError('Backend fundamentals: missing symbol or periods');
  return {
    symbol: p.symbol,
    currency: typeof p.currency === 'string' ? p.currency : 'USD',
    periods: p.periods.map((x) => {
      const r = (x ?? {}) as Record<string, unknown>;
      return {
        label: String(r.label ?? ''),
        periodEnd: String(r.periodEnd ?? ''),
        kind: r.kind === 'quarterly' ? 'quarterly' : 'annual',
        revenue: optNum(r.revenue),
        netIncome: optNum(r.netIncome),
        eps: optNum(r.eps),
        operatingCashFlow: optNum(r.operatingCashFlow),
        totalAssets: optNum(r.totalAssets),
        totalLiabilities: optNum(r.totalLiabilities),
        totalDebt: optNum(r.totalDebt),
      };
    }),
    sharesOutstanding: { value: optNum((p.sharesOutstanding as Record<string, unknown> | undefined)?.value), unit: 'shares' },
    dividendsPerShare: Array.isArray(p.dividendsPerShare)
      ? p.dividendsPerShare.map((d) => (d ?? {}) as Record<string, unknown>).filter((d) => typeof d.date === 'string' && Number.isFinite(num(d.amount))).map((d) => ({ date: String(d.date), amount: num(d.amount) }))
      : [],
    filings: Array.isArray(p.filings)
      ? p.filings
          .map((f) => (f ?? {}) as Record<string, unknown>)
          .filter((f) => typeof f.url === 'string' && /^https:\/\/(www\.)?sec\.gov\//.test(f.url))
          .slice(0, 40)
          .map((f) => ({ form: String(f.form ?? ''), filedAt: String(f.filedAt ?? ''), reportDate: f.reportDate ? String(f.reportDate) : undefined, title: String(f.title ?? f.form ?? 'Filing').slice(0, 200), url: String(f.url), accession: f.accession ? String(f.accession) : undefined }))
      : [],
    provenance: (p.provenance ?? {}) as Partial<Provenance>,
  };
}

export function parseBackendCalendar(payload: unknown, fallbackProv: Provenance): EconomicEvent[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { events?: unknown }).events)) throw new ParseError('Backend calendar: missing events');
  const kinds = new Set(['earnings', 'fomc', 'cpi', 'ppi', 'employment', 'gdp', 'company', 'other']);
  return ((payload as { events: unknown[] }).events)
    .map((e) => (e ?? {}) as Record<string, unknown>)
    .filter((e) => typeof e.title === 'string' && Number.isFinite(num(e.scheduledAt)) && typeof e.sourceUrl === 'string' && /^https:\/\//.test(e.sourceUrl))
    .map((e) => ({
      id: String(e.id ?? `${e.kind}-${e.scheduledAt}`),
      kind: (kinds.has(String(e.kind)) ? e.kind : 'other') as EconomicEvent['kind'],
      title: String(e.title).slice(0, 160),
      scheduledAt: num(e.scheduledAt),
      dateOnly: e.dateOnly === true,
      sourceTimeZone: typeof e.sourceTimeZone === 'string' ? e.sourceTimeZone : 'America/New_York',
      source: { name: String(e.sourceName ?? 'Official source'), url: String(e.sourceUrl) },
      symbol: typeof e.symbol === 'string' ? e.symbol : undefined,
      previous: e.previous && typeof e.previous === 'object' ? { value: optNum((e.previous as Record<string, unknown>).value), unit: String((e.previous as Record<string, unknown>).unit ?? ''), period: String((e.previous as Record<string, unknown>).period ?? '') } : null,
      actual: null,
      provenance: fallbackProv,
    }));
}
