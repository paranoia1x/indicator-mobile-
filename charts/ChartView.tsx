import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview/lib/WebView';
import { buildChartHtml, encodeHostMessage, parseChartEvent, type ChartEvent } from './html';
import type { ChartPayload } from './payload';

/** Imperative handle exposed by react-native-webview at runtime (its typings omit the ref). */
interface WebViewHandle {
  injectJavaScript(js: string): void;
  reload(): void;
}
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebViewHandle> }>;

export type DrawMode = 'none' | 'hline' | 'trend' | 'fib' | 'note';

export interface ChartViewProps {
  payload: ChartPayload | null;
  mode?: DrawMode;
  onEvent?: (e: ChartEvent) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  background: string;
}

/**
 * Native chart host. The WebView is locked down: no navigation, no file access, no network
 * (CSP connect-src 'none'), no multiple windows, no data detectors. Only validated JSON messages
 * cross the bridge.
 */
export function ChartView({ payload, mode = 'none', onEvent, style, accessibilityLabel, background }: ChartViewProps) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildChartHtml(background), [background]);

  const send = useCallback((msg: unknown) => {
    ref.current?.injectJavaScript(`window.__onHostMessage && window.__onHostMessage(${encodeHostMessage(msg)}); true;`);
  }, []);

  useEffect(() => {
    if (ready && payload) send({ type: 'render', payload });
  }, [ready, payload, send]);

  useEffect(() => {
    if (ready) send({ type: 'mode', mode });
  }, [ready, mode, send]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const ev = parseChartEvent(e.nativeEvent.data);
      if (!ev) return;
      if (ev.type === 'ready') setReady(true);
      onEvent?.(ev);
    },
    [onEvent],
  );

  return (
    <View style={[{ flex: 1, backgroundColor: background }, style]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <WebView
        ref={ref}
        source={{ html, baseUrl: 'about:blank' }}
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={(r: { url: string }) => r.url === 'about:blank' || r.url.startsWith('about:blank') || r.url.startsWith('data:')}
        onMessage={onMessage}
        onContentProcessDidTerminate={() => {
          setReady(false);
          ref.current?.reload();
        }}
        onRenderProcessGone={() => {
          setReady(false);
          ref.current?.reload();
        }}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        mixedContentMode="never"
        cacheEnabled={false}
        incognito
        dataDetectorTypes="none"
        textInteractionEnabled={false}
        geolocationEnabled={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: background }}
        containerStyle={{ backgroundColor: background }}
      />
    </View>
  );
}
