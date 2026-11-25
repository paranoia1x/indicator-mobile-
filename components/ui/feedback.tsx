import { useNetworkState } from 'expo-network';
import React, { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE } from '@/themes/tokens';
import { Button } from './controls';
import { Icon, Row, Text, type IconName } from './primitives';

/** Loading placeholder with a gentle pulse (static when reduced motion is on). */
export function Skeleton({ width = '100%', height = 16, radius = RADIUS.sm }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { c, reducedMotion } = useTheme();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [o, reducedMotion]);
  return <Animated.View accessibilityLabel="Loading" style={{ width, height, borderRadius: radius, backgroundColor: c.surfaceAlt, opacity: o }} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: SPACE.md }} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i} gap={SPACE.md}>
          <Skeleton width={38} height={38} radius={11} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={70} height={14} />
        </Row>
      ))}
    </View>
  );
}

export function EmptyState({ icon = 'albums-outline', title, message, action, onAction }: { icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.sm }}>
      <Icon name={icon} size={32} tone="muted" />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="secondary" align="center" style={{ maxWidth: 420 }}>
          {message}
        </Text>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} variant="secondary" small style={{ marginTop: SPACE.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  return <EmptyState icon="cloud-offline-outline" title="Data unavailable" message={msg} action={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
}

export function Callout({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warning' | 'simulated'; title?: string; children: React.ReactNode; icon?: IconName }) {
  const { c } = useTheme();
  const col = tone === 'warning' ? c.warning : tone === 'simulated' ? c.status.simulated : c.accent;
  return (
    <View accessible accessibilityRole="text" style={{ flexDirection: 'row', gap: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: col + '14', borderWidth: 1, borderColor: col + '40' }}>
      <Icon name={icon ?? (tone === 'warning' ? 'warning-outline' : tone === 'simulated' ? 'flask-outline' : 'information-circle-outline')} size={18} color={col} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text variant="bodyStrong" color={col}>
            {title}
          </Text>
        ) : null}
        {typeof children === 'string' ? (
          <Text variant="caption" tone="secondary">
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function useIsOffline(): boolean {
  const n = useNetworkState();
  return n.isConnected === false || n.isInternetReachable === false;
}

export function OfflineBanner() {
  const offline = useIsOffline();
  const { c } = useTheme();
  if (!offline) return null;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ marginHorizontal: SPACE.lg, marginBottom: SPACE.sm, padding: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: c.warning + '1F', borderWidth: 1, borderColor: c.warning + '55', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Icon name="cloud-offline-outline" size={16} color={c.warning} />
      <Text variant="caption" color={c.warning} style={{ flex: 1 }}>
        Offline — showing cached and simulated data only. Cached prices are labelled with their original time and are not current.
      </Text>
    </View>
  );
}

export function Disclaimer({ compact }: { compact?: boolean }) {
  return (
    <Text variant="caption" tone="muted" align="center" style={{ paddingHorizontal: SPACE.lg }}>
      {compact
        ? 'Educational use only. Not investment advice. Past performance does not predict future results.'
        : 'Indicator Mobile is an educational research tool. It does not provide investment advice, does not execute real trades, and cannot predict future prices. Historical and simulated results do not guarantee future performance.'}
    </Text>
  );
}
