import { addJournalEntry, advance, cancelOrder, createSession, maxAffordableQuantity, placeOrder, resetSession, sessionReport, SimError } from '@/simulator/engine';
import type { Candle } from '@/market-data/core/types';

const bars: Candle[] = [100, 102, 104, 101, 110, 120, 90, 95].map((p, i) => ({ time: i * 86400, open: p, high: p + 1, low: p - 1, close: p + 0.5, volume: 1000 }));
const noCosts = { commissionPerTrade: 0, commissionBps: 0, slippageBps: 0 };

function session(costs = noCosts) {
  return createSession({ name: 'Test', symbol: 'X.SIM', timeframe: '1D', dataStatus: 'simulated', candles: bars, startIndex: 0, startingCash: 10_000, costs, nowMs: 0 });
}

describe('simulator', () => {
  it('fills market orders at the NEXT bar open (no look-ahead)', () => {
    let s = placeOrder(session(), bars, 'buy', 10);
    expect(s.fills).toHaveLength(0);
    s = advance(s, bars, 1);
    expect(s.fills[0].price).toBe(102);
    expect(s.fills[0].index).toBe(1);
    expect(s.cash).toBe(10_000 - 1020);
    expect(s.quantity).toBe(10);
  });

  it('applies slippage and commission', () => {
    let s = placeOrder(session({ commissionPerTrade: 1, commissionBps: 10, slippageBps: 10 }), bars, 'buy', 10);
    s = advance(s, bars, 1);
    const px = 102 * 1.001;
    expect(s.fills[0].price).toBeCloseTo(px, 9);
    expect(s.fills[0].fees).toBeCloseTo(1 + 10 * px * 0.001, 9);
  });

  it('computes realized P/L on sells and the session report', () => {
    let s = advance(placeOrder(session(), bars, 'buy', 10), bars, 1);
    s = advance(s, bars, 3); // cursor at 4
    s = advance(placeOrder(s, bars, 'sell', 10), bars, 1); // sells at open of bar 5 = 120
    const sell = s.fills[1];
    expect(sell.realizedPnl).toBeCloseTo(10 * (120 - 102), 9);
    const r = sessionReport(s, bars);
    expect(r.realizedPnl).toBeCloseTo(180, 9);
    expect(r.trades).toBe(2);
    expect(r.winningSells).toBe(1);
    expect(r.equityNow).toBeCloseTo(10_180, 9);
    expect(r.buyAndHoldReturn).toBeCloseTo(120.5 / 100.5 - 1, 9);
  });

  it('forbids leverage, margin and short selling', () => {
    const s = session();
    expect(() => placeOrder(s, bars, 'buy', 1000)).toThrow(SimError);
    expect(() => placeOrder(s, bars, 'sell', 1)).toThrow(/Short selling is not available/);
    expect(() => placeOrder(s, bars, 'buy', -5)).toThrow(SimError);
    expect(maxAffordableQuantity(s, 100)).toBeLessThan(100);
  });

  it('cancels pending orders, records journal entries and resets', () => {
    let s = placeOrder(session(), bars, 'buy', 5);
    s = cancelOrder(s, s.pending[0].id);
    expect(s.pending).toHaveLength(0);
    s = addJournalEntry(s, bars, 'Waiting for confirmation', 5);
    expect(s.journal[0].text).toBe('Waiting for confirmation');
    expect(() => addJournalEntry(s, bars, '   ')).toThrow(SimError);
    s = advance(s, bars, 3);
    s = resetSession(s, bars);
    expect(s.cursor).toBe(0);
    expect(s.journal).toHaveLength(0);
    expect(s.cash).toBe(10_000);
  });

  it('stops at the end of data and tracks drawdown', () => {
    let s = advance(placeOrder(session(), bars, 'buy', 90), bars, 1);
    s = advance(s, bars, 100);
    expect(s.cursor).toBe(bars.length - 1);
    expect(() => placeOrder(s, bars, 'buy', 1)).toThrow(/end of the available data/);
    expect(sessionReport(s, bars).maxDrawdown).toBeLessThan(0);
  });

  it('validates starting balance', () => {
    expect(() => createSession({ name: '', symbol: 'X', timeframe: '1D', dataStatus: 'simulated', candles: bars, startIndex: 0, startingCash: 0 })).toThrow(SimError);
  });
});
