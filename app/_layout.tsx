import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

type UpdateUIState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'no_update'; reason?: string }
  | { kind: 'available'; label: string; isMandatory: boolean; size?: number }
  | { kind: 'downloading'; label: string; isMandatory: boolean }
  | { kind: 'applied'; label: string }
  | { kind: 'failed'; label?: string; message: string };

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [updateState, setUpdateState] = useState<UpdateUIState>({ kind: 'idle' });
  const deployRef = useRef<any>(null);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    let cancelled = false;
    try {
      const { Sankofa, SankofaDeploy } = require('sankofa-react-native');

      Sankofa.initialize('sk_test_b25f965d194d55bd071fb23921401e7c', {
        endpoint: 'http://192.168.1.241:8080',
        debug: true,
        recordSessions: true,
        maskAllInputs: true,
        trackLifecycleEvents: true,
      });

      const deploy = new SankofaDeploy({ checkOnResume: true });
      deployRef.current = deploy;

      setUpdateState({ kind: 'checking' });

      deploy
        .checkForUpdate()
        .then(async (update: any) => {
          if (cancelled) return;
          console.log('[Sankofa Deploy] checkForUpdate result:', JSON.stringify(update));
          if (!update.updateAvailable) {
            setUpdateState({ kind: 'no_update', reason: update.reason });
            return;
          }

          setUpdateState({
            kind: 'available',
            label: update.label,
            isMandatory: !!update.isMandatory,
            size: update.size,
          });

          if (update.isMandatory) {
            await applyUpdate(deploy, update, setUpdateState, cancelled);
          } else {
            setUpdateState({
              kind: 'downloading',
              label: update.label,
              isMandatory: false,
            });
            try {
              await deploy.downloadInBackground(update);
              if (!cancelled) {
                setUpdateState({ kind: 'applied', label: update.label });
              }
            } catch (err: any) {
              if (!cancelled) {
                setUpdateState({ kind: 'failed', label: update.label, message: err?.message || 'download failed' });
              }
            }
          }
        })
        .catch((err: any) => {
          if (cancelled) return;
          console.warn('[Sankofa Deploy] Update check failed:', err);
          setUpdateState({ kind: 'failed', message: err?.message || 'update check failed' });
        });
    } catch (e) {
      console.warn('[Sankofa] Native module not available (running in Expo Go?)', e);
      setUpdateState({ kind: 'idle' });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0F0F14' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <UpdateModal state={updateState} onDismiss={() => setUpdateState({ kind: 'idle' })} />
      <UpdateDebugBanner state={updateState} />
    </ThemeProvider>
  );
}

async function applyUpdate(
  deploy: any,
  update: any,
  setUpdateState: (s: UpdateUIState) => void,
  cancelled: boolean,
) {
  setUpdateState({ kind: 'downloading', label: update.label, isMandatory: true });
  try {
    await deploy.downloadAndApply(update);
    // downloadAndApply triggers a native reload on success, so this branch only
    // runs if the reload didn't happen (likely a silent failure).
    if (!cancelled) {
      setUpdateState({ kind: 'failed', label: update.label, message: 'Update did not apply. Check server logs.' });
    }
  } catch (err: any) {
    if (!cancelled) {
      setUpdateState({ kind: 'failed', label: update.label, message: err?.message || 'apply failed' });
    }
  }
}

function UpdateModal({ state, onDismiss }: { state: UpdateUIState; onDismiss: () => void }) {
  const visible =
    (state.kind === 'available' && state.isMandatory) ||
    (state.kind === 'downloading' && state.isMandatory) ||
    state.kind === 'failed';

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {state.kind === 'available' && state.isMandatory && (
            <>
              <Text style={styles.title}>Update required</Text>
              <Text style={styles.body}>
                A mandatory update ({state.label}) is available and must be installed to continue.
              </Text>
            </>
          )}
          {state.kind === 'downloading' && state.isMandatory && (
            <>
              <Text style={styles.title}>Updating…</Text>
              <Text style={styles.body}>Downloading {state.label}. The app will reload automatically.</Text>
              <ActivityIndicator style={{ marginTop: 12 }} />
            </>
          )}
          {state.kind === 'failed' && (
            <>
              <Text style={styles.title}>Update failed</Text>
              <Text style={styles.body}>
                {state.label ? `${state.label}: ` : ''}
                {state.message}
              </Text>
              <Pressable style={styles.primaryButton} onPress={onDismiss}>
                <Text style={styles.primaryButtonText}>Dismiss</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function UpdateDebugBanner({ state }: { state: UpdateUIState }) {
  if (state.kind === 'idle') return null;
  const text = (() => {
    switch (state.kind) {
      case 'checking':
        return 'Checking for updates…';
      case 'no_update':
        return `Up to date${state.reason ? ` (${state.reason})` : ''}`;
      case 'available':
        return `Update available: ${state.label}${state.isMandatory ? ' (mandatory)' : ' (optional)'}`;
      case 'downloading':
        return `Downloading ${state.label}…`;
      case 'applied':
        return `Downloaded ${state.label}. Applies on next restart.`;
      case 'failed':
        return `Update failed: ${state.message}`;
    }
  })();
  return (
    <View pointerEvents="none" style={styles.banner}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1A21',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: '#C9C9D4', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#F5A623',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#1A1A21', fontSize: 15, fontWeight: '700' },
  banner: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerText: { color: '#fff', fontSize: 12, textAlign: 'center' },
});
