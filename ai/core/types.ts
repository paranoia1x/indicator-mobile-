import type { DataStatus } from '../../market-data/core/types';

/** A unit of verified application data the assistant may cite. */
export interface Fact {
  id: string;
  kind: 'verified' | 'historical' | 'reference';
  text: string;
  source: { name: string; url?: string; status: DataStatus | 'reference'; asOf?: number };
}

export interface Claim {
  text: string;
  citations: string[];
}

export interface AssistantAnswer {
  question: string;
  engine: 'local-rules' | 'remote-llm';
  verifiedFacts: Claim[];
  historicalObservations: Claim[];
  interpretations: Claim[];
  missingInformation: string[];
  /** Only facts that are actually cited by at least one claim. */
  citations: Fact[];
  /** Grounding / safety warnings produced while validating the answer. */
  warnings: string[];
  disclaimer: string;
  createdAt: number;
}

export const ASSISTANT_DISCLAIMER =
  'Educational information only — not investment advice. Historical observations do not predict future prices. Verify important facts with the cited primary sources.';
