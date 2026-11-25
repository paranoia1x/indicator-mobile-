import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { DataStatus, Instrument, Provenance } from '@/market-data/core/types';
import { a11yChange, formatDateTime, formatPct, formatPrice, relativeTime } from '@/services/format';
import { tap } from '@/services/haptics';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE } from '@/themes/tokens';
import { Icon, Row, Text } from './primitives';

export const STATUS_LABEL: Record<DataStatus, string> = {
  live: 'LIVE',
  delayed: 'DELAYED',
  historical: 'HISTORICAL',
  cached: 'CACHED',
  simulated: 'SIMULATED',
};

const STATUS_HELP: Record<DataStatus, string> = {
  live: 'Recently updated data from a real provider.',
  delayed: 'Real data that the provider delays intentionally.',
  historical: 'Completed historical data from a real provider; not current.',
  cached: 'Saved earlier on this device; may be out of date.',
  simulated: 'Generated demo data. Not real market data.',
};

/** Mandatory data-status label shown next to every price. */
export function DataStatusBadge({ status, asOf, compact }: { status: DataStatus; asOf?: number; compact?: boolean }) {
  const { c } = useTheme();
  const col = c.status[status];
  return (
    <View
      accessible
      accessibilityLabel={`Data status: ${STATUS_LABEL[status].toLowerCase()}. ${STATUS_HELP[status]}${asOf ? ` As of ${formatDateTime(asOf)}.` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: col + '55', backgroundColor: col + '18' }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
      <Text variant="micro" color={col}>
        {STATUS_LABEL[status]}
        {!compact && asOf ? ` · ${relativeTime(asOf)}` : ''}
      </Text>
    </View>
  );
}

export function ProvenanceLine({ p }: { p: Provenance }) {
  return (
    <View style={{ gap: 4 }}>
      <Row gap={SPACE.sm} wrap>
        <DataStatusBadge status={p.status} asOf={p.asOf} />
        <Text variant="caption" tone="muted">
          {p.providerName} · as of {formatDateTime(p.asOf)}
        </Text>
      </Row>
      {p.attribution ? (
        <Text variant="caption" tone="muted">
          {p.attribution}
        </Text>
      ) : null}
      {p.warnings?.map((w) => (
        <Text key={w} variant="caption" tone="warning">
          ⚠ {w}
        </Text>
      ))}
    </View>
  );
}

export function ChangeText({ value, variant = 'label', withArrow = true, pill }: { value: number | null | undefined; variant?: 'label' | 'body' | 'bodyStrong' | 'caption' | 'heading'; withArrow?: boolean; pill?: boolean }) {
  const { c } = useTheme();
  const v = value ?? null;
  const col = v === null || v === 0 ? c.textSecondary : v > 0 ? c.up : c.down;
  const arrow = v === null || v === 0 || !withArrow ? '' : v > 0 ? '▲ ' : '▼ ';
  const txt = (
    <Text variant={variant} color={col} numeric accessibilityLabel={a11yChange(v)}>
      {arrow}
      {formatPct(v)}
    </Text>
  );
  if (!pill) return txt;
  return <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: v === null || v === 0 ? c.surfaceAlt : v > 0 ? c.upSoft : c.downSoft }}>{txt}</View>;
}

/** Minimal sparkline (SVG). Colour follows the period's direction. */
export function Sparkline({ values, width = 84, height = 32, strokeWidth = 1.6, fill = true }: { values: number[]; width?: number; height?: number; strokeWidth?: number; fill?: boolean }) {
  const { c } = useTheme();
  const { d, area, up } = useMemo(() => {
    const v = values.filter((x) => Number.isFinite(x));
    if (v.length < 2) return { d: '', area: '', up: true };
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = max - min || 1;
    const pts = v.map((y, i) => [(i / (v.length - 1)) * width, height - 2 - ((y - min) / span) * (height - 4)]);
    const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { d: path, area: `${path} L${width},${height} L0,${height} Z`, up: v[v.length - 1] >= v[0] };
  }, [values, width, height]);
  if (!d) return <View style={{ width, height }} />;
  const col = up ? c.up : c.down;
  const gid = `g${up ? 'u' : 'd'}${width}`;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={col} stopOpacity={0.25} />
          <Stop offset="1" stopColor={col} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {fill && <Path d={area} fill={`url(#${gid})`} />}
      <Path d={d} stroke={col} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: c.surfaceAlt, borderRadius: RADIUS.md, padding: SPACE.md, gap: 4, borderWidth: 1, borderColor: c.border }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="heading" numeric tone={tone}>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" tone="muted">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function AssetAvatar({ instrument, size = 38 }: { instrument: Pick<Instrument, 'symbol' | 'assetClass' | 'isSimulated'>; size?: number }) {
  const { c } = useTheme();
  const hue = [...instrument.symbol].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  const icon = instrument.assetClass === 'crypto' ? 'logo-bitcoin' : instrument.assetClass === 'index' ? 'stats-chart' : instrument.assetClass === 'etf' ? 'layers' : null;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: `hsla(${hue},55%,52%,0.16)`, borderWidth: 1, borderColor: `hsla(${hue},55%,60%,0.35)`, alignItems: 'center', justifyContent: 'center' }}>
      {icon ? (
        <Icon name={icon} size={size * 0.46} color={`hsl(${hue},70%,68%)`} />
      ) : (
        <Text variant="label" color={`hsl(${hue},70%,${c.scheme === 'light' ? 38 : 72}%)`}>
          {instrument.symbol.replace('.SIM', '').slice(0, 3)}
        </Text>
      )}
    </View>
  );
}

export function InstrumentRow({
  instrument,
  price,
  changePct,
  spark,
  status,
  right,
  onPress,
}: {
  instrument: Instrument;
  price?: number | null;
  changePct?: number | null;
  spark?: number[];
  status?: DataStatus;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${instrument.name}, ${instrument.symbol}${price != null ? `, price ${formatPrice(price)}` : ''}, ${a11yChange(changePct)}${status ? `, ${status} data` : ''}`}
      onPress={() => {
        tap('select');
        (onPress ?? (() => router.push(`/asset/${encodeURIComponent(instrument.symbol)}`)))();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, opacity: pressed ? 0.7 : 1, minHeight: 56 })}
    >
      <AssetAvatar instrument={instrument} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {instrument.name.replace(' (Simulated)', '')}
        </Text>
        <Row gap={6}>
          <Text variant="caption" tone="muted">
            {instrument.symbol}
          </Text>
          {status && <DataStatusBadge status={status} compact />}
        </Row>
      </View>
      {spark && spark.length > 1 ? <Sparkline values={spark} width={64} height={28} /> : null}
      {right ?? (
        <View style={{ alignItems: 'flex-end', minWidth: 84 }}>
          <Text variant="bodyStrong" numeric>
            {formatPrice(price)}
          </Text>
          <ChangeText value={changePct} variant="caption" />
        </View>
      )}
      {!right && <View style={{ width: 0, borderColor: c.border }} />}
    </Pressable>
  );
}

/** Confirmed / speculative / unverified label for news items. */
export function StatusPill({ status }: { status: 'confirmed' | 'speculative' | 'unverified' }) {
  const { c } = useTheme();
  const col = status === 'confirmed' ? c.up : status === 'speculative' ? c.warning : c.textMuted;
  return (
    <View accessible accessibilityLabel={`${status} news`} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: col + '66' }}>
      <Text variant="micro" color={col}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}
