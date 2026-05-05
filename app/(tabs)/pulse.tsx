import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEMO_SURVEYS, DEMO_SURVEY_META } from '@/lib/sankofaDemo';
import { getSankofaPulse } from '@/lib/sankofaClient';

// Sankofa SDK entry for screen-tagging — optional, tolerated if missing.
let useSankofaScreen: (name: string) => void = () => {};
try {
  useSankofaScreen = require('sankofa-react-native').useSankofaScreen;
} catch {}

// SurveyModal needs to be mounted somewhere in the tree to actually
// render the dialog SankofaPulse triggers. The modal subscribes to the
// pulse instance and shows whenever .show() resolves a survey.
let SurveyModal: React.ComponentType<{ pulse: any }> | null = null;
try {
  SurveyModal = require('sankofa-react-native').SurveyModal;
} catch {}

const CARD_BG = '#1A1A2E';
const BORDER = '#2A2A3E';
const MUTED = '#6B7280';
const ACCENT = '#F5A623';

/**
 * Pulse Lab — exercises every public surface of the Pulse SDK on RN:
 *   - `pulse.show(surveyId)` programmatic presentation
 *   - `pulse.getActiveMatchingSurveys()` eligibility-filtered list
 *   - `pulse.on(event, listener)` lifecycle hooks
 *
 * Toggle "Pro user" to swap the eligibility context — the
 * `psv_demo_product_research` survey targets `userProperties.plan = 'pro'`.
 */
export default function PulseScreen() {
  useSankofaScreen('Pulse');
  const pulse = getSankofaPulse();
  const ready = pulse !== null;
  const [proUser, setProUser] = useState(true);
  const [eventLog, setEventLog] = useState<string[]>([]);

  useEffect(() => {
    if (!pulse) return;
    const events: Array<
      'survey_shown' | 'survey_dismissed' | 'survey_completed' | 'survey_partial_saved'
    > = ['survey_shown', 'survey_dismissed', 'survey_completed', 'survey_partial_saved'];
    const unsubs: Array<() => void> = [];
    for (const ev of events) {
      unsubs.push(
        pulse.on(ev, (payload: any) => {
          const ts = new Date().toLocaleTimeString();
          const suffix = [
            payload.response_id ? `response=${payload.response_id}` : '',
            payload.reason ? `reason=${payload.reason}` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          setEventLog((log) => {
            const entry = `${ts}  ${ev}${suffix ? ` — ${suffix}` : ''}`;
            return [entry, ...log].slice(0, 40);
          });
        }),
      );
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, [pulse]);

  const respondent = proUser
    ? { external_id: 'usr_demo_pro', user_id: 'usr_demo_pro', email: 'pro@example.com' }
    : { external_id: 'usr_demo_free' };

  const userProperties = proUser ? { plan: 'pro' } : { plan: 'free' };

  const showSurvey = async (id: string) => {
    if (!pulse) return;
    try {
      await pulse.show(id, {
        respondent,
        context: { userProperties },
      });
    } catch (err) {
      const msg = (err as Error).message;
      setEventLog((log) =>
        [`${new Date().toLocaleTimeString()}  show error — ${msg}`, ...log].slice(0, 40),
      );
    }
  };

  const probeEligibility = async (id: string) => {
    if (!pulse) return;
    try {
      const surveys = await pulse.getActiveMatchingSurveys();
      const matched = surveys.some((s: any) => s.id === id);
      const summary = matched
        ? `eligible ✓ (${surveys.length} matching)`
        : 'ineligible — survey did not pass targeting evaluation';
      setEventLog((log) =>
        [
          `${new Date().toLocaleTimeString()}  probe ${id} — ${summary}`,
          ...log,
        ].slice(0, 40),
      );
    } catch (err) {
      // Eligibility probe failures shouldn't crash the screen — fall
      // back to a log entry so the host can see what went wrong.
      setEventLog((log) =>
        [
          `${new Date().toLocaleTimeString()}  probe ${id} — error: ${(err as Error).message}`,
          ...log,
        ].slice(0, 40),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Pulse Lab</Text>
        <Text style={styles.subtitle}>
          Programmatic survey presentation + lifecycle event log.
        </Text>

        {!ready && (
          <View style={[styles.card, styles.warn]}>
            <Text style={styles.warnText}>
              SankofaPulse not ready. Make sure Sankofa.initialize and
              the SankofaPulse construction in app/_layout.tsx ran.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Host context</Text>
          <Text style={styles.cardBody}>
            "Product research" requires plan = "pro". Toggle to demo
            an ineligible probe.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Pro user</Text>
            <Switch
              value={proUser}
              onValueChange={setProUser}
              trackColor={{ false: '#3B3B3B', true: ACCENT }}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Surveys</Text>
        {Object.values(DEMO_SURVEYS).map((id) => {
          const meta = DEMO_SURVEY_META[id];
          return (
            <View key={id} style={styles.card}>
              <Text style={styles.cardTitle}>{meta?.title ?? id}</Text>
              <Text style={styles.surveyId}>{id}</Text>
              <Text style={styles.cardBody}>{meta?.description}</Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, !ready && styles.btnDisabled]}
                  disabled={!ready}
                  onPress={() => showSurvey(id)}
                >
                  <Text style={styles.btnPrimaryText}>Show</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnSecondary, !ready && styles.btnDisabled]}
                  disabled={!ready}
                  onPress={() => probeEligibility(id)}
                >
                  <Text style={styles.btnSecondaryText}>Check eligibility</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Lifecycle event log</Text>
        <View style={styles.card}>
          {eventLog.length === 0 ? (
            <Text style={styles.muted}>
              No events yet. Press Show on a survey above.
            </Text>
          ) : (
            eventLog.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>
                {entry}
              </Text>
            ))
          )}
          {eventLog.length > 0 && (
            <Pressable
              style={[styles.btn, styles.btnSecondary, { alignSelf: 'flex-start', marginTop: 8 }]}
              onPress={() => setEventLog([])}
            >
              <Text style={styles.btnSecondaryText}>Clear log</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Mounting SurveyModal here lets the SDK render the dialog
          without the host having to wire navigation tricks. The modal
          is invisible until pulse.show() resolves a survey. */}
      {SurveyModal && pulse ? <SurveyModal pulse={pulse} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F14' },
  scroll: { padding: 16, paddingBottom: 32 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: MUTED, fontSize: 13, marginBottom: 16 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  warn: { borderColor: '#7A4A1F', backgroundColor: '#2A1F0F' },
  warnText: { color: '#F5A623', fontSize: 13 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cardBody: { color: '#C4C4C4', fontSize: 13, marginTop: 4, lineHeight: 18 },
  surveyId: { color: MUTED, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  toggleLabel: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  btnPrimary: { backgroundColor: ACCENT },
  btnPrimaryText: { color: '#0F0F14', fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: BORDER },
  btnSecondaryText: { color: '#FFF', fontWeight: '500' },
  btnDisabled: { opacity: 0.4 },
  sectionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  muted: { color: MUTED, fontSize: 13 },
  logEntry: { color: '#E4E4E4', fontSize: 12, fontFamily: 'monospace', paddingVertical: 2 },
});
