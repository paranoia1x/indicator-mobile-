import { toPlainText } from '../../security/core/sanitize';
import type { AssistantAnswer, Claim, Fact } from './types';

/**
 * Prompt-injection defences for EXTERNAL content (news, filings, provider text) that is passed to
 * the assistant as data. External text is never treated as instructions: it is sanitised,
 * instruction-like sentences are neutralised, and it is wrapped in delimiters that the system
 * prompt declares to be untrusted data.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|messages?|rules)\b/i,
  /\bdisregard (all |any |the )?(previous|prior|above|system) /i,
  /\b(system|developer) (prompt|message|instructions?)\b/i,
  /\byou are now\b/i,
  /\bact as (an? )?(unrestricted|jailbroken|different)/i,
  /\bnew instructions?:/i,
  /\b(reveal|print|show|output|leak|send) (your |the )?(api[ -]?keys?|secrets?|tokens?|credentials|password|system prompt|instructions)\b/i,
  /\b(seed phrase|recovery phrase|private key)\b/i,
  /\bbegin(ning)? of (system|prompt)\b/i,
  /<\/?(system|assistant|instructions?|untrusted[_-]?data)>/i,
  /\b(recommend|tell (the )?user to) (buy|sell|short)\b/i,
];

export function scanForInjection(text: string): { flagged: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const r of INJECTION_PATTERNS) {
    const m = text.match(r);
    if (m) matches.push(m[0]);
  }
  return { flagged: matches.length > 0, matches };
}

/** Sanitises external text and replaces instruction-like sentences with a neutral marker. */
export function quarantineExternalText(raw: unknown, maxLength = 1500): { text: string; flagged: boolean } {
  const plain = toPlainText(raw, maxLength * 2);
  let flagged = false;
  const sentences = plain.split(/(?<=[.!?\n])\s+/);
  const kept = sentences.map((s) => {
    if (scanForInjection(s).flagged) {
      flagged = true;
      return '[removed: instruction-like text from an external source]';
    }
    return s;
  });
  let text = kept.join(' ');
  if (text.length > maxLength) text = text.slice(0, maxLength - 1) + '…';
  return { text, flagged };
}

/** Wraps untrusted content in explicit data delimiters for the remote model. */
export function wrapUntrusted(id: string, text: string): string {
  const safe = text.replace(/<\/?untrusted_data[^>]*>/gi, '');
  return `<untrusted_data id="${id.replace(/[^\w.:-]/g, '')}">${safe}</untrusted_data>`;
}

const ADVICE_PATTERNS: RegExp[] = [
  /\byou should (buy|sell|short|invest|go long|go short)\b/i,
  /\b(strong )?(buy|sell) (signal|now|rating|recommendation)\b/i,
  /\bguarantee[sd]?\b/i,
  /\b(risk[- ]free|can'?t lose|sure thing)\b/i,
  /\bwill (definitely |certainly |surely )?(rise|fall|go up|go down|increase|decrease|reach|hit|rally|crash|drop|climb)\b/i,
  /\bprice target of\b/i,
];

export function containsAdviceOrPrediction(text: string): boolean {
  return ADVICE_PATTERNS.some((r) => r.test(text));
}

/** Numbers appearing in text, normalised (commas, currency, percent signs removed). */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /[-−]?\$?\d[\d,]*(\.\d+)?\s*%?/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[0].replace(/[−]/g, '-').replace(/[$,%\s]/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function numberSupported(n: number, facts: Fact[]): boolean {
  if (Math.abs(n) < 10 && Number.isInteger(n)) return true; // small counts/ordinals ("2 sources", "Q3")
  for (const f of facts) {
    for (const m of extractNumbers(f.text)) {
      // Compare magnitudes: prose often says "fell 3.2%" where the source shows "−3.2%".
      const a = Math.abs(m);
      const b = Math.abs(n);
      if (a === b) return true;
      const tol = Math.max(a * 0.005, 0.051); // allow rounding to 1 decimal
      if (Math.abs(a - b) <= tol) return true;
    }
  }
  return false;
}

/**
 * Validates an answer against the fact sheet it was given (hallucination resistance):
 * - unknown citation ids are removed;
 * - factual/historical claims without valid citations are downgraded to interpretations;
 * - factual/historical claims containing numbers absent from their cited facts are downgraded;
 * - any claim containing personalised advice or certain predictions is removed.
 */
export function groundAnswer(answer: AssistantAnswer, facts: Fact[]): AssistantAnswer {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const warnings = [...answer.warnings];
  const interpretations: Claim[] = [];
  const keepFactual = (claims: Claim[], label: string): Claim[] => {
    const kept: Claim[] = [];
    for (const c of claims) {
      if (containsAdviceOrPrediction(c.text)) {
        warnings.push(`Removed a ${label} statement that contained advice or a certain prediction.`);
        continue;
      }
      const cites = c.citations.filter((id) => byId.has(id));
      if (cites.length < c.citations.length) warnings.push('Removed citation(s) that did not match any provided source.');
      if (cites.length === 0) {
        warnings.push(`A ${label} statement had no valid source and was moved to interpretations.`);
        interpretations.push({ text: c.text, citations: [] });
        continue;
      }
      const cited = cites.map((id) => byId.get(id) as Fact);
      const unsupported = extractNumbers(c.text).filter((n) => !numberSupported(n, cited));
      if (unsupported.length) {
        warnings.push(`A ${label} statement contained figures not found in its sources (${unsupported.slice(0, 3).join(', ')}) and was moved to interpretations.`);
        interpretations.push({ text: c.text, citations: cites });
        continue;
      }
      kept.push({ text: c.text, citations: cites });
    }
    return kept;
  };
  const verifiedFacts = keepFactual(answer.verifiedFacts, 'factual');
  const historicalObservations = keepFactual(answer.historicalObservations, 'historical');
  for (const c of answer.interpretations) {
    if (containsAdviceOrPrediction(c.text)) {
      warnings.push('Removed an interpretation that contained advice or a certain prediction.');
      continue;
    }
    interpretations.push({ text: c.text, citations: c.citations.filter((id) => byId.has(id)) });
  }
  const used = new Set([...verifiedFacts, ...historicalObservations, ...interpretations].flatMap((c) => c.citations));
  return {
    ...answer,
    verifiedFacts,
    historicalObservations,
    interpretations,
    citations: facts.filter((f) => used.has(f.id)),
    warnings: [...new Set(warnings)],
  };
}
