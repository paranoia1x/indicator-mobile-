import type { CandleSeries, Quote, Timeframe } from '@/market-data/core/types';
import { asCached } from '@/market-data/core/validate';
import { kv } from './kv';

/**
 * Offline market-data cache (SQLite-backed KV) with a small LRU index.
 * Cached data is always re-labelled `cached` when served, keeping its original `asOf` time,
 * so stale prices are never presented as current.
 */
const INDEX_KEY = 'cache:index';
const MAX_ENTRIES = 60;
const MAX_CANDLES = 1500;

type Index = { key: string; at: number }[];

async function readIndex(): Promise<Index> {
  try {
    const raw = await kv.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as Index) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function touch(key: string): Promise<void> {
  const idx = (await readIndex()).filter((e) => e.key !== key);
  idx.unshift({ key, at: Date.now() });
  const evicted = idx.splice(MAX_ENTRIES);
  await Promise.all(evicted.map((e) => kv.removeItem(e.key)));
  await kv.setItem(INDEX_KEY, JSON.stringify(idx));
}

const seriesKey = (provider: string, symbol: string, tf: Timeframe) => `cache:series:${provider}:${symbol}:${tf}`;
const quoteKey = (provider: string, symbol: string) => `cache:quote:${provider}:${symbol}`;

export async function putSeries(provider: string, s: CandleSeries): Promise<void> {
  if (s.provenance.status === 'simulated') return; // demo data is regenerated, never cached
  const key = seriesKey(provider, s.symbol, s.timeframe);
  const trimmed: CandleSeries = { ...s, candles: s.candles.slice(-MAX_CANDLES) };
  await kv.setItem(key, JSON.stringify(trimmed));
  await touch(key);
}

export async function getSeries(provider: string, symbol: string, tf: Timeframe): Promise<CandleSeries | null> {
  try {
    const raw = await kv.getItem(seriesKey(provider, symbol, tf));
    if (!raw) return null;
    const s = JSON.parse(raw) as CandleSeries;
    if (!Array.isArray(s.candles)) return null;
    return { ...s, provenance: asCached(s.provenance) };
  } catch {
    return null;
  }
}

export async function putQuote(provider: string, q: Quote): Promise<void> {
  if (q.provenance.status === 'simulated') return;
  const key = quoteKey(provider, q.symbol);
  await kv.setItem(key, JSON.stringify(q));
  await touch(key);
}

export async function getQuoteCached(provider: string, symbol: string): Promise<Quote | null> {
  try {
    const raw = await kv.getItem(quoteKey(provider, symbol));
    if (!raw) return null;
    const q = JSON.parse(raw) as Quote;
    return { ...q, provenance: asCached(q.provenance) };
  } catch {
    return null;
  }
}

export async function cacheStats(): Promise<{ entries: number; oldest: number | null }> {
  const idx = await readIndex();
  return { entries: idx.length, oldest: idx.length ? Math.min(...idx.map((e) => e.at)) : null };
}

export async function clearMarketCache(): Promise<void> {
  const idx = await readIndex();
  await Promise.all(idx.map((e) => kv.removeItem(e.key)));
  await kv.removeItem(INDEX_KEY);
}
