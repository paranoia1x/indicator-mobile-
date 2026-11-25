import type { EconomicEvent, EventKind } from '../../../news/core/calendar';
import { normalizeNews } from '../../../news/core/processing';
import type { NewsItem } from '../../../news/core/types';
import { fnv1a, mulberry32 } from '../random';
import type { FinancialPeriod, Fundamentals, Provenance } from '../types';
import { generateDemoDaily } from './generator';
import { DEMO_SPECS, getDemoSpec } from './universe';

/** Simulated news, calendar and fundamentals for DEMO MODE. Every item is labelled simulated. */

const DAY_MS = 86_400_000;

export function demoProvenance(nowMs: number, note = 'Simulated demo content'): Provenance {
  return { providerId: 'demo', providerName: 'Demo data (simulated)', status: 'simulated', asOf: nowMs, fetchedAt: nowMs, attribution: note };
}

const TEMPLATES: { h: (n: string) => string; s: (n: string) => string; primary?: boolean; dupOf?: number }[] = [
  { h: (n) => `${n} reports quarterly results; revenue up year over year`, s: (n) => `${n} published its quarterly report. Revenue increased compared with the same quarter last year while operating costs also rose. The company reiterated its annual outlook.`, primary: true },
  { h: (n) => `${n} quarterly revenue rises; company reiterates outlook`, s: (n) => `Coverage of the quarterly report from ${n}. Revenue grew year over year; management kept guidance unchanged.`, dupOf: 0 },
  { h: (n) => `${n} reportedly in talks to acquire a smaller rival, sources say`, s: () => 'People familiar with the matter said discussions were at an early stage and may not result in a deal. The company declined to comment.' },
  { h: (n) => `${n} declares quarterly dividend`, s: (n) => `The board of ${n} declared a regular quarterly cash dividend payable next month.`, primary: true },
  { h: (n) => `${n} appoints new chief financial officer`, s: (n) => `${n} announced the appointment of a new CFO, effective at the start of next quarter.`, primary: true },
  { h: (n) => `${n} launches new product line`, s: (n) => `${n} unveiled a new product line aimed at enterprise customers. Pricing and volumes were not disclosed.` },
  { h: (n) => `Could ${n} be the next takeover target? Analysts weigh options`, s: () => 'Some commentators speculated about strategic alternatives. No company statement has been issued.' },
];

const MACRO: { h: string; s: string; cat: string }[] = [
  { h: 'Simulated CPI report: consumer prices rose 0.2% last month', s: 'The simulated consumer price index increased 0.2% month over month. Core prices, which exclude food and energy, rose 0.3%.', cat: 'inflation' },
  { h: 'Simulated FOMC holds policy rate steady', s: 'The simulated Federal Open Market Committee left its target range unchanged and said future decisions would depend on incoming data.', cat: 'rates' },
  { h: 'Simulated jobs report: payrolls increased, unemployment rate unchanged', s: 'The simulated employment report showed nonfarm payrolls rose while the unemployment rate held steady. Prior months were revised.', cat: 'employment' },
  { h: 'Crypto markets swing as simulated exchange outage resolved', s: 'Prices of simulated digital assets moved sharply during a temporary exchange outage that was later resolved.', cat: 'crypto' },
];

