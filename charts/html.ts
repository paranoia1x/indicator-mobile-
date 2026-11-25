import { LWC_BUNDLE } from './webview/generated/lwc-bundle';

/**
 * Self-contained chart document for the WebView / iframe.
 *
 * Security: strict Content-Security-Policy — no network (connect-src 'none'), no external
 * scripts/styles/images/frames; only the bundled Lightweight Charts library and this renderer run.
 * Messages are JSON, type-checked, and size-limited on both sides.
 */
const RENDERER = String.raw`
(function () {
  'use strict';
  var LC = window.LightweightCharts;
  var el = document.getElementById('chart');
  var chart = null, main = null, lastKey = null, mode = 'none';
  var lastCross = 0;

  function post(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }

  function styleOf(s) { return s === 'dashed' ? LC.LineStyle.Dashed : s === 'dotted' ? LC.LineStyle.Dotted : LC.LineStyle.Solid; }

  function fmt(p) {
    if (!isFinite(p)) return '';
    var a = Math.abs(p);
    return p.toLocaleString('en-US', { minimumFractionDigits: a >= 1 ? 2 : 4, maximumFractionDigits: a >= 1 ? 2 : a >= 0.01 ? 4 : 6 });
  }

  function render(p) {
    var range = null;
    if (chart && lastKey === p.viewKey && !p.resetView) {
      try { range = chart.timeScale().getVisibleLogicalRange(); } catch (e) {}
    }
    if (chart) { chart.remove(); chart = null; }
    var c = p.colors;
    document.body.style.background = c.bg;
    chart = LC.createChart(el, {
      autoSize: true,
      layout: {
        background: { type: 'solid', color: c.bg },
        textColor: c.text,
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        attributionLogo: true,
        panes: { separatorColor: c.border, separatorHoverColor: c.grid, enableResize: true }
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border, mode: p.logScale ? LC.PriceScaleMode.Logarithmic : LC.PriceScaleMode.Normal, scaleMargins: { top: 0.08, bottom: p.volume ? 0.22 : 0.08 } },
      timeScale: { borderColor: c.border, timeVisible: p.timeVisible, secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 0.5 },
      crosshair: { mode: LC.CrosshairMode.Normal, vertLine: { color: c.crosshair, labelBackgroundColor: c.border }, horzLine: { color: c.crosshair, labelBackgroundColor: c.border } },
      handleScale: { pinch: true, mouseWheel: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
      handleScroll: { horzTouchDrag: true, vertTouchDrag: false, mouseWheel: true, pressedMouseMove: true },
      localization: { priceFormatter: fmt },
      kineticScroll: { touch: true, mouse: false }
    });

    var candles = p.candles;
    if (p.chartType === 'line' || p.chartType === 'area') {
      var pts = candles.map(function (b) { return { time: b.time, value: b.close }; });
      main = p.chartType === 'line'
        ? chart.addSeries(LC.LineSeries, { color: c.accent, lineWidth: 2, priceLineColor: c.accent })
        : chart.addSeries(LC.AreaSeries, { lineColor: c.accent, topColor: c.accent + '55', bottomColor: c.accent + '05', lineWidth: 2 });
      main.setData(pts);
    } else {
      var def = p.chartType === 'ohlc' ? LC.BarSeries : LC.CandlestickSeries;
      var opts = p.chartType === 'ohlc'
        ? { upColor: c.up, downColor: c.down, thinBars: false }
        : { upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down };
      main = chart.addSeries(def, opts);
      main.setData(candles.map(function (b) { return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; }));
    }

    if (p.volume) {
      var vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(p.volume);
    }

    p.overlays.forEach(function (l) {
      var s = chart.addSeries(LC.LineSeries, { color: l.color, lineWidth: 1.5, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, title: '' });
      s.setData(l.data);
    });

    p.panes.forEach(function (pane, i) {
      var idx = i + 1;
      var first = null;
      pane.lines.forEach(function (l) {
        var s = l.kind === 'histogram'
          ? chart.addSeries(LC.HistogramSeries, { color: l.color, lastValueVisible: false, priceLineVisible: false }, idx)
          : chart.addSeries(LC.LineSeries, { color: l.color, lineWidth: 1.5, lastValueVisible: true, priceLineVisible: false, crosshairMarkerVisible: false }, idx);
        s.setData(l.data);
        if (!first) first = s;
      });
      if (first) pane.guides.forEach(function (g) {
        first.createPriceLine({ price: g, color: c.muted, lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false, title: '' });
      });
    });
    try {
      var all = chart.panes();
      var h = el.clientHeight || 400;
      var paneH = Math.max(70, Math.min(140, h * 0.2));
      for (var k = 1; k < all.length; k++) all[k].setHeight(paneH);
    } catch (e) {}

    p.segments.forEach(function (sg) {
      var s = chart.addSeries(LC.LineSeries, { color: sg.color, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
      s.setData([sg.a, sg.b]);
    });

    p.priceLines.forEach(function (pl) {
      main.createPriceLine({ price: pl.price, color: pl.color, lineWidth: 1, lineStyle: styleOf(pl.style), axisLabelVisible: true, title: pl.title });
    });

    if (p.markers.length) LC.createSeriesMarkers(main, p.markers);

    var wm = document.getElementById('wm');
    wm.textContent = p.watermark || '';
    wm.style.color = c.muted;

    if (range && candles.length) chart.timeScale().setVisibleLogicalRange(range);
    else if (candles.length > 160) chart.timeScale().setVisibleLogicalRange({ from: candles.length - 160, to: candles.length + 3 });
    else chart.timeScale().fitContent();
    lastKey = p.viewKey;

    chart.subscribeCrosshairMove(function (param) {
      var now = Date.now();
      if (now - lastCross < 40) return;
      lastCross = now;
      if (!param || param.time === undefined || !param.seriesData) { post({ type: 'crosshair', data: null }); return; }
      var d = param.seriesData.get(main);
      if (!d) { post({ type: 'crosshair', data: null }); return; }
      post({ type: 'crosshair', data: { time: param.time, open: d.open, high: d.high, low: d.low, close: d.close !== undefined ? d.close : d.value } });
    });

    chart.subscribeClick(function (param) {
      if (mode === 'none' || !param || !param.point || param.time === undefined) return;
      var price = main.coordinateToPrice(param.point.y);
      if (price === null || !isFinite(price)) return;
      post({ type: 'drawPoint', time: param.time, price: price });
    });
    post({ type: 'rendered', bars: candles.length });
  }

  function handle(raw) {
    var msg;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;
    try {
      if (msg.type === 'render' && msg.payload && Array.isArray(msg.payload.candles)) render(msg.payload);
      else if (msg.type === 'mode' && ['none', 'hline', 'trend', 'fib', 'note'].indexOf(msg.mode) >= 0) {
        mode = msg.mode;
        document.body.style.cursor = mode === 'none' ? 'default' : 'crosshair';
      } else if (msg.type === 'fit' && chart) chart.timeScale().fitContent();
    } catch (e) {
      post({ type: 'error', message: String(e && e.message || e).slice(0, 300) });
    }
  }

  window.__onHostMessage = handle;
  window.addEventListener('message', function (ev) { if (ev && typeof ev.data === 'string') handle(ev.data); });
  document.addEventListener('message', function (ev) { if (ev && typeof ev.data === 'string') handle(ev.data); });
  window.onerror = function (m) { post({ type: 'error', message: String(m).slice(0, 300) }); };
  post({ type: 'ready' });
})();
`;

