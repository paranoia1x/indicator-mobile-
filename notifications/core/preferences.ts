/**
 * Notification preference logic (platform-neutral). Notifications are informational only:
 * no urgency language, no prompts to trade, and the user can disable everything.
 */

export type NotificationCategory = 'earnings' | 'economic-events' | 'filings' | 'news' | 'watchlist-research' | 'analysis-complete' | 'data-connection';

export const NOTIFICATION_CATEGORIES: { id: NotificationCategory; label: string; description: string }[] = [
  { id: 'earnings', label: 'Published earnings reports', description: 'When a watched company’s earnings release is published.' },
  { id: 'economic-events', label: 'Scheduled economic events', description: 'Reminders before CPI, jobs, GDP and FOMC releases.' },
  { id: 'filings', label: 'New public filings', description: 'New SEC filings for watched companies (requires backend).' },
  { id: 'news', label: 'Verified financial news', description: 'Confirmed news about watched assets. Speculative stories are never pushed.' },
  { id: 'watchlist-research', label: 'Watchlist research updates', description: 'Summaries of notable historical changes in your watchlists.' },
  { id: 'analysis-complete', label: 'Completed historical analysis', description: 'When a long backtest or research job finishes.' },
  { id: 'data-connection', label: 'Market data connection problems', description: 'When a data provider is unreachable or returns invalid data.' },
];

export type Frequency = 'immediate' | 'hourly-digest' | 'daily-digest';

export interface NotificationPrefs {
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  frequency: Frequency;
  quietHours: { enabled: boolean; startMinute: number; endMinute: number };
  maxPerDay: number;
  /** Minutes before a scheduled event to remind. */
  eventLeadMinutes: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false, // opt-in
  categories: {
    earnings: true,
    'economic-events': true,
    filings: false,
    news: false,
    'watchlist-research': false,
    'analysis-complete': true,
    'data-connection': true,
  },
  frequency: 'immediate',
  quietHours: { enabled: true, startMinute: 22 * 60, endMinute: 7 * 60 },
  maxPerDay: 6,
  eventLeadMinutes: 30,
};

/** Whether a local minute-of-day falls in quiet hours (supports ranges that cross midnight). */
export function inQuietHours(prefs: NotificationPrefs, minuteOfDay: number): boolean {
  const { enabled, startMinute: s, endMinute: e } = prefs.quietHours;
  if (!enabled || s === e) return false;
  return s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e;
}

export function shouldDeliver(
  prefs: NotificationPrefs,
  category: NotificationCategory,
  localMinuteOfDay: number,
  deliveredToday: number,
): { deliver: boolean; reason: string } {
  if (!prefs.enabled) return { deliver: false, reason: 'Notifications are turned off.' };
  if (!prefs.categories[category]) return { deliver: false, reason: 'This category is turned off.' };
  // Connection problems are informational but still respect quiet hours.
  if (inQuietHours(prefs, localMinuteOfDay)) return { deliver: false, reason: 'Quiet hours.' };
  if (deliveredToday >= prefs.maxPerDay) return { deliver: false, reason: 'Daily limit reached.' };
  return { deliver: true, reason: 'ok' };
}

/** Moves a reminder out of quiet hours to the end of the quiet period (same or next day). */
export function adjustForQuietHours(prefs: NotificationPrefs, fireAt: Date): Date {
  const minute = fireAt.getHours() * 60 + fireAt.getMinutes();
  if (!inQuietHours(prefs, minute)) return fireAt;
  const out = new Date(fireAt);
  const end = prefs.quietHours.endMinute;
  out.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (out <= fireAt) out.setDate(out.getDate() + 1);
  return out;
}

const URGENCY = /\b(now|hurry|act fast|don'?t miss|last chance|urgent|immediately|before it'?s too late|buy|sell|moon|soar|plunge|crash)\b|!/i;

/** Guards notification copy against FOMO / pressure language. Throws if violated (tested). */
export function assertCalmCopy(text: string): string {
  if (URGENCY.test(text)) throw new Error(`Notification copy contains urgency or trading language: “${text}”`);
  return text;
}

export function sanitizePrefs(p: Partial<NotificationPrefs> | undefined): NotificationPrefs {
  const d = DEFAULT_NOTIFICATION_PREFS;
  const clampMin = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1439, Math.max(0, Math.round(v))) : def);
  return {
    enabled: typeof p?.enabled === 'boolean' ? p.enabled : d.enabled,
    categories: { ...d.categories, ...(p?.categories ?? {}) },
    frequency: p?.frequency && ['immediate', 'hourly-digest', 'daily-digest'].includes(p.frequency) ? p.frequency : d.frequency,
    quietHours: {
      enabled: typeof p?.quietHours?.enabled === 'boolean' ? p.quietHours.enabled : d.quietHours.enabled,
      startMinute: clampMin(p?.quietHours?.startMinute, d.quietHours.startMinute),
      endMinute: clampMin(p?.quietHours?.endMinute, d.quietHours.endMinute),
    },
    maxPerDay: typeof p?.maxPerDay === 'number' ? Math.min(50, Math.max(1, Math.round(p.maxPerDay))) : d.maxPerDay,
    eventLeadMinutes: typeof p?.eventLeadMinutes === 'number' ? Math.min(1440, Math.max(0, Math.round(p.eventLeadMinutes))) : d.eventLeadMinutes,
  };
}