/** Deterministic simulated news for the last ~14 days. Includes duplicates to exercise deduplication. */
export function generateDemoNews(nowMs: number): NewsItem[] {
  const day = Math.floor(nowMs / DAY_MS);
  const rand = mulberry32(fnv1a(`news:${day}`));
  const prov = demoProvenance(nowMs, 'Simulated news — fictional companies and events');
  const out: NewsItem[] = [];
  const stocks = DEMO_SPECS.filter((s) => s.assetClass === 'stock');
  stocks.forEach((spec, k) => {
    const short = spec.name.replace(' (Simulated)', '');
    const picks = [k % TEMPLATES.length, (k + 2) % TEMPLATES.length, (k + 5) % TEMPLATES.length];
    if (picks.includes(0)) picks.push(1); // duplicate coverage of the same story
    for (const t of picks) {
      const tpl = TEMPLATES[t];
      const ageH = tpl.dupOf !== undefined ? 0 : Math.floor(rand() * 14 * 24) + 1;
      const published = nowMs - ageH * 3600_000 - (tpl.dupOf !== undefined ? -2 * 3600_000 : 0);
      const item = normalizeNews(
        {
          id: `demo-${spec.symbol}-${t}`,
          headline: tpl.h(short),
          summary: tpl.s(short),
          publisher: tpl.primary ? `${short} Investor Relations (Simulated)` : t % 2 ? 'Demo Business Daily (Simulated)' : 'Demo Newswire (Simulated)',
          publishedAt: Math.min(published, nowMs),
          eventTime: tpl.primary ? published - 3600_000 : undefined,
          url: `https://example.com/demo-news/${spec.symbol.toLowerCase()}/${t}`,
          symbols: [spec.symbol],
          industries: spec.industry ? [spec.industry] : [],
          isPrimarySource: !!tpl.primary,
        },
        prov,
      );
      if (item) out.push(item);
    }
  });
  MACRO.forEach((m, i) => {
    const item = normalizeNews(
      {
        id: `demo-macro-${i}`,
        headline: m.h,
        summary: m.s,
        publisher: 'Demo Economics Desk (Simulated)',
        publishedAt: nowMs - (i * 2 + 1) * DAY_MS,
        url: `https://example.com/demo-news/macro/${i}`,
        symbols: m.cat === 'crypto' ? ['AURC.SIM', 'NOVA.SIM'] : ['DMX500.SIM'],
        industries: [],
      },
      prov,
    );
    if (item) out.push(item);
  });
  return out.sort((a, b) => b.publishedAt - a.publishedAt);
}

const SIM_SOURCE = { name: 'Simulated schedule (demo — not an official calendar)', url: 'https://example.com/demo-calendar' };

/**
 * Simulated economic calendar with past and upcoming events. Upcoming events never include an
 * "actual" value; past events include a simulated actual for event-study demonstrations.
 */
