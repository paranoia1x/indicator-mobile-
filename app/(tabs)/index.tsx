import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Callout,
  Card,
  ChangeText,
  Chip,
  Columns,
  DataStatusBadge,
  Disclaimer,
  IconButton,
  InstrumentRow,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  SkeletonRows,
  Sparkline,
  StatusPill,
  Stack,
  SwitchRow,
  Text,
  useIsOffline,
} from '@/components/ui';
import { useCalendar, useDataMode, useNews } from '@/hooks/useMarketData';
import { lastChange, useSeriesMany } from '@/hooks/useSeriesMany';
import { DEMO_CRYPTO_SYMBOLS, DEMO_INDEX_SYMBOLS, DEMO_SPECS } from '@/market-data/core/demo/universe';
import { COINBASE_INSTRUMENTS } from '@/market-data/providers/coinbase';
import { EVENT_EXPLANATIONS } from '@/news/core/calendar';
import { deduplicateNews } from '@/news/core/processing';
import { computeBreadth, periodChange } from '@/research/breadth';
import { findInstrument } from '@/services/data-service';
import { formatDate, formatDateTime, formatPct, formatPrice, relativeTime } from '@/services/format';
import { usEquitySession } from '@/services/market-session';
import { DASHBOARD_WIDGETS, useActivity, useSettings, useWatchlists, type DashboardWidgetId } from '@/storage/stores';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE } from '@/themes/tokens';

const STOCKS = DEMO_SPECS.filter((s) => s.assetClass === 'stock').map((s) => s.symbol);

