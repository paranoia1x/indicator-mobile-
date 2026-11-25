import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap } from '@/services/haptics';
import { useTheme } from '@/themes/ThemeProvider';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'markets', title: 'Markets', icon: 'globe-outline', active: 'globe' },
  { name: 'charts', title: 'Charts', icon: 'stats-chart-outline', active: 'stats-chart' },
  { name: 'research', title: 'Research', icon: 'flask-outline', active: 'flask' },
  { name: 'assistant', title: 'AI Assistant', icon: 'sparkles-outline', active: 'sparkles' },
];

export default function TabsLayout() {
  const { c, textScale } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 58 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10.5 * Math.min(textScale, 1.15), fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}
      screenListeners={{ tabPress: () => tap('select') }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: `${t.title} tab`,
            tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? t.active : t.icon} size={size - 2} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
