import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSankofaCatch } from '@/lib/sankofaClient';

// Screen-tagging hook — tolerated if missing (Expo Go without native module).
let useSankofaScreen: (name: string) => void = () => {};
try {
  useSankofaScreen = require('sankofa-react-native').useSankofaScreen;
} catch {}

// ── Theme — matches the rest of the example ──────────────────────────
const GOLD = '#F5A623';
const SURFACE = '#1A1A2E';
const SURFACE2 = '#16213E';
const BORDER = '#2A2A3E';
const DANGER = '#F87171';
const WARN = '#FBBF24';
const MUTED = '#6B7280';

// ── Custom business error — demo of typed, fingerprinted errors ──────
class CheckoutValidationError extends Error {
  readonly code: string;
  readonly field: string;
  constructor(message: string, code: string, field: string) {
    super(message);
    this.name = 'CheckoutValidationError';
    this.code = code;
    this.field = field;
  }
}

// ── Scenario definitions ─────────────────────────────────────────────
// Each scenario is a self-contained handler that throws / captures in a
// realistic way. The handler returns a short status string the UI shows
// in the footer ticker so the tester can confirm a dispatch happened.

interface Scenario {
  id: string;
  title: string;
  description: string;
  tone: 'danger' | 'warn' | 'info';
  run: () => Promise<void> | void;
}

