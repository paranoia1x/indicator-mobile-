import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Callout, Card, ChipScroller, Divider, Icon, IconButton, InstrumentRow, Row, Sheet, SkeletonRows, Stack, Stepper, SwitchRow, Text, TextField } from '@/components/ui';
import { useSearch } from '@/hooks/useMarketData';
import { INDICATOR_IDS, INDICATORS, indicatorLabel, type IndicatorConfig, type IndicatorId } from '@/indicators/registry';
import { normalizeSymbol } from '@/market-data/core/validate';
import { useActivity, useChartPrefs } from '@/storage/stores';
import { useTheme } from '@/themes/ThemeProvider';
import { RADIUS, SPACE } from '@/themes/tokens';

const SWATCHES = ['#4C8DFF', '#F5B544', '#A78BFA', '#2DD4BF', '#F472B6', '#94A3B8', '#22C55E', '#EF4444', '#FFFFFF'];

export function SymbolPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (symbol: string) => void }) {
  const [q, setQ] = useState('');
  const search = useSearch(q);
  const { recentSearches, searched } = useActivity();
  const typed = normalizeSymbol(q);
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose an instrument">
      <TextField icon="search" placeholder="Search name, symbol or sector" value={q} onChangeText={setQ} autoFocus returnKeyType="search" onSubmitEditing={() => searched(q)} />
      {!q && recentSearches.length ? (
        <ChipScroller options={recentSearches} value={'' as string} onChange={(v) => setQ(v)} />
      ) : null}
      {search.isLoading ? <SkeletonRows rows={4} /> : null}
      {search.data?.errors.map((e) => (
        <Text key={e} variant="caption" tone="warning">
          {e}
        </Text>
      ))}
      {(search.data?.results ?? []).slice(0, 40).map((i) => (
        <InstrumentRow
          key={i.symbol}
          instrument={i}
          right={<Icon name="chevron-forward" size={18} tone="muted" />}
          onPress={() => {
            searched(q);
            onPick(i.symbol);
            onClose();
          }}
        />
      ))}
      {typed && !(search.data?.results ?? []).some((r) => r.symbol === typed) ? (
        <Button label={`Open ${typed}`} variant="secondary" onPress={() => (onPick(typed), onClose())} accessibilityHint="Opens this symbol using your configured data sources" />
      ) : null}
    </Sheet>
  );
}

export function IndicatorInfoSheet({ id, onClose }: { id: IndicatorId | null; onClose: () => void }) {
  const m = id ? INDICATORS[id] : null;
  return (
    <Sheet visible={!!m} onClose={onClose} title={m?.name ?? ''}>
      {m ? (
        <Stack gap={SPACE.md}>
          <Text variant="body">{m.description}</Text>
          <Text variant="label" tone="muted">
            HOW IT IS COMMONLY READ
          </Text>
          <Text variant="body">{m.howToRead}</Text>
          <Text variant="label" tone="muted">
            WORKED EXAMPLE
          </Text>
          <Text variant="body">{m.example}</Text>
          <Text variant="label" tone="muted">
            HISTORICAL BEHAVIOUR
          </Text>
          <Text variant="body">{m.historicalBehavior}</Text>
          <Callout tone="warning" title="Known limitations">
            <Stack gap={4}>
              {m.limitations.map((l) => (
                <Text key={l} variant="caption" tone="secondary">
                  • {l}
                </Text>
              ))}
            </Stack>
          </Callout>
          <Text variant="caption" tone="muted">
            Indicators describe past prices. They are not predictions and do not tell you what to do.
          </Text>
        </Stack>
      ) : null}
    </Sheet>
  );
}

