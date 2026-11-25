import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Row, Text } from '@/components/ui';
import type { IndicatorConfig } from '@/indicators/registry';
import type { Candle, Timeframe } from '@/market-data/core/types';
import type { EconomicEvent } from '@/news/core/calendar';
import { formatPrice } from '@/services/format';
import { tap } from '@/services/haptics';
import { newId, type ChartType, type Drawing } from '@/storage/stores';
import { useTheme } from '@/themes/ThemeProvider';
import { SPACE } from '@/themes/tokens';
import { ChartView, type DrawMode } from './ChartView';
import type { ChartEvent } from './html';
import { buildChartPayload, type ChartColors } from './payload';

export function useChartColors(): ChartColors {
  const { c } = useTheme();
  return useMemo(
    () => ({ bg: c.bg === '#000000' ? '#000000' : c.surface, text: c.textSecondary, grid: c.chartGrid, border: c.border, up: c.up, down: c.down, accent: c.accent, muted: c.textMuted, crosshair: c.textMuted }),
    [c],
  );
}

export interface InteractiveChartProps {
  symbol: string;
  timeframe: Timeframe;
  candles: readonly Candle[];
  chartType: ChartType;
  logScale?: boolean;
  showVolume?: boolean;
  showStructure?: boolean;
  indicators?: IndicatorConfig[];
  events?: EconomicEvent[];
  drawings?: Drawing[];
  replayIndex?: number | null;
  height?: number;
  drawMode?: DrawMode;
  onDrawingCreated?: (d: Drawing) => void;
  onRequestNoteText?: (point: { time: number; price: number }) => void;
  watermark?: string | null;
  showLegend?: boolean;
  resetKey?: string;
}

const DRAW_COLOR = '#F5B544';

export function InteractiveChart(props: InteractiveChartProps) {
  const colors = useChartColors();
  const { c } = useTheme();
  const [legend, setLegend] = useState<{ time: number; open?: number; high?: number; low?: number; close?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ time: number; price: number } | null>(null);
  const intraday = !['1D', '1W', '1M'].includes(props.timeframe);

  const payload = useMemo(
    () =>
      props.candles.length
        ? buildChartPayload({
            viewKey: `${props.symbol}:${props.timeframe}:${props.resetKey ?? ''}`,
            candles: props.candles,
            chartType: props.chartType,
            logScale: !!props.logScale,
            intraday,
            showVolume: props.showVolume ?? true,
            showStructure: !!props.showStructure,
            indicators: props.indicators ?? [],
            events: props.events,
            drawings: props.drawings,
            colors,
            replayIndex: props.replayIndex,
            watermark: props.watermark,
          })
        : null,
    [props.candles, props.chartType, props.logScale, props.showVolume, props.showStructure, props.indicators, props.events, props.drawings, props.replayIndex, props.symbol, props.timeframe, props.watermark, props.resetKey, colors, intraday],
  );

  const { drawMode = 'none', onDrawingCreated, onRequestNoteText } = props;
  const onEvent = useCallback(
    (e: ChartEvent) => {
      if (e.type === 'crosshair') setLegend(e.data);
      else if (e.type === 'error') setError(e.message);
      else if (e.type === 'rendered') setError(null);
      else if (e.type === 'drawPoint' && onDrawingCreated) {
        tap('select');
        const pt = { time: e.time, price: e.price };
        if (drawMode === 'hline') onDrawingCreated({ id: newId('d'), kind: 'hline', price: pt.price, color: DRAW_COLOR });
        else if (drawMode === 'note') onRequestNoteText?.(pt);
        else if (drawMode === 'trend' || drawMode === 'fib') {
          if (!pending.current) pending.current = pt;
          else {
            const a = pending.current;
            pending.current = null;
            onDrawingCreated({ id: newId('d'), kind: drawMode, a, b: pt, color: drawMode === 'fib' ? '#A78BFA' : DRAW_COLOR });
          }
        }
      }
    },
    [drawMode, onDrawingCreated, onRequestNoteText],
  );

  const last = props.candles[Math.min(props.candles.length - 1, props.replayIndex ?? Infinity)];
  const shown = legend ?? (last ? { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close } : null);
  const a11y = last
    ? `${props.symbol} ${props.timeframe} ${props.chartType} chart. ${props.candles.length} bars. Latest close ${formatPrice(last.close)}. Use the data table below or the AI assistant for a text description.`
    : `${props.symbol} chart, no data`;

  return (
    <View style={{ height: props.height, flex: props.height ? undefined : 1 }}>
      {props.showLegend !== false && shown ? (
        <Row gap={SPACE.sm} wrap style={{ paddingHorizontal: SPACE.sm, paddingVertical: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {(['open', 'high', 'low', 'close'] as const).map((k) => (
            <Text key={k} variant="caption" tone="muted" numeric>
              {k[0].toUpperCase()} <Text variant="caption" numeric color={(shown.close ?? 0) >= (shown.open ?? 0) ? c.up : c.down}>{formatPrice(shown[k])}</Text>
            </Text>
          ))}
          <Text variant="caption" tone="muted">
            {new Date(shown.time * 1000).toISOString().slice(0, intraday ? 16 : 10).replace('T', ' ')}
            {intraday ? ' UTC' : ''}
          </Text>
        </Row>
      ) : null}
      {drawMode !== 'none' ? (
        <Text variant="caption" tone="accent" style={{ paddingHorizontal: SPACE.sm }}>
          {drawMode === 'hline' ? 'Tap the chart to place a horizontal line.' : drawMode === 'note' ? 'Tap the chart to place a note.' : `Tap two points on the chart to draw ${drawMode === 'fib' ? 'Fibonacci levels' : 'a trend line'}.`}
        </Text>
      ) : null}
      <ChartView payload={payload} mode={drawMode} onEvent={onEvent} accessibilityLabel={a11y} background={colors.bg} />
      {error ? (
        <Text variant="caption" tone="warning" style={{ padding: SPACE.sm }}>
          Chart error: {error}
        </Text>
      ) : null}
    </View>
  );
}
