import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { Connect } from '@/components/Connect';
import { sankofaConnection } from '@/lib/sankofaConnection';

import { ErrorBoundary as ExpoErrorBoundary, ErrorBoundaryProps } from 'expo-router';

// Custom ErrorBoundary that tells SankofaDeploy a fatal JS error happened
// before rendering Expo Router's default error screen. SankofaDeploy will
// report `crash_on_update` to the server and roll back to the previous
// bundle if the current one is an OTA update.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  try {
    const { SankofaDeploy } = require('sankofa-react-native');
    const anyGlobal = globalThis as any;
    const deploy = anyGlobal.__sankofaDeployInstance as { reportError?: (e: unknown) => void } | undefined;
    if (deploy?.reportError) {
      deploy.reportError(props.error);
    } else if (typeof SankofaDeploy?.reportError === 'function') {
      SankofaDeploy.reportError(props.error);
    }
  } catch {}
  return <ExpoErrorBoundary {...props} />;
}

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

  // Subscribe to the connection store. Re-renders when the user
  // connects / disconnects so the layout swaps between the connect
  // screen and the tab stack.
  const connection = useSyncExternalStore(
    sankofaConnection.subscribe,
    sankofaConnection.getSnapshot,
    sankofaConnection.getSnapshot,
  );

  // Bootstrap: hydrate persisted creds on first mount. If creds exist
  // the store auto-initialises the native SDK, otherwise the connect
  // screen renders below until the user submits.
  useEffect(() => {
    void sankofaConnection.hydrate();
  }, []);

  // Font load failures are non-fatal. After an OTA update, Metro's asset
  // entries for a font can drift from what's physically in the .app, making
  // `expo-font.loadAsync` fail with CTFontManagerError 101. Crashing the
  // entire app over a cosmetic font is the wrong trade-off — fall back to
  // the system font, report the failure, and keep rendering.
  useEffect(() => {
    if (error) {
      console.warn('[App] Font load failed, falling back to system font:', error);
      try {
        const deploy = (globalThis as any).__sankofaDeployInstance;
        deploy?.reportError?.(error, { fatal: false });
      } catch {}
    }
  }, [error]);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Deploy (OTA updates) only spins up once the user has connected and
  // the native Sankofa SDK is initialised — Deploy reports update
  // outcomes through the SDK transport and races into a noisy retry
  // loop if it boots before the SDK has an api-key resolved. The core
  // SDK + Switch / Config / Pulse init now lives in
  // `sankofaConnection.initialiseSDK` so the connect screen drives the
  // bootstrap order across iOS, Android, and Expo Go.
  useEffect(() => {
    if (!connection.isConnected) return;
    let cancelled = false;
    try {
      const { SankofaDeploy } = require('sankofa-react-native');

      const deploy = new SankofaDeploy({ checkOnResume: true });
      deployRef.current = deploy;
      (globalThis as any).__sankofaDeployInstance = deploy;

      // Tell the SDK this boot is healthy as soon as React mounts the root
      // layout. Without this the SDK's rollback heuristic counts any
      // sub-10-second session as a "crash" (two of those in a row triggers
      // a false-positive rollback).
      deploy.notifyAppReady?.();

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

          // Mandatory → download and apply without asking. Optional → wait
          // for the user to press "Download" in the modal.
          if (update.isMandatory) {
            await applyUpdate(deploy, update, setUpdateState, cancelled);
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
  }, [connection.isConnected]);

  // Wait for either a successful font load OR a load failure — don't block
  // the UI forever if the font can't register.
  if (!loaded && !error) return null;

  // First-run gate. Render the connect form until the user provides an
  // API key + endpoint. Once they do, `sankofaConnection.connect`
  // persists the creds (AsyncStorage) and initialises the native SDK;
  // the store's `isConnected` flip causes this layout to re-render
  // with the full tab stack. Returning users skip this entirely —
  // `hydrate()` auto-initialises from the saved creds on mount.
  if (connection.isHydrated && !connection.isConnected) {
    return (
      <ThemeProvider value={DarkTheme}>
        <Connect initialEndpoint={connection.endpoint} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      {/*
        Screen tagging in this example uses `useSankofaScreen("Name")`
        per-screen (see app/(tabs)/crashes.tsx etc.), because Expo
        Router owns the `NavigationContainer` and exposes route info
        through its own hooks instead of a ref.

        For non-Expo-Router apps that hold a `NavigationContainer`
        directly, drop `useSankofaNavigationTracking(navRef)` once in
        the app shell and skip all the per-screen hooks:

          import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
          import { useSankofaNavigationTracking } from "sankofa-react-native";

          export default function App() {
            const navRef = useNavigationContainerRef();
            useSankofaNavigationTracking(navRef);
            return (
              <NavigationContainer ref={navRef}>
                <RootStack />
              </NavigationContainer>
            );
          }
      */}
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0F0F14' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <UpdateModal
        state={updateState}
        onDismiss={() => setUpdateState({ kind: 'idle' })}
        onDownloadNow={async () => {
          const deploy = deployRef.current;
          if (!deploy || updateState.kind !== 'available') return;
          const update = {
            updateAvailable: true,
            label: updateState.label,
            isMandatory: updateState.isMandatory,
            size: updateState.size,
            // The SDK will pull the full update object from its own cache;
            // the modal only holds the display-level fields.
          } as any;
          setUpdateState({ kind: 'downloading', label: updateState.label, isMandatory: false });
          try {
            // Re-issue checkForUpdate to get fresh URL + sha, then download.
            const fresh = await deploy.checkForUpdate();
            if (fresh?.updateAvailable) {
              await deploy.downloadInBackground(fresh);
              setUpdateState({ kind: 'applied', label: fresh.label || update.label });
            } else {
              setUpdateState({ kind: 'no_update', reason: fresh?.reason });
            }
          } catch (err: any) {
            setUpdateState({
              kind: 'failed',
              label: update.label,
              message: err?.message || 'download failed',
            });
          }
        }}
        onRestartNow={async () => {
          const deploy = deployRef.current;
          if (!deploy) return;
          try {
            const applied = await deploy.applyPending();
            if (!applied) {
              setUpdateState({
                kind: 'failed',
                message: 'No pending update to apply',
              });
            }
          } catch (err: any) {
            setUpdateState({
              kind: 'failed',
              message: err?.message || 'restart failed',
            });
          }
        }}
      />
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UpdateModal({
  state,
  onDismiss,
  onDownloadNow,
  onRestartNow,
}: {
  state: UpdateUIState;
  onDismiss: () => void;
  onDownloadNow: () => void | Promise<void>;
  onRestartNow: () => void | Promise<void>;
}) {
  const visible =
    state.kind === 'available' ||
    state.kind === 'downloading' ||
    state.kind === 'applied' ||
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
          {state.kind === 'available' && !state.isMandatory && (
            <>
              <Text style={styles.title}>Update available</Text>
              <Text style={styles.body}>
                {state.label} is ready to download
                {typeof state.size === 'number' ? ` (${formatSize(state.size)})` : ''}. Download now to apply
                it on the next app launch, or tap Later to stay on the current version.
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => void onDownloadNow()}>
                <Text style={styles.primaryButtonText}>Download</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onDismiss}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </Pressable>
            </>
          )}
          {state.kind === 'downloading' && (
            <>
              <Text style={styles.title}>{state.isMandatory ? 'Updating…' : 'Downloading update…'}</Text>
              <Text style={styles.body}>
                {state.isMandatory
                  ? `Downloading ${state.label}. The app will reload automatically.`
                  : `Downloading ${state.label}. We'll let you know when it's ready.`}
              </Text>
              <ActivityIndicator style={{ marginTop: 12 }} />
            </>
          )}
          {state.kind === 'applied' && (
            <>
              <Text style={styles.title}>Update ready</Text>
              <Text style={styles.body}>
                {state.label} has been downloaded. Restart the app to apply it now, or dismiss to
                apply on the next launch.
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => void onRestartNow()}>
                <Text style={styles.primaryButtonText}>Restart now</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onDismiss}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </Pressable>
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
      case 'no_update': {
        const r = state.reason || '';
        const isError =
          r.startsWith('check_') ||
          r.startsWith('handshake_') ||
          r.startsWith('exception') ||
          r.includes('network_error');
        if (!r) return 'Up to date';
        return isError ? `Update check failed: ${r}` : `Up to date (${r})`;
      }
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
  secondaryButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#C9C9D4', fontSize: 14, fontWeight: '600' },
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
