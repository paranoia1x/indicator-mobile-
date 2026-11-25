import { isSafeExternalUrl, toPlainText } from '../../security/core/sanitize';
import type { NewsCategory, NewsItem, VerificationStatus } from './types';

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|mc_[a-z]+|ref|ref_src|cmpid|guccounter|ncid|soc_src|soc_trk)$/i;

/** Canonical URL used to detect the same article syndicated with different tracking params. */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = '';
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    u.hostname = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
    u.search = '';
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

const STOP = new Set('a an the of to in on for and or but with by from at as is are was were be been its it this that after over amid into says said report reports new'.split(' '));

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s.%$]/gu, ' ')
      .split(/\s+/)
      .map((t) => t.replace(/\.$/, ''))
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Overlap coefficient |A∩B| / min(|A|,|B|) — catches a short headline contained in a longer one. */
export function overlap(a: Set<string>, b: Set<string>): number {
  const m = Math.min(a.size, b.size);
  if (m === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / m;
}

export function headlineSimilar(a: Set<string>, b: Set<string>, threshold = 0.6): boolean {
  return jaccard(a, b) >= threshold || (Math.min(a.size, b.size) >= 4 && overlap(a, b) >= 0.85);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Groups repeated stories. Two items are duplicates when their canonical URLs match, or when
 * their headlines are similar (Jaccard ≥ threshold) and they were published within `windowMs`.
 * The earliest primary-source item (else the earliest item) is kept; others become `alsoReportedBy`.
 */
export function deduplicateNews(items: readonly NewsItem[], threshold = 0.6, windowMs = 48 * 3600_000): NewsItem[] {
  const sorted = [...items].sort((a, b) => a.publishedAt - b.publishedAt);
  const groups: { lead: NewsItem; members: NewsItem[]; tokens: Set<string>; urls: Set<string> }[] = [];
  for (const it of sorted) {
    const cu = canonicalUrl(it.url);
    const tk = titleTokens(it.headline);
    const g = groups.find(
      (gr) => (cu !== null && gr.urls.has(cu)) || (Math.abs(it.publishedAt - gr.lead.publishedAt) <= windowMs && headlineSimilar(gr.tokens, tk, threshold)),
    );
    if (g) {
      g.members.push(it);
      if (cu) g.urls.add(cu);
      if (it.isPrimarySource && !g.lead.isPrimarySource) g.lead = it;
    } else {
      groups.push({ lead: it, members: [it], tokens: tk, urls: new Set(cu ? [cu] : []) });
    }
  }
  return groups
    .map((g) => {
      const others = g.members.filter((m) => m !== g.lead);
      const symbols = [...new Set(g.members.flatMap((m) => m.symbols))];
      return {
        ...g.lead,
        symbols,
        alsoReportedBy: [
          ...g.lead.alsoReportedBy,
          ...others.map((o) => ({ publisher: o.publisher, url: o.url, publishedAt: o.publishedAt })),
        ],
      };
    })
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

const SPECULATIVE = [
  /\b(reportedly|rumou?r(s|ed)?|speculat\w*|unconfirmed|people familiar|sources? (say|said|close)|according to (people|sources)|considering|weighs?|explor(es|ing)|in talks|potential(ly)?|expected to|poised to|eyes?|mulls?|plans? to|price target|predicts?|forecasts?)\b/i,
  // Modal verbs are matched case-sensitively so the month "May" is not treated as hedging.
  /\b(could|may|might)\b/,
  /\?$/,
];
const CONFIRMED = [/\b(announced|reports?|reported|files?|filed|declares?|declared|completes?|completed|approved|appoints?|appointed|released|posts?|posted|raised|cut|held|rose|fell|increased|decreased)\b/i];

/** Heuristic verification status with an explanation the UI shows to the user. */
export function classifyVerification(headline: string, summary: string, isPrimarySource: boolean): { status: VerificationStatus; reason: string } {
  const text = `${headline} ${summary}`;
  const spec = SPECULATIVE.find((r) => r.test(headline)) ?? SPECULATIVE.find((r) => r.test(summary));
  if (spec) {
    const m = text.match(spec);
    return { status: 'speculative', reason: `Contains hedging or unsourced language${m ? ` (“${m[0]}”)` : ''}.` };
  }
  if (isPrimarySource) return { status: 'confirmed', reason: 'Published by the primary source (official filing, company or agency).' };
  if (CONFIRMED.some((r) => r.test(headline))) return { status: 'confirmed', reason: 'Reports a completed event; verify against the primary source when available.' };
  return { status: 'unverified', reason: 'Not enough information to classify; treat with caution.' };
}

const CATEGORY_RULES: [NewsCategory, RegExp][] = [
  ['earnings', /\b(earnings|quarterly results|q[1-4]\b|eps|revenue|guidance|profit|net income|10-q|10-k)\b/i],
  ['mergers-acquisitions', /\b(acquir\w*|acquisition|merger|merge|takeover|buyout|deal to buy)\b/i],
  ['dividend', /\bdividend/i],
  ['stock-split', /\bstock split|\bsplit\b/i],
  ['leadership', /\b(ceo|cfo|chief executive|chair(man|woman)?|resign\w*|appoint\w*|steps down|board)\b/i],
  ['regulatory', /\b(sec|ftc|doj|regulator\w*|antitrust|lawsuit|settlement|probe|investigation|fine[ds]?|approval|fda)\b/i],
  ['product', /\b(launch\w*|unveil\w*|new product|release[sd]? (a|its|the) new)\b/i],
  ['inflation', /\b(cpi|ppi|inflation|consumer prices|producer prices|pce)\b/i],
  ['interest-rates', /\b(fed|fomc|federal reserve|interest rates?|rate (hike|cut)|basis points|treasury yields?)\b/i],
  ['employment', /\b(jobs report|payrolls|unemployment|jobless|employment|labor market)\b/i],
  ['economic-policy', /\b(tariff|fiscal|stimulus|budget|policy|gdp|economy)\b/i],
  ['crypto', /\b(crypto\w*|bitcoin|ethereum|token|blockchain|stablecoin)\b/i],
  ['company-announcement', /\b(announce\w*|press release|8-k)\b/i],
];

export function categorize(headline: string, summary: string): NewsCategory[] {
  const text = `${headline} ${summary}`;
  const cats = CATEGORY_RULES.filter(([, r]) => r.test(text)).map(([c]) => c);
  return cats.length ? [...new Set(cats)] : ['other'];
}

/** Extractive (non-AI) summary: the first `n` sentences of the sanitised text. */
export function extractiveSummary(text: string, n = 2, maxLength = 320): string {
  const sentences = toPlainText(text).match(/[^.!?]+[.!?]+(\s|$)/g) ?? [toPlainText(text)];
  const s = sentences.slice(0, n).join('').trim();
  return s.length > maxLength ? s.slice(0, maxLength - 1).trimEnd() + '…' : s;
}

const PRIMARY_PUBLISHERS = /^(sec|u\.s\. securities and exchange commission|sec edgar|bureau of labor statistics|bls|bureau of economic analysis|bea|federal reserve|board of governors of the federal reserve system|u\.s\. treasury|business wire|pr newswire|globenewswire)$/i;

export interface RawNews {
  id?: string;
  headline: unknown;
  summary?: unknown;
  publisher: unknown;
  publishedAt: unknown;
  eventTime?: unknown;
  url: unknown;
  symbols?: unknown;
  industries?: unknown;
  isPrimarySource?: boolean;
}

/** Normalises and validates a raw provider news record. Returns null when unusable. */
export function normalizeNews(raw: RawNews, provenance: NewsItem['provenance']): NewsItem | null {
  const headline = toPlainText(raw.headline, 300);
  const publisher = toPlainText(raw.publisher, 120);
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const publishedAt = typeof raw.publishedAt === 'number' ? raw.publishedAt : Date.parse(String(raw.publishedAt));
  if (!headline || !publisher || !Number.isFinite(publishedAt) || !isSafeExternalUrl(url)) return null;
  const summary = toPlainText(raw.summary ?? '', 1200);
  const eventTimeNum = raw.eventTime == null ? NaN : typeof raw.eventTime === 'number' ? raw.eventTime : Date.parse(String(raw.eventTime));
  const isPrimary = raw.isPrimarySource ?? PRIMARY_PUBLISHERS.test(publisher);
  const { status, reason } = classifyVerification(headline, summary, isPrimary);
  const symbols = Array.isArray(raw.symbols) ? raw.symbols.filter((s): s is string => typeof s === 'string' && /^[A-Z0-9.\-]{1,20}$/.test(s)).slice(0, 20) : [];
  const industries = Array.isArray(raw.industries) ? raw.industries.map((s) => toPlainText(s, 60)).filter(Boolean).slice(0, 10) : [];
  return {
    id: raw.id ?? `${publisher}:${canonicalUrl(url) ?? url}`,
    headline,
    summary,
    publisher,
    publishedAt,
    eventTime: Number.isFinite(eventTimeNum) && eventTimeNum !== publishedAt ? eventTimeNum : null,
    url,
    symbols,
    industries,
    categories: categorize(headline, summary),
    status,
    statusReason: reason,
    aiSummary: null,
    whyItMayMatter: null,
    interpretations: [],
    alsoReportedBy: [],
    isPrimarySource: isPrimary,
    provenance,
  };
}

/** Generic, category-based context shown when no AI summary is available. Never predictive. */
export function categoryContext(cat: NewsCategory): { why: string; interpretations: string[] } {
  const C: Partial<Record<NewsCategory, { why: string; interpretations: string[] }>> = {
    earnings: { why: 'Earnings reports update investors on revenue, profit and outlook; prices often move when results differ from what was widely expected.', interpretations: ['Results above expectations can still be followed by a decline if guidance disappoints or expectations were already high.', 'One quarter may reflect temporary factors rather than a lasting trend.'] },
    'interest-rates': { why: 'Interest rates affect borrowing costs, company valuations and the relative appeal of bonds versus stocks.', interpretations: ['Markets often react to the difference between the decision and what was expected, not the decision itself.', 'Commentary about future policy can matter more than the current rate.'] },
    inflation: { why: 'Inflation data influences expectations for central-bank policy and real (inflation-adjusted) returns.', interpretations: ['A single month can be noisy; trends over several months are more informative.', 'Different measures (headline vs core) can tell different stories.'] },
    employment: { why: 'Labour-market data signals the health of the economy and can shift interest-rate expectations.', interpretations: ['Strong jobs data can be read as good for growth or bad if it raises rate expectations.', 'Initial figures are frequently revised.'] },
    'mergers-acquisitions': { why: 'Deals can change a company’s size, debt, and competitive position.', interpretations: ['Announced deals can fail on regulatory or financing grounds.', 'Acquirers and targets often react in opposite directions.'] },
    dividend: { why: 'Dividend changes indicate how a company is choosing to return cash to shareholders.', interpretations: ['A cut can reflect stress or a deliberate shift toward reinvestment.', 'A raise does not guarantee future payments.'] },
    regulatory: { why: 'Regulatory actions can create costs, restrictions or approvals that affect a business.', interpretations: ['Outcomes of investigations and lawsuits are often uncertain for long periods.'] },
    crypto: { why: 'Crypto assets are highly sensitive to regulation, liquidity and sentiment.', interpretations: ['Crypto news is frequently unverified; check primary sources.', 'Moves can be large and fast in both directions.'] },
  };
  return C[cat] ?? { why: 'This story may be relevant to the companies or industries it mentions.', interpretations: ['The same news can be interpreted differently by different investors.'] };
}
