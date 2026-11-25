import { createBackendProvider } from '@/market-data/providers/backend';
import { COINBASE_INSTRUMENTS, createCoinbaseProvider } from '@/market-data/providers/coinbase';
import { createDemoProvider } from '@/market-data/providers/demo';
import { ProviderUnavailableError, type MarketDataProvider } from '@/market-data/providers/types';
import { DEMO_INSTRUMENTS } from '@/market-data/core/demo/universe';
import type { CandleSeries, Instrument, Quote, Timeframe } from '@/market-data/core/types';
import { validateBackendUrl } from '@/security/core/sanitize';
import { getQuoteCached, getSeries, putQuote, putSeries } from '@/storage/cache';
import { secure, SECURE_KEYS } from '@/storage/secure';

export interface DataMode {
  liveCrypto: boolean;
  backendUrl: string | null;
  allowInsecureDev: boolean;
}

const demo = createDemoProvider();
const coinbase = createCoinbaseProvider();
let backendCache: { key: string; p: ReturnType<typeof createBackendProvider> } | null = null;

export function backendProvider(mode: DataMode) {
  if (!mode.backendUrl) return null;
  const v = validateBackendUrl(mode.backendUrl, mode.allowInsecureDev);
  if (!v.ok) return null;
  const key = `${v.url}|${mode.allowInsecureDev}`;
  if (backendCache?.key !== key) {
    backendCache = { key, p: createBackendProvider({ baseUrl: v.url, allowInsecureDev: mode.allowInsecureDev, getToken: () => secure.get(SECURE_KEYS.backendToken).catch(() => null) }) };
  }
  return backendCache.p;
}

export function providerFor(symbol: string, mode: DataMode): MarketDataProvider {
  if (demo.supports(symbol)) return demo;
  if (coinbase.supports(symbol)) {
    if (mode.liveCrypto) return coinbase;
    throw new ProviderUnavailableError('Live crypto data is turned off. Enable “Coinbase public market data” in Settings → Data sources.');
  }
  const b = backendProvider(mode);
  if (b) return b;
  throw new ProviderUnavailableError('Real stock and ETF data requires a configured Indicator backend (Settings → Data sources). Demo instruments work offline.');
}

/** Fetches candles; on network failure serves the cached copy (re-labelled “cached”). */
export async function fetchCandles(symbol: string, tf: Timeframe, mode: DataMode, signal?: AbortSignal): Promise<CandleSeries> {
  const p = providerFor(symbol, mode);
  try {
    const s = await p.getCandles(symbol, tf, signal);
    putSeries(p.id, s).catch(() => undefined);
    return s;
  } catch (e) {
    const cached = await getSeries(p.id, symbol, tf);
    if (cached) return { ...cached, provenance: { ...cached.provenance, warnings: [...(cached.provenance.warnings ?? []), `Showing cached data: ${(e as Error).message}`] } };
    throw e;
  }
}

export async function fetchQuote(symbol: string, mode: DataMode, signal?: AbortSignal): Promise<Quote> {
  const p = providerFor(symbol, mode);
  try {
    const q = await p.getQuote(symbol, signal);
    putQuote(p.id, q).catch(() => undefined);
    return q;
  } catch (e) {
    const cached = await getQuoteCached(p.id, symbol);
    if (cached) return cached;
    throw e;
  }
}

export function knownInstruments(mode: DataMode): Instrument[] {
  return [...DEMO_INSTRUMENTS, ...(mode.liveCrypto ? COINBASE_INSTRUMENTS : [])];
}

export function findInstrument(symbol: string, mode: DataMode, extra: Instrument[] = []): Instrument {
  return (
    [...knownInstruments(mode), ...COINBASE_INSTRUMENTS, ...extra].find((i) => i.symbol === symbol) ?? {
      symbol,
      name: symbol,
      assetClass: 'stock',
      currency: 'USD',
      isSimulated: false,
    }
  );
}

export async function searchInstruments(query: string, mode: DataMode, signal?: AbortSignal): Promise<{ results: Instrument[]; errors: string[] }> {
  const errors: string[] = [];
  const results: Instrument[] = [...(await demo.search(query))];
  if (mode.liveCrypto) results.push(...(await coinbase.search(query)));
  const b = backendProvider(mode);
  if (b && query.trim()) {
    try {
      results.push(...(await b.search(query, signal)));
    } catch (e) {
      errors.push(`Backend search unavailable: ${(e as Error).message}`);
    }
  }
  const seen = new Set<string>();
  return { results: results.filter((r) => (seen.has(r.symbol) ? false : (seen.add(r.symbol), true))), errors };
}

export async function fetchNews(symbols: string[] | null, mode: DataMode, signal?: AbortSignal) {
  const items = [...(await demo.getNews!(symbols?.filter((s) => s.endsWith('.SIM')) ?? null))];
  const errors: string[] = [];
  const b = backendProvider(mode);
  if (b) {
    try {
      items.push(...(await b.getNews!(symbols?.filter((s) => !s.endsWith('.SIM')) ?? null, signal)));
    } catch (e) {
      errors.push(`Backend news unavailable: ${(e as Error).message}`);
    }
  }
  return { items: items.sort((a, c) => c.publishedAt - a.publishedAt), errors };
}

export async function fetchCalendar(mode: DataMode, signal?: AbortSignal) {
  const events = [...(await demo.getCalendar!())];
  const errors: string[] = [];
  const b = backendProvider(mode);
  if (b) {
    try {
      events.push(...(await b.getCalendar!(signal)));
    } catch (e) {
      errors.push(`Official calendar unavailable: ${(e as Error).message}`);
    }
  }
  return { events: events.sort((a, c) => a.scheduledAt - c.scheduledAt), errors };
}

export async function fetchFundamentals(symbol: string, mode: DataMode, signal?: AbortSignal) {
  const p = providerFor(symbol, mode);
  return p.getFundamentals ? p.getFundamentals(symbol, signal) : null;
}