function IndicatorEditor({ cfg, onInfo }: { cfg: IndicatorConfig; onInfo: (id: IndicatorId) => void }) {
  const { updateIndicator, resetIndicator, removeIndicator } = useChartPrefs();
  const { c } = useTheme();
  const meta = INDICATORS[cfg.id];
  const [open, setOpen] = useState(false);
  return (
    <Card padded={false} style={{ padding: SPACE.md }}>
      <Row gap={SPACE.sm}>
        <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${indicatorLabel(cfg)} settings`} onPress={() => setOpen(!open)}>
          <Row gap={SPACE.sm}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.colors[meta.lines[0].key] }} />
            <Text variant="bodyStrong">{indicatorLabel(cfg)}</Text>
            <Text variant="caption" tone="muted">
              {meta.placement === 'overlay' ? 'overlay' : 'panel'}
            </Text>
          </Row>
        </Pressable>
        <IconButton icon="information-circle-outline" label={`About ${meta.name}`} onPress={() => onInfo(cfg.id)} />
        <IconButton icon={cfg.visible ? 'eye-outline' : 'eye-off-outline'} label={cfg.visible ? 'Hide' : 'Show'} onPress={() => updateIndicator(cfg.uid, { visible: !cfg.visible })} />
        <IconButton icon="trash-outline" label={`Remove ${meta.short}`} onPress={() => removeIndicator(cfg.uid)} />
      </Row>
      {open ? (
        <Stack gap={SPACE.xs} style={{ marginTop: SPACE.sm }}>
          {meta.params.map((p) => (
            <Stepper key={p.key} label={p.label} value={cfg.params[p.key]} min={p.min} max={p.max} step={p.step} onChange={(v) => updateIndicator(cfg.uid, { params: { [p.key]: v } })} />
          ))}
          {meta.lines.map((l) => (
            <View key={l.key} style={{ gap: 6, paddingVertical: 4 }}>
              <Text variant="caption" tone="secondary">
                {l.label} colour
              </Text>
              <Row gap={8} wrap>
                {SWATCHES.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={`Colour ${s}`}
                    accessibilityState={{ selected: cfg.colors[l.key] === s }}
                    onPress={() => updateIndicator(cfg.uid, { colors: { [l.key]: s } })}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: s, borderWidth: cfg.colors[l.key] === s ? 3 : 1, borderColor: cfg.colors[l.key] === s ? c.text : c.border }}
                  />
                ))}
              </Row>
            </View>
          ))}
          <Button label="Reset to defaults" small variant="ghost" icon="refresh" onPress={() => resetIndicator(cfg.uid)} style={{ alignSelf: 'flex-start' }} />
        </Stack>
      ) : null}
    </Card>
  );
}

export function IndicatorPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { indicators, addIndicator, resetAllIndicators } = useChartPrefs();
  const [info, setInfo] = useState<IndicatorId | null>(null);
  const { c } = useTheme();
  return (
    <>
      <Sheet visible={visible && !info} onClose={onClose} title="Indicators">
        <Text variant="caption" tone="secondary">
          Tap an indicator to adjust its settings and colours. Multiple indicators can be shown at once.
        </Text>
        {indicators.map((cfg) => (
          <IndicatorEditor key={cfg.uid} cfg={cfg} onInfo={setInfo} />
        ))}
        {indicators.length === 0 ? (
          <Text variant="caption" tone="muted">
            No indicators added.
          </Text>
        ) : null}
        <Divider />
        <Text variant="label" tone="muted">
          ADD INDICATOR
        </Text>
        <Row wrap gap={SPACE.sm}>
          {INDICATOR_IDS.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${INDICATORS[id].name}`}
              onPress={() => addIndicator(id)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }}
            >
              <Text variant="label">+ {INDICATORS[id].short}</Text>
            </Pressable>
          ))}
        </Row>
        <Button label="Reset all to default" variant="secondary" icon="refresh" onPress={resetAllIndicators} />
      </Sheet>
      <IndicatorInfoSheet id={info} onClose={() => setInfo(null)} />
    </>
  );
}

export type ReplaySpeed = 1 | 2 | 4 | 8;

