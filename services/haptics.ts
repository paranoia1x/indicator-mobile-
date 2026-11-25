import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettings } from '@/storage/stores';

/** Subtle haptics, respecting the user's setting. No-ops on web. */
export function tap(kind: 'light' | 'select' | 'success' | 'warning' = 'light'): void {
  if (Platform.OS === 'web' || !useSettings.getState().haptics) return;
  const p =
    kind === 'select'
      ? Haptics.selectionAsync()
      : kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => undefined);
}
