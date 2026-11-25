import type { EconomicEvent } from '@/news/core/calendar';
import type { NewsItem } from '@/news/core/types';
import type { CandleSeries, Fundamentals, Instrument, Quote, Timeframe } from '../core/types';

export interface ProviderInfo {
  id: string;
  name: string;
  /** What kind of data the provider serves and its known limitations. */
  description: string;
  requiresBackend: boolean;
  licenseNote: string;
}

export interface MarketDataProvider extends ProviderInfo {
  supports(symbol: string): boolean;
  timeframes: readonly Timeframe[];
  listInstruments(): Instrument[];
  search(query: string, signal?: AbortSignal): Promise<Instrument[]>;
  getCandles(symbol: string, tf: Timeframe, signal?: AbortSignal): Promise<CandleSeries>;
  getQuote(symbol: string, signal?: AbortSignal): Promise<Quote>;
  getFundamentals?(symbol: string, signal?: AbortSignal): Promise<Fundamentals | null>;
  getNews?(symbols: string[] | null, signal?: AbortSignal): Promise<NewsItem[]>;
  getCalendar?(signal?: AbortSignal): Promise<EconomicEvent[]>;
}

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}
