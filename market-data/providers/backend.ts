import { requestJson } from '@/services/http';
import { deduplicateNews, normalizeNews, type RawNews } from '@/news/core/processing';
import { parseBackendBars, parseBackendCalendar, parseBackendFundamentals, parseBackendInstruments } from '../core/parsers';
import type { CandleSeries, DataStatus, Provenance, Quote, Timeframe } from '../core/types';
import { TIMEFRAMES } from '../core/types';
import { classifyFreshness } from '../core/validate';
import type { MarketDataProvider } from './types';

/**
 * Client for the self-hosted Indicator backend (server/ — FastAPI). The backend holds all
 * provider API keys (Alpaca, FRED, SEC contact header, Anthropic) server-side; the app only holds
 * an optional per-device access token in the OS keychain.
 */
export interface BackendConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  allowInsecureDev: boolean;
}

const STATUSES: DataStatus[] = ['live', 'delayed', 'historical', 'cached', 'simulated'];

function mergeProv(p: Partial<Provenance>, fallback: Provenance): Provenance {
  return {
    ...fallback,
    providerId: typeof p.providerId === 'string' ? p.providerId : fallback.providerId,
    providerName: typeof p.providerName === 'string' ? p.providerName : fallback.providerName,
    status: p.status && STATUSES.includes(p.status) ? p.status : fallback.status,
    asOf: typeof p.asOf === 'number' ? p.asOf : fallback.asOf,
    delayMinutes: typeof p.delayMinutes === 'number' ? p.delayMinutes : undefined,
    attribution: typeof p.attribution === 'string' ? p.attribution.slice(0, 300) : fallback.attribution,
    sourceUrl: typeof p.sourceUrl === 'string' && p.sourceUrl.startsWith('https://') ? p.sourceUrl : undefined,
  };
}

export function createBackendProvider(cfg: BackendConfig, now: () => number = Date.now): MarketDataProvider & { health(): Promise<Record<string, boolean>> } {
  const get = async <T>(path: string, signal?: AbortSignal) => {
    const token = await cfg.getToken();
    return requestJson<T>(`${cfg.baseUrl}${path}`, { signal, allowInsecureDev: cfg.allowInsecureDev, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  };
  const baseProv = (): Provenance => ({ providerId: 'backend', providerName: 'Indicator backend', status: 'historical', asOf: now(), fetchedAt: now() });

  return {
    id: 'backend',
    name: 'Indicator backend (self-hosted)',
    description: 'Your own server that proxies authorised providers: Alpaca (US stocks/ETFs, IEX feed on the free plan), SEC EDGAR (filings & financials), FRED (economic data & release dates) and an optional AI model.',
    requiresBackend: true,
    licenseNote: 'Each upstream provider’s terms apply. See DATA_PROVIDERS.md.',
    timeframes: TIMEFRAMES,
    supports: (symbol) => !symbol.endsWith('.SIM'),
    listInstruments: () => [],
    async health() {
      const r = await get<{ providers?: Record<string, unknown> }>('/v1/health');
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(r.providers ?? {})) out[k] = v === true;
      return out;
    },
    async search(query, signal) {
      if (!query.trim()) return [];
      return parseBackendInstruments(await get(`/v1/instruments/search?q=${encodeURIComponent(query.trim().slice(0, 40))}`, signal));
    },
    async getCandles(symbol, tf: Timeframe, signal): Promise<CandleSeries> {
      const parsed = parseBackendBars(await get(`/v1/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${tf}`, signal));
      const last = parsed.candles[parsed.candles.length - 1];
      const fb = baseProv();
      fb.status = classifyFreshness({ lastBarTime: last?.time, timeframe: tf, nowMs: now(), providerDelayMinutes: parsed.provenance.delayMinutes });
      const prov = mergeProv(parsed.provenance, fb);
      return { symbol, timeframe: tf, candles: parsed.candles, provenance: { ...prov, warnings: parsed.warnings } };
    },
    async getQuote(symbol, signal): Promise<Quote> {
      const r = await get<Record<string, unknown>>(`/v1/quotes?symbols=${encodeURIComponent(symbol)}`, signal);
      const q = Array.isArray(r.quotes) ? (r.quotes as Record<string, unknown>[]).find((x) => x.symbol === symbol) : undefined;
      const price = Number(q?.price);
      if (!q || !(price > 0)) throw new Error('Quote unavailable');
      const prev = q.previousClose === null || q.previousClose === undefined ? null : Number(q.previousClose);
      return {
        symbol,
        price,
        previousClose: prev !== null && prev > 0 ? prev : null,
        change: prev ? price - prev : null,
        changePct: prev ? price / prev - 1 : null,
        volume: typeof q.volume === 'number' ? q.volume : null,
        time: Number(q.time) || now(),
        provenance: mergeProv((q.provenance ?? {}) as Partial<Provenance>, baseProv()),
      };
    },
    async getFundamentals(symbol, signal) {
      const f = parseBackendFundamentals(await get(`/v1/fundamentals/${encodeURIComponent(symbol)}`, signal));
      return { ...f, provenance: mergeProv(f.provenance, { ...baseProv(), providerName: 'SEC EDGAR via backend', sourceUrl: 'https://www.sec.gov/edgar/search/' }) };
    },
    async getNews(symbols, signal) {
      const r = await get<{ items?: RawNews[]; provenance?: Partial<Provenance> }>(`/v1/news?limit=50${symbols ? `&symbols=${encodeURIComponent(symbols.join(','))}` : ''}`, signal);
      const prov = mergeProv(r.provenance ?? {}, baseProv());
      return deduplicateNews((r.items ?? []).map((i) => normalizeNews(i, prov)).filter((x): x is NonNullable<typeof x> => x !== null));
    },
    async getCalendar(signal) {
      return parseBackendCalendar(await get('/v1/calendar', signal), { ...baseProv(), providerName: 'Official release calendars via backend' });
    },
  };
}
