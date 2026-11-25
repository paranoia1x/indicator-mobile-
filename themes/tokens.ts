import type { DataStatus } from '@/market-data/core/types';

export interface Palette {
  scheme: 'dark' | 'light';
  bg: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  navy: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  up: string;
  down: string;
  upSoft: string;
  downSoft: string;
  warning: string;
  danger: string;
  overlay: string;
  chartGrid: string;
  status: Record<DataStatus, string>;
}

const statusDark: Record<DataStatus, string> = {
  live: '#34D399',
  delayed: '#FBBF24',
  historical: '#7AA7FF',
  cached: '#94A3B8',
  simulated: '#C4A1FF',
};
const statusLight: Record<DataStatus, string> = {
  live: '#047857',
  delayed: '#B45309',
  historical: '#1D4ED8',
  cached: '#475569',
  simulated: '#7C3AED',
};

export const PALETTES: Record<'oled' | 'dark' | 'light', Palette> = {
  oled: {
    scheme: 'dark',
    bg: '#000000',
    surface: '#0A0C10',
    surfaceAlt: '#0F131A',
    elevated: '#141923',
    navy: '#0B1730',
    border: '#1A2130',
    borderStrong: '#273044',
    text: '#F2F4F8',
    textSecondary: '#A3ACBC',
    textMuted: '#6E788A',
    accent: '#4C8DFF',
    accentSoft: 'rgba(76,141,255,0.14)',
    onAccent: '#FFFFFF',
    up: '#2BC48A',
    down: '#F2555A',
    upSoft: 'rgba(43,196,138,0.14)',
    downSoft: 'rgba(242,85,90,0.14)',
    warning: '#FBBF24',
    danger: '#F2555A',
    overlay: 'rgba(0,0,0,0.72)',
    chartGrid: 'rgba(255,255,255,0.05)',
    status: statusDark,
  },
  dark: {
    scheme: 'dark',
    bg: '#07090D',
    surface: '#0E1219',
    surfaceAlt: '#131923',
    elevated: '#19202C',
    navy: '#0E1C38',
    border: '#212A3A',
    borderStrong: '#2D3850',
    text: '#EEF1F6',
    textSecondary: '#A0AABB',
    textMuted: '#6D7789',
    accent: '#5B96FF',
    accentSoft: 'rgba(91,150,255,0.15)',
    onAccent: '#FFFFFF',
    up: '#2BC48A',
    down: '#F2555A',
    upSoft: 'rgba(43,196,138,0.15)',
    downSoft: 'rgba(242,85,90,0.15)',
    warning: '#FBBF24',
    danger: '#F2555A',
    overlay: 'rgba(0,0,0,0.65)',
    chartGrid: 'rgba(255,255,255,0.06)',
    status: statusDark,
  },
  light: {
    scheme: 'light',
    bg: '#F4F6FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F8',
    elevated: '#FFFFFF',
    navy: '#E7EEFB',
    border: '#DCE2EC',
    borderStrong: '#C5CEDC',
    text: '#0B1220',
    textSecondary: '#475467',
    textMuted: '#6B7588',
    accent: '#2563EB',
    accentSoft: 'rgba(37,99,235,0.10)',
    onAccent: '#FFFFFF',
    up: '#0F8A5F',
    down: '#D92D3A',
    upSoft: 'rgba(15,138,95,0.10)',
    downSoft: 'rgba(217,45,58,0.10)',
    warning: '#B45309',
    danger: '#D92D3A',
    overlay: 'rgba(15,23,42,0.45)',
    chartGrid: 'rgba(15,23,42,0.06)',
    status: statusLight,
  },
};

/** Okabe–Ito based colour-blind-safe up/down colours (blue / orange). */
export const COLORBLIND = {
  dark: { up: '#56B4E9', down: '#E69F00', upSoft: 'rgba(86,180,233,0.15)', downSoft: 'rgba(230,159,0,0.15)' },
  light: { up: '#0072B2', down: '#B86E00', upSoft: 'rgba(0,114,178,0.10)', downSoft: 'rgba(184,110,0,0.10)' },
};

export const SPACE = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const TYPE = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.3 },
  micro: { fontSize: 10.5, lineHeight: 13, fontWeight: '700' as const, letterSpacing: 0.6 },
  mono: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
};
export type TypeVariant = keyof typeof TYPE;
