/**
 * US equity regular-session status computed from the clock (America/New_York, 9:30–16:00,
 * Monday–Friday). Exchange holidays and early closes are NOT modelled — the UI says so.
 */
export type SessionState = 'pre-market' | 'open' | 'after-hours' | 'closed';

export function usEquitySession(nowMs: number): { state: SessionState; label: string; detail: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(nowMs);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = get('weekday');
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const weekend = wd === 'Sat' || wd === 'Sun';
  let state: SessionState = 'closed';
  if (!weekend) {
    if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) state = 'pre-market';
    else if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) state = 'open';
    else if (minutes >= 16 * 60 && minutes < 20 * 60) state = 'after-hours';
  }
  const label = { 'pre-market': 'Pre-market', open: 'Regular session open', 'after-hours': 'After-hours', closed: 'Closed' }[state];
  return { state, label, detail: 'US equities, New York time. Exchange holidays and early closes are not accounted for.' };
}
