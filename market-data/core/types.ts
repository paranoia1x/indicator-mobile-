/**
 * Core market-data domain types.
 *
 * These modules are platform-neutral (no React / React Native / Expo imports) so they
 * can be shared with the separate `indicator` desktop repository. Enforced by
 * `npm run check:core-purity`.
 */

/**
 * How trustworthy / fresh a value is. Every price shown in the UI must carry one of these.
 * - live:       streamed or fetched within the expected refresh window of a real provider
 * - delayed:    real provider data that is intentionally delayed (e.g. 15-minute feeds)
 * - historical: completed historical bars from a real provider
 * - cached:     real provider data served from the local cache (may be stale)
 * - simulated:  generated demo data — NOT real market data
 */
export type DataStatus = 'live' | 'delayed' | 'historical' | 'cached' | 'simulated';

export type AssetClass = 'stock' | 'etf' | 'index' | 'crypto';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export const TIMEFRAMES: readonly Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M'];

/** Nominal bar length in seconds (1M uses 30 days as a nominal value only). */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
};

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1 minute',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '30m': '30 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '1D': '1 day',
  '1W': '1 week',
  '1M': '1 month',
};

/** OHLCV bar. `time` is the bar OPEN time in UNIX seconds (UTC). Volume may be unknown (null). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface Provenance {
  providerId: string;
  providerName: string;
  status: DataStatus;
  /** UNIX ms of the most recent data point contained in the payload. */
  asOf: number;
  /** UNIX ms when the app received the payload from the provider (or generated it). */
  fetchedAt: number;
  /** Known provider delay in minutes, if any. */
  delayMinutes?: number;
  /** Human-readable attribution / licence note to display alongside the data. */
  attribution?: string;
  sourceUrl?: string;
  /** Data-quality warnings discovered while parsing (e.g. dropped invalid bars). */
  warnings?: string[];
}

export interface CandleSeries {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  provenance: Provenance;
}

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
  sector?: string;
  industry?: string;
  currency: string;
  /** True for fictional demo instruments. */
  isSimulated: boolean;
  description?: string;
  /** Market capitalisation in `currency`. null = unknown (never treat as 0). */
  marketCap?: number | null;
  /** Provider-specific identifier (e.g. Coinbase product id "BTC-USD"). */
  providerSymbol?: string;
  /** SEC Central Index Key for US issuers, when known. */
  cik?: string;
}

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  /** UNIX ms of the quote. */
  time: number;
  provenance: Provenance;
}

/** A reported financial value. `value: null` means "not available" — distinct from zero. */
export interface ReportedValue {
  value: number | null;
  unit: string;
  /** Fiscal period label, e.g. "FY2025" or "Q3 2025". */
  period?: string;
  periodEnd?: string;
  /** Filing form type (e.g. "10-K") and accession, when sourced from SEC EDGAR. */
  form?: string;
  sourceUrl?: string;
}

export interface FinancialPeriod {
  label: string;
  periodEnd: string;
  kind: 'annual' | 'quarterly';
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalDebt: number | null;
}

export interface Fundamentals {
  symbol: string;
  currency: string;
  periods: FinancialPeriod[];
  sharesOutstanding: ReportedValue;
  dividendsPerShare: { date: string; amount: number }[];
  filings: Filing[];
  provenance: Provenance;
}

export interface Filing {
  form: string;
  filedAt: string;
  reportDate?: string;
  title: string;
  url: string;
  accession?: string;
}

export interface DataIssue {
  index: number;
  kind: 'non-finite' | 'negative-price' | 'high-low-inverted' | 'ohlc-outside-range' | 'duplicate-time' | 'out-of-order' | 'negative-volume';
  detail: string;
}
