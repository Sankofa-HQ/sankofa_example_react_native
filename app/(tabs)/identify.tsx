import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SankofaEventLog, LogEntry } from '@/components/SankofaEventLog';

// ─── Sankofa SDK ─────────────────────────────────────────────────────────────
let useSankofaScreen: (name: string) => void = () => {};
let Sankofa: {
  identify: (id: string) => void;
  setPerson: (t: object) => void;
  reset: () => void;
} = { identify: () => {}, setPerson: () => {}, reset: () => {} };

try {
  const sdk = require('sankofa-react-native');
  useSankofaScreen = sdk.useSankofaScreen;
  Sankofa = sdk.Sankofa;
} catch {}
// ─────────────────────────────────────────────────────────────────────────────

const GOLD = '#F5A623';
const SURFACE = '#1A1A2E';
const BORDER = '#2A2A3E';
const INPUT_BG = '#0F0F14';

function makeId() { return Math.random().toString(36).slice(2); }
function timestamp() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

export default function IdentifyScreen() {
  useSankofaScreen('Identify');

  const [userId, setUserId]   = useState('user_1234');
  const [name, setName]       = useState('Kofi Boateng');
  const [email, setEmail]     = useState('kofi@sankofa.dev');
  const [log, setLog]         = useState<LogEntry[]>([]);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLog(prev => [...prev, { ...entry, id: makeId(), timestamp: timestamp() }]);
  }, []);

  const handleIdentify = () => {
    if (!userId.trim()) return;
    Sankofa.identify(userId.trim());
    addLog({ type: 'identify', label: `identify("${userId.trim()}")` });
  };

  const handleSetPerson = () => {
    const traits: Record<string, string> = {};
    if (name.trim())  traits.name  = name.trim();
    if (email.trim()) traits.email = email.trim();
    Sankofa.setPerson(traits);
    addLog({
      type: 'people',
      label: 'setPerson()',
      detail: JSON.stringify(traits),
    });
  };

  const handleReset = () => {
    Sankofa.reset();
    addLog({ type: 'reset', label: 'reset() — new anonymous session' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Info card ── */}
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>👤</Text>
            <Text style={styles.cardTitle}>User Identity</Text>
            <Text style={styles.cardSub}>
              Call <Text style={styles.code}>identify()</Text> when a user logs in to merge
              their anonymous session with their profile.
            </Text>
          </View>

          {/* ── Fields ── */}
          <Text style={styles.label}>USER ID</Text>
          <TextInput
            style={styles.input}
            value={userId}
            onChangeText={setUserId}
            placeholder="user_1234"
            placeholderTextColor="#4B5563"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>NAME (optional)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Kofi Boateng"
            placeholderTextColor="#4B5563"
          />

          <Text style={styles.label}>EMAIL (optional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="kofi@sankofa.dev"
            placeholderTextColor="#4B5563"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* ── Action buttons ── */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleIdentify}>
            <Text style={styles.primaryBtnText}>👤  Identify User</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSetPerson}>
            <Text style={styles.secondaryBtnText}>🧑‍💼  Set Person Traits</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleReset}>
            <Text style={styles.dangerBtnText}>🔄  Reset (Logout)</Text>
          </TouchableOpacity>

          {/* ── Log ── */}
          <Text style={styles.logTitle}>EVENT LOG</Text>
          <View style={styles.logBox}>
            <SankofaEventLog entries={log} />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F14' },
  scroll: { padding: 16, gap: 12 },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  cardSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18 },
  code: { fontFamily: 'SpaceMono', color: GOLD, fontSize: 12 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A5A6E',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
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
  dangerBtn: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  dangerBtnText: { fontSize: 16, fontWeight: '600', color: '#F87171' },
  logTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A5A6E',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  logBox: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 160,
    overflow: 'hidden',
  },
});
