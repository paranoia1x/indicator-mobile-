import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Network from 'expo-network';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, Icon, Stack as VStack, Text } from '@/components/ui';
import { useSettings } from '@/storage/stores';
import { ThemeProvider, useTheme } from '@/themes/ThemeProvider';
import { SPACE } from '@/themes/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 30 * 60_000, refetchOnReconnect: true, networkMode: 'offlineFirst' } },
});

// Pause network refetches when offline and when the app is in the background (battery).
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected !== false));
  return () => sub.remove();
});
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
  return () => sub.remove();
});

function useHydrated(): boolean {
  const [h, setH] = useState(useSettings.persist.hasHydrated());
  useEffect(() => {
    const unsub = useSettings.persist.onFinishHydration(() => setH(true));
    setH(useSettings.persist.hasHydrated());
    return unsub;
  }, []);
  return h;
}

function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const accepted = useSettings((s) => s.acceptedDisclaimerAt);
  const set = useSettings((s) => s.set);
  const { c } = useTheme();
  if (accepted) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: SPACE.xxl }}>
      <VStack gap={SPACE.lg} style={{ maxWidth: 560, alignSelf: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="analytics" size={28} tone="accent" />
        </View>
        <Text variant="display">Indicator</Text>
        <Text variant="body" tone="secondary">
          A research and education tool for understanding financial markets.
        </Text>
        <VStack gap={SPACE.sm}>
          {[
            ['school-outline', 'Educational only — not investment advice, and no personalised buy or sell recommendations.'],
            ['eye-outline', 'Read-only for real markets. No brokerage connections, deposits, or real trades — ever.'],
            ['flask-outline', 'Demo mode uses clearly labelled SIMULATED data. Every price shows whether it is live, delayed, historical, cached or simulated.'],
            ['trending-up-outline', 'Nobody can predict future prices. Historical and simulated results do not guarantee future performance.'],
          ].map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', gap: SPACE.md }}>
              <Icon name={icon as 'eye-outline'} size={20} tone="accent" />
              <Text variant="body" style={{ flex: 1 }}>
                {text}
              </Text>
            </View>
          ))}
        </VStack>
        <Button label="I understand" onPress={() => set({ acceptedDisclaimerAt: Date.now() })} />
      </VStack>
    </View>
  );
}

function BiometricGate({ children }: { children: React.ReactNode }) {
  const enabled = useSettings((s) => s.biometricLock);
  const [unlocked, setUnlocked] = useState(!enabled || Platform.OS === 'web');
  const { c } = useTheme();
  const authenticate = async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Indicator', disableDeviceFallback: false });
      if (r.success) setUnlocked(true);
    } catch {
      /* stay locked */
    }
  };
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return setUnlocked(true);
    authenticate();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, [enabled]);
  if (unlocked) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, padding: SPACE.xxl }}>
      <Icon name="lock-closed" size={40} tone="accent" />
      <Text variant="heading">Indicator is locked</Text>
      <Text variant="caption" tone="secondary" align="center">
        Biometric protection is enabled for your local data.
      </Text>
      <Button label="Unlock" icon="finger-print" onPress={authenticate} />
    </View>
  );
}

function Shell() {
  const { c } = useTheme();
  const hydrated = useHydrated();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
  }, [c.bg]);
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <>
      <StatusBar style={c.scheme === 'light' ? 'dark' : 'light'} />
      <BiometricGate>
        <DisclaimerGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chart-fullscreen" options={{ animation: 'fade', orientation: 'all' }} />
          </Stack>
        </DisclaimerGate>
      </BiometricGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Shell />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