function buildScenarios(): Scenario[] {
  return [
    {
      id: 'type-error',
      title: 'TypeError — null property access',
      description:
        'Reads `upstream.user.name` on an empty object. Caught by the global ErrorUtils hook.',
      tone: 'danger',
      run: () => {
        const upstream: any = {};
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        upstream.user.name;
      },
    },
    {
      id: 'reference-error',
      title: 'ReferenceError — undeclared identifier',
      description:
        'References `missingGlobal` which is not defined anywhere. Unhandled exception path.',
      tone: 'danger',
      run: () => {
        // @ts-expect-error — intentional undeclared identifier
        return missingGlobal.value;
      },
    },
    {
      id: 'unhandled-rejection',
      title: 'Unhandled promise rejection',
      description:
        'Fires a fetch() to an invalid host without awaiting. Caught by the RN rejection polyfill.',
      tone: 'danger',
      run: () => {
        // Deliberately not awaited — the rejection-tracking polyfill
        // routes this through SankofaCatch.
        void fetch('https://this-host-does-not-exist.sankofa.invalid/boom')
          .then((r) => r.json());
      },
    },
    {
      id: 'fetch-error',
      title: 'Native fetch error — captured with context',
      description:
        'Manual try/catch around fetch(); captureException with URL + method + status tags.',
      tone: 'warn',
      run: async () => {
        const catcher = getSankofaCatch();
        const url = 'https://this-host-does-not-exist.sankofa.invalid/api/orders';
        const method = 'POST';
        try {
          const res = await fetch(url, { method, body: JSON.stringify({ id: 'ord_1' }) });
          if (!res.ok) throw new Error(`Upstream ${res.status}`);
        } catch (err) {
          catcher?.captureException(err, {
            tags: { surface: 'crash-gallery', scenario: 'fetch-error', http_method: method },
            extra: { url, attempted_at: new Date().toISOString() },
            fingerprint: ['fetch-error', url],
          });
        }
      },
    },
    {
      id: 'json-parse',
      title: 'JSON.parse on HTML — SyntaxError',
      description:
        'Server returned a login redirect HTML page where JSON was expected.',
      tone: 'warn',
      run: () => {
        const catcher = getSankofaCatch();
        const payload =
          '<!doctype html><html><body>Session expired — please sign in</body></html>';
        try {
          JSON.parse(payload);
        } catch (err) {
          catcher?.captureException(err, {
            tags: { surface: 'crash-gallery', scenario: 'json-parse' },
            extra: { payload_preview: payload.slice(0, 80), payload_length: payload.length },
          });
        }
      },
    },
    {
      id: 'stack-overflow',
      title: 'RangeError — stack overflow',
      description:
        'Infinite recursion to trigger a native RangeError. Classic symptom of a bad reducer.',
      tone: 'danger',
      run: () => {
        function recurse(n: number): number {
          return recurse(n + 1);
        }
        recurse(0);
      },
    },
    {
      id: 'checkout-validation',
      title: 'CheckoutValidationError — custom business error',
      description:
        'Typed error with code + field, captured with fingerprint + tags + extra.',
      tone: 'warn',
      run: () => {
        const catcher = getSankofaCatch();
        try {
          throw new CheckoutValidationError(
            'Card expiry is in the past',
            'E_CARD_EXPIRED',
            'card.expiry',
          );
        } catch (err) {
          const e = err as CheckoutValidationError;
          catcher?.captureException(e, {
            level: 'error',
            tags: {
              surface: 'crash-gallery',
              scenario: 'checkout-validation',
              error_code: e.code,
              field: e.field,
            },
            extra: {
              cart_id: 'cart_8817',
              currency: 'USD',
              subtotal: 149.0,
              payment_method: 'card',
            },
            fingerprint: ['checkout-validation', e.code],
          });
        }
      },
    },
    {
      id: 'settimeout-throw',
      title: 'setTimeout throw — async timer escape',
      description:
        'Throws from inside a timer callback so there is no request scope. Global handler catches it.',
      tone: 'danger',
      run: () => {
        setTimeout(() => {
          throw new Error('Background sync failed: token refresh timed out');
        }, 0);
      },
    },
    {
      id: 'storage-failure',
      title: 'AsyncStorage-style failure',
      description:
        'Simulates a native storage write failure; try/catch + captureException with storage context.',
      tone: 'warn',
      run: () => {
        const catcher = getSankofaCatch();
        const simulateStorageWrite = (key: string, _value: string) => {
          // Simulate a quota/native-bridge failure.
          const err = new Error('[AsyncStorage] Failed to persist key: quota exceeded');
          (err as any).code = 'E_STORAGE_QUOTA';
          (err as any).key = key;
          throw err;
        };
        try {
          simulateStorageWrite('@sankofa/session', JSON.stringify({ big: 'x'.repeat(4096) }));
        } catch (err) {
          catcher?.captureException(err, {
            tags: { surface: 'crash-gallery', scenario: 'storage-failure', storage: 'async-storage' },
            extra: {
              key: (err as any).key,
              code: (err as any).code,
              approx_payload_bytes: 4096,
            },
          });
        }
      },
    },
    {
      id: 'breadcrumb-trail',
      title: 'Manual breadcrumb trail + captured throw',
      description:
        'Seeds three breadcrumbs (nav → network → ui), then throws. The capture carries the full trail.',
      tone: 'info',
      run: () => {
        const catcher = getSankofaCatch();
        if (!catcher) return;
        catcher.addBreadcrumb({
          type: 'navigation',
          category: 'nav',
          message: 'User navigated to /checkout/review',
          level: 'info',
          data: { from: '/cart', to: '/checkout/review' },
        });
        catcher.addBreadcrumb({
          type: 'http',
          category: 'fetch',
          message: 'GET /api/cart — 200 OK',
          level: 'info',
          data: { method: 'GET', url: '/api/cart', status: 200, duration_ms: 184 },
        });
        catcher.addBreadcrumb({
          type: 'ui',
          category: 'press',
          message: 'Tap: Place Order',
          level: 'info',
          data: { component: 'CheckoutReviewScreen.PlaceOrderButton' },
        });
        try {
          throw new Error('Place Order handler crashed: cart is empty after breadcrumb trail');
        } catch (err) {
          catcher.captureException(err, {
            tags: { surface: 'crash-gallery', scenario: 'breadcrumb-trail' },
          });
        }
      },
    },
    {
      id: 'capture-message',
      title: 'captureMessage — warning signal',
      description:
        'Non-error signal: rate limit nearing. Uses captureMessage with level=warning.',
      tone: 'info',
      run: () => {
        const catcher = getSankofaCatch();
        catcher?.captureMessage(
          'Rate limit nearing threshold (87% of 1000 req/min)',
          {
            level: 'warning',
            tags: { surface: 'crash-gallery', scenario: 'capture-message', subsystem: 'api-client' },
            extra: { used: 874, limit: 1000, window_seconds: 60 },
          },
        );
      },
    },
    {
      id: 'native-module',
      title: 'Native module error — missing method',
      description:
        'Calls a non-existent method on a fake NativeModule. Common symptom of bridge drift.',
      tone: 'danger',
      run: () => {
        const catcher = getSankofaCatch();
        try {
          const fake = { multiply: undefined as undefined | ((a: number, b: number) => number) };
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          fake.multiply!(2, 3);
        } catch (err) {
          catcher?.captureException(err, {
            tags: {
              surface: 'crash-gallery',
              scenario: 'native-module',
              module: 'FakeCryptoModule',
              method: 'multiply',
            },
            extra: {
              hint: 'Likely a mismatch between JS bundle and the installed native .app/.apk.',
            },
          });
        }
      },
    },
  ];
}