/** Timer-driven historical replay. Advances one bar per tick while playing. */
export function useReplay(total: number, onTick?: () => void) {
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(2);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || index === null) return;
    timer.current = setInterval(() => {
      setIndex((i) => {
        if (i === null) return i;
        if (i >= total - 1) {
          setPlaying(false);
          return i;
        }
        onTick?.();
        return i + 1;
      });
    }, 900 / speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, total, index === null, onTick]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    index,
    playing,
    speed,
    start: (from: number) => {
      setIndex(Math.max(30, Math.min(total - 1, from)));
      setPlaying(false);
    },
    stop: () => {
      setPlaying(false);
      setIndex(null);
    },
    toggle: () => setPlaying((p) => !p),
    step: (n: number) => setIndex((i) => (i === null ? i : Math.max(30, Math.min(total - 1, i + n)))),
    setSpeed,
  };
}

export function ReplayBar({ r, total, timeLabel }: { r: ReturnType<typeof useReplay>; total: number; timeLabel: string }) {
  const { c } = useTheme();
  if (r.index === null) return null;
  const pct = total > 1 ? r.index / (total - 1) : 0;
  return (
    <Card padded={false} style={{ padding: SPACE.sm, gap: SPACE.xs }}>
      <Row justify="space-between">
        <Text variant="label" tone="accent">
          HISTORICAL REPLAY
        </Text>
        <Text variant="caption" tone="muted" numeric>
          {timeLabel} · bar {r.index + 1}/{total}
        </Text>
      </Row>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surfaceAlt }}>
        <View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: c.accent }} />
      </View>
      <Row justify="space-between">
        <Row gap={0}>
          <IconButton icon="play-skip-back" label="Back 10 bars" onPress={() => r.step(-10)} />
          <IconButton icon="play-back" label="Back 1 bar" onPress={() => r.step(-1)} />
          <IconButton icon={r.playing ? 'pause' : 'play'} label={r.playing ? 'Pause' : 'Play'} onPress={r.toggle} active />
          <IconButton icon="play-forward" label="Forward 1 bar" onPress={() => r.step(1)} />
          <IconButton icon="play-skip-forward" label="Forward 10 bars" onPress={() => r.step(10)} />
        </Row>
        <Row gap={4}>
          {([1, 2, 4, 8] as const).map((s) => (
            <Pressable key={s} accessibilityRole="button" accessibilityLabel={`Speed ${s}x`} accessibilityState={{ selected: r.speed === s }} onPress={() => r.setSpeed(s)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: r.speed === s ? c.accentSoft : 'transparent' }}>
              <Text variant="label" color={r.speed === s ? c.accent : c.textMuted}>
                {s}×
              </Text>
            </Pressable>
          ))}
          <IconButton icon="close" label="Exit replay" onPress={r.stop} />
        </Row>
      </Row>
      <Text variant="caption" tone="muted">
        Only bars up to the replay point are shown, and swing points appear only once they were confirmed.
      </Text>
    </Card>
  );
}

export function NotePrompt({ visible, onCancel, onSave }: { visible: boolean; onCancel: () => void; onSave: (text: string) => void }) {
  const [t, setT] = useState('');
  return (
    <Sheet visible={visible} onClose={onCancel} title="Add chart note">
      <TextField placeholder="Note text (max 24 characters on chart)" value={t} onChangeText={setT} maxLength={120} autoFocus />
      <Row gap={SPACE.sm}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          label="Save"
          onPress={() => {
            if (t.trim()) onSave(t.trim());
            setT('');
          }}
          style={{ flex: 1 }}
        />
      </Row>
    </Sheet>
  );
}

export function ChartSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const p = useChartPrefs();
  return (
    <Sheet visible={visible} onClose={onClose} title="Chart settings">
      <SwitchRow label="Volume" value={p.showVolume} onChange={(v) => p.set({ showVolume: v })} />
      <SwitchRow label="Logarithmic price scale" description="Equal percentage moves take equal vertical space." value={p.logScale} onChange={(v) => p.set({ logScale: v })} />
      <SwitchRow label="Historical market structure" description="Confirmed swing highs/lows (HH, HL, LH, LL), breakouts, structure breaks and prior support/resistance." value={p.showStructure} onChange={(v) => p.set({ showStructure: v })} />
      <SwitchRow label="Event markers" description="Earnings and economic releases on the time axis." value={p.showEvents} onChange={(v) => p.set({ showEvents: v })} />
    </Sheet>
  );
}
