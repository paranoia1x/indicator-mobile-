import type { IndicatorId } from '../../indicators/registry';
import type { Timeframe } from '../../market-data/core/types';

export type LessonLevel = 'beginner' | 'intermediate' | 'advanced';

export type LessonBlock =
  | { type: 'text'; text: string }
  | { type: 'keypoints'; points: string[] }
  | { type: 'callout'; tone: 'info' | 'warning'; text: string }
  | { type: 'chart'; symbol: string; timeframe: Timeframe; indicators?: IndicatorId[]; showStructure?: boolean; caption: string };

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  level: LessonLevel;
  title: string;
  minutes: number;
  summary: string;
  blocks: LessonBlock[];
  quiz: QuizQuestion[];
}

const SIM_NOTE = 'Interactive charts in lessons use clearly labelled SIMULATED demo data so they work offline.';

export const LESSONS: Lesson[] = [
  // ---------------------------------------------------------------- Beginner
  {
    id: 'what-are-stocks',
    level: 'beginner',
    title: 'What stocks are',
    minutes: 4,
    summary: 'Ownership, why share prices change, and what you can and cannot lose.',
    blocks: [
      { type: 'text', text: 'A stock (or share) is a small piece of ownership in a company. If the company grows its profits over time, its shares may become more valuable, and it may pay part of its profits to shareholders as dividends. If the business struggles, the share price can fall — sometimes to zero.' },
      { type: 'text', text: 'A share price is simply the most recent price at which a buyer and a seller agreed to trade. It changes constantly as people revise their views about the company’s future, interest rates, the economy and many other factors. Nobody can know in advance which way the next change will go.' },
      { type: 'keypoints', points: ['Owning a share = owning part of a business.', 'Prices reflect the latest agreed trade, not a fixed “true value”.', 'Without leverage, the most you can lose on a share is what you paid for it.'] },
      { type: 'callout', tone: 'warning', text: 'Past price increases do not mean a stock will keep rising.' },
    ],
    quiz: [
      { id: 'q1', question: 'What does owning a share represent?', options: ['A loan to the company', 'Partial ownership of the company', 'A guaranteed dividend', 'A promise of future profit'], answer: 1, explanation: 'A share is an ownership stake. Dividends and profits are not guaranteed.' },
      { id: 'q2', question: 'Without borrowing, what is the maximum loss on a share you bought for $50?', options: ['$25', '$50', 'Unlimited', '$100'], answer: 1, explanation: 'A share price cannot fall below zero, so the loss is limited to the $50 paid (ignoring costs).' },
    ],
  },
  {
    id: 'what-are-etfs',
    level: 'beginner',
    title: 'What ETFs are',
    minutes: 4,
    summary: 'Baskets of assets that trade like a stock, and why they diversify.',
    blocks: [
      { type: 'text', text: 'An exchange-traded fund (ETF) holds a basket of assets — for example, every company in a broad market index — and trades on an exchange like a single share. Buying one share of a broad ETF gives small exposure to every holding at once.' },
      { type: 'text', text: 'Because an ETF holds many companies, a problem at one company has a smaller effect on the whole. This is diversification. It reduces company-specific risk but not market-wide risk: when the whole market falls, a broad ETF falls too.' },
      { type: 'chart', symbol: 'BRDX.SIM', timeframe: '1W', caption: 'A simulated broad-market ETF. Compare its swings with a single simulated stock such as PLSE.SIM.' },
      { type: 'keypoints', points: ['ETFs hold many assets in one tradable share.', 'They charge an annual fee called the expense ratio.', 'Diversification lowers, but does not remove, risk.'] },
    ],
    quiz: [
      { id: 'q1', question: 'Which risk does a broad-market ETF NOT remove?', options: ['Risk of one company failing', 'Market-wide declines', 'Single-sector concentration', 'None — it removes all risk'], answer: 1, explanation: 'Diversification reduces company-specific risk, but a broad market decline still affects the ETF.' },
    ],
  },
  {
    id: 'what-is-crypto',
    level: 'beginner',
    title: 'What cryptocurrency is',
    minutes: 5,
    summary: 'Digital assets, 24/7 markets, and why volatility is so high.',
    blocks: [
      { type: 'text', text: 'Cryptocurrencies are digital assets whose ownership is recorded on a blockchain — a shared ledger maintained by a network of computers. Unlike stocks, most crypto assets do not represent a claim on a company’s profits.' },
      { type: 'text', text: 'Crypto markets trade 24 hours a day, every day. Prices have historically swung far more than stock prices, with declines of more than 50% occurring several times. Regulation, exchange failures, and sentiment can cause sudden moves.' },
      { type: 'chart', symbol: 'AURC.SIM', timeframe: '1D', indicators: ['atr'], caption: 'A simulated crypto asset. Notice how wide the daily ranges (ATR) are compared with a simulated utility stock.' },
      { type: 'callout', tone: 'warning', text: 'Never share a wallet seed phrase or private key with anyone or any app. This app will never ask for one.' },
    ],
    quiz: [
      { id: 'q1', question: 'Which statement about crypto markets is true?', options: ['They close on weekends', 'They have historically been more volatile than stocks', 'Prices are guaranteed by governments', 'They always rise after halving events'], answer: 1, explanation: 'Crypto trades 24/7 and has historically shown much higher volatility than stocks. Nothing guarantees price direction.' },
      { id: 'q2', question: 'An app asks for your 12-word recovery phrase to “verify” your wallet. What should you do?', options: ['Enter it', 'Enter only half', 'Refuse — legitimate apps never need it', 'Email it instead'], answer: 2, explanation: 'Anyone with the recovery phrase controls the wallet. Never share it.' },
    ],
  },
  {
    id: 'how-exchanges-work',
    level: 'beginner',
    title: 'How stock exchanges work',
    minutes: 5,
    summary: 'Order books, bids and asks, market hours and why prices move.',
    blocks: [
      { type: 'text', text: 'An exchange matches buyers and sellers. Buyers post bids (the price they will pay), sellers post asks (the price they will accept). When a bid meets an ask, a trade occurs and that becomes the latest price.' },
      { type: 'text', text: 'The gap between the best bid and best ask is the spread — a hidden cost of trading. Popular, liquid stocks usually have tight spreads; thinly traded assets can have wide spreads and larger price jumps.' },
      { type: 'text', text: 'US stock exchanges have a regular session (9:30 a.m. to 4:00 p.m. Eastern Time on trading days) plus extended hours with thinner liquidity. Prices you see may be real-time, delayed (often by 15 minutes) or from the previous close — this app always labels which.' },
      { type: 'keypoints', points: ['Prices come from matched bids and asks.', 'The spread is a cost.', 'Always check whether a price is live, delayed, cached or simulated.'] },
    ],
    quiz: [
      { id: 'q1', question: 'If the best bid is $10.00 and the best ask is $10.05, what is the spread?', options: ['$0.05', '$10.025', '$20.05', '$0.00'], answer: 0, explanation: 'Spread = ask − bid = $0.05.' },
    ],
  },
  {
    id: 'reading-candlesticks',
    level: 'beginner',
    title: 'Reading candlestick charts',
    minutes: 6,
    summary: 'Open, high, low and close in a single bar.',
    blocks: [
      { type: 'text', text: 'Each candlestick summarises one period (a minute, a day, a week). The thick body spans the open and close prices. The thin lines (wicks) reach the highest and lowest prices traded during that period.' },
      { type: 'text', text: 'When the close is above the open, the candle is drawn as rising (green by default; blue in the colour-blind palette). When the close is below the open, it is falling (red; orange in the colour-blind palette). Long wicks show that prices travelled far from where they ended.' },
      { type: 'chart', symbol: 'HLXS.SIM', timeframe: '1D', caption: 'Pinch to zoom, drag to pan, and long-press to see the exact OHLC values of any candle.' },
      { type: 'callout', tone: 'info', text: 'Candlestick “patterns” have names, but research on their predictive value is mixed. Treat them as descriptions of past trading, not signals.' },
    ],
    quiz: [
      { id: 'q1', question: 'What does the body of a candlestick show?', options: ['High to low', 'Open to close', 'Volume', 'Previous close to current'], answer: 1, explanation: 'The body spans open and close; the wicks reach the high and low.' },
      { id: 'q2', question: 'A daily candle has open 50, high 55, low 48, close 49. Is it rising or falling?', options: ['Rising', 'Falling'], answer: 1, explanation: 'The close (49) is below the open (50), so it is a falling candle — despite trading as high as 55 during the day.' },
    ],
  },
  {
    id: 'understanding-volume',
    level: 'beginner',
    title: 'Understanding volume',
    minutes: 4,
    summary: 'What trading activity tells you — and what it does not.',
    blocks: [
      { type: 'text', text: 'Volume is the number of shares or units traded in a period. It shows how much activity accompanied a move. Every trade has both a buyer and a seller, so volume alone does not reveal who was “in control”.' },
      { type: 'text', text: 'Unusually high volume often coincides with news, earnings, index changes or large institutional activity. Low volume can mean a move had little participation. Indices have no volume of their own, and some data feeds report only one venue’s volume — this app shows volume as “unavailable” rather than zero in those cases.' },
      { type: 'chart', symbol: 'PLSE.SIM', timeframe: '1D', indicators: ['obv'], caption: 'Volume bars and On-Balance Volume for a simulated biotech stock.' },
    ],
    quiz: [
      { id: 'q1', question: 'High volume on a down day proves that sellers outnumbered buyers.', options: ['True', 'False'], answer: 1, explanation: 'Every share sold was bought by someone. Volume measures activity, not the number of buyers versus sellers.' },
    ],
  },
  {
    id: 'market-risk',
    level: 'beginner',
    title: 'Understanding market risk',
    minutes: 6,
    summary: 'Volatility, drawdowns, diversification and time horizon.',
    blocks: [
      { type: 'text', text: 'Risk in markets means the range of possible outcomes, including losses. Volatility measures how widely prices have swung. Drawdown measures how far prices fell from a previous peak before recovering — or not.' },
      { type: 'text', text: 'Large declines have happened repeatedly in history. Diversifying across many assets reduces exposure to any one failure, but broad markets can still fall sharply together, especially in crises.' },
      { type: 'chart', symbol: 'DMX500.SIM', timeframe: '1W', caption: 'A simulated broad index with several drawdowns. Use the Research tab to measure the maximum drawdown.' },
      { type: 'keypoints', points: ['Higher potential return usually comes with higher risk.', 'A 50% loss requires a 100% gain to recover.', 'Leverage multiplies losses — this app never offers it.'] },
    ],
    quiz: [
      { id: 'q1', question: 'After a 50% loss, what gain is needed to get back to the starting value?', options: ['50%', '75%', '100%', '150%'], answer: 2, explanation: '$100 → $50 requires +$50, which is +100% of $50.' },
    ],
  },
  // ---------------------------------------------------------------- Intermediate
  {
    id: 'technical-indicators',
    level: 'intermediate',
    title: 'Technical indicators',
    minutes: 8,
    summary: 'What indicators compute, why they lag, and how to avoid over-reading them.',
    blocks: [
      { type: 'text', text: 'Technical indicators are formulas applied to past prices and volume — moving averages, RSI, MACD, Bollinger Bands and so on. They summarise what already happened in a compact form.' },
      { type: 'text', text: 'Because they are computed from past data, indicators lag. They can describe momentum or volatility, but they do not contain information about the future that the price itself does not. Different settings produce different readings, and settings tuned on the past often work worse afterwards.' },
      { type: 'chart', symbol: 'NWSC.SIM', timeframe: '1D', indicators: ['sma', 'rsi', 'macd'], caption: 'SMA, RSI and MACD on simulated data. Tap any indicator in the chart screen for its formula and limitations.' },
      { type: 'callout', tone: 'warning', text: 'An “overbought” RSI is a description of recent price changes, not a prediction that price will fall.' },
    ],
    quiz: [
      { id: 'q1', question: 'Why do moving averages lag price?', options: ['They are calculated from past prices', 'Data providers delay them', 'They predict the future', 'They use volume'], answer: 0, explanation: 'Averages of past prices change only after prices have already moved.' },
      { id: 'q2', question: 'RSI is above 70. What does that tell you with certainty?', options: ['Price will fall', 'Recent gains outweighed recent losses', 'The stock is overvalued', 'Volume is high'], answer: 1, explanation: 'RSI only measures the balance of recent gains and losses.' },
    ],
  },
  {
    id: 'market-trends',
    level: 'intermediate',
    title: 'Market trends and structure',
    minutes: 7,
    summary: 'Higher highs, lower lows, and why trends are only certain in hindsight.',
    blocks: [
      { type: 'text', text: 'Analysts often describe a past uptrend as a sequence of higher highs (HH) and higher lows (HL), and a past downtrend as lower highs (LH) and lower lows (LL). Swing highs and lows are local turning points.' },
      { type: 'text', text: 'A swing point can only be confirmed after several later bars have formed. In this app, a swing confirmed with a 5-bar window appears 5 bars after the turning point — exactly when it could first have been known. Replays and backtests never show it earlier.' },
      { type: 'chart', symbol: 'ORBT.SIM', timeframe: '1D', showStructure: true, caption: 'Confirmed swing points labelled HH, HL, LH and LL on simulated data.' },
      { type: 'callout', tone: 'info', text: 'Trends that look obvious on a finished chart were uncertain while they were forming.' },
    ],
    quiz: [
      { id: 'q1', question: 'When can a 5-bar swing low first be confirmed?', options: ['On the bar itself', 'One bar later', 'Five bars later', 'Never'], answer: 2, explanation: 'The next five bars must close without a lower low before the swing low is confirmed.' },
    ],
  },
  {
    id: 'support-resistance',
    level: 'intermediate',
    title: 'Support and resistance',
    minutes: 6,
    summary: 'Price areas where the market reacted before.',
    blocks: [
      { type: 'text', text: 'Support is a price area where declines previously paused; resistance is where advances previously paused. They often form around clusters of past swing points, round numbers or prior highs and lows.' },
      { type: 'text', text: 'These areas describe history. Price can move straight through them, and “breakouts” beyond them frequently reverse. This app shows previously established zones built only from swings confirmed at the time.' },
      { type: 'chart', symbol: 'MRDN.SIM', timeframe: '1D', showStructure: true, caption: 'Historical support/resistance zones derived from clustered swing points.' },
    ],
    quiz: [
      { id: 'q1', question: 'Support at $40 means…', options: ['Price cannot fall below $40', 'Past declines paused near $40', 'Analysts expect $40', 'The company is worth $40'], answer: 1, explanation: 'Support is a historical observation, not a floor.' },
    ],
  },
  {
    id: 'financial-statements',
    level: 'intermediate',
    title: 'Company financial statements',
    minutes: 9,
    summary: 'Income statement, balance sheet and cash-flow statement in plain language.',
    blocks: [
      { type: 'text', text: 'The income statement shows revenue, expenses and net income over a period. The balance sheet shows assets, liabilities and shareholders’ equity at a point in time. The cash-flow statement shows cash coming in and going out from operations, investing and financing.' },
      { type: 'text', text: 'US public companies file annual reports (Form 10-K) and quarterly reports (Form 10-Q) with the SEC. These filings are the primary source; news articles summarise them. Company pages in this app link directly to EDGAR filings when connected to a data backend.' },
      { type: 'keypoints', points: ['Profit is not the same as cash.', 'A missing value is not zero — “unavailable” means the figure was not reported or not retrieved.', 'Compare companies within the same industry.'] },
    ],
    quiz: [
      { id: 'q1', question: 'Which statement shows a company’s position at a single point in time?', options: ['Income statement', 'Balance sheet', 'Cash-flow statement', 'Press release'], answer: 1, explanation: 'The balance sheet is a snapshot; the other two cover a period.' },
    ],
  },
  {
    id: 'economic-cycles',
    level: 'intermediate',
    title: 'Economic cycles',
    minutes: 6,
    summary: 'Expansions, recessions, and why markets do not move in lockstep with the economy.',
    blocks: [
      { type: 'text', text: 'Economies tend to alternate between expansions and contractions. In the US, recession dates are determined after the fact by the National Bureau of Economic Research.' },
      { type: 'text', text: 'Stock markets often move before economic data, because prices reflect expectations. That means a weak economic report can coincide with rising prices, and vice versa. Sectors respond differently: utilities and consumer staples have historically been less cyclical than industrials or consumer discretionary.' },
    ],
    quiz: [
      { id: 'q1', question: 'Why can stocks rise during weak economic data?', options: ['Data is always wrong', 'Prices reflect expectations about the future', 'Exchanges ignore data', 'It never happens'], answer: 1, explanation: 'Markets price expectations; the reaction depends on what was already expected.' },
    ],
  },
  {
    id: 'interest-rates',
    level: 'intermediate',
    title: 'Interest rates',
    minutes: 6,
    summary: 'How policy rates affect borrowing, valuations and different sectors.',
    blocks: [
      { type: 'text', text: 'The Federal Reserve’s Federal Open Market Committee (FOMC) sets a target range for the federal funds rate, its main policy rate, at meetings held on a published schedule. Changes ripple through to mortgages, corporate loans and bond yields.' },
      { type: 'text', text: 'Higher rates raise borrowing costs and reduce the present value of distant future profits, which has historically weighed on companies whose value depends on growth far in the future. Banks may earn more on loans but can face credit losses. The market’s reaction depends on what was expected.' },
      { type: 'callout', tone: 'info', text: 'Official rate decisions and statements are published at federalreserve.gov.' },
    ],
    quiz: [
      { id: 'q1', question: 'All else equal, how do higher interest rates affect the present value of profits expected far in the future?', options: ['Increase it', 'Decrease it', 'No effect'], answer: 1, explanation: 'Future cash flows are discounted at a higher rate, so their present value falls.' },
    ],
  },
  {
    id: 'inflation',
    level: 'intermediate',
    title: 'Inflation',
    minutes: 5,
    summary: 'CPI, PPI and why inflation reports move markets.',
    blocks: [
      { type: 'text', text: 'Inflation is the rise in the general price level. The Bureau of Labor Statistics publishes the Consumer Price Index (CPI) and Producer Price Index (PPI) monthly. “Core” measures exclude volatile food and energy prices.' },
      { type: 'text', text: 'Inflation matters to markets mainly through its expected effect on interest-rate policy and on real (inflation-adjusted) returns. Single monthly readings are noisy and sometimes revised.' },
    ],
    quiz: [
      { id: 'q1', question: 'Which agency publishes CPI in the United States?', options: ['Federal Reserve', 'Bureau of Labor Statistics', 'SEC', 'Treasury'], answer: 1, explanation: 'CPI is published by the Bureau of Labor Statistics.' },
    ],
  },
  {
    id: 'market-volatility',
    level: 'intermediate',
    title: 'Market volatility',
    minutes: 6,
    summary: 'Measuring volatility and why it clusters.',
    blocks: [
      { type: 'text', text: 'Volatility is usually measured as the standard deviation of returns, often annualised. Average True Range (ATR) measures the typical size of bars in price units.' },
      { type: 'text', text: 'Volatility tends to cluster: turbulent periods are often followed by more turbulence, and calm by calm — until the regime changes. This app marks historical volatility regime changes using only data available at each point.' },
      { type: 'chart', symbol: 'CRST.SIM', timeframe: '1D', indicators: ['atr', 'bollinger'], caption: 'ATR and Bollinger Bands widen and narrow as simulated volatility changes.' },
    ],
    quiz: [
      { id: 'q1', question: 'Does high volatility tell you the direction of the next move?', options: ['Yes, up', 'Yes, down', 'No'], answer: 2, explanation: 'Volatility measures the size of moves, not their direction.' },
    ],
  },
  // ---------------------------------------------------------------- Advanced
  {
    id: 'statistical-uncertainty',
    level: 'advanced',
    title: 'Statistical uncertainty',
    minutes: 8,
    summary: 'Sample size, noise and confidence in historical results.',
    blocks: [
      { type: 'text', text: 'Market returns are noisy. With few observations, an average can differ greatly from the long-run behaviour simply by chance. A strategy with ten trades tells you very little; even hundreds of trades can be misleading if they come from one market regime.' },
      { type: 'text', text: 'Always ask: how many independent observations are there? Over what period? Would the result survive small changes to the rules or the period? This app reports the number of observations alongside every historical statistic.' },
      { type: 'keypoints', points: ['Small samples → wide uncertainty.', 'Returns are not normally distributed; extreme moves occur more often than a bell curve suggests.', 'Regimes change; history is one path among many possible paths.'] },
    ],
    quiz: [
      { id: 'q1', question: 'A rule had 4 winning trades out of 5. What is the most reasonable conclusion?', options: ['It has an 80% win rate', 'The sample is too small to conclude much', 'It will win next time', 'It is guaranteed profitable'], answer: 1, explanation: 'Five observations carry enormous uncertainty.' },
    ],
  },
  {
    id: 'backtesting-methodology',
    level: 'advanced',
    title: 'Backtesting methodology',
    minutes: 10,
    summary: 'Building historical tests that do not fool you.',
    blocks: [
      { type: 'text', text: 'A backtest simulates rules on historical data. To be meaningful it must only use information available at each decision point, model realistic costs, and be evaluated on data not used to design it.' },
      { type: 'text', text: 'The Backtest Lab in this app decides at each bar’s close and executes at the next bar’s open with commission and slippage. It splits data chronologically into in-sample and out-of-sample segments, compares results with buy-and-hold and cash, records dataset fingerprints, and keeps every experiment — including the ones that failed.' },
      { type: 'callout', tone: 'warning', text: 'Simulated historical performance is hypothetical and does not predict future results.' },
    ],
    quiz: [
      { id: 'q1', question: 'Why is out-of-sample data important?', options: ['It makes results look better', 'It tests rules on data not used to design them', 'It removes costs', 'It is required by law'], answer: 1, explanation: 'Testing on unseen data gives a more honest estimate of performance.' },
    ],
  },
  {
    id: 'correlation-causation',
    level: 'advanced',
    title: 'Correlation versus causation',
    minutes: 6,
    summary: 'Why two series moving together does not mean one drives the other.',
    blocks: [
      { type: 'text', text: 'Correlation measures how closely two series moved together historically. It does not show that one caused the other: both may respond to a third factor, the relationship may be coincidental, or it may reverse later.' },
      { type: 'text', text: 'When the AI assistant explains why a price moved, it separates verified facts (a filing was published, the price fell 4%) from interpretations (the filing may have contributed). Timing alone does not prove cause.' },
    ],
    quiz: [
      { id: 'q1', question: 'Stock A and B have a correlation of 0.9. Which is true?', options: ['A causes B', 'B causes A', 'They moved together historically', 'They will move together next year'], answer: 2, explanation: 'Correlation describes past co-movement only.' },
    ],
  },
  {
    id: 'data-leakage',
    level: 'advanced',
    title: 'Data leakage and look-ahead bias',
    minutes: 7,
    summary: 'How future information sneaks into analysis.',
    blocks: [
      { type: 'text', text: 'Look-ahead bias occurs when an analysis uses information that was not available at the time — such as using a day’s closing price to make a decision at that day’s open, or marking a swing low before it was confirmed.' },
      { type: 'text', text: 'Data leakage is broader: any path by which evaluation data influences design. Examples include tuning parameters on the full dataset, normalising with statistics computed on future data, or using today’s list of index members to test the past (survivorship bias).' },
      { type: 'chart', symbol: 'SUMT.SIM', timeframe: '1D', showStructure: true, caption: 'Swing markers appear only when confirmed. Try Historical Replay to see the delay.' },
    ],
    quiz: [
      { id: 'q1', question: 'Testing a strategy on today’s S&P 500 members over the past 20 years introduces…', options: ['Survivorship bias', 'Lower costs', 'No bias', 'Better liquidity'], answer: 0, explanation: 'Companies that were removed or failed are missing, which tends to inflate results.' },
    ],
  },
  {
    id: 'overfitting',
    level: 'advanced',
    title: 'Model overfitting',
    minutes: 7,
    summary: 'Why the best backtest is often the worst guide.',
    blocks: [
      { type: 'text', text: 'If you try many parameter combinations and pick the best historical result, you will often select the one that best fit random noise. Its performance on new data typically degrades.' },
      { type: 'text', text: 'The Backtest Lab’s parameter sweep demonstrates this: it optimises on the in-sample segment only, then reports how the chosen parameters performed out-of-sample, along with the “degradation” between the two.' },
      { type: 'keypoints', points: ['More parameters → more ways to overfit.', 'Prefer simple rules with economic reasoning.', 'Record and report every attempt, not just the winner.'] },
    ],
    quiz: [
      { id: 'q1', question: 'You tested 500 parameter sets and the best returned 300% in-sample. What should you expect out-of-sample?', options: ['About 300%', 'Likely much worse', 'Better than 300%', 'Exactly the benchmark'], answer: 1, explanation: 'Selecting the best of many trials inflates in-sample results.' },
    ],
  },
  {
    id: 'market-efficiency',
    level: 'advanced',
    title: 'Market efficiency',
    minutes: 6,
    summary: 'Why consistently beating the market after costs is hard.',
    blocks: [
      { type: 'text', text: 'The efficient-market hypothesis holds that prices quickly incorporate available information. In its strong forms it is debated, but the evidence that most active managers underperform low-cost index funds after fees over long periods is widely reported.' },
      { type: 'text', text: 'Public information — including every indicator in this app — is available to millions of participants. Any edge from it, if it exists, tends to be small and to shrink once widely known.' },
    ],
    quiz: [
      { id: 'q1', question: 'Why might a widely known indicator rule stop working?', options: ['Others trade on it, removing the edge', 'Indicators expire', 'Exchanges ban it', 'It never worked'], answer: 0, explanation: 'Widely exploited patterns tend to be arbitraged away.' },
    ],
  },
  {
    id: 'portfolio-risk',
    level: 'advanced',
    title: 'Portfolio risk concepts',
    minutes: 8,
    summary: 'Diversification, correlation, drawdown and position sizing.',
    blocks: [
      { type: 'text', text: 'Portfolio risk depends not only on each holding’s volatility but also on how holdings move together. Combining assets with low or negative correlation can reduce overall volatility. Correlations often rise during crises, reducing diversification exactly when it is most wanted.' },
      { type: 'text', text: 'Maximum drawdown and the time to recover are often more meaningful to people than volatility. Position sizing — how much to allocate to each asset — matters as much as which assets are chosen.' },
    ],
    quiz: [
      { id: 'q1', question: 'What tends to happen to correlations between risky assets in a crisis?', options: ['They usually rise', 'They usually fall to zero', 'They become negative', 'They stop existing'], answer: 0, explanation: 'Historically, many risky assets have fallen together in crises.' },
    ],
  },
  {
    id: 'behavioral-finance',
    level: 'advanced',
    title: 'Behavioral finance',
    minutes: 7,
    summary: 'Biases that affect decisions — including yours.',
    blocks: [
      { type: 'text', text: 'People are prone to predictable biases: overconfidence, loss aversion (losses feel worse than equal gains feel good), herding, anchoring on past prices, confirmation bias, and hindsight bias (“I knew it all along”).' },
      { type: 'text', text: 'This app is designed to counter some of these: it avoids urgency-driven notifications, labels speculation, shows competing interpretations, and demonstrates hindsight bias with historical examples. The simulator’s journal lets you record your reasoning before seeing outcomes.' },
      { type: 'keypoints', points: ['Write down your reasoning before acting.', 'Seek disconfirming evidence.', 'Be wary of urgency and fear of missing out.'] },
    ],
    quiz: [
      { id: 'q1', question: 'Feeling that a past crash was “obvious” is an example of…', options: ['Hindsight bias', 'Diversification', 'Liquidity', 'Mean reversion'], answer: 0, explanation: 'Hindsight bias makes past events seem more predictable than they were.' },
    ],
  },
];

export const LESSON_NOTE = SIM_NOTE;

export function lessonsByLevel(level: LessonLevel): Lesson[] {
  return LESSONS.filter((l) => l.level === level);
}

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** Scores a quiz attempt. Unanswered questions count as incorrect. */
export function scoreQuiz(lesson: Lesson, answers: Record<string, number | undefined>): { correct: number; total: number; passed: boolean } {
  const total = lesson.quiz.length;
  const correct = lesson.quiz.filter((q) => answers[q.id] === q.answer).length;
  return { correct, total, passed: total === 0 || correct / total >= 0.7 };
}
