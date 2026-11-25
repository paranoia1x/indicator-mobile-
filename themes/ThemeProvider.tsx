import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme, useWindowDimensions } from 'react-native';
import { useSettings } from '@/storage/stores';
import { COLORBLIND, PALETTES, type Palette } from './tokens';

export interface Theme {
  c: Palette;
  mode: 'oled' | 'dark' | 'light';
  textScale: number;
  reducedMotion: boolean;
  colorblind: boolean;
  haptics: boolean;
  isTablet: boolean;
  width: number;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { theme, textScale, colorblind, reducedMotion, haptics } = useSettings();
  const [osReduce, setOsReduce] = useState(false);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOsReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOsReduce);
    return () => sub.remove();
  }, []);

  const value = useMemo<Theme>(() => {
    const mode = theme === 'system' ? (system === 'light' ? 'light' : 'oled') : theme;
    const base = PALETTES[mode];
    const c = colorblind ? { ...base, ...(base.scheme === 'light' ? COLORBLIND.light : COLORBLIND.dark) } : base;
    return {
      c,
      mode,
      textScale,
      colorblind,
      haptics,
      reducedMotion: reducedMotion === 'on' || (reducedMotion === 'system' && osReduce),
      isTablet: Math.min(width, height) >= 600,
      width,
    };
  }, [theme, system, colorblind, textScale, reducedMotion, osReduce, haptics, width, height]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
