import { requestJson } from '@/services/http';
import { parseCoinbaseCandles, parseCoinbaseStats, parseCoinbaseTicker } from '../core/parsers';
import { resampleCandles } from '../core/resample';
import type { Candle, CandleSeries, Instrument, Quote, Timeframe } from '../core/types';
import { TIMEFRAME_SECONDS } from '../core/types';
import { classifyFreshness, summarizeIssues } from '../core/validate';
import type { MarketDataProvider } from './types';

/**
 * Coinbase Exchange PUBLIC market-data endpoints (no API key, read-only).
 * Endpoint shapes follow Coinbase Exchange REST docs; see DATA_PROVIDERS.md for verification
 * status. The app never places orders and never requests Coinbase credentials.
 */
export const COINBASE_BASE = 'https://api.exchange.coinbase.com';

const PRODUCTS: [string, string][] = [
  ['BTC-USD', 'Bitcoin'],
  ['ETH-USD', 'Ethereum'],
  ['SOL-USD', 'Solana'],
  ['XRP-USD', 'XRP'],
  ['ADA-USD', 'Cardano'],
  ['DOGE-USD', 'Dogecoin'],
  ['LTC-USD', 'Litecoin'],
  ['AVAX-USD', 'Avalanche'],
  ['LINK-USD', 'Chainlink'],
  ['DOT-USD', 'Polkadot'],
];

export const COINBASE_INSTRUMENTS: Instrument[] = PRODUCTS.map(([id, name]) => ({
  symbol: id,
  name: `${name} / U.S. Dollar`,
  assetClass: 'crypto',
  exchange: 'Coinbase',
  sector: 'Digital Assets',
  currency: 'USD',
  isSimulated: false,
  providerSymbol: id,
}));

/** Native granularity used to build each app timeframe (Coinbase supports 60/300/900/3600/21600/86400 s). */
const PLAN: Record<Timeframe, { granularity: number; pages: number; resample?: Timeframe }> = {
  '1m': { granularity: 60, pages: 1 },
  '5m': { granularity: 300, pages: 1 },
  '15m': { granularity: 900, pages: 1 },
  '30m': { granularity: 900, pages: 2, resample: '30m' },
  '1h': { granularity: 3600, pages: 2 },
  '4h': { granularity: 3600, pages: 3, resample: '4h' },
  '1D': { granularity: 86400, pages: 3 },
  '1W': { granularity: 86400, pages: 5, resample: '1W' },
  '1M': { granularity: 86400, pages: 7, resample: '1M' },
};
const MAX_PER_REQUEST = 300;

export function createCoinbaseProvider(now: () => number = Date.now): MarketDataProvider {
  return {
    id: 'coinbase',
    name: 'Coinbase Exchange (public market data)',
    description: 'Real crypto prices from Coinbase Exchange public endpoints. No key required. The most recent candle may be incomplete.',
    requiresBackend: false,
    licenseNote: 'Market data © Coinbase. Displayed for personal, non-commercial education; review Coinbase’s terms before any commercial use.',
    timeframes: Object.keys(PLAN) as Timeframe[],
    supports: (symbol) => PRODUCTS.some(([id]) => id === symbol),
    listInstruments: () => COINBASE_INSTRUMENTS,
    async search(query) {
      const q = query.trim().toLowerCase();
      return COINBASE_INSTRUMENTS.filter((i) => !q || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
    },
    async getCandles(symbol, tf, signal): Promise<CandleSeries> {
      const plan = PLAN[tf];
      const span = plan.granularity * MAX_PER_REQUEST;
      let end = Math.floor(now() / 1000);
      const all: Candle[] = [];
      let dropped = 0;
      for (let p = 0; p < plan.pages; p++) {
        const start = end - span;
        const url = `${COINBASE_BASE}/products/${encodeURIComponent(symbol)}/candles?granularity=${plan.granularity}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;
        const parsed = parseCoinbaseCandles(await requestJson<unknown>(url, { signal, timeoutMs: 15_000 }));
        dropped += parsed.dropped;
        all.push(...parsed.candles);
        if (parsed.candles.length === 0) break;
        end = start;
      }
      const dedup = [...new Map(all.map((c) => [c.time, c])).values()].sort((a, b) => a.time - b.time);
      const candles = plan.resample ? resampleCandles(dedup, plan.resample) : dedup;
      const last = candles[candles.length - 1];
      const fetchedAt = now();
      return {
        symbol,
        timeframe: tf,
        candles,
        provenance: {
          providerId: 'coinbase',
          providerName: 'Coinbase Exchange',
          status: classifyFreshness({ lastBarTime: last?.time, timeframe: tf, nowMs: fetchedAt }),
          asOf: last ? (last.time + TIMEFRAME_SECONDS[plan.resample ?? tf]) * 1000 : fetchedAt,
          fetchedAt,
          attribution: 'Data: Coinbase Exchange public API. Latest candle may be incomplete.',
          sourceUrl: `https://www.coinbase.com/price`,
          warnings: dropped ? summarizeIssues([{ index: 0, kind: 'non-finite', detail: `${dropped} invalid bars dropped` }]) : undefined,
        },
      };
    },
    async getQuote(symbol, signal): Promise<Quote> {
      const [tickerRaw, statsRaw] = await Promise.all([
        requestJson<unknown>(`${COINBASE_BASE}/products/${encodeURIComponent(symbol)}/ticker`, { signal }),
        requestJson<unknown>(`${COINBASE_BASE}/products/${encodeURIComponent(symbol)}/stats`, { signal }),
      ]);
      const t = parseCoinbaseTicker(tickerRaw);
      const s = parseCoinbaseStats(statsRaw);
      const fetchedAt = now();
      const prev = s.open;
      return {
        symbol,
        price: t.price,
        previousClose: prev,
        change: prev !== null ? t.price - prev : null,
        changePct: prev !== null ? t.price / prev - 1 : null,
        volume: t.volume24h,
        time: t.time,
        provenance: {
          providerId: 'coinbase',
          providerName: 'Coinbase Exchange',
          status: fetchedAt - t.time < 5 * 60_000 ? 'live' : 'historical',
          asOf: t.time,
          fetchedAt,
          attribution: 'Change is measured against the 24-hour open (crypto trades continuously; there is no daily close).',
        },
      };
    },
  };
}
