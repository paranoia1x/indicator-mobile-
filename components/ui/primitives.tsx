import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text as RNText, View, type StyleProp, type TextProps, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE, TYPE, type TypeVariant } from '@/themes/tokens';

type Tone = 'default' | 'secondary' | 'muted' | 'accent' | 'up' | 'down' | 'warning' | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  color?: string;
  numeric?: boolean;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

/** Text that honours the in-app text-size setting and OS font scaling. */
export function Text({ variant = 'body', tone = 'default', color, numeric, align, style, ...rest }: AppTextProps) {
  const { c, textScale } = useTheme();
  const t = TYPE[variant];
  const toneColor: Record<Tone, string> = {
    default: c.text,
    secondary: c.textSecondary,
    muted: c.textMuted,
    accent: c.accent,
    up: c.up,
    down: c.down,
    warning: c.warning,
    onAccent: c.onAccent,
  };
  return (
    <RNText
      maxFontSizeMultiplier={1.8}
      {...rest}
      style={[
        { ...t, fontSize: t.fontSize * textScale, lineHeight: t.lineHeight * textScale, color: color ?? toneColor[tone], textAlign: align },
        numeric && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}

export function Card({ style, children, padded = true, tone = 'surface', ...rest }: ViewProps & { padded?: boolean; tone?: 'surface' | 'alt' | 'navy' }) {
  const { c } = useTheme();
  const bg = tone === 'navy' ? c.navy : tone === 'alt' ? c.surfaceAlt : c.surface;
  return (
    <View {...rest} style={[{ backgroundColor: bg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: padded ? SPACE.lg : 0 }, style]}>
      {children}
    </View>
  );
}

export function Row({ style, gap = SPACE.sm, align = 'center', justify, wrap, ...rest }: ViewProps & { gap?: number; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; wrap?: boolean }) {
  return <View {...rest} style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? 'wrap' : undefined }, style]} />;
}

export function Stack({ style, gap = SPACE.sm, ...rest }: ViewProps & { gap?: number }) {
  return <View {...rest} style={[{ gap }, style]} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color, tone = 'default' }: { name: IconName; size?: number; color?: string; tone?: Tone }) {
  const { c } = useTheme();
  const map: Record<Tone, string> = { default: c.text, secondary: c.textSecondary, muted: c.textMuted, accent: c.accent, up: c.up, down: c.down, warning: c.warning, onAccent: c.onAccent };
  return <Ionicons name={name} size={size} color={color ?? map[tone]} accessibilityElementsHidden importantForAccessibility="no" />;
}
