import type { Candle, Timeframe } from '../types';
import { TIMEFRAME_SECONDS } from '../types';
import { fnv1a, gaussian, mulberry32 } from '../random';
import { resampleCandles } from '../resample';
import { DEMO_SPECS, type DemoSpec } from './universe';

/**
 * Deterministic synthetic price generator for DEMO MODE ONLY.
 *
 * Output is fictional and must always be labelled "simulated". It uses a regime-switching
 * market factor + sector factor + idiosyncratic noise so that the charts exhibit realistic-looking
 * trends, consolidations, drawdowns and volatility clusters for educational purposes.
 */

const DAY = 86400;
/** First generated calendar day (UTC). */
export const DEMO_EPOCH_SEC = Date.UTC(2018, 0, 1) / 1000;

interface Regime {
  mu: number; // annualised drift
  vol: number; // annualised volatility
  stay: number; // daily probability of staying in regime
}
const REGIMES: Regime[] = [
  { mu: 0.16, vol: 0.13, stay: 0.993 }, // steady uptrend
  { mu: 0.02, vol: 0.1, stay: 0.99 }, // range-bound / consolidation
  { mu: -0.35, vol: 0.3, stay: 0.975 }, // correction
  { mu: -1.2, vol: 0.65, stay: 0.9 }, // short crash
  { mu: 0.45, vol: 0.28, stay: 0.97 }, // recovery rally
];
const NEXT: number[][] = [
  [0, 0.55, 0.35, 0.03, 0.07],
  [0.55, 0, 0.35, 0.03, 0.07],
  [0.25, 0.25, 0, 0.2, 0.3],
  [0, 0, 0.2, 0, 0.8],
  [0.6, 0.3, 0.1, 0, 0],
];

function dayIndex(sec: number): number {
  return Math.floor((sec - DEMO_EPOCH_SEC) / DAY);
}

const factorCache = new Map<string, Float64Array>();

/** Daily log-return of a named factor for calendar days [0, nDays). */
function factorReturns(name: string, nDays: number, regimeSwitching: boolean, annualVol = 0.12): Float64Array {
  const key = `${name}:${nDays}`;
  const hit = factorCache.get(key);
  if (hit) return hit;
  const rand = mulberry32(fnv1a('factor:' + name));
  const out = new Float64Array(nDays);
  let r = 0;
  const dt = 1 / 365;
  for (let i = 0; i < nDays; i++) {
    if (regimeSwitching) {
      const reg = REGIMES[r];
      if (rand() > reg.stay) {
        const u = rand();
        let acc = 0;
        for (let j = 0; j < NEXT[r].length; j++) {
          acc += NEXT[r][j];
          if (u <= acc) {
            r = j;
            break;
          }
        }
      }
      const cur = REGIMES[r];
      out[i] = (cur.mu - 0.5 * cur.vol * cur.vol) * dt + cur.vol * Math.sqrt(dt) * gaussian(rand);
    } else {
      out[i] = annualVol * Math.sqrt(dt) * gaussian(rand) - 0.5 * annualVol * annualVol * dt;
    }
  }
  factorCache.set(key, out);
  return out;
}

function isWeekday(sec: number): boolean {
  const d = new Date(sec * 1000).getUTCDay();
  return d !== 0 && d !== 6;
}

const dailyCache = new Map<string, Candle[]>();

/** Generates daily candles from DEMO_EPOCH up to and including the UTC day of `nowMs`. */
export function generateDemoDaily(spec: DemoSpec, nowMs: number): Candle[] {
  const lastDay = dayIndex(Math.floor(nowMs / 1000));
  const key = `${spec.symbol}:${lastDay}`;
  const hit = dailyCache.get(key);
  if (hit) return hit;

  const nDays = lastDay + 1;
  const market = factorReturns('market', nDays, true);
  const sector = spec.sector ? factorReturns('sector:' + spec.sector, nDays, false, 0.1) : null;
  const rand = mulberry32(fnv1a('idio:' + spec.symbol));
  const is24x7 = spec.assetClass === 'crypto';
  const tradingDaysPerYear = is24x7 ? 365 : 252;
  const dt = 1 / tradingDaysPerYear;
  const noVolume = spec.assetClass === 'index';

  const out: Candle[] = [];
  let logP = Math.log(spec.startPrice);
  let accFactor = 0;
  let prevClose = spec.startPrice;
  // Volatility clustering (GARCH-like multiplier on idiosyncratic noise).
  let volMult = 1;

  for (let d = 0; d < nDays; d++) {
    accFactor += spec.beta * market[d] + (sector ? 0.6 * sector[d] : 0);
    const t = DEMO_EPOCH_SEC + d * DAY;
    if (!is24x7 && !isWeekday(t)) continue;

    const z = gaussian(rand);
    volMult = Math.min(3, Math.max(0.5, 0.94 * volMult + 0.06 * (0.6 + Math.abs(z))));
    const idio = (spec.drift - 0.5 * spec.vol * spec.vol) * dt + spec.vol * volMult * Math.sqrt(dt) * z;
    logP += accFactor + idio;
    accFactor = 0;

    const close = Math.exp(logP);
    const dailyVol = Math.max(0.004, (spec.vol * volMult + 0.12 * spec.beta) / Math.sqrt(tradingDaysPerYear));
    const open = prevClose * Math.exp(0.25 * dailyVol * gaussian(rand));
    const hi = Math.max(open, close) * Math.exp(Math.abs(gaussian(rand)) * 0.45 * dailyVol);
    const lo = Math.min(open, close) * Math.exp(-Math.abs(gaussian(rand)) * 0.45 * dailyVol);
    const ret = Math.abs(Math.log(close / prevClose));
    const volume = noVolume
      ? null
      : Math.round(spec.baseVolume * (0.6 + 0.4 * rand() + ret / dailyVol * 0.45) * Math.exp(0.25 * gaussian(rand)));
    out.push({ time: t, open: round(open), high: round(hi), low: round(lo), close: round(close), volume });
    prevClose = close;
  }
  dailyCache.set(key, out);
  return out;
}

