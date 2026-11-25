import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { buildChartHtml, parseChartEvent } from './html';
import type { ChartViewProps } from './ChartView';

export type { DrawMode, ChartViewProps } from './ChartView';

/**
 * Web preview host (development / screenshots). Uses a sandboxed iframe (scripts only, opaque
 * origin) and accepts messages solely from that iframe's window.
 */
export function ChartView({ payload, mode = 'none', onEvent, style, accessibilityLabel, background }: ChartViewProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildChartHtml(background), [background]);

  const send = useCallback((msg: unknown) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const ev = parseChartEvent(e.data);
      if (!ev) return;
      if (ev.type === 'ready') setReady(true);
      onEvent?.(ev);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onEvent]);

  useEffect(() => {
    setReady(false);
  }, [html]);

  useEffect(() => {
    if (ready && payload) send({ type: 'render', payload });
  }, [ready, payload, send]);

  useEffect(() => {
    if (ready) send({ type: 'mode', mode });
  }, [ready, mode, send]);

  return (
    <View style={[{ flex: 1, backgroundColor: background }, style]} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {React.createElement('iframe', {
        ref: frame,
        srcDoc: html,
        sandbox: 'allow-scripts',
        title: accessibilityLabel,
        style: { border: 0, width: '100%', height: '100%', background, display: 'block' },
      })}
    </View>
  );
}
