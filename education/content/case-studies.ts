/**
 * Historical case studies. Figures are widely documented, rounded, and cited to official or
 * institutional sources. They are presented for education; verify against the sources.
 */
export interface CaseStudy {
  id: string;
  title: string;
  period: string;
  summary: string;
  whatHappened: string[];
  lessons: string[];
  hindsightNote: string;
  sources: { name: string; url: string }[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'black-monday-1987',
    title: 'Black Monday',
    period: 'October 1987',
    summary: 'On October 19, 1987, the Dow Jones Industrial Average fell about 22.6% in a single day — still its largest one-day percentage decline.',
    whatHappened: [
      'Declines had already occurred in the preceding days, and selling accelerated globally on October 19.',
      'Portfolio-insurance strategies that sold futures as prices fell were widely cited as amplifying the decline.',
      'The Federal Reserve issued a statement the next morning affirming its readiness to provide liquidity.',
    ],
    lessons: ['Extreme one-day moves are possible and can exceed what historical volatility suggested.', 'Automated selling can create feedback loops.', 'Liquidity can disappear quickly.'],
    hindsightNote: 'Explanations offered afterwards differ; there is still no single agreed cause.',
    sources: [{ name: 'Federal Reserve History — Stock Market Crash of 1987', url: 'https://www.federalreservehistory.org/essays/stock-market-crash-of-1987' }],
  },
  {
    id: 'dotcom-2000',
    title: 'The dot-com bubble and bust',
    period: '1995–2002',
    summary: 'The Nasdaq Composite peaked in March 2000 and fell roughly 78% by October 2002 as many internet companies failed.',
    whatHappened: [
      'Rapid adoption of the internet fuelled very high valuations for companies with little or no profit.',
      'After the peak, many companies ran out of cash; some well-known names went bankrupt.',
      'Some survivors eventually became very large companies, but recovering the index peak took about 15 years.',
    ],
    lessons: ['A transformative technology does not guarantee profitable investments.', 'Valuation matters.', 'Survivorship bias: today’s winners hide the many failures.'],
    hindsightNote: 'Many observers called valuations excessive for years before the peak; timing the top was not obvious.',
    sources: [{ name: 'U.S. SEC — Investor.gov: market history and risk', url: 'https://www.investor.gov/' }],
  },
  {
    id: 'gfc-2008',
    title: 'The 2007–2009 financial crisis',
    period: '2007–2009',
    summary: 'The S&P 500 fell about 57% from its October 2007 peak to its March 2009 low amid a banking and housing crisis.',
    whatHappened: [
      'Losses on subprime mortgages spread through the financial system via complex securities and leverage.',
      'Lehman Brothers filed for bankruptcy on September 15, 2008.',
      'Governments and central banks intervened on a large scale; the US economy was in recession from December 2007 to June 2009 (NBER dating).',
    ],
    lessons: ['Leverage and interconnectedness can turn local losses into systemic crises.', 'Correlations between risky assets rose sharply.', 'Recoveries can take years.'],
    hindsightNote: 'The bottom in March 2009 occurred while economic news was still very negative.',
    sources: [
      { name: 'Federal Reserve History — The Great Recession and Its Aftermath', url: 'https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath' },
      { name: 'NBER — US Business Cycle Expansions and Contractions', url: 'https://www.nber.org/research/data/us-business-cycle-expansions-and-contractions' },
    ],
  },
  {
    id: 'flash-crash-2010',
    title: 'The Flash Crash',
    period: 'May 6, 2010',
    summary: 'US equity prices plunged and largely rebounded within roughly half an hour; the Dow fell nearly 1,000 points intraday.',
    whatHappened: [
      'A joint SEC–CFTC report described a large automated sell order in futures interacting with high-frequency trading and evaporating liquidity.',
      'Some individual stocks briefly traded at absurd prices, and many trades were later cancelled.',
    ],
    lessons: ['Market orders in fast markets can fill far from the last price (slippage).', 'Liquidity is not guaranteed.'],
    hindsightNote: 'Market structure changes such as single-stock circuit breakers were introduced afterwards.',
    sources: [{ name: 'SEC/CFTC — Findings Regarding the Market Events of May 6, 2010', url: 'https://www.sec.gov/news/studies/2010/marketevents-report.pdf' }],
  },
  {
    id: 'covid-2020',
    title: 'The COVID-19 crash and rebound',
    period: 'February–August 2020',
    summary: 'The S&P 500 fell about 34% from its February 19, 2020 high to its March 23, 2020 low, then reached a new high in August 2020.',
    whatHappened: [
      'The spread of COVID-19 led to lockdowns and extreme uncertainty about the economy.',
      'Volatility spiked; trading halts (market-wide circuit breakers) were triggered several times in March.',
      'Large fiscal and monetary support was announced; markets rebounded while the economy was still weak.',
    ],
    lessons: ['Markets can fall and recover far faster than the economy.', 'Prices reflect expectations, not current conditions.'],
    hindsightNote: 'Very few forecasts in March 2020 anticipated a new high within five months.',
    sources: [{ name: 'Federal Reserve — Financial Stability Report (May 2020)', url: 'https://www.federalreserve.gov/publications/financial-stability-report.htm' }],
  },
  {
    id: 'rates-2022',
    title: 'Rising rates in 2022',
    period: '2022',
    summary: 'The Federal Reserve began raising its policy rate from near zero in March 2022; both stocks and bonds declined substantially that year.',
    whatHappened: [
      'Inflation reached its highest levels in decades, prompting rapid rate increases.',
      'Growth-oriented stocks whose value depends on distant profits fell especially sharply.',
      'Bond prices fell as yields rose, so the usual stock/bond diversification helped less than many expected.',
    ],
    lessons: ['Interest rates affect valuations across asset classes.', 'Diversification benefits depend on correlations, which can change.'],
    hindsightNote: 'The pace of tightening surprised many forecasters at the start of the year.',
    sources: [{ name: 'Federal Reserve — FOMC meeting calendars and statements', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' }],
  },
];
