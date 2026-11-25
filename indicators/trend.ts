import type { Candle } from '../market-data/core/types';
import type { Out } from './moving-averages';

export interface AdxResult {
  adx: Out;
  plusDI: Out;
  minusDI: Out;
}

/**
 * Average Directional Index (Wilder, 1978).
 * +DM/−DM and TR are computed from bar 1; Wilder-smoothed sums start at index `period`
 * (sum of the first `period` values), +DI/−DI from there, and ADX first appears at
 * index 2·period − 1 as the mean of the first `period` DX values, then Wilder-smoothed.
 */
export function adx(candles: readonly Candle[], period = 14): AdxResult {
  const n = candles.length;
  const plusDI: Out = new Array(n).fill(null);
  const minusDI: Out = new Array(n).fill(null);
  const adxOut: Out = new Array(n).fill(null);
  if (n <= period) return { adx: adxOut, plusDI, minusDI };

  let sTR = 0;
  let sPDM = 0;
  let sMDM = 0;
  const dx: number[] = new Array(n).fill(NaN);

  for (let i = 1; i < n; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    const pdm = up > down && up > 0 ? up : 0;
    const mdm = down > up && down > 0 ? down : 0;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));

    if (i <= period) {
      sTR += tr;
      sPDM += pdm;
      sMDM += mdm;
      if (i < period) continue;
    } else {
      sTR = sTR - sTR / period + tr;
      sPDM = sPDM - sPDM / period + pdm;
      sMDM = sMDM - sMDM / period + mdm;
    }
    const pdi = sTR === 0 ? 0 : (100 * sPDM) / sTR;
    const mdi = sTR === 0 ? 0 : (100 * sMDM) / sTR;
    plusDI[i] = pdi;
    minusDI[i] = mdi;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum;
  }

  const first = 2 * period - 1;
  if (first < n) {
    let s = 0;
    for (let i = period; i <= first; i++) s += dx[i];
    let prev = s / period;
    adxOut[first] = prev;
    for (let i = first + 1; i < n; i++) {
      prev = (prev * (period - 1) + dx[i]) / period;
      adxOut[i] = prev;
    }
  }
  return { adx: adxOut, plusDI, minusDI };
}
