import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// ─── Sankofa SDK Initialization ───────────────────────────────────────────────
// Initialize once at the root layout, before any screen renders.
// In production replace 'YOUR_API_KEY' with your real key from sankofa.dev.
//
// NOTE: The native module is only available in dev builds (expo run:ios / expo run:android).
// It will throw in Expo Go — use a development build for this example.
try {
  const { Sankofa, SankofaDeploy } = require('sankofa-react-native');

  // 1. Initialize analytics (also triggers the unified handshake)
  Sankofa.initialize('sk_test_b25f965d194d55bd071fb23921401e7c', {
    endpoint: 'http://192.168.1.241:8080',   // ← point to your local Sankofa server
    debug: true,
    recordSessions: true,
    maskAllInputs: true,
    trackLifecycleEvents: true,
  });

  // 2. Initialize Deploy — OTA updates
  // Config is auto-read from Sankofa.initialize() (apiKey + endpoint).
  // The handshake response includes the deploy module config, so
  // checkForUpdate() doesn't make a separate HTTP call.
  const deploy = new SankofaDeploy({ checkOnResume: true });

  // 3. Check for OTA update on startup
  deploy.checkForUpdate().then((update: any) => {
    if (update.updateAvailable) {
      console.log(`[Sankofa Deploy] Update available: ${update.label} (${update.isMandatory ? 'mandatory' : 'optional'})`);
      if (update.isMandatory) {
        // Mandatory: download and apply immediately
        deploy.downloadAndApply(update);
      } else {
        // Optional: download in background, apply on next restart
        deploy.downloadInBackground(update);
      }
    } else {
      console.log('[Sankofa Deploy] App is up to date');
    }
  }).catch((err: any) => {
    console.warn('[Sankofa Deploy] Update check failed:', err);
  });

  // 4. Confirm the app is healthy after 10 seconds (auto-rollback safety)
  // SankofaDeploy does this automatically via a timer, but you can
  // call deploy.notifyAppReady() explicitly after your app renders.
} catch (e) {
  console.warn('[Sankofa] Native module not available (running in Expo Go?)', e);
}
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0F0F14' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
