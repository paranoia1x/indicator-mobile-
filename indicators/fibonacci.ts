export const FIB_RETRACEMENT_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const FIB_EXTENSION_RATIOS = [1.272, 1.618] as const;

export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
}

/**
 * Fibonacci retracement levels between a swing start and swing end chosen by the user.
 * For an upward move (start < end) retracements are measured down from the end;
 * for a downward move they are measured up from the end. These are drawing aids,
 * not predictions — price has no obligation to react at any level.
 */
export function fibonacciLevels(start: number, end: number, includeExtensions = false): FibLevel[] {
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new RangeError('Fibonacci anchors must be finite numbers');
  const diff = end - start;
  const ratios: number[] = [...FIB_RETRACEMENT_RATIOS, ...(includeExtensions ? FIB_EXTENSION_RATIOS : [])];
  return ratios.map((r) => ({
    ratio: r,
    price: end - diff * r,
    label: `${(r * 100).toFixed(1).replace(/\.0$/, '')}%`,
  }));
}
