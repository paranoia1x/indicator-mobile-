import React from 'react';
import { Pressable, ScrollView, Switch, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { tap } from '@/services/haptics';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE } from '@/themes/tokens';
import { Icon, Row, Text, type IconName } from './primitives';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
  const bg = { primary: c.accent, secondary: c.surfaceAlt, ghost: 'transparent', danger: c.downSoft }[variant];
  const fg = { primary: c.onAccent, secondary: c.text, ghost: c.accent, danger: c.down }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: RADIUS.md,
          paddingVertical: small ? 8 : 12,
          paddingHorizontal: small ? 12 : 16,
          minHeight: 44,
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.border,
        },
        style,
      ]}
    >
      <Row gap={SPACE.xs + 2} justify="center">
        {icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}
        <Text variant={small ? 'label' : 'bodyStrong'} color={fg}>
          {label}
        </Text>
      </Row>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, active, size = 20, ...rest }: { icon: IconName; label: string; onPress: () => void; active?: boolean; size?: number } & Omit<PressableProps, 'onPress'>) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.accentSoft : pressed ? c.surfaceAlt : 'transparent' })}
      {...rest}
    >
      <Icon name={icon} size={size} color={active ? c.accent : c.textSecondary} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={{ paddingHorizontal: 12, paddingVertical: 7, minHeight: 34, borderRadius: RADIUS.pill, backgroundColor: selected ? c.accentSoft : c.surfaceAlt, borderWidth: 1, borderColor: selected ? c.accent : c.border, justifyContent: 'center' }}
    >
      <Row gap={4}>
        {icon && <Icon name={icon} size={14} color={selected ? c.accent : c.textSecondary} />}
        <Text variant="label" color={selected ? c.accent : c.textSecondary}>
          {label}
        </Text>
      </Row>
    </Pressable>
  );
}

export function ChipScroller<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.xs + 2, paddingVertical: 2 }}>
      {options.map((o) => (
        <Chip key={o} label={labels?.[o] ?? o} selected={o === value} onPress={() => onChange(o)} />
      ))}
    </ScrollView>
  );
}

export function Segmented<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: RADIUS.md, padding: 3, borderWidth: 1, borderColor: c.border }}>
      {options.map((o) => {
        const sel = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            onPress={() => {
              tap('select');
              onChange(o);
            }}
            style={{ flex: 1, paddingVertical: 8, minHeight: 36, borderRadius: RADIUS.sm, backgroundColor: sel ? c.elevated : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="label" color={sel ? c.text : c.textSecondary} numberOfLines={1}>
              {labels?.[o] ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, description, value, onChange, disabled }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Row gap={SPACE.md} style={{ paddingVertical: SPACE.sm, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          tap('select');
          onChange(v);
        }}
        trackColor={{ true: c.accent, false: c.borderStrong }}
        thumbColor="#FFFFFF"
      />
    </Row>
  );
}

export function Stepper({ label, value, onChange, min, max, step = 1, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  const { c } = useTheme();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const shown = format ? format(value) : step < 1 ? value.toFixed(String(step).split('.')[1]?.length ?? 1) : String(value);
  return (
    <Row gap={SPACE.sm} style={{ paddingVertical: 4 }} accessible accessibilityRole="adjustable" accessibilityLabel={`${label}: ${shown}`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(clamp(value - step))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="remove" size={18} />
      </Pressable>
      <Text variant="mono" numeric style={{ minWidth: 56, textAlign: 'center' }}>
        {shown}
      </Text>
      <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => onChange(clamp(value + step))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="add" size={18} />
      </Pressable>
    </Row>
  );
}

export function TextField(props: TextInputProps & { label?: string; icon?: IconName }) {
  const { c, textScale } = useTheme();
  const { label, icon, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      ) : null}
      <Row gap={SPACE.sm} style={{ backgroundColor: c.surfaceAlt, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: SPACE.md, minHeight: 46 }}>
        {icon && <Icon name={icon} size={18} tone="muted" />}
        <TextInput
          placeholderTextColor={c.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={label ?? rest.placeholder}
          {...rest}
          style={[{ flex: 1, color: c.text, fontSize: 15 * textScale, paddingVertical: 10 }, style]}
        />
      </Row>
    </View>
  );
}
