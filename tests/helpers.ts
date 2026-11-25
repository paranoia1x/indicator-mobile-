import type { Candle } from '@/market-data/core/types';

/** Builds candles from closes with a deterministic high/low envelope. */
export function candlesFromCloses(closes: number[], startTime = 1_700_000_000, step = 86400): Candle[] {
  return closes.map((c, i) => {
    const prev = i === 0 ? c : closes[i - 1];
    const open = prev;
    const high = Math.max(open, c) * 1.01;
    const low = Math.min(open, c) * 0.99;
    return { time: startTime + i * step, open, high, low, close: c, volume: 1000 + ((i * 37) % 500) };
  });
}

/** Deterministic pseudo-random walk for property tests. */
export function randomWalk(n: number, seed = 42, start = 100): number[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    p = Math.max(1, p * (1 + (rnd() - 0.5) * 0.04));
    out.push(Math.round(p * 100) / 100);
  }
  return out;
}

export const close = (a: number | null, b: number | null, eps = 1e-9) =>
  a === null || b === null ? a === b : Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