export function generateDemoCalendar(nowMs: number): EconomicEvent[] {
  const prov = demoProvenance(nowMs, 'Simulated calendar — dates and values are fictional');
  const today = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const rand = mulberry32(fnv1a(`calendar:${Math.floor(today / (30 * DAY_MS))}`));
  const events: EconomicEvent[] = [];
  const add = (kind: EventKind, title: string, dayOffset: number, hourUtc: number, extra: Partial<EconomicEvent> = {}) => {
    const t = today + dayOffset * DAY_MS + hourUtc * 3600_000;
    events.push({
      id: `demo-${kind}-${extra.symbol ?? 'macro'}-${dayOffset}`,
      kind,
      title,
      scheduledAt: t,
      dateOnly: false,
      sourceTimeZone: 'America/New_York',
      source: SIM_SOURCE,
      previous: null,
      actual: null,
      provenance: prov,
      ...extra,
    });
  };
  // Monthly macro releases: 24 months back (for event studies) and 2 ahead.
  for (let m = -24; m <= 2; m++) {
    const base = m * 30;
    const prevCpi = Math.round((2 + rand() * 2.5) * 10) / 10;
    const prevJobs = Math.round(80 + rand() * 220);
    const isPast = base + 12 < 0;
    add('cpi', 'Consumer Price Index (simulated)', base + 12, 13.5, { previous: { value: prevCpi, unit: '% y/y', period: 'prior month' }, actual: isPast ? { value: Math.round((prevCpi + (rand() - 0.5)) * 10) / 10, unit: '% y/y', period: 'month' } : null });
    add('ppi', 'Producer Price Index (simulated)', base + 13, 13.5, { previous: { value: Math.round((1 + rand() * 3) * 10) / 10, unit: '% y/y', period: 'prior month' } });
    add('employment', 'Employment Situation (simulated)', base + 5, 13.5, { previous: { value: prevJobs, unit: 'k jobs', period: 'prior month' }, actual: base + 5 < 0 ? { value: Math.round(prevJobs + (rand() - 0.5) * 120), unit: 'k jobs', period: 'month' } : null });
    if (m % 2 === 0) add('fomc', 'FOMC rate decision (simulated)', base + 18, 19, { previous: { value: 4.25, unit: '% upper bound', period: 'prior meeting' } });
    if (m % 3 === 0) add('gdp', 'GDP advance estimate (simulated)', base + 27, 13.5, { previous: { value: Math.round((rand() * 4 - 0.5) * 10) / 10, unit: '% q/q annualised', period: 'prior quarter' } });
  }
  // Quarterly earnings for demo stocks: 8 quarters back, 1 ahead.
  DEMO_SPECS.filter((s) => s.assetClass === 'stock').forEach((s, k) => {
    for (let q = -8; q <= 1; q++) {
      const off = q * 91 + ((k * 7) % 45) + 3;
      add('earnings', `${s.name.replace(' (Simulated)', '')} quarterly earnings (simulated)`, off, 21, { symbol: s.symbol });
    }
  });
  return events.sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/** Simulated fundamentals. Some values are intentionally `null` to show "unavailable" handling. */
export function generateDemoFundamentals(symbol: string, nowMs: number): Fundamentals | null {
  const spec = getDemoSpec(symbol);
  if (!spec || spec.assetClass !== 'stock' || !spec.sharesOutstanding) return null;
  const rand = mulberry32(fnv1a(`fund:${symbol}`));
  const daily = generateDemoDaily(spec, nowMs);
  const lastPx = daily[daily.length - 1]?.close ?? spec.startPrice;
  const shares = spec.sharesOutstanding;
  const year = new Date(nowMs).getUTCFullYear();
  const isBiotech = spec.industry === 'Biotechnology';
  const baseRevenue = (lastPx * shares) / (isBiotech ? 25 : 2.5 + rand() * 4);
  const margin = isBiotech ? -0.6 : 0.05 + rand() * 0.2;
  const periods: FinancialPeriod[] = [];
  for (let y = 5; y >= 1; y--) {
    const g = Math.pow(1 + (spec.drift + (rand() - 0.5) * 0.1), -y + 1);
    const revenue = Math.round(baseRevenue * g);
    const ni = Math.round(revenue * (margin + (rand() - 0.5) * 0.04));
    periods.push({
      label: `FY${year - y}`,
      periodEnd: `${year - y}-12-31`,
      kind: 'annual',
      revenue,
      netIncome: ni,
      eps: Math.round((ni / shares) * 100) / 100,
      operatingCashFlow: Math.round(ni * (1.1 + rand() * 0.4)),
      totalAssets: Math.round(revenue * (1.5 + rand())),
      totalLiabilities: Math.round(revenue * (0.6 + rand() * 0.6)),
      // Older debt figures intentionally unavailable to demonstrate null handling.
      totalDebt: y >= 4 ? null : Math.round(revenue * (0.2 + rand() * 0.4)),
    });
  }
  for (let q = 8; q >= 1; q--) {
    const qi = (8 - q) % 4;
    const yy = year - Math.ceil(q / 4);
    const revenue = Math.round((baseRevenue / 4) * (0.92 + rand() * 0.16));
    const ni = Math.round(revenue * (margin + (rand() - 0.5) * 0.06));
    periods.push({
      label: `Q${qi + 1} ${yy}`,
      periodEnd: `${yy}-${String((qi + 1) * 3).padStart(2, '0')}-${qi === 0 || qi === 3 ? '31' : '30'}`,
      kind: 'quarterly',
      revenue,
      netIncome: ni,
      eps: Math.round((ni / shares) * 100) / 100,
      operatingCashFlow: q === 1 ? null : Math.round(ni * (1 + rand() * 0.5)),
      totalAssets: null,
      totalLiabilities: null,
      totalDebt: null,
    });
  }
  const paysDividend = !isBiotech && margin > 0.08;
  const dividends = paysDividend
    ? Array.from({ length: 8 }, (_, i) => ({ date: new Date(nowMs - (i + 1) * 91 * DAY_MS).toISOString().slice(0, 10), amount: Math.round(lastPx * 0.006 * 100) / 100 }))
    : [];
  return {
    symbol,
    currency: 'USD',
    periods,
    sharesOutstanding: { value: shares, unit: 'shares' },
    dividendsPerShare: dividends,
    filings: [],
    provenance: demoProvenance(nowMs, 'Simulated financial statements for a fictional company'),
  };
}