// ── Screen ───────────────────────────────────────────────────────────

type TickerState =
  | { kind: 'idle' }
  | { kind: 'triggering'; scenario: string }
  | { kind: 'dispatched'; scenario: string };

export default function CrashesScreen() {
  useSankofaScreen('Crashes');

  const scenarios = useMemo(buildScenarios, []);
  const [ticker, setTicker] = useState<TickerState>({ kind: 'idle' });

  // Seed sticky context on mount — user + screen tags live on every
  // event captured from this surface until setUser(null) is called.
  useEffect(() => {
    const catcher = getSankofaCatch();
    if (!catcher) return;
    catcher.setUser({
      id: 'usr_demo_42',
      email: 'demo@sankofa.dev',
      username: 'demo',
    });
    catcher.setTags({ surface: 'crash-gallery', build_flavor: 'example' });
    catcher.setExtra('crash_gallery_opened_at', new Date().toISOString());
  }, []);

  const handleRun = useCallback(async (s: Scenario) => {
    setTicker({ kind: 'triggering', scenario: s.title });
    try {
      await s.run();
    } catch (err) {
      // Synchronous scenarios that throw (type-error, reference-error,
      // stack-overflow) bubble up here because Pressable's onPress is
      // wrapped in RN's event path — the global ErrorUtils handler sees
      // them first on dev builds, but on release we still want a
      // captured event with the gallery context.
      const catcher = getSankofaCatch();
      catcher?.captureException(err, {
        tags: { surface: 'crash-gallery', scenario: s.id, bubbled: 'true' },
      });
    }
    // Small UI settle — show "Dispatched" on the next tick so the user
    // sees the state change even for instant scenarios.
    setTimeout(() => setTicker({ kind: 'dispatched', scenario: s.title }), 120);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.dot} />
            <Text style={styles.headerLabel}>CATCH · CRASH GALLERY</Text>
          </View>
          <Text style={styles.headerTitle}>Break things on purpose</Text>
          <Text style={styles.headerSub}>
            Every button below triggers a realistic RN failure. Open the{' '}
            <Text style={styles.code}>Catch</Text> dashboard to see events land with
            stack, breadcrumbs, tags, and the active flag + config snapshot.
          </Text>
        </View>

        {/* Scenario cards */}
        {scenarios.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => void handleRun(s)}
            style={({ pressed }) => [
              styles.scenarioCard,
              s.tone === 'danger' && styles.scenarioCardDanger,
              s.tone === 'warn' && styles.scenarioCardWarn,
              s.tone === 'info' && styles.scenarioCardInfo,
              pressed && styles.scenarioCardPressed,
            ]}
          >
            <View style={styles.scenarioHeaderRow}>
              <Text
                style={[
                  styles.scenarioTitle,
                  s.tone === 'danger' && { color: DANGER },
                  s.tone === 'warn' && { color: WARN },
                  s.tone === 'info' && { color: '#60A5FA' },
                ]}
              >
                {s.title}
              </Text>
              <Text style={styles.scenarioRun}>Run →</Text>
            </View>
            <Text style={styles.scenarioDescription}>{s.description}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Footer status ticker */}
      <View style={styles.ticker}>
        <Text style={styles.tickerText}>
          {ticker.kind === 'idle' && 'Tap any card to dispatch a crash event.'}
          {ticker.kind === 'triggering' && `🚀 Triggering: ${ticker.scenario}`}
          {ticker.kind === 'dispatched' && `✅ Dispatched: ${ticker.scenario}`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F14' },
  scroll: { padding: 16, paddingBottom: 96, gap: 10 },

  headerCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: DANGER,
    letterSpacing: 1.5,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: MUTED, lineHeight: 18 },
  code: { fontFamily: 'SpaceMono', color: GOLD, fontSize: 12 },

  scenarioCard: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 6,
  },
  scenarioCardDanger: { borderColor: 'rgba(248,113,113,0.35)' },
  scenarioCardWarn: { borderColor: 'rgba(251,191,36,0.35)' },
  scenarioCardInfo: { borderColor: 'rgba(96,165,250,0.35)' },
  scenarioCardPressed: {
    backgroundColor: SURFACE2,
    transform: [{ scale: 0.99 }],
  },
  scenarioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scenarioTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1, paddingRight: 8 },
  scenarioRun: { fontSize: 12, fontWeight: '700', color: GOLD },
  scenarioDescription: { fontSize: 12, color: MUTED, lineHeight: 17 },

  ticker: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(15,15,20,0.95)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tickerText: { color: '#E5E7EB', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
