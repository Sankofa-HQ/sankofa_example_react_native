import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

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

  useEffect(() => {
    let cancelled = false;
    try {
      const { Sankofa, SankofaDeploy, SankofaSwitch, SankofaConfig, SankofaPulse } = require('sankofa-react-native');
      const { setSankofaSwitch, setSankofaConfig, setSankofaPulse } = require('@/lib/sankofaClient');
      const { DEMO_FLAG_DEFAULTS, DEMO_CONFIG_DEFAULTS } = require('@/lib/sankofaDemo');

      // 🚀 Phase A — single init, errors+crashes auto-captured.
      //
      // `enableCatch: true` (the default) tells both the JS and the
      // native bridges to auto-start SankofaCatch.  That covers ALL
      // four error surfaces from one call:
      //
      //   - JS uncaught errors + unhandled promise rejections (JS Catch)
      //   - iOS NSException + POSIX-signal crashes (native iOS Catch)
      //   - Android JVM uncaught exceptions + ANRs (native Android Catch)
      //   - Console / fetch / XHR breadcrumbs (JS Catch autocapture)
      //
      // Switch + Config decisions are auto-discovered from the registry
      // — no `readFlagSnapshot` / `readConfigSnapshot` boilerplate.
      Sankofa.initialize('', {
        endpoint: 'http://192.168.1.241:8080',
        debug: true,
        recordSessions: true,
        maskAllInputs: true,
        trackLifecycleEvents: true,
        // Catch — Crashlytics + Sentry merged.  Every option below
        // could be omitted; defaults are sensible.
        enableCatch: true,
        catchEnvironment: 'test',
        appVersion: '1.0.0',
        // 🚀 Phase B — beforeSend hook. Runs AFTER an event is composed
        // but BEFORE it's sent. Return null to drop entirely; return
        // the event (possibly modified) to ship. Throws swallowed.
        // Demo behaviours:
        //   1. Drop events whose message contains "[noise]" — useful
        //      for filtering framework warnings you can't fix.
        //   2. Scrub `user_email` from `extra` so PII doesn't leak.
        // Only applies to the JS-side capture path; native NSException
        // + JVM crashes are composed by the native SDKs.
        beforeSend: (event: import('sankofa-react-native').CatchEvent) => {
          if (event.message?.includes('[noise]')) return null;
          if (event.extra && 'user_email' in event.extra) {
            return {
              ...event,
              extra: { ...event.extra, user_email: '[redacted]' },
            };
          }
          return event;
        },
      });

      // Switch + Config — constructed AFTER initialize so they land in
      // the Module Registry as "core-initialized" and the handshake
      // routes flags/values straight into them.  Bundled defaults keep
      // getFlag/get working before the first handshake completes (e.g.
      // offline first-launch).  Catch auto-discovers them from the
      // registry at capture time, so no closure plumbing is needed.
      const switches = new SankofaSwitch({ defaults: DEMO_FLAG_DEFAULTS });
      const config = new SankofaConfig({ defaults: DEMO_CONFIG_DEFAULTS });
      setSankofaSwitch(switches);
      setSankofaConfig(config);

      // Sankofa Pulse — surveys (NPS, CSAT, custom). Construct after
      // initialize() so the bridge has the apiKey + endpoint cached.
      // Pulse forwards Switch's flag decisions for `feature_flag`-tied
      // targeting, so flag-gated surveys evaluate without a re-fetch.
      const pulse = new SankofaPulse({
        defaultFlagValues: (() => {
          const out: Record<string, unknown> = {};
          try {
            for (const key of Object.keys(DEMO_FLAG_DEFAULTS)) {
              const d = switches.getDecision(key);
              if (d?.variant) out[key] = d.variant;
              else if (d?.value !== undefined) out[key] = d.value;
            }
          } catch {}
          return out;
        })(),
      });
      setSankofaPulse(pulse);

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
  }, []);

  // Wait for either a successful font load OR a load failure — don't block
  // the UI forever if the font can't register.
  if (!loaded && !error) return null;

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