export function buildChartHtml(bg: string): string {
  const safeBg = /^#[0-9a-fA-F]{3,8}$/.test(bg) ? bg : '#000000';
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'" />
<style>
html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden;background:${safeBg};-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none}
#chart{position:absolute;inset:0}
#wm{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font:700 22px -apple-system,Roboto,sans-serif;letter-spacing:3px;opacity:.12;pointer-events:none;white-space:nowrap;z-index:2}
</style>
</head><body>
<div id="chart"></div><div id="wm"></div>
<script>${LWC_BUNDLE}</script>
<script>${RENDERER}</script>
</body></html>`;
}

/** Messages the chart may send to the host. Anything else is ignored. */
export type ChartEvent =
  | { type: 'ready' }
  | { type: 'rendered'; bars: number }
  | { type: 'error'; message: string }
  | { type: 'crosshair'; data: { time: number; open?: number; high?: number; low?: number; close?: number } | null }
  | { type: 'drawPoint'; time: number; price: number };

export function parseChartEvent(raw: unknown): ChartEvent | null {
  if (typeof raw !== 'string' || raw.length > 20_000) return null;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  switch (m?.type) {
    case 'ready':
      return { type: 'ready' };
    case 'rendered':
      return { type: 'rendered', bars: Number(m.bars) || 0 };
    case 'error':
      return { type: 'error', message: String(m.message ?? '').slice(0, 300) };
    case 'crosshair': {
      const d = m.data as Record<string, unknown> | null;
      if (!d) return { type: 'crosshair', data: null };
      const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const time = n(d.time);
      return time === undefined ? { type: 'crosshair', data: null } : { type: 'crosshair', data: { time, open: n(d.open), high: n(d.high), low: n(d.low), close: n(d.close) } };
    }
    case 'drawPoint': {
      const time = Number(m.time);
      const price = Number(m.price);
      return Number.isFinite(time) && Number.isFinite(price) ? { type: 'drawPoint', time, price } : null;
    }
    default:
      return null;
  }
}

/** Serialises a host→chart message for injectJavaScript (escapes line separators). */
export function encodeHostMessage(msg: unknown): string {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(JSON.stringify(msg)).split(LS).join('\\u2028').split(PS).join('\\u2029');
}
