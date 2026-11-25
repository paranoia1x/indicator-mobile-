/** Display formatting. Missing values render as an em dash with “unavailable” semantics, never 0. */
export const DASH = '—';

export function formatPrice(v: number | null | undefined, currency?: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const a = Math.abs(v);
  const digits = a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  const s = v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency === 'USD' ? `$${s}` : s;
}

export function formatPct(v: number | null | undefined, digits = 2, signed = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const s = (v * 100).toFixed(digits);
  return `${signed && v > 0 ? '+' : ''}${s}%`;
}

export function formatCompact(v: number | null | undefined, prefix = ''): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e12) return `${sign}${prefix}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${prefix}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${prefix}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${prefix}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${a.toFixed(a < 10 ? 2 : 0)}`;
}

export function formatDateTime(ms: number, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }): string {
  if (!Number.isFinite(ms)) return DASH;
  return new Intl.DateTimeFormat('en-US', opts).format(ms);
}

export function formatDate(ms: number): string {
  return formatDateTime(ms, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function relativeTime(ms: number, now = Date.now()): string {
  const d = Math.round((now - ms) / 1000);
  const abs = Math.abs(d);
  const fut = d < 0;
  const f = (n: number, u: string) => (fut ? `in ${n}${u}` : `${n}${u} ago`);
  if (abs < 60) return fut ? 'in <1m' : 'just now';
  if (abs < 3600) return f(Math.floor(abs / 60), 'm');
  if (abs < 86400) return f(Math.floor(abs / 3600), 'h');
  if (abs < 86400 * 30) return f(Math.floor(abs / 86400), 'd');
  return formatDate(ms);
}

/** Spoken label for screen readers, e.g. "up 2.31 percent". */
export function a11yChange(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'change unavailable';
  if (v === 0) return 'unchanged';
  return `${v > 0 ? 'up' : 'down'} ${Math.abs(v * 100).toFixed(2)} percent`;
}
