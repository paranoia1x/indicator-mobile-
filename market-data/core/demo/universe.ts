import type { AssetClass, Instrument } from '../types';

/**
 * Fictional demo universe. Every symbol ends in ".SIM" so it can never be confused with
 * a real listed security, and every instrument is flagged `isSimulated`.
 */
export interface DemoSpec {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  sector?: string;
  industry?: string;
  exchange: string;
  startPrice: number;
  /** Annualised drift and volatility of the idiosyncratic component. */
  drift: number;
  vol: number;
  /** Sensitivity to the simulated market factor. */
  beta: number;
  baseVolume: number;
  sharesOutstanding?: number;
  description: string;
}

export const DEMO_SPECS: DemoSpec[] = [
  { symbol: 'NWSC.SIM', name: 'Northwind Semiconductor (Simulated)', assetClass: 'stock', sector: 'Technology', industry: 'Semiconductors', exchange: 'DEMO', startPrice: 42, drift: 0.14, vol: 0.38, beta: 1.4, baseVolume: 9_000_000, sharesOutstanding: 1_150_000_000, description: 'Fictional designer of power-efficient processors used to demonstrate how high-beta technology stocks can move more than the broad market in both directions.' },
  { symbol: 'HLXS.SIM', name: 'Helix Software (Simulated)', assetClass: 'stock', sector: 'Technology', industry: 'Application Software', exchange: 'DEMO', startPrice: 118, drift: 0.1, vol: 0.3, beta: 1.2, baseVolume: 3_500_000, sharesOutstanding: 420_000_000, description: 'Fictional subscription-software company. Useful for lessons on recurring revenue, margins and valuation multiples.' },
  { symbol: 'ORBT.SIM', name: 'Orbital Logistics (Simulated)', assetClass: 'stock', sector: 'Industrials', industry: 'Freight & Logistics', exchange: 'DEMO', startPrice: 64, drift: 0.05, vol: 0.26, beta: 1.0, baseVolume: 2_200_000, sharesOutstanding: 310_000_000, description: 'Fictional freight and logistics operator whose results are sensitive to economic cycles.' },
  { symbol: 'MRDN.SIM', name: 'Meridian Bancorp (Simulated)', assetClass: 'stock', sector: 'Financials', industry: 'Banks', exchange: 'DEMO', startPrice: 38, drift: 0.04, vol: 0.27, beta: 1.1, baseVolume: 6_000_000, sharesOutstanding: 880_000_000, description: 'Fictional regional bank used to illustrate interest-rate sensitivity and credit risk.' },
  { symbol: 'CRST.SIM', name: 'Crestline Energy (Simulated)', assetClass: 'stock', sector: 'Energy', industry: 'Oil & Gas', exchange: 'DEMO', startPrice: 55, drift: 0.03, vol: 0.34, beta: 0.9, baseVolume: 4_800_000, sharesOutstanding: 640_000_000, description: 'Fictional integrated energy producer. Demonstrates commodity-driven volatility.' },
  { symbol: 'VRDA.SIM', name: 'Verdant Foods (Simulated)', assetClass: 'stock', sector: 'Consumer Staples', industry: 'Packaged Foods', exchange: 'DEMO', startPrice: 47, drift: 0.04, vol: 0.17, beta: 0.55, baseVolume: 2_600_000, sharesOutstanding: 500_000_000, description: 'Fictional packaged-food maker with historically lower volatility — a "defensive" example.' },
  { symbol: 'PLSE.SIM', name: 'Pulse Therapeutics (Simulated)', assetClass: 'stock', sector: 'Health Care', industry: 'Biotechnology', exchange: 'DEMO', startPrice: 23, drift: 0.06, vol: 0.55, beta: 0.9, baseVolume: 5_100_000, sharesOutstanding: 210_000_000, description: 'Fictional clinical-stage biotech. Illustrates event risk around trial results and regulatory decisions.' },
  { symbol: 'SUMT.SIM', name: 'Summit Retail (Simulated)', assetClass: 'stock', sector: 'Consumer Discretionary', industry: 'Specialty Retail', exchange: 'DEMO', startPrice: 76, drift: 0.06, vol: 0.31, beta: 1.15, baseVolume: 2_900_000, sharesOutstanding: 260_000_000, description: 'Fictional specialty retailer whose sales depend on consumer spending.' },
  { symbol: 'TIDE.SIM', name: 'Tidewater Utilities (Simulated)', assetClass: 'stock', sector: 'Utilities', industry: 'Electric Utilities', exchange: 'DEMO', startPrice: 61, drift: 0.035, vol: 0.16, beta: 0.45, baseVolume: 1_900_000, sharesOutstanding: 390_000_000, description: 'Fictional regulated electric utility. Used in lessons on dividends and rate sensitivity.' },
  { symbol: 'ATLS.SIM', name: 'Atlas Materials (Simulated)', assetClass: 'stock', sector: 'Materials', industry: 'Chemicals', exchange: 'DEMO', startPrice: 88, drift: 0.04, vol: 0.25, beta: 1.0, baseVolume: 1_400_000, sharesOutstanding: 180_000_000, description: 'Fictional specialty-chemicals producer.' },
  { symbol: 'KSTR.SIM', name: 'Kestrel Media (Simulated)', assetClass: 'stock', sector: 'Communication Services', industry: 'Interactive Media', exchange: 'DEMO', startPrice: 140, drift: 0.09, vol: 0.33, beta: 1.2, baseVolume: 3_100_000, sharesOutstanding: 730_000_000, description: 'Fictional online media and advertising company.' },
  { symbol: 'BRCH.SIM', name: 'Birchwood Realty Trust (Simulated)', assetClass: 'stock', sector: 'Real Estate', industry: 'REITs', exchange: 'DEMO', startPrice: 34, drift: 0.03, vol: 0.22, beta: 0.8, baseVolume: 1_700_000, sharesOutstanding: 450_000_000, description: 'Fictional real-estate investment trust.' },
  { symbol: 'BRDX.SIM', name: 'Broad Market Demo ETF (Simulated)', assetClass: 'etf', sector: 'Multi-sector', industry: 'Broad Market ETF', exchange: 'DEMO', startPrice: 250, drift: 0.0, vol: 0.02, beta: 1.0, baseVolume: 40_000_000, description: 'Fictional fund that tracks the simulated broad market. Shows how diversification reduces single-company risk.' },
  { symbol: 'TECX.SIM', name: 'Technology Sector Demo ETF (Simulated)', assetClass: 'etf', sector: 'Technology', industry: 'Sector ETF', exchange: 'DEMO', startPrice: 140, drift: 0.04, vol: 0.08, beta: 1.25, baseVolume: 12_000_000, description: 'Fictional technology-sector fund.' },
  { symbol: 'AGGB.SIM', name: 'Aggregate Bond Demo ETF (Simulated)', assetClass: 'etf', sector: 'Fixed Income', industry: 'Bond ETF', exchange: 'DEMO', startPrice: 100, drift: 0.015, vol: 0.05, beta: 0.05, baseVolume: 8_000_000, description: 'Fictional bond fund with low historical volatility.' },
  { symbol: 'DMX500.SIM', name: 'Demo Composite 500 Index (Simulated)', assetClass: 'index', exchange: 'DEMO', startPrice: 2700, drift: 0.0, vol: 0.0, beta: 1.0, baseVolume: 0, description: 'Fictional broad-market index representing the simulated market factor.' },
  { symbol: 'DMXTEC.SIM', name: 'Demo Tech 100 Index (Simulated)', assetClass: 'index', exchange: 'DEMO', startPrice: 6800, drift: 0.035, vol: 0.07, beta: 1.25, baseVolume: 0, description: 'Fictional technology-weighted index.' },
  { symbol: 'DMXSC.SIM', name: 'Demo Small Cap 2000 Index (Simulated)', assetClass: 'index', exchange: 'DEMO', startPrice: 1550, drift: -0.01, vol: 0.09, beta: 1.15, baseVolume: 0, description: 'Fictional small-company index.' },
  { symbol: 'DMXBND.SIM', name: 'Demo Bond Index (Simulated)', assetClass: 'index', exchange: 'DEMO', startPrice: 1000, drift: 0.015, vol: 0.045, beta: 0.05, baseVolume: 0, description: 'Fictional aggregate bond index.' },
  { symbol: 'AURC.SIM', name: 'Aurum Coin (Simulated)', assetClass: 'crypto', sector: 'Digital Assets', industry: 'Layer-1 Network', exchange: 'DEMO', startPrice: 9000, drift: 0.25, vol: 0.7, beta: 0.6, baseVolume: 30_000, description: 'Fictional cryptocurrency. Crypto markets trade 24/7 and have historically been much more volatile than stocks.' },
  { symbol: 'NOVA.SIM', name: 'Nova Token (Simulated)', assetClass: 'crypto', sector: 'Digital Assets', industry: 'Smart-contract Platform', exchange: 'DEMO', startPrice: 600, drift: 0.2, vol: 0.85, beta: 0.7, baseVolume: 400_000, description: 'Fictional smart-contract token.' },
  { symbol: 'LMNX.SIM', name: 'Lumen Network (Simulated)', assetClass: 'crypto', sector: 'Digital Assets', industry: 'Payments Network', exchange: 'DEMO', startPrice: 0.45, drift: 0.1, vol: 1.0, beta: 0.7, baseVolume: 900_000_000, description: 'Fictional payments-focused token with extreme simulated volatility.' },
];

export const DEMO_INSTRUMENTS: Instrument[] = DEMO_SPECS.map((s) => ({
  symbol: s.symbol,
  name: s.name,
  assetClass: s.assetClass,
  exchange: s.exchange,
  sector: s.sector,
  industry: s.industry,
  currency: 'USD',
  isSimulated: true,
  description: s.description,
}));

export const DEMO_INDEX_SYMBOLS = ['DMX500.SIM', 'DMXTEC.SIM', 'DMXSC.SIM', 'DMXBND.SIM'];
export const DEMO_CRYPTO_SYMBOLS = ['AURC.SIM', 'NOVA.SIM', 'LMNX.SIM'];

export function getDemoSpec(symbol: string): DemoSpec | undefined {
  return DEMO_SPECS.find((s) => s.symbol === symbol);
}
