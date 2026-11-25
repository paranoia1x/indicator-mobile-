import { useQueries } from '@tanstack/react-query';
import type { CandleSeries, Timeframe } from '@/market-data/core/types';
import { fetchCandles } from '@/services/data-service';
import { useDataMode } from './useMarketData';

/** Loads several candle series in parallel (shared cache with useCandles). */
export function useSeriesMany(symbols: string[], tf: Timeframe) {
  const mode = useDataMode();
  const results = useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ['candles', symbol, tf, mode],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchCandles(symbol, tf, mode, signal),
      staleTime: symbol.endsWith('.SIM') ? Infinity : 60_000,
      retry: 1,
    })),
  });
  const map: Record<string, CandleSeries | undefined> = {};
  const errors: Record<string, string> = {};
  results.forEach((r, i) => {
    map[symbols[i]] = r.data;
    if (r.error) errors[symbols[i]] = (r.error as Error).message;
  });
  return { map, errors, loading: results.some((r) => r.isLoading), refetch: () => Promise.all(results.map((r) => r.refetch())) };
}

export function lastChange(s: CandleSeries | undefined): { price: number | null; changePct: number | null; spark: number[] } {
  const c = s?.candles ?? [];
  const n = c.length;
  if (!n) return { price: null, changePct: null, spark: [] };
  return { price: c[n - 1].close, changePct: n > 1 ? c[n - 1].close / c[n - 2].close - 1 : null, spark: c.slice(-30).map((x) => x.close) };
}
