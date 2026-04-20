import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SankofaEventLog, LogEntry } from '@/components/SankofaEventLog';
import { DEMO_CONFIG, DEMO_FLAGS } from '@/lib/sankofaDemo';
import {
  getMaintenanceEnabled,
  getSankofaSwitch,
  getThemeColors,
  useDemoConfig,
  useDemoFlags,
} from '@/lib/sankofaClient';

// ─── Sankofa SDK ─────────────────────────────────────────────────────────────
// useSankofaScreen tags this component's screen name in the native SDK.
// All subsequent track() calls will automatically carry "$screen_name": "Home".
let useSankofaScreen: (name: string) => void = () => {};
let Sankofa: { track: (e: string, p?: object) => void; flush: () => void; screen: (n: string) => void } = {
  track: () => {},
  flush: () => {},
  screen: () => {},
};
try {
  const sdk = require('sankofa-react-native');
  useSankofaScreen = sdk.useSankofaScreen;
  Sankofa = sdk.Sankofa;
} catch {}
// ─────────────────────────────────────────────────────────────────────────────

const GOLD = '#F5A623';
const SURFACE = '#1A1A2E';
const SURFACE2 = '#16213E';
const BORDER = '#2A2A3E';

interface QuickEvent {
  label: string;
  event: string;
  emoji: string;
  properties?: object;
}

const QUICK_EVENTS: QuickEvent[] = [
  { label: 'CTA Clicked',     event: 'cta_clicked',      emoji: '🚀' },
  { label: 'Add to Cart',     event: 'add_to_cart',      emoji: '🛒', properties: { item_id: 'SKU-001', price: 29.99 } },
  { label: 'View Product',    event: 'product_viewed',   emoji: '👀', properties: { product: 'Sankofa Pro' } },
  { label: 'Checkout Start',  event: 'checkout_started', emoji: '💳' },
  { label: 'Pay Clicked',     event: 'pay_clicked',      emoji: '💰', properties: { amount: 99.00, currency: 'USD' } },
  { label: 'Share',           event: 'share_clicked',    emoji: '📤', properties: { platform: 'Twitter' } },
  { label: 'Checkout Start2',  event: 'checkout_started-2', emoji: '💳' },
  { label: 'Pay Clicked2',     event: 'pay_clicked-2',      emoji: '💰', properties: { amount2: 199.00, currency2: 'GHS' } },
  { label: 'Share2',           event: 'share_clicked-2',    emoji: '📤', properties: { platform: 'WhatsApp' } },
];

function makeId() {
  return Math.random().toString(36).slice(2);
}

function timestamp() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

export default function HomeScreen() {
  // 🚀 One hook call. The native SDK is now aware this is the "Home" screen.
  useSankofaScreen('Home');

  const flags = useDemoFlags();
  const config = useDemoConfig();
  const theme = getThemeColors(config);
  const maintenance = getMaintenanceEnabled(config);
  const ctaVariant = flags[DEMO_FLAGS.CHECKOUT_CTA_VARIANT]?.variant ?? 'control';
  const ctaLabel =
    ctaVariant === 'blue' ? 'Try it free' :
    ctaVariant === 'red'  ? 'Upgrade now' :
    'Fire showcase event';
  const ctaBg =
    ctaVariant === 'blue' ? '#2563eb' :
    ctaVariant === 'red'  ? '#dc2626' :
    theme.primary;

  const [log, setLog] = useState<LogEntry[]>([]);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLog(prev => [...prev, { ...entry, id: makeId(), timestamp: timestamp() }]);
  }, []);

  const fireEvent = useCallback((q: QuickEvent) => {
    Sankofa.track(q.event, q.properties);
    addLog({
      type: 'track',
      label: q.event,
      detail: q.properties ? JSON.stringify(q.properties) : undefined,
    });
  }, [addLog]);

  const clearLog = useCallback(() => setLog([]), []);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header card ── */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.dot} />
          <Text style={styles.headerLabel}>LIVE SESSION</Text>
        </View>
        <Text style={styles.headerTitle}>Home Screen</Text>
        <Text style={styles.headerSub}>
          Screen tagged via{' '}
          <Text style={styles.code}>useSankofaScreen("Home")</Text>
        </Text>
      </View>

      {maintenance && (
        <View style={styles.maintenanceBanner}>
          <Text style={styles.maintenanceText}>
            ⚠️ Maintenance window active — see the Lab tab for details.
          </Text>
        </View>
      )}

      {/* Flag-driven CTA — variant changes label + colour */}
      <Pressable
        onPress={() => {
          // Reading the variant records an exposure row for experiment math.
          getSankofaSwitch()?.getVariant(DEMO_FLAGS.CHECKOUT_CTA_VARIANT, 'control');
          const payload = { variant: ctaVariant, config_support: config[DEMO_CONFIG.SUPPORT_URL]?.value };
          Sankofa.track('cta_showcase_pressed', payload);
          addLog({ type: 'track', label: 'cta_showcase_pressed', detail: JSON.stringify(payload) });
        }}
        style={[styles.flagCta, { backgroundColor: ctaBg }]}
      >
        <Text style={styles.flagCtaLabel}>{ctaLabel}</Text>
        <Text style={styles.flagCtaTag}>variant · {ctaVariant}</Text>
      </Pressable>

      {/* ── Quick event buttons ── */}
      <Text style={styles.sectionLabel}>FIRE EVENTS</Text>
      <View style={styles.grid}>
        {QUICK_EVENTS.map((q) => (
          <Pressable
            key={q.event}
            style={({ pressed }) => [styles.eventBtn, pressed && styles.eventBtnPressed]}
            onPress={() => fireEvent(q)}
          >
            <Text style={styles.eventEmoji}>{q.emoji}</Text>
            <Text style={styles.eventLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Log header ── */}
      <View style={styles.logHeader}>
        <Text style={styles.sectionLabel}>EVENT LOG</Text>
        {log.length > 0 && (
          <TouchableOpacity onPress={clearLog}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Live log ── */}
      <View style={styles.logBox}>
        <SankofaEventLog entries={log} />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  headerCard: {
    margin: 16,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#6B7280',
  },
  code: {
    fontFamily: 'SpaceMono',
    color: GOLD,
    fontSize: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A5A6E',
    letterSpacing: 1.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  eventBtn: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    alignItems: 'center',
    width: '30.5%',
    gap: 6,
  },
  eventBtnPressed: {
    backgroundColor: SURFACE2,
    borderColor: GOLD,
    transform: [{ scale: 0.96 }],
  },
  eventEmoji: { fontSize: 22 },
  eventLabel: {
    fontSize: 11,
    color: '#D1D5DB',
    textAlign: 'center',
    fontWeight: '600',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 16,
    marginBottom: 4,
  },
  clearBtn: {
    fontSize: 13,
    color: GOLD,
    fontWeight: '600',
  },
  logBox: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: SURFACE,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  maintenanceBanner: {
    marginHorizontal: 16,
    backgroundColor: '#f59e0b1f',
    borderColor: '#f59e0b',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  maintenanceText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  flagCta: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  flagCtaLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  flagCtaTag: { color: '#ffffffb3', fontSize: 10, marginTop: 4, letterSpacing: 1 },
});
