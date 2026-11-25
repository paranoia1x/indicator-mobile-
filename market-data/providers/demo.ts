import { generateDemoCalendar, generateDemoFundamentals, generateDemoNews, demoProvenance } from '../core/demo/content';
import { generateDemoCandles } from '../core/demo/generator';
import { DEMO_INSTRUMENTS } from '../core/demo/universe';
import { TIMEFRAMES, type CandleSeries, type Quote, type Timeframe } from '../core/types';
import type { MarketDataProvider } from './types';

/** Offline demonstration provider. All output is SIMULATED and labelled as such. */
export function createDemoProvider(now: () => number = Date.now): MarketDataProvider {
  return {
    id: 'demo',
    name: 'Demo data (simulated)',
    description: 'Deterministic simulated prices, news, calendar and financials for fictional instruments ending in “.SIM”. Works offline without any API keys.',
    requiresBackend: false,
    licenseNote: 'Generated in-app. Not real market data.',
    timeframes: TIMEFRAMES,
    supports: (symbol) => symbol.endsWith('.SIM'),
    listInstruments: () => DEMO_INSTRUMENTS,
    async search(query) {
      const q = query.trim().toLowerCase();
      if (!q) return DEMO_INSTRUMENTS;
      return DEMO_INSTRUMENTS.filter((i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.sector?.toLowerCase().includes(q) || i.industry?.toLowerCase().includes(q));
    },
    async getCandles(symbol: string, tf: Timeframe): Promise<CandleSeries> {
      const t = now();
      const candles = generateDemoCandles(symbol, tf, t);
      const last = candles[candles.length - 1];
      return { symbol, timeframe: tf, candles, provenance: { ...demoProvenance(t), asOf: last ? last.time * 1000 : t } };
    },
    async getQuote(symbol: string): Promise<Quote> {
      const t = now();
      const d = generateDemoCandles(symbol, '1D', t);
      const last = d[d.length - 1];
      const prev = d[d.length - 2];
      if (!last) throw new Error(`Unknown demo symbol ${symbol}`);
      return {
        symbol,
        price: last.close,
        previousClose: prev?.close ?? null,
        change: prev ? last.close - prev.close : null,
        changePct: prev ? last.close / prev.close - 1 : null,
        volume: last.volume,
        time: last.time * 1000,
        provenance: { ...demoProvenance(t), asOf: last.time * 1000 },
      };
    },
    async getFundamentals(symbol) {
      return generateDemoFundamentals(symbol, now());
    },
    async getNews(symbols) {
      const all = generateDemoNews(now());
      return symbols ? all.filter((n) => n.symbols.some((s) => symbols.includes(s))) : all;
    },
    async getCalendar() {
      return generateDemoCalendar(now());
    },
  };
}
