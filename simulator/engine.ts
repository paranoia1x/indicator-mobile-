import type { Candle, DataStatus, Timeframe } from '../market-data/core/types';
import { maxDrawdown } from '../research/statistics';

/**
 * Virtual-money historical replay simulator. EDUCATIONAL ONLY — fictional money, no connection to
 * any exchange or brokerage. No leverage, margin, short selling, rewards or competitions.
 *
 * No look-ahead: the user only sees bars up to `cursor`; market orders placed while viewing bar
 * `cursor` fill at the OPEN of bar `cursor + 1` (with simulated slippage and commission).
 */

export interface SimCosts {
  commissionPerTrade: number; // fixed fee in fictional dollars
  commissionBps: number; // proportional fee
  slippageBps: number; // adverse price impact
}

export const DEFAULT_SIM_COSTS: SimCosts = { commissionPerTrade: 1, commissionBps: 5, slippageBps: 5 };

export type OrderSide = 'buy' | 'sell';

export interface PendingOrder {
  id: string;
  side: OrderSide;
  quantity: number;
  placedAtIndex: number;
  note?: string;
}

export interface Fill {
  orderId: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fees: number;
  slippageCost: number;
  index: number;
  time: number;
  realizedPnl: number | null;
}

export interface JournalEntry {
  id: string;
  index: number;
  time: number;
  text: string;
  createdAt: number;
}

export interface SimSession {
  id: string;
  name: string;
  createdAt: number;
  symbol: string;
  timeframe: Timeframe;
  dataStatus: DataStatus;
  startingCash: number;
  costs: SimCosts;
  startIndex: number;
  cursor: number;
  cash: number;
  quantity: number;
  avgCost: number;
  pending: PendingOrder[];
  fills: Fill[];
  journal: JournalEntry[];
  equity: { index: number; time: number; value: number }[];
}