export default function Home() {
  const { c } = useTheme();
  const mode = useDataMode();
  const dashboard = useSettings((s) => s.dashboard);
  const [customize, setCustomize] = useState(false);
  const watch = useWatchlists();
  const active = watch.lists.find((l) => l.id === watch.activeId) ?? watch.lists[0];
  const recent = useActivity((s) => s.recentSymbols);
  const liveCrypto = mode.liveCrypto ? ['BTC-USD', 'ETH-USD', 'SOL-USD'] : [];
  const watchSymbols = (active?.items ?? []).slice(0, 6).map((i) => i.symbol);

  const symbols = useMemo(() => [...new Set([...DEMO_INDEX_SYMBOLS, ...STOCKS, ...DEMO_CRYPTO_SYMBOLS, ...liveCrypto, ...watchSymbols])], [liveCrypto.join(), watchSymbols.join()]);
  const series = useSeriesMany(symbols, '1D');
  const news = useNews(null);
  const cal = useCalendar();
  const now = Date.now();

  const widgets: Record<DashboardWidgetId, React.ReactNode> = {
    freshness: <FreshnessCard key="freshness" />,
    indices: (
      <View key="indices" style={{ gap: SPACE.sm }}>
        <SectionHeader title="Major indices" icon="stats-chart-outline" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.md }}>
          {DEMO_INDEX_SYMBOLS.map((sym) => {
            const s = series.map[sym];
            const lc = lastChange(s);
            const inst = findInstrument(sym, mode);
            return (
              <Pressable key={sym} accessibilityRole="button" accessibilityLabel={`${inst.name} ${formatPrice(lc.price)} ${formatPct(lc.changePct)}`} onPress={() => router.push(`/asset/${encodeURIComponent(sym)}`)}>
                <Card style={{ width: 172, gap: 6 }}>
                  <Text variant="label" tone="secondary" numberOfLines={1}>
                    {inst.name.replace(' Index (Simulated)', '')}
                  </Text>
                  <Text variant="heading" numeric>
                    {formatPrice(lc.price)}
                  </Text>
                  <Row justify="space-between">
                    <ChangeText value={lc.changePct} />
                    <Sparkline values={lc.spark} width={70} height={26} />
                  </Row>
                  {s && <DataStatusBadge status={s.provenance.status} compact />}
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    ),
    session: <SessionCard key="session" />,
    summary: <MarketSummary key="summary" map={series.map} />,
    watchlist: (
      <Card key="watchlist">
        <SectionHeader title={active ? active.name : 'Watchlist'} icon="star-outline" action="Manage" onAction={() => router.push('/watchlists')} />
        <View style={{ marginTop: SPACE.sm }}>
          {series.loading && !Object.keys(series.map).length ? <SkeletonRows rows={3} /> : null}
          {watchSymbols.length === 0 ? (
            <Text variant="caption" tone="secondary">
              Your watchlist is empty. Add assets from Markets or any asset page.
            </Text>
          ) : (
            watchSymbols.map((sym) => {
              const lc = lastChange(series.map[sym]);
              return <InstrumentRow key={sym} instrument={findInstrument(sym, mode)} price={lc.price} changePct={lc.changePct} spark={lc.spark} status={series.map[sym]?.provenance.status} />;
            })
          )}
          {Object.entries(series.errors)
            .filter(([s]) => watchSymbols.includes(s))
            .map(([s, e]) => (
              <Text key={s} variant="caption" tone="warning">
                {s}: {e}
              </Text>
            ))}
        </View>
      </Card>
    ),
    sectors: <SectorCard key="sectors" map={series.map} />,
    crypto: (
      <Card key="crypto">
        <SectionHeader title="Crypto overview" icon="logo-bitcoin" action={mode.liveCrypto ? undefined : 'Enable live'} onAction={() => router.push('/settings')} />
        <View style={{ marginTop: SPACE.sm }}>
          {[...liveCrypto, ...DEMO_CRYPTO_SYMBOLS].map((sym) => {
            const lc = lastChange(series.map[sym]);
            return <InstrumentRow key={sym} instrument={findInstrument(sym, mode, COINBASE_INSTRUMENTS)} price={lc.price} changePct={lc.changePct} spark={lc.spark} status={series.map[sym]?.provenance.status} />;
          })}
        </View>
        <Text variant="caption" tone="muted">
          Crypto trades 24/7; daily change is measured between UTC daily bars.
        </Text>
      </Card>
    ),
    news: (
      <Card key="news">
        <SectionHeader title="Latest news" icon="newspaper-outline" action="All news" onAction={() => router.push('/news')} />
        <Stack gap={SPACE.md} style={{ marginTop: SPACE.md }}>
          {deduplicateNews(news.data?.items ?? [])
            .slice(0, 4)
            .map((n) => (
              <Pressable key={n.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/news', params: { id: n.id } })}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {n.headline}
                </Text>
                <Row gap={6} wrap style={{ marginTop: 4 }}>
                  <Text variant="caption" tone="muted">
                    {n.publisher} · {relativeTime(n.publishedAt)}
                  </Text>
                  <StatusPill status={n.status} />
                  <DataStatusBadge status={n.provenance.status} compact />
                </Row>
              </Pressable>
            ))}
          {news.isLoading && <SkeletonRows rows={2} />}
        </Stack>
      </Card>
    ),
    events: (
      <Card key="events">
        <SectionHeader title="Upcoming events" icon="calendar-outline" action="Calendar" onAction={() => router.push('/calendar')} />
        <Stack gap={SPACE.md} style={{ marginTop: SPACE.md }}>
          {(cal.data?.events ?? [])
            .filter((e) => e.scheduledAt >= now)
            .slice(0, 4)
            .map((e) => (
              <Row key={e.id} gap={SPACE.md}>
                <View style={{ width: 48, alignItems: 'center', paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: c.surfaceAlt }}>
                  <Text variant="micro" tone="muted">
                    {formatDateTime(e.scheduledAt, { month: 'short' }).toUpperCase()}
                  </Text>
                  <Text variant="heading">{formatDateTime(e.scheduledAt, { day: 'numeric' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {EVENT_EXPLANATIONS[e.kind].name} · {formatDateTime(e.scheduledAt, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                  </Text>
                </View>
                <DataStatusBadge status={e.provenance.status} compact />
              </Row>
            ))}
        </Stack>
      </Card>
    ),
    recent: (
      <Card key="recent">
        <SectionHeader title="Recently viewed" icon="time-outline" />
        {recent.length ? (
          <Row wrap gap={SPACE.sm} style={{ marginTop: SPACE.md }}>
            {recent.map((s) => (
              <Chip key={s} label={s} onPress={() => router.push(`/asset/${encodeURIComponent(s)}`)} />
            ))}
          </Row>
        ) : (
          <Text variant="caption" tone="secondary" style={{ marginTop: SPACE.sm }}>
            Assets you open will appear here.
          </Text>
        )}
      </Card>
    ),
  };

  const visible = dashboard.filter((w) => w.visible).map((w) => widgets[w.id]);
  const wide = visible.filter((_, i) => ['freshness', 'indices'].includes(dashboard.filter((w) => w.visible)[i].id));
  const rest = visible.filter((v) => !wide.includes(v));

  return (
    <Screen
      title="Markets today"
      subtitle={formatDate(now)}
      onRefresh={() => {
        series.refetch();
        news.refetch();
        cal.refetch();
      }}
      refreshing={false}
      right={
        <Row gap={0}>
          <IconButton icon="notifications-outline" label="Notification settings" onPress={() => router.push('/notifications')} />
          <IconButton icon="options-outline" label="Customize dashboard" onPress={() => setCustomize(true)} />
          <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </Row>
      }
    >
      {wide}
      <Columns>{rest}</Columns>
      <Disclaimer compact />
      <CustomizeSheet visible={customize} onClose={() => setCustomize(false)} />
    </Screen>
  );
}



function FreshnessCard() {
  const mode = useDataMode();
  const offline = useIsOffline();
  return (
    <Callout tone={mode.backendUrl || mode.liveCrypto ? 'info' : 'simulated'} title={mode.backendUrl || mode.liveCrypto ? 'Mixed data sources' : 'Demo mode — simulated data'}>
      <Text variant="caption" tone="secondary">
        {[
          'Instruments ending in “.SIM” are fictional and use simulated prices.',
          mode.liveCrypto ? 'Live crypto: Coinbase Exchange public data.' : 'Live crypto is off.',
          mode.backendUrl ? 'Stocks/ETFs: your Indicator backend.' : 'No backend configured for real stock data.',
          offline ? 'You are offline: cached data is shown with its original timestamp.' : null,
        ]
          .filter(Boolean)
          .join(' ')}
      </Text>
      <Button label="Data sources" variant="ghost" small onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start', marginLeft: -12 }} />
    </Callout>
  );
}

function SessionCard() {
  const { c } = useTheme();
  const s = usEquitySession(Date.now());
  const col = s.state === 'open' ? c.up : s.state === 'closed' ? c.textMuted : c.warning;
  return (
    <Card>
      <Row gap={SPACE.md}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col }} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">US equities: {s.label}</Text>
          <Text variant="caption" tone="muted">
            {s.detail} Crypto markets trade continuously.
          </Text>
        </View>
      </Row>
    </Card>
  );
}

function MarketSummary({ map }: { map: Record<string, { candles: { time: number; open: number; high: number; low: number; close: number; volume: number | null }[] } | undefined> }) {
  const stocks = Object.fromEntries(STOCKS.filter((s) => map[s]).map((s) => [s, map[s]!.candles]));
  if (!Object.keys(stocks).length) return <Card><SkeletonRows rows={2} /></Card>;
  const b = computeBreadth(stocks);
  const moves = Object.entries(stocks)
    .map(([s, c]) => ({ s, ch: periodChange(c, 1) }))
    .filter((x) => x.ch !== null)
    .sort((a, z) => Math.abs(z.ch!) - Math.abs(a.ch!));
  const top = moves[0];
  return (
    <Card tone="navy">
      <Row justify="space-between">
        <SectionHeader title="Educational summary" icon="school-outline" />
        <DataStatusBadge status="simulated" compact />
      </Row>
      <Stack gap={SPACE.sm} style={{ marginTop: SPACE.md }}>
        <Text variant="body">
          In the simulated market, {b.advancers} of {b.total} stocks closed higher on the latest bar and {b.decliners} closed lower. {b.aboveSma50} of {b.total} are above their 50-day average.
        </Text>
        {top ? (
          <Text variant="body">
            The largest move was {top.s} ({formatPct(top.ch)}). A single day’s move usually has many possible causes — open the asset and ask the AI assistant what information is and isn’t available.
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          What this means: breadth describes how widely a move was shared across stocks. It is a description of the past, not a forecast.
        </Text>
      </Stack>
    </Card>
  );
}

function SectorCard({ map }: { map: Record<string, { candles: { close: number }[] } | undefined> }) {
  const { c } = useTheme();
  const [period, setPeriod] = useState<1 | 21>(1);
  const bySector = new Map<string, number[]>();
  for (const spec of DEMO_SPECS.filter((s) => s.assetClass === 'stock')) {
    const cs = map[spec.symbol]?.candles;
    if (!cs || cs.length <= period) continue;
    const ch = cs[cs.length - 1].close / cs[cs.length - 1 - period].close - 1;
    bySector.set(spec.sector!, [...(bySector.get(spec.sector!) ?? []), ch]);
  }
  const rows = [...bySector.entries()].map(([s, xs]) => ({ s, v: xs.reduce((a, b) => a + b, 0) / xs.length })).sort((a, b) => b.v - a.v);
  const max = Math.max(0.0001, ...rows.map((r) => Math.abs(r.v)));
  return (
    <Card>
      <Row justify="space-between">
        <SectionHeader title="Sector performance" icon="grid-outline" />
        <Row gap={6}>
          <Chip label="1D" selected={period === 1} onPress={() => setPeriod(1)} />
          <Chip label="1M" selected={period === 21} onPress={() => setPeriod(21)} />
        </Row>
      </Row>
      <Stack gap={8} style={{ marginTop: SPACE.md }}>
        {rows.map((r) => (
          <Row key={r.s} gap={SPACE.sm} accessible accessibilityLabel={`${r.s} ${formatPct(r.v)}`}>
            <Text variant="caption" style={{ width: 132 }} numberOfLines={1}>
              {r.s}
            </Text>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
              <View style={{ width: `${(Math.abs(r.v) / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: r.v >= 0 ? c.up : c.down }} />
            </View>
            <View style={{ width: 66, alignItems: 'flex-end' }}>
              <ChangeText value={r.v} variant="caption" withArrow={false} />
            </View>
          </Row>
        ))}
      </Stack>
      <Text variant="caption" tone="muted" style={{ marginTop: SPACE.sm }}>
        Equal-weighted average of simulated stocks in each sector. Historical change only.
      </Text>
    </Card>
  );
}

function CustomizeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { dashboard, moveWidget, toggleWidget, resetDashboard } = useSettings();
  return (
    <Sheet visible={visible} onClose={onClose} title="Customize dashboard">
      {dashboard.map((w, i) => (
        <Row key={w.id} gap={SPACE.sm}>
          <View style={{ flex: 1 }}>
            <SwitchRow label={DASHBOARD_WIDGETS.find((d) => d.id === w.id)?.label ?? w.id} value={w.visible} onChange={() => toggleWidget(w.id)} />
          </View>
          <IconButton icon="arrow-up" label="Move up" onPress={() => moveWidget(w.id, -1)} disabled={i === 0} />
          <IconButton icon="arrow-down" label="Move down" onPress={() => moveWidget(w.id, 1)} disabled={i === dashboard.length - 1} />
        </Row>
      ))}
      <Button label="Reset layout" variant="secondary" onPress={resetDashboard} />
    </Sheet>
  );
}

