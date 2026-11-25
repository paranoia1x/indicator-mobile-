import { useQuery } from '@tanstack/react-query';
import type { Timeframe } from '@/market-data/core/types';
import { fetchCalendar, fetchCandles, fetchFundamentals, fetchNews, fetchQuote, searchInstruments, type DataMode } from '@/services/data-service';
import { useSettings } from '@/storage/stores';
import { useShallow } from 'zustand/react/shallow';

export function useDataMode(): DataMode {
  return useSettings(useShallow((s) => ({ liveCrypto: s.liveCrypto, backendUrl: s.backendUrl, allowInsecureDev: s.allowInsecureDev })));
}

const isDemo = (symbol: string) => symbol.endsWith('.SIM');

/** Battery-conscious refresh: demo data never polls; intraday real data polls modestly. */
function refreshMs(symbol: string, tf: Timeframe): number | false {
  if (isDemo(symbol)) return false;
  if (tf === '1m' || tf === '5m') return 60_000;
  if (tf === '15m' || tf === '30m' || tf === '1h') return 5 * 60_000;
  return 15 * 60_000;
}

export function useCandles(symbol: string | null, tf: Timeframe) {
  const mode = useDataMode();
  return useQuery({
    queryKey: ['candles', symbol, tf, mode],
    queryFn: ({ signal }) => fetchCandles(symbol as string, tf, mode, signal),
    enabled: !!symbol,
    staleTime: isDemo(symbol ?? '') ? Infinity : 30_000,
    refetchInterval: symbol ? refreshMs(symbol, tf) : false,
    retry: 1,
  });
}

export function useQuote(symbol: string | null) {
  const mode = useDataMode();
  return useQuery({
    queryKey: ['quote', symbol, mode],
    queryFn: ({ signal }) => fetchQuote(symbol as string, mode, signal),
    enabled: !!symbol,
    staleTime: isDemo(symbol ?? '') ? Infinity : 30_000,
    refetchInterval: symbol && !isDemo(symbol) ? 60_000 : false,
    retry: 1,
  });
}

export function useSearch(query: string) {
  const mode = useDataMode();
  return useQuery({ queryKey: ['search', query, mode], queryFn: ({ signal }) => searchInstruments(query, mode, signal), staleTime: 60_000 });
}

export function useNews(symbols: string[] | null) {
  const mode = useDataMode();
  return useQuery({ queryKey: ['news', symbols?.join(','), mode], queryFn: ({ signal }) => fetchNews(symbols, mode, signal), staleTime: 5 * 60_000 });
}

export function useCalendar() {
  const mode = useDataMode();
  return useQuery({ queryKey: ['calendar', mode], queryFn: ({ signal }) => fetchCalendar(mode, signal), staleTime: 30 * 60_000 });
}

export function useFundamentals(symbol: string | null) {
  const mode = useDataMode();
  return useQuery({ queryKey: ['fundamentals', symbol, mode], queryFn: ({ signal }) => fetchFundamentals(symbol as string, mode, signal), enabled: !!symbol, staleTime: 6 * 3600_000, retry: 1 });
}