export class SimError extends Error {}

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq = (seq + 1) % 1e6)}`;

export function createSession(args: {
  name: string;
  symbol: string;
  timeframe: Timeframe;
  dataStatus: DataStatus;
  candles: readonly Candle[];
  startIndex: number;
  startingCash: number;
  costs?: SimCosts;
  nowMs?: number;
}): SimSession {
  if (!(args.startingCash > 0 && args.startingCash <= 1e9)) throw new SimError('Starting balance must be between 1 and 1,000,000,000 (fictional).');
  if (args.candles.length < 2) throw new SimError('Not enough historical data for a replay.');
  const startIndex = Math.min(Math.max(0, Math.floor(args.startIndex)), args.candles.length - 2);
  const c = args.candles[startIndex];
  return {
    id: nextId('sim'),
    name: args.name.trim().slice(0, 60) || 'Practice session',
    createdAt: args.nowMs ?? Date.now(),
    symbol: args.symbol,
    timeframe: args.timeframe,
    dataStatus: args.dataStatus,
    startingCash: args.startingCash,
    costs: args.costs ?? DEFAULT_SIM_COSTS,
    startIndex,
    cursor: startIndex,
    cash: args.startingCash,
    quantity: 0,
    avgCost: 0,
    pending: [],
    fills: [],
    journal: [],
    equity: [{ index: startIndex, time: c.time, value: args.startingCash }],
  };
}

/** Rough upper bound on how many units the cash can buy at the reference price, including costs. */
export function maxAffordableQuantity(s: SimSession, refPrice: number): number {
  const px = refPrice * (1 + s.costs.slippageBps / 10_000) * 1.02; // 2% buffer for gaps
  const avail = s.cash - s.costs.commissionPerTrade - committedCash(s, refPrice);
  if (avail <= 0) return 0;
  return Math.floor((avail / (px * (1 + s.costs.commissionBps / 10_000))) * 1e6) / 1e6;
}

function committedCash(s: SimSession, refPrice: number): number {
  return s.pending.filter((o) => o.side === 'buy').reduce((a, o) => a + o.quantity * refPrice * 1.02, 0);
}

export function placeOrder(s: SimSession, candles: readonly Candle[], side: OrderSide, quantity: number, note?: string): SimSession {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new SimError('Quantity must be a positive number.');
  if (s.cursor >= candles.length - 1) throw new SimError('Replay has reached the end of the available data.');
  const ref = candles[s.cursor].close;
  if (side === 'buy') {
    if (quantity > maxAffordableQuantity(s, ref) + 1e-9) throw new SimError('Insufficient fictional cash. Margin and leverage are not available in this simulator.');
  } else {
    const pendingSells = s.pending.filter((o) => o.side === 'sell').reduce((a, o) => a + o.quantity, 0);
    if (quantity > s.quantity - pendingSells + 1e-9) throw new SimError('You can only sell units you hold. Short selling is not available.');
  }
  const order: PendingOrder = { id: nextId('ord'), side, quantity, placedAtIndex: s.cursor, note: note?.slice(0, 500) };
  return { ...s, pending: [...s.pending, order] };
}

export function cancelOrder(s: SimSession, orderId: string): SimSession {
  return { ...s, pending: s.pending.filter((o) => o.id !== orderId) };
}

/** Advances the replay by `steps` bars, filling pending orders at the next bar's open. */
export function advance(s: SimSession, candles: readonly Candle[], steps = 1): SimSession {
  let st: SimSession = { ...s, pending: [...s.pending], fills: [...s.fills], equity: [...s.equity] };
  for (let k = 0; k < steps; k++) {
    if (st.cursor >= candles.length - 1) break;
    const i = st.cursor + 1;
    const bar = candles[i];
    for (const o of st.pending) st = fillOrder(st, o, bar, i);
    st.pending = [];
    st.cursor = i;
    st.equity.push({ index: i, time: bar.time, value: st.cash + st.quantity * bar.close });
  }
  return st;
}

function fillOrder(s: SimSession, o: PendingOrder, bar: Candle, index: number): SimSession {
  const slip = s.costs.slippageBps / 10_000;
  const bps = s.costs.commissionBps / 10_000;
  if (o.side === 'buy') {
    const px = bar.open * (1 + slip);
    // A gap up may make the order unaffordable; reduce to what fits rather than borrowing.
    const maxQ = (s.cash - s.costs.commissionPerTrade) / (px * (1 + bps));
    const q = Math.max(0, Math.min(o.quantity, Math.floor(maxQ * 1e6) / 1e6));
    if (q <= 0) return s;
    const fees = s.costs.commissionPerTrade + q * px * bps;
    const newQty = s.quantity + q;
    return {
      ...s,
      cash: s.cash - q * px - fees,
      quantity: newQty,
      avgCost: (s.avgCost * s.quantity + q * px + fees) / newQty,
      fills: [...s.fills, { orderId: o.id, side: 'buy', quantity: q, price: px, fees, slippageCost: q * bar.open * slip, index, time: bar.time, realizedPnl: null }],
    };
  }
  const q = Math.min(o.quantity, s.quantity);
  if (q <= 0) return s;
  const px = bar.open * (1 - slip);
  const fees = s.costs.commissionPerTrade + q * px * bps;
  const realized = q * (px - s.avgCost) - fees;
  const remaining = s.quantity - q;
  return {
    ...s,
    cash: s.cash + q * px - fees,
    quantity: remaining < 1e-9 ? 0 : remaining,
    avgCost: remaining < 1e-9 ? 0 : s.avgCost,
    fills: [...s.fills, { orderId: o.id, side: 'sell', quantity: q, price: px, fees, slippageCost: q * bar.open * slip, index, time: bar.time, realizedPnl: realized }],
  };
}

export function addJournalEntry(s: SimSession, candles: readonly Candle[], text: string, nowMs = Date.now()): SimSession {
  const t = text.trim();
  if (!t) throw new SimError('Journal entry is empty.');
  return { ...s, journal: [...s.journal, { id: nextId('jr'), index: s.cursor, time: candles[s.cursor].time, text: t.slice(0, 2000), createdAt: nowMs }] };
}

export function resetSession(s: SimSession, candles: readonly Candle[]): SimSession {
  return { ...s, cursor: s.startIndex, cash: s.startingCash, quantity: 0, avgCost: 0, pending: [], fills: [], journal: [], equity: [{ index: s.startIndex, time: candles[s.startIndex].time, value: s.startingCash }] };
}

export interface SimReport {
  equityNow: number;
  totalReturn: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFees: number;
  totalSlippage: number;
  maxDrawdown: number;
  trades: number;
  winningSells: number;
  losingSells: number;
  barsElapsed: number;
  buyAndHoldReturn: number;
  exposureNow: number;
}

export function sessionReport(s: SimSession, candles: readonly Candle[]): SimReport {
  const price = candles[s.cursor].close;
  const equityNow = s.cash + s.quantity * price;
  const sells = s.fills.filter((f) => f.side === 'sell');
  const realized = sells.reduce((a, f) => a + (f.realizedPnl ?? 0), 0);
  return {
    equityNow,
    totalReturn: equityNow / s.startingCash - 1,
    realizedPnl: realized,
    unrealizedPnl: s.quantity > 0 ? s.quantity * (price - s.avgCost) : 0,
    totalFees: s.fills.reduce((a, f) => a + f.fees, 0),
    totalSlippage: s.fills.reduce((a, f) => a + f.slippageCost, 0),
    maxDrawdown: maxDrawdown(s.equity.map((e) => e.value)).maxDrawdown,
    trades: s.fills.length,
    winningSells: sells.filter((f) => (f.realizedPnl ?? 0) > 0).length,
    losingSells: sells.filter((f) => (f.realizedPnl ?? 0) <= 0).length,
    barsElapsed: s.cursor - s.startIndex,
    buyAndHoldReturn: candles[s.cursor].close / candles[s.startIndex].close - 1,
    exposureNow: equityNow > 0 ? (s.quantity * price) / equityNow : 0,
  };
}
