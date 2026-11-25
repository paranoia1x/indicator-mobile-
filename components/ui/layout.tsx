import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, RefreshControl, ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE } from '@/themes/tokens';
import { IconButton } from './controls';
import { Icon, Row, Text, type IconName } from './primitives';
import { OfflineBanner } from './feedback';

/** Max content width so tablet layouts stay readable. */
export const CONTENT_MAX = 980;

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  back,
  right,
  onRefresh,
  refreshing,
  contentStyle,
  ...rest
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  back?: boolean;
  right?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
} & Omit<ScrollViewProps, 'children'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <Row style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.md }} gap={SPACE.sm}>
      {back && <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      <View style={{ flex: 1 }}>
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Row>
  ) : null;
  const inner = <View style={[{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', paddingHorizontal: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.xxxl + insets.bottom }, contentStyle]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }}>{header}</View>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} /> : undefined}
          {...rest}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}

export function SectionHeader({ title, action, onAction, icon }: { title: string; action?: string; onAction?: () => void; icon?: IconName }) {
  return (
    <Row justify="space-between" style={{ marginBottom: -SPACE.xs }}>
      <Row gap={6}>
        {icon && <Icon name={icon} size={16} tone="secondary" />}
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
      </Row>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} hitSlop={10}>
          <Text variant="label" tone="accent">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

/** Bottom sheet built on Modal; respects reduced motion. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { c, reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(400)).current;
  useEffect(() => {
    if (visible) {
      if (reducedMotion) y.setValue(0);
      else Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    } else y.setValue(400);
  }, [visible, reducedMotion, y]);
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} />
      <Animated.View
        accessibilityViewIsModal
        style={{ transform: [{ translateY: y }], backgroundColor: c.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderWidth: 1, borderColor: c.border, maxHeight: '88%', paddingBottom: insets.bottom + SPACE.md, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      >
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong }} />
        </View>
        <Row justify="space-between" style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm }}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/** Two-column layout on tablets, single column on phones. */
export function Columns({ children, minColumnWidth = 380 }: { children: React.ReactNode; minColumnWidth?: number }) {
  const { width } = useTheme();
  const twoCol = Math.min(width, CONTENT_MAX) >= minColumnWidth * 2;
  const kids = React.Children.toArray(children);
  if (!twoCol) return <View style={{ gap: SPACE.lg }}>{kids}</View>;
  const left = kids.filter((_, i) => i % 2 === 0);
  const right = kids.filter((_, i) => i % 2 === 1);
  return (
    <Row align="flex-start" gap={SPACE.lg}>
      <View style={{ flex: 1, gap: SPACE.lg }}>{left}</View>
      <View style={{ flex: 1, gap: SPACE.lg }}>{right}</View>
    </Row>
  );
}

export function NavRow({ icon, label, description, onPress }: { icon: IconName; label: string; description?: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={description} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Row gap={SPACE.md} style={{ paddingVertical: SPACE.md }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} tone="accent" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{label}</Text>
          {description ? (
            <Text variant="caption" tone="secondary">
              {description}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-forward" size={18} tone="muted" />
      </Row>
    </Pressable>
  );
}
