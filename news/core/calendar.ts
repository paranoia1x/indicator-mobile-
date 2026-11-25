import type { Provenance } from '../../market-data/core/types';

export type EventKind = 'earnings' | 'fomc' | 'cpi' | 'ppi' | 'employment' | 'gdp' | 'company' | 'other';

export interface EconomicEvent {
  id: string;
  kind: EventKind;
  title: string;
  /** Scheduled time (UNIX ms, UTC). */
  scheduledAt: number;
  /** True when only the date is known (no release time announced). */
  dateOnly: boolean;
  /** IANA time zone of the official schedule (displayed alongside the user's local time). */
  sourceTimeZone: string;
  source: { name: string; url: string };
  symbol?: string;
  /** Most recent previously reported value, when available. null = unavailable. */
  previous: { value: number | null; unit: string; period: string } | null;
  /** Only present after official release. Never forecast. */
  actual: { value: number | null; unit: string; period: string } | null;
  provenance: Provenance;
}

export const EVENT_EXPLANATIONS: Record<EventKind, { name: string; explanation: string; historicalContext: string }> = {
  earnings: {
    name: 'Earnings release',
    explanation: 'A company reports revenue, profit and often guidance for the coming period. Results are compared with expectations formed beforehand.',
    historicalContext: 'Share prices have frequently moved more than usual around earnings dates, in either direction. The direction depends on results relative to expectations and on guidance.',
  },
  fomc: {
    name: 'FOMC meeting',
    explanation: 'The Federal Reserve’s Federal Open Market Committee announces its decision on the federal funds target range, followed by a statement and usually a press conference.',
    historicalContext: 'Market reactions have depended on how the decision and guidance compared with expectations rather than on the decision alone.',
  },
  cpi: {
    name: 'Consumer Price Index (CPI)',
    explanation: 'The Bureau of Labor Statistics’ monthly measure of changes in prices paid by urban consumers — the most widely followed US inflation gauge.',
    historicalContext: 'In periods when inflation was a central policy concern, CPI releases were associated with larger moves in interest rates and stocks.',
  },
  ppi: {
    name: 'Producer Price Index (PPI)',
    explanation: 'The Bureau of Labor Statistics’ monthly measure of prices received by domestic producers.',
    historicalContext: 'PPI is sometimes watched as an early indicator of consumer inflation, though the relationship is loose.',
  },
  employment: {
    name: 'Employment Situation (jobs report)',
    explanation: 'The Bureau of Labor Statistics’ monthly report on nonfarm payrolls, the unemployment rate and wages, usually released on the first Friday of the month.',
    historicalContext: 'Initial payroll figures are often revised in later months; markets react to the surprise versus expectations.',
  },
  gdp: {
    name: 'Gross Domestic Product (GDP)',
    explanation: 'The Bureau of Economic Analysis’ quarterly estimate of the value of goods and services produced in the US, released as advance, second and third estimates.',
    historicalContext: 'GDP is backward-looking; markets have often already priced in much of the information by the release date.',
  },
  company: {
    name: 'Company event',
    explanation: 'A scheduled corporate event such as an investor day, shareholder meeting, or product announcement.',
    historicalContext: 'Effects vary widely and are often small unless material new information is disclosed.',
  },
  other: { name: 'Scheduled release', explanation: 'A scheduled public release.', historicalContext: 'Historical effects vary.' },
};

/** Formats a scheduled time in both the source time zone and the viewer's time zone. */
export function formatEventTime(e: EconomicEvent, viewerTimeZone?: string): { source: string; local: string } {
  const opts: Intl.DateTimeFormatOptions = e.dateOnly
    ? { year: 'numeric', month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  const safeTz = (tz?: string) => {
    if (!tz) return undefined;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      return undefined;
    }
  };
  return {
    source: new Intl.DateTimeFormat('en-US', { ...opts, timeZone: safeTz(e.sourceTimeZone) ?? 'UTC' }).format(e.scheduledAt),
    local: new Intl.DateTimeFormat('en-US', { ...opts, timeZone: safeTz(viewerTimeZone) }).format(e.scheduledAt),
  };
}
