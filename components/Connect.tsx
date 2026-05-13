import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { inferEnv, sankofaConnection } from '@/lib/sankofaConnection';

/**
 * First-run connect screen. Mirrors the iOS / Android / web example
 * gates — collects an API key + optional endpoint, persists them via
 * `sankofaConnection`, and lets the root layout flip to `<Tabs />`.
 */
export function Connect({ initialEndpoint }: { initialEndpoint: string }) {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState(initialEndpoint);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const env = inferEnv(apiKey);
  const valid = apiKey.trim().length > 8;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setSubmitting(true);
    try {
      await sankofaConnection.connect(apiKey, endpoint);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F0F1A' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logo} />
        <Text style={styles.eyebrow}>Sankofa Developer Sandbox</Text>
        <Text style={styles.title}>Connect your project</Text>
        <Text style={styles.lede}>
          Paste your Sankofa API key to start tracking events, capturing errors,
          and exercising every SDK module from this app. Your key is stored on
          this device only.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>API key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk_test_…"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            secureTextEntry
          />
          {env ? (
            <Text style={[styles.meta, env === 'test' ? styles.envTest : styles.envLive]}>
              Detected {env.toUpperCase()} environment
            </Text>
          ) : null}
          {touched && !valid ? (
            <Text style={styles.error}>That key looks too short — paste the full token.</Text>
          ) : null}

          <Text style={[styles.label, { marginTop: 18 }]}>Engine URL</Text>
          <TextInput
            style={styles.input}
            value={endpoint}
            onChangeText={setEndpoint}
            placeholder="http://localhost:8080"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            Override only if you self-host. Use http://10.0.2.2:8080 on the
            Android emulator.
          </Text>

          <Pressable
            style={[styles.button, !valid && styles.buttonDisabled]}
            onPress={submit}
            disabled={!valid || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Connect &amp; initialize SDK</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have a key? </Text>
          <Pressable onPress={() => Linking.openURL('https://sankofa.dev')}>
            <Text style={styles.footerLink}>Get one in 30 seconds ↗</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#6C5CE7',
    marginBottom: 20,
    shadowColor: '#6C5CE7',
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  eyebrow: {
    color: '#9CA3AF',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  lede: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 20,
    marginTop: 32,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#16162A',
    color: '#fff',
    fontSize: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  meta: { fontSize: 12, marginTop: 6 },
  envTest: { color: '#EAB308' },
  envLive: { color: '#22C55E' },
  error: { color: '#F87171', fontSize: 12, marginTop: 6 },
  hint: { color: '#6B7280', fontSize: 11, marginTop: 6 },
  button: {
    marginTop: 22,
    backgroundColor: '#6C5CE7',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', marginTop: 20 },
  footerText: { color: '#9CA3AF', fontSize: 12 },
  footerLink: { color: '#A29BFE', fontSize: 12, fontWeight: '700' },
});
