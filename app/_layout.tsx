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
  const { Sankofa } = require('sankofa-react-native');
  Sankofa.initialize('sk_test_b25f965d194d55bd071fb23921401e7c', {
    endpoint: 'http://172.20.10.6:8080',   // ← point to your local Sankofa server
    debug: true,
    recordSessions: true,
    maskAllInputs: true,
    trackLifecycleEvents: true,
  });
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
