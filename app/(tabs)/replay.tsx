import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SankofaEventLog, LogEntry } from '@/components/SankofaEventLog';

// ─── Sankofa SDK ─────────────────────────────────────────────────────────────
let useSankofaScreen: (name: string) => void = () => {};
let Sankofa: { track: (e: string, p?: object) => void; flush: () => void } = {
  track: () => {},
  flush: () => {},
};
try {
  const sdk = require('sankofa-react-native');
  useSankofaScreen = sdk.useSankofaScreen;
  Sankofa = sdk.Sankofa;
} catch {}
// ─────────────────────────────────────────────────────────────────────────────

const GOLD = '#F5A623';
const SURFACE = '#1A1A2E';
const BORDER = '#2A2A3E';

function makeId() { return Math.random().toString(36).slice(2); }
function timestamp() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

type ScenarioKey = 'checkout_empty' | 'checkout_filling' | 'checkout_complete';

const SCENARIOS: { key: ScenarioKey; label: string; emoji: string; events: string[] }[] = [
  {
    key: 'checkout_empty',
    label: 'Checkout - Empty',
    emoji: '🛒',
    events: ['checkout_viewed', 'bag_empty_shown'],
  },
  {
    key: 'checkout_filling',
    label: 'Checkout - With Items',
    emoji: '📦',
    events: ['item_added', 'coupon_applied', 'checkout_viewed'],
  },
  {
    key: 'checkout_complete',
    label: 'Checkout - Complete',
    emoji: '✅',
    events: ['pay_clicked', 'payment_success', 'order_confirmed'],
  },
];

export default function ReplayScreen() {
  // Each scenario shows what it looks like when screen name changes dynamically
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('checkout_empty');
  const [log, setLog] = useState<LogEntry[]>([]);

  // ✨ The hook re-fires Sankofa.screen() whenever activeScenario changes
  useSankofaScreen(`Checkout - ${activeScenario.replace('checkout_', '').replace('_', ' ')}`);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLog(prev => [...prev, { ...entry, id: makeId(), timestamp: timestamp() }]);
  }, []);

  const selectScenario = (key: ScenarioKey) => {
    const scenario = SCENARIOS.find(s => s.key === key)!;
    setActiveScenario(key);
    addLog({
      type: 'screen',
      label: `screen("${scenario.label}")`,
      detail: 'Auto-fired by useSankofaScreen hook',
    });
  };

  const fireScenarioEvents = () => {
    const scenario = SCENARIOS.find(s => s.key === activeScenario)!;
    scenario.events.forEach((event, i) => {
      setTimeout(() => {
        Sankofa.track(event, { scenario: scenario.label });
        addLog({ type: 'track', label: event, detail: `screen_name: "${scenario.label}"` });
      }, i * 300);
    });
  };

  const flush = () => {
    Sankofa.flush();
    addLog({ type: 'track', label: 'flush() — force uploaded all queued events' });
  };

  const currentScenario = SCENARIOS.find(s => s.key === activeScenario)!;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.headerCard}>
          <Text style={styles.headerEmoji}>🎬</Text>
          <Text style={styles.headerTitle}>Replay & Heatmap Demo</Text>
          <Text style={styles.headerSub}>
            Switch scenarios to see how <Text style={styles.code}>useSankofaScreen</Text> keeps
            the native SDK screen-state in sync automatically.
          </Text>
        </View>

        {/* ── Scenario picker ── */}
        <Text style={styles.sectionLabel}>SWITCH SCREEN CONTEXT</Text>
        <View style={styles.scenarios}>
          {SCENARIOS.map((s) => {
            const active = s.key === activeScenario;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.scenarioBtn, active && styles.scenarioBtnActive]}
                onPress={() => selectScenario(s.key)}
              >
                <Text style={styles.scenarioEmoji}>{s.emoji}</Text>
                <Text style={[styles.scenarioLabel, active && styles.scenarioLabelActive]}>
                  {s.label}
                </Text>
                {active && <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Current context badge ── */}
        <View style={styles.contextBadge}>
          <Text style={styles.contextKey}>$screen_name</Text>
          <Text style={styles.contextValue}>"{currentScenario.label}"</Text>
        </View>

        {/* ── Actions ── */}
        <Text style={styles.sectionLabel}>ACTIONS</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={fireScenarioEvents}>
            <Text style={styles.primaryBtnText}>⚡  Fire Scenario Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={flush}>
            <Text style={styles.secondaryBtnText}>📤  Flush to Server</Text>
          </TouchableOpacity>
        </View>

        {/* ── How it works ── */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          <Text style={styles.howText}>
            Every time you switch scenario, <Text style={styles.code}>useSankofaScreen</Text> detects the
            new screen name via React's <Text style={styles.code}>useEffect([screenName])</Text> and
            calls <Text style={styles.code}>Sankofa.screen()</Text> on the native SDK.{'\n\n'}
            All subsequent events fired — whether by JS or native touches — carry the correct
            <Text style={styles.code}> $screen_name</Text>, making heatmap overlays pixel-perfect.
          </Text>
        </View>

        {/* ── Live log ── */}
        <Text style={styles.sectionLabel}>EVENT LOG</Text>
        <View style={styles.logBox}>
          <SankofaEventLog entries={log} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F14' },
  scroll: { padding: 16, gap: 16 },
  headerCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    gap: 6,
  },
  headerEmoji: { fontSize: 36, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18 },
  code: { fontFamily: 'SpaceMono', color: GOLD, fontSize: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A5A6E',
    letterSpacing: 1.5,
  },
  scenarios: { gap: 10 },
  scenarioBtn: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scenarioBtnActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  scenarioEmoji: { fontSize: 24, width: 32 },
  scenarioLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', flex: 1 },
  scenarioLabelActive: { color: '#FFFFFF' },
  activePill: {
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activePillText: { fontSize: 10, fontWeight: '800', color: '#0F0F14' },
  contextBadge: {
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contextKey: { fontSize: 12, color: '#9CA3AF', fontFamily: 'SpaceMono' },
  contextValue: { fontSize: 14, color: GOLD, fontWeight: '700', fontFamily: 'SpaceMono', flex: 1 },
  actions: { gap: 10 },
  primaryBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#0F0F14' },
  secondaryBtn: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: '#E5E7EB' },
  howCard: {
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    gap: 8,
  },
  howTitle: { fontSize: 14, fontWeight: '700', color: '#60A5FA' },
  howText: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  logBox: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 200,
    overflow: 'hidden',
  },
});
