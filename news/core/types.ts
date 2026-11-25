import type { Provenance } from '../../market-data/core/types';

export type NewsCategory =
  | 'earnings'
  | 'company-announcement'
  | 'product'
  | 'mergers-acquisitions'
  | 'regulatory'
  | 'leadership'
  | 'dividend'
  | 'stock-split'
  | 'inflation'
  | 'interest-rates'
  | 'employment'
  | 'economic-policy'
  | 'industry'
  | 'crypto'
  | 'other';

/**
 * confirmed   — primary/official source (filing, company release, government statistic) or the
 *               article reports a completed fact without hedging language
 * speculative — rumours, unnamed sources, "may/could/considering", analyst opinion
 * unverified  — not enough information to tell
 */
export type VerificationStatus = 'confirmed' | 'speculative' | 'unverified';

export interface NewsItem {
  id: string;
  headline: string;
  /** Publisher-supplied summary (sanitised plain text). */
  summary: string;
  publisher: string;
  /** When the article was published (UNIX ms). */
  publishedAt: number;
  /** When the underlying event happened, if known and different (UNIX ms). */
  eventTime: number | null;
  url: string;
  symbols: string[];
  industries: string[];
  categories: NewsCategory[];
  status: VerificationStatus;
  statusReason: string;
  /** Optional model-generated summary; always labelled as AI-generated in the UI. */
  aiSummary: { text: string; generatedBy: string; generatedAt: number } | null;
  whyItMayMatter: string | null;
  interpretations: string[];
  /** Other outlets that carried the same story (after deduplication). */
  alsoReportedBy: { publisher: string; url: string; publishedAt: number }[];
  /** Original-source flag: true when the publisher is the primary source (e.g. SEC, the company). */
  isPrimarySource: boolean;
  provenance: Provenance;
}
