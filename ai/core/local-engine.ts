import { findTermsInText, GLOSSARY } from '../../education/content/glossary';
import { INDICATOR_IDS, INDICATORS, type IndicatorId } from '../../indicators/registry';
import { buildFacts, type AssistantContext } from './facts';
import { groundAnswer } from './guard';
import { ASSISTANT_DISCLAIMER, type AssistantAnswer, type Claim, type Fact } from './types';

/**
 * Offline, deterministic "explainer" engine. It never generates free-form claims about data: every
 * factual sentence is copied from the fact sheet and cited. It answers educational questions from
 * the built-in indicator registry and glossary. Used when no AI backend is configured or reachable.
 */

type Intent = 'why-move' | 'read-chart' | 'indicator' | 'support-resistance' | 'earnings' | 'volatility' | 'history' | 'missing' | 'rates' | 'news-reaction' | 'glossary' | 'unknown';

const INTENT_RULES: [Intent, RegExp][] = [
  ['news-reaction', /\b(decline|fall|drop|fell)\b.*\b(after|despite)\b.*\b(good|positive|strong|beat)\b|\bpositive news\b/i],
  ['why-move', /\bwhy (did|is|has|was)\b.*\b(move|moving|rise|rising|rose|fall|falling|fell|drop|dropp|jump|surge|decline|up|down)|\bwhat (is|was) (causing|driving)\b|\bwhy .* today\b/i],
  ['read-chart', /\b(how (do|to|can) i read|read(ing)? (this|the|a) chart|explain (this|the) chart)\b/i],
  ['support-resistance', /\b(support|resistance)\b/i],
  ['earnings', /\b(earnings|financial statements?|revenue|net income|10-k|10-q|eps|report say)\b/i],
  ['volatility', /\bvolatil/i],
  ['history', /\b(historical(ly)?|perform(ed|ance)?|track record|past (year|month))\b/i],
  ['missing', /\b(missing|don'?t (we )?know|unknown|what information|limitations?)\b/i],
  ['rates', /\binterest rates?\b|\bfed\b|\bfomc\b/i],
];

function detectIndicator(q: string): IndicatorId | null {
  const lower = q.toLowerCase();
  for (const id of INDICATOR_IDS) {
    const m = INDICATORS[id];
    if (lower.includes(m.short.toLowerCase()) || lower.includes(m.name.toLowerCase()) || new RegExp(`\\b${id}\\b`).test(lower)) return id;
  }
  if (/\bbollinger\b/.test(lower)) return 'bollinger';
  if (/\bmoving average\b/.test(lower)) return 'sma';
  if (/\bstoch/.test(lower)) return 'stochastic';
  if (/\bon[- ]balance\b/.test(lower)) return 'obv';
  return null;
}

export function detectIntent(question: string): Intent {
  if (detectIndicator(question) && !/\bwhy (did|is)\b/i.test(question)) return 'indicator';
  for (const [intent, re] of INTENT_RULES) if (re.test(question)) return intent;
  if (findTermsInText(question).length) return 'glossary';
  return 'unknown';
}

const cite = (facts: Fact[], ...ids: string[]): Claim[] =>
  ids.flatMap((id) => {
    const f = facts.find((x) => x.id === id);
    return f ? [{ text: f.text, citations: [f.id] }] : [];
  });

const citePrefix = (facts: Fact[], prefix: string): Claim[] => facts.filter((f) => f.id.startsWith(prefix)).map((f) => ({ text: f.text, citations: [f.id] }));

function referenceFact(id: string, text: string, url?: string): Fact {
  return { id, kind: 'reference', text, source: { name: 'Indicator Mobile Learning Center', status: 'reference', url } };
}

export function answerLocally(question: string, ctx: AssistantContext): AssistantAnswer {
  const q = question.trim().slice(0, 1000);
  const facts = buildFacts(ctx);
  const intent = detectIntent(q);
  const verified: Claim[] = [];
  const historical: Claim[] = [];
  const interp: Claim[] = [];
  const missing: string[] = [];
  const sym = ctx.instrument?.symbol ?? 'this asset';
  const hasSeries = !!ctx.series && ctx.series.candles.length > 1;

  if (ctx.series?.provenance.status === 'simulated') {
    missing.push('This answer uses SIMULATED demo data. It describes a fictional instrument, not a real market.');
  }

  switch (intent) {
    case 'why-move':
    case 'news-reaction': {
      verified.push(...cite(facts, 'f:change', 'f:range', 'f:volume'));
      const news = citePrefix(facts, 'f:news:');
      verified.push(...news);
      historical.push(...cite(facts, 'f:vol', 'f:structure'));
      if (news.length) {
        interp.push({ text: 'The news items listed were published around the same time as the move. Timing alone does not prove that they caused it; other information, market-wide moves or large orders may also have contributed.', citations: news.map((n) => n.citations[0]) });
      } else {
        interp.push({ text: `No news items about ${sym} are available in the app for this period. Price moves often happen without a single identifiable cause — for example, broad market moves, sector rotation, or large orders.`, citations: [] });
      }
      if (intent === 'news-reaction') {
        interp.push({ text: 'Prices can fall after positive news when results were already expected (“priced in”), when guidance or details disappointed, when investors took profits, or when the wider market declined at the same time. Several of these can apply at once.', citations: [] });
      }
      missing.push('A verified causal explanation is not available: the app cannot observe why individual participants traded.', 'Order-flow, analyst expectations and non-public information are not included.');
      break;
    }
    case 'read-chart': {
      facts.push(referenceFact('r:chart', 'Each candle shows the open, high, low and close for one period; rising candles close above their open. Volume bars show trading activity. Swing labels (HH, HL, LH, LL) appear only after confirmation.'));
      verified.push(...cite(facts, 'f:price', 'f:range'));
      historical.push(...cite(facts, 'f:structure', 'f:zone0', 'f:ret63'));
      interp.push({ text: 'Reading a chart: (1) check the data status label and timeframe; (2) look at the overall direction over several timeframes; (3) note where price reacted in the past (support/resistance); (4) compare volume with its average; (5) remember that every pattern visible on a finished chart was uncertain while it formed.', citations: ['r:chart'] });
      break;
    }
    case 'indicator': {
      const id = detectIndicator(q) as IndicatorId;
      const m = INDICATORS[id];
      facts.push(referenceFact(`r:ind:${id}`, `${m.name}: ${m.description} How it is commonly read: ${m.howToRead} Historical behaviour: ${m.historicalBehavior} Example: ${m.example}`));
      const readingId = `f:ind:${id}`;
      if (facts.some((f) => f.id === readingId)) verified.push(...cite(facts, readingId));
      else if (hasSeries) missing.push(`${m.short} is not currently enabled on your chart, so no live reading is included. Add it from the Indicators panel to include its current value.`);
      interp.push({ text: `${m.name}: ${m.description}`, citations: [`r:ind:${id}`] });
      interp.push({ text: `How it is commonly read: ${m.howToRead}`, citations: [`r:ind:${id}`] });
      historical.push({ text: `Historical behaviour: ${m.historicalBehavior}`, citations: [`r:ind:${id}`] });
      missing.push(...m.limitations.map((l) => `Limitation: ${l}`));
      break;
    }
    case 'support-resistance': {
      facts.push(referenceFact('r:sr', 'Support and resistance are price areas where past declines or advances paused. They are historical observations, not guaranteed floors or ceilings.'));
      interp.push({ text: 'Support is an area where past declines paused; resistance is where past advances paused. Price can move through these areas at any time, and breakouts frequently reverse.', citations: ['r:sr'] });
      historical.push(...citePrefix(facts, 'f:zone'));
      if (!historical.length) missing.push('No previously established support/resistance areas with at least two swing reactions were found in the loaded data.');
      break;
    }
    case 'earnings': {
      const fund = cite(facts, 'f:fund:annual');
      verified.push(...fund);
      verified.push(...citePrefix(facts, 'f:news:').filter((c) => /earnings|revenue|results|10-[kq]/i.test(c.text)));
      if (!fund.length) missing.push('Reported financial statements are not available for this instrument in the current data mode. Connect a backend with SEC EDGAR access to load filings for US issuers.');
      interp.push({ text: 'Earnings are usually judged relative to prior expectations and guidance, so identical results can produce different price reactions.', citations: [] });
      missing.push('Consensus analyst expectations are not included in this app.');
      break;
    }
    case 'volatility':
      historical.push(...cite(facts, 'f:vol', 'f:maxdd', 'f:range'));
      facts.push(referenceFact('r:vol', 'Volatility measures the size of price changes, not their direction. It tends to cluster in time.'));
      interp.push({ text: 'Higher volatility means a wider range of recent outcomes. Possible contributors include news, earnings, macroeconomic releases and lower liquidity, but the data alone does not identify the cause.', citations: ['r:vol'] });
      break;
    case 'history':
      historical.push(...cite(facts, 'f:ret21', 'f:ret63', 'f:ret252', 'f:maxdd', 'f:vol', 'f:structure'));
      interp.push({ text: 'Past performance describes one historical path. It does not indicate future returns.', citations: [] });
      break;
    case 'rates': {
      facts.push(referenceFact('r:rates', 'The Federal Reserve’s FOMC sets the federal funds target range. Higher rates raise borrowing costs and reduce the present value of distant future cash flows.', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'));
      interp.push({ text: 'Interest rates affect businesses through borrowing costs, consumer demand and how investors value future profits. Highly indebted companies and those whose value depends on distant growth have historically been more sensitive to rate changes; banks can benefit from wider lending margins but face credit risk.', citations: ['r:rates'] });
      verified.push(...citePrefix(facts, 'f:event:').filter((c) => /FOMC|Federal|rate/i.test(c.text)));
      break;
    }
    case 'missing':
      missing.push(
        'Real-time order-book data and the reasons behind individual trades.',
        'Consensus analyst estimates and private company information.',
        'Data for delisted companies (survivorship bias in historical comparisons).',
      );
      if (!ctx.fundamentals) missing.push('Company financial statements (not loaded in this data mode).');
      if (!(ctx.news ?? []).length) missing.push('News coverage for this instrument.');
      if (ctx.series && ctx.series.provenance.status !== 'live') missing.push(`Live prices — current data status is “${ctx.series.provenance.status}”.`);
      break;
    case 'glossary':
    case 'unknown': {
      const terms = findTermsInText(q).slice(0, 3);
      terms.forEach((t, i) => {
        facts.push(referenceFact(`r:gl:${i}`, `${t.term}: ${t.definition}`));
        interp.push({ text: `${t.term}: ${t.definition}`, citations: [`r:gl:${i}`] });
      });
      if (!terms.length) {
        interp.push({
          text: `I can explain market data shown in the app (price changes, volume, volatility, structure, indicators, news and scheduled events) and financial concepts such as ${GLOSSARY.slice(0, 6).map((g) => g.term.toLowerCase()).join(', ')} and more. Try “Why did ${sym} move today?” or “What does RSI mean?”.`,
          citations: [],
        });
      }
      break;
    }
  }

  if (!hasSeries && ['why-move', 'read-chart', 'volatility', 'history', 'news-reaction'].includes(intent)) {
    missing.push('No price data is loaded for this question. Open an instrument first so its data can be included.');
  }

  const answer: AssistantAnswer = {
    question: q,
    engine: 'local-rules',
    verifiedFacts: verified,
    historicalObservations: historical,
    interpretations: interp,
    missingInformation: [...new Set(missing)],
    citations: [],
    warnings: [],
    disclaimer: ASSISTANT_DISCLAIMER,
    createdAt: ctx.nowMs,
  };
  return groundAnswer(answer, facts);
}