function round(p: number): number {
  if (p >= 1000) return Math.round(p * 100) / 100;
  if (p >= 1) return Math.round(p * 10000) / 10000;
  return Math.round(p * 1e6) / 1e6;
}

const INTRADAY_BARS = 720;

/** US cash-session approximation used for demo stocks: 14:30–21:00 UTC, Mon–Fri. */
function inStockSession(sec: number): boolean {
  if (!isWeekday(sec)) return false;
  const m = Math.floor((sec % DAY) / 60);
  return m >= 14 * 60 + 30 && m < 21 * 60;
}

function generateIntraday(spec: DemoSpec, tf: Timeframe, nowMs: number): Candle[] {
  const step = TIMEFRAME_SECONDS[tf];
  const daily = generateDemoDaily(spec, nowMs);
  const anchor = daily[daily.length - 1]?.close ?? spec.startPrice;
  const is24x7 = spec.assetClass === 'crypto';
  let t = Math.floor(nowMs / 1000 / step) * step;
  const times: number[] = [];
  let guard = 0;
  while (times.length < INTRADAY_BARS && guard++ < INTRADAY_BARS * 20) {
    if (is24x7 || inStockSession(t)) times.push(t);
    t -= step;
  }
  times.reverse();
  const rand = mulberry32(fnv1a(`intraday:${spec.symbol}:${tf}:${times[0]}`));
  const yearSec = is24x7 ? 365 * DAY : 252 * 6.5 * 3600;
  const sigma = Math.max(0.15, spec.vol + 0.12 * spec.beta) * Math.sqrt(step / yearSec);
  const w: number[] = [0];
  for (let i = 0; i < times.length; i++) w.push(w[i] + sigma * gaussian(rand));
  const end = w[w.length - 1];
  const barsPerDay = is24x7 ? DAY / step : (6.5 * 3600) / step;
  return times.map((time, i) => {
    const open = anchor * Math.exp(w[i] - end);
    const close = anchor * Math.exp(w[i + 1] - end);
    const hi = Math.max(open, close) * Math.exp(Math.abs(gaussian(rand)) * 0.5 * sigma);
    const lo = Math.min(open, close) * Math.exp(-Math.abs(gaussian(rand)) * 0.5 * sigma);
    const volume =
      spec.assetClass === 'index'
        ? null
        : Math.round((spec.baseVolume / barsPerDay) * (0.5 + rand()) * (1 + Math.abs(w[i + 1] - w[i]) / sigma * 0.3));
    return { time, open: round(open), high: round(hi), low: round(lo), close: round(close), volume };
  });
}

/** Returns simulated candles for any supported timeframe. */
export function generateDemoCandles(symbol: string, tf: Timeframe, nowMs: number): Candle[] {
  const spec = DEMO_SPECS.find((s) => s.symbol === symbol);
  if (!spec) return [];
  switch (tf) {
    case '1D':
      return generateDemoDaily(spec, nowMs);
    case '1W':
    case '1M':
      return resampleCandles(generateDemoDaily(spec, nowMs), tf);
    case '4h':
      return resampleCandles(generateIntraday(spec, '1h', nowMs), '4h');
    default:
      return generateIntraday(spec, tf, nowMs);
  }
}

/** Clears memoised series (used by tests and when the day rolls over). */
export function clearDemoCache(): void {
  dailyCache.clear();
  factorCache.clear();
}
