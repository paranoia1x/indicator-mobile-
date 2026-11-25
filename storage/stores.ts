import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createIndicatorConfig, resetIndicatorConfig, sanitizeParams, type IndicatorConfig, type IndicatorId } from '@/indicators/registry';
import type { Timeframe } from '@/market-data/core/types';
import { DEFAULT_NOTIFICATION_PREFS, sanitizePrefs, type NotificationPrefs } from '@/notifications/core/preferences';
import type { ExperimentRecord } from '@/research/backtest';
import type { SimSession } from '@/simulator/engine';
import type { AssistantAnswer } from '@/ai/core/types';
import { kv } from './kv';

const storage = createJSONStorage(() => ({
  getItem: (k: string) => kv.getItem(k),
  setItem: (k: string, v: string) => kv.setItem(k, v),
  removeItem: (k: string) => kv.removeItem(k),
}));

let idSeq = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(idSeq = (idSeq + 1) % 1e6).toString(36)}`;

// ---------------------------------------------------------------- Settings
export type ThemeMode = 'system' | 'oled' | 'dark' | 'light';
export type DashboardWidgetId = 'indices' | 'session' | 'watchlist' | 'sectors' | 'crypto' | 'news' | 'events' | 'recent' | 'summary' | 'freshness';

export const DASHBOARD_WIDGETS: { id: DashboardWidgetId; label: string }[] = [
  { id: 'freshness', label: 'Data status' },
  { id: 'indices', label: 'Major indices' },
  { id: 'session', label: 'Market session status' },
  { id: 'summary', label: 'Educational market summary' },
  { id: 'watchlist', label: 'Watchlist overview' },
  { id: 'sectors', label: 'Sector performance' },
  { id: 'crypto', label: 'Crypto overview' },
  { id: 'news', label: 'Latest news' },
  { id: 'events', label: 'Upcoming events' },
  { id: 'recent', label: 'Recently viewed' },
];

export interface SettingsState {
  theme: ThemeMode;
  textScale: number;
  colorblind: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  haptics: boolean;
  liveCrypto: boolean;
  backendUrl: string | null;
  allowInsecureDev: boolean;
  biometricLock: boolean;
  acceptedDisclaimerAt: number | null;
  notifications: NotificationPrefs;
  dashboard: { id: DashboardWidgetId; visible: boolean }[];
  set: (patch: Partial<Omit<SettingsState, 'set' | 'moveWidget' | 'toggleWidget' | 'resetDashboard'>>) => void;
  moveWidget: (id: DashboardWidgetId, dir: -1 | 1) => void;
  toggleWidget: (id: DashboardWidgetId) => void;
  resetDashboard: () => void;
}

const defaultDashboard = () => DASHBOARD_WIDGETS.map((w) => ({ id: w.id, visible: true }));

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      textScale: 1,
      colorblind: false,
      reducedMotion: 'system',
      haptics: true,
      liveCrypto: false,
      backendUrl: null,
      allowInsecureDev: false,
      biometricLock: false,
      acceptedDisclaimerAt: null,
      notifications: DEFAULT_NOTIFICATION_PREFS,
      dashboard: defaultDashboard(),
      set: (patch) => set(patch),
      moveWidget: (id, dir) => {
        const d = [...get().dashboard];
        const i = d.findIndex((w) => w.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.length) return;
        [d[i], d[j]] = [d[j], d[i]];
        set({ dashboard: d });
      },
      toggleWidget: (id) => set({ dashboard: get().dashboard.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)) }),
      resetDashboard: () => set({ dashboard: defaultDashboard() }),
    }),
    {
      name: 'settings',
      version: 1,
      storage,
      partialize: ({ set: _s, moveWidget: _m, toggleWidget: _t, resetDashboard: _r, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const known = new Set(DASHBOARD_WIDGETS.map((w) => w.id));
        const dash = Array.isArray(p.dashboard) ? p.dashboard.filter((w) => known.has(w.id)) : [];
        for (const w of DASHBOARD_WIDGETS) if (!dash.some((x) => x.id === w.id)) dash.push({ id: w.id, visible: true });
        return {
          ...current,
          ...p,
          textScale: typeof p.textScale === 'number' ? Math.min(1.4, Math.max(0.85, p.textScale)) : current.textScale,
          notifications: sanitizePrefs(p.notifications),
          dashboard: dash,
        };
      },
    },
  ),
);

// ---------------------------------------------------------------- Watchlists
export interface WatchItem {
  symbol: string;
  addedAt: number;
  note: string;
}
export interface Watchlist {
  id: string;
  name: string;
  items: WatchItem[];
  createdAt: number;
}

interface WatchlistState {
  lists: Watchlist[];
  activeId: string | null;
  create: (name: string) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setActive: (id: string) => void;
  addSymbol: (id: string, symbol: string) => void;
  removeSymbol: (id: string, symbol: string) => void;
  moveSymbol: (id: string, symbol: string, dir: -1 | 1) => void;
  setNote: (id: string, symbol: string, note: string) => void;
}

const cleanName = (n: string) => n.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 40) || 'Untitled';

export const useWatchlists = create<WatchlistState>()(
  persist(
    (set, get) => ({
      lists: [
        {
          id: 'default',
          name: 'My watchlist',
          createdAt: 0,
          items: ['NWSC.SIM', 'HLXS.SIM', 'BRDX.SIM', 'AURC.SIM', 'TIDE.SIM'].map((symbol) => ({ symbol, addedAt: 0, note: '' })),
        },
      ],
      activeId: 'default',
      create: (name) => {
        const id = newId('wl');
        set({ lists: [...get().lists, { id, name: cleanName(name), items: [], createdAt: Date.now() }], activeId: id });
        return id;
      },
      rename: (id, name) => set({ lists: get().lists.map((l) => (l.id === id ? { ...l, name: cleanName(name) } : l)) }),
      remove: (id) => {
        const lists = get().lists.filter((l) => l.id !== id);
        set({ lists, activeId: get().activeId === id ? (lists[0]?.id ?? null) : get().activeId });
      },
      setActive: (id) => set({ activeId: id }),
      addSymbol: (id, symbol) =>
        set({ lists: get().lists.map((l) => (l.id === id && !l.items.some((i) => i.symbol === symbol) ? { ...l, items: [...l.items, { symbol, addedAt: Date.now(), note: '' }] } : l)) }),
      removeSymbol: (id, symbol) => set({ lists: get().lists.map((l) => (l.id === id ? { ...l, items: l.items.filter((i) => i.symbol !== symbol) } : l)) }),
      moveSymbol: (id, symbol, dir) =>
        set({
          lists: get().lists.map((l) => {
            if (l.id !== id) return l;
            const items = [...l.items];
            const i = items.findIndex((x) => x.symbol === symbol);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= items.length) return l;
            [items[i], items[j]] = [items[j], items[i]];
            return { ...l, items };
          }),
        }),
      setNote: (id, symbol, note) =>
        set({ lists: get().lists.map((l) => (l.id === id ? { ...l, items: l.items.map((i) => (i.symbol === symbol ? { ...i, note: note.slice(0, 2000) } : i)) } : l)) }),
    }),
    { name: 'watchlists', version: 1, storage, partialize: (s) => ({ lists: s.lists, activeId: s.activeId }) },
  ),
);

// ---------------------------------------------------------------- Chart preferences & drawings
export type ChartType = 'candles' | 'line' | 'area' | 'ohlc';

export type Drawing =
  | { id: string; kind: 'hline'; price: number; color: string; label?: string }
  | { id: string; kind: 'trend'; a: { time: number; price: number }; b: { time: number; price: number }; color: string }
  | { id: string; kind: 'fib'; a: { time: number; price: number }; b: { time: number; price: number }; color: string }
  | { id: string; kind: 'note'; time: number; price: number; text: string; color: string };

interface ChartPrefsState {
  symbol: string;
  setSymbol: (symbol: string) => void;
  chartType: ChartType;
  timeframe: Timeframe;
  logScale: boolean;
  showVolume: boolean;
  showStructure: boolean;
  showEvents: boolean;
  indicators: IndicatorConfig[];
  drawings: Record<string, Drawing[]>;
  set: (patch: Partial<Pick<ChartPrefsState, 'chartType' | 'timeframe' | 'logScale' | 'showVolume' | 'showStructure' | 'showEvents'>>) => void;
  addIndicator: (id: IndicatorId) => void;
  updateIndicator: (uid: string, patch: Partial<Pick<IndicatorConfig, 'params' | 'colors' | 'visible'>>) => void;
  resetIndicator: (uid: string) => void;
  removeIndicator: (uid: string) => void;
  resetAllIndicators: () => void;
  addDrawing: (symbol: string, d: Drawing) => void;
  removeDrawing: (symbol: string, id: string) => void;
  clearDrawings: (symbol: string) => void;
}

const defaultIndicators = () => [createIndicatorConfig('sma', { period: 50 }), createIndicatorConfig('rsi')];

export const useChartPrefs = create<ChartPrefsState>()(
  persist(
    (set, get) => ({
      symbol: 'NWSC.SIM',
      setSymbol: (symbol) => set({ symbol }),
      chartType: 'candles',
      timeframe: '1D',
      logScale: false,
      showVolume: true,
      showStructure: false,
      showEvents: true,
      indicators: defaultIndicators(),
      drawings: {},
      set: (patch) => set(patch),
      addIndicator: (id) => set({ indicators: [...get().indicators, createIndicatorConfig(id)].slice(0, 12) }),
      updateIndicator: (uid, patch) =>
        set({
          indicators: get().indicators.map((c) =>
            c.uid === uid ? { ...c, ...patch, params: patch.params ? sanitizeParams(c.id, { ...c.params, ...patch.params }) : c.params, colors: patch.colors ? { ...c.colors, ...patch.colors } : c.colors } : c,
          ),
        }),
      resetIndicator: (uid) => set({ indicators: get().indicators.map((c) => (c.uid === uid ? resetIndicatorConfig(c) : c)) }),
      removeIndicator: (uid) => set({ indicators: get().indicators.filter((c) => c.uid !== uid) }),
      resetAllIndicators: () => set({ indicators: defaultIndicators() }),
      addDrawing: (symbol, d) => set({ drawings: { ...get().drawings, [symbol]: [...(get().drawings[symbol] ?? []), d].slice(-50) } }),
      removeDrawing: (symbol, id) => set({ drawings: { ...get().drawings, [symbol]: (get().drawings[symbol] ?? []).filter((d) => d.id !== id) } }),
      clearDrawings: (symbol) => set({ drawings: { ...get().drawings, [symbol]: [] } }),
    }),
    {
      name: 'chart-prefs',
      version: 1,
      storage,
      partialize: (s) => ({ symbol: s.symbol, chartType: s.chartType, timeframe: s.timeframe, logScale: s.logScale, showVolume: s.showVolume, showStructure: s.showStructure, showEvents: s.showEvents, indicators: s.indicators, drawings: s.drawings }),
    },
  ),
);

// ---------------------------------------------------------------- Recents / favourites / notes
interface ActivityState {
  recentSymbols: string[];
  recentSearches: string[];
  favorites: string[];
  notes: Record<string, string>;
  viewed: (symbol: string) => void;
  searched: (q: string) => void;
  toggleFavorite: (symbol: string) => void;
  setNote: (symbol: string, text: string) => void;
  clearRecents: () => void;
}

export const useActivity = create<ActivityState>()(
  persist(
    (set, get) => ({
      recentSymbols: [],
      recentSearches: [],
      favorites: [],
      notes: {},
      viewed: (symbol) => set({ recentSymbols: [symbol, ...get().recentSymbols.filter((s) => s !== symbol)].slice(0, 12) }),
      searched: (q) => {
        const t = q.trim().slice(0, 40);
        if (t.length < 2) return;
        set({ recentSearches: [t, ...get().recentSearches.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, 10) });
      },
      toggleFavorite: (symbol) => set({ favorites: get().favorites.includes(symbol) ? get().favorites.filter((s) => s !== symbol) : [...get().favorites, symbol] }),
      setNote: (symbol, text) => set({ notes: { ...get().notes, [symbol]: text.slice(0, 5000) } }),
      clearRecents: () => set({ recentSymbols: [], recentSearches: [] }),
    }),
    { name: 'activity', version: 1, storage, partialize: (s) => ({ recentSymbols: s.recentSymbols, recentSearches: s.recentSearches, favorites: s.favorites, notes: s.notes }) },
  ),
);

// ---------------------------------------------------------------- Learning progress
interface LearningState {
  progress: Record<string, { completedAt: number; score: number; total: number }>;
  bookmarks: string[];
  complete: (lessonId: string, score: number, total: number) => void;
  toggleBookmark: (lessonId: string) => void;
  reset: () => void;
}

export const useLearning = create<LearningState>()(
  persist(
    (set, get) => ({
      progress: {},
      bookmarks: [],
      complete: (lessonId, score, total) => set({ progress: { ...get().progress, [lessonId]: { completedAt: Date.now(), score, total } } }),
      toggleBookmark: (id) => set({ bookmarks: get().bookmarks.includes(id) ? get().bookmarks.filter((b) => b !== id) : [...get().bookmarks, id] }),
      reset: () => set({ progress: {}, bookmarks: [] }),
    }),
    { name: 'learning', version: 1, storage, partialize: (s) => ({ progress: s.progress, bookmarks: s.bookmarks }) },
  ),
);

// ---------------------------------------------------------------- Simulator sessions
interface SimulatorState {
  sessions: SimSession[];
  activeId: string | null;
  upsert: (s: SimSession) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
}

export const useSimulator = create<SimulatorState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      upsert: (s) => {
        const trimmed = { ...s, equity: s.equity.length > 2000 ? s.equity.filter((_, i) => i % Math.ceil(s.equity.length / 2000) === 0 || i === s.equity.length - 1) : s.equity };
        const exists = get().sessions.some((x) => x.id === s.id);
        set({ sessions: exists ? get().sessions.map((x) => (x.id === s.id ? trimmed : x)) : [trimmed, ...get().sessions].slice(0, 20), activeId: s.id });
      },
      remove: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id), activeId: get().activeId === id ? null : get().activeId }),
      setActive: (id) => set({ activeId: id }),
    }),
    { name: 'simulator', version: 1, storage, partialize: (s) => ({ sessions: s.sessions, activeId: s.activeId }) },
  ),
);

// ---------------------------------------------------------------- Research experiments (all kept, including failures)
const thin = (xs: number[], max = 300) => (xs.length <= max ? xs : xs.filter((_, i) => i % Math.ceil(xs.length / max) === 0 || i === xs.length - 1));

interface ResearchState {
  experiments: ExperimentRecord[];
  add: (e: ExperimentRecord) => void;
  setNotes: (id: string, notes: string) => void;
  remove: (id: string) => void;
}

export const useResearch = create<ResearchState>()(
  persist(
    (set, get) => ({
      experiments: [],
      add: (e) => {
        const slim = (seg: ExperimentRecord['inSample']) => ({ ...seg, equity: thin(seg.equity), trades: seg.trades.slice(-200) });
        const rec: ExperimentRecord = { ...e, inSample: slim(e.inSample), outOfSample: slim(e.outOfSample), benchmarkInSample: slim(e.benchmarkInSample), benchmarkOutOfSample: slim(e.benchmarkOutOfSample) };
        set({ experiments: [rec, ...get().experiments].slice(0, 100) });
      },
      setNotes: (id, notes) => set({ experiments: get().experiments.map((e) => (e.id === id ? { ...e, notes: notes.slice(0, 4000) } : e)) }),
      remove: (id) => set({ experiments: get().experiments.filter((e) => e.id !== id) }),
    }),
    { name: 'research', version: 1, storage, partialize: (s) => ({ experiments: s.experiments }) },
  ),
);

// ---------------------------------------------------------------- Assistant history (local only)
interface AssistantState {
  history: AssistantAnswer[];
  push: (a: AssistantAnswer) => void;
  clear: () => void;
}

export const useAssistantHistory = create<AssistantState>()(
  persist(
    (set, get) => ({
      history: [],
      push: (a) => set({ history: [...get().history, a].slice(-30) }),
      clear: () => set({ history: [] }),
    }),
    { name: 'assistant', version: 1, storage, partialize: (s) => ({ history: s.history }) },
  ),
);

/** Wipes all locally stored user data (settings, watchlists, notes, sessions, caches). */
export async function deleteAllLocalData(): Promise<void> {
  await kv.clear();
  useWatchlists.setState({ lists: [], activeId: null });
  useActivity.setState({ recentSymbols: [], recentSearches: [], favorites: [], notes: {} });
  useLearning.setState({ progress: {}, bookmarks: [] });
  useSimulator.setState({ sessions: [], activeId: null });
  useResearch.setState({ experiments: [] });
  useAssistantHistory.setState({ history: [] });
  useChartPrefs.setState({ drawings: {} });
}
