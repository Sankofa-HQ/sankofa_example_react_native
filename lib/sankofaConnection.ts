/**
 * Holds the user-supplied Sankofa endpoint + API key, persists them via
 * `@react-native-async-storage/async-storage`, and exposes a tiny store
 * the example's root layout subscribes to.
 *
 * Mirrors the iOS / Android / Flutter / web example connection helpers:
 *
 *   - First launch with no saved creds → root layout renders `<Connect />`.
 *   - On submit → creds saved, SDK initialised, root flips to `<Tabs />`.
 *   - On subsequent launches we auto-init from the saved creds and
 *     never show the connect screen (instant).
 *   - `disconnect()` clears the persisted creds and flips the store
 *     state back to "not connected" so the user lands on `<Connect />`.
 *
 * The SDK is only initialised once per process — the `initialised` guard
 * makes the helper safe to call from both the bootstrap effect and the
 * connect form without double-initialising.
 */
// AsyncStorage is loaded via `require` so the example still typechecks
// before `npm install` brings the package in. The shape we use is the
// stable subset every released version exposes (getItem / setItem /
// multiRemove), so the loose typing here is safe.
interface AsyncStorageShape {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
}
let AsyncStorage: AsyncStorageShape = {
  getItem: async () => null,
  setItem: async () => {},
  multiRemove: async () => {},
};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // Module not installed yet — the runtime store falls back to its
  // in-memory state, which still drives the connect screen flow but
  // won't survive a process restart. Once `npm install` lands the
  // dependency from `package.json`, persistence kicks in for real.
  console.warn(
    '[Sankofa example] @react-native-async-storage/async-storage not installed — connect form will not persist across launches. Run `npm install` to enable.',
  );
}

const STORAGE_API_KEY = 'sankofa.example.apiKey';
const STORAGE_ENDPOINT = 'sankofa.example.endpoint';
const DEFAULT_ENDPOINT = 'http://localhost:8080';

type Listener = () => void;

export interface ConnectionSnapshot {
  apiKey: string;
  endpoint: string;
  isConnected: boolean;
  isHydrated: boolean;
}

class Store {
  private state: ConnectionSnapshot = {
    apiKey: '',
    endpoint: DEFAULT_ENDPOINT,
    isConnected: false,
    isHydrated: false,
  };
  private listeners = new Set<Listener>();
  private initialisedSdk = false;

  /** Read persisted creds. Called once from `_layout.tsx`'s mount
   *  effect — runs `initialiseSDK` automatically when creds exist so
   *  the SDK is ready by the time `(tabs)` renders. */
  async hydrate(): Promise<void> {
    try {
      const [apiKey, endpoint] = await Promise.all([
        AsyncStorage.getItem(STORAGE_API_KEY),
        AsyncStorage.getItem(STORAGE_ENDPOINT),
      ]);
      const trimmedKey = (apiKey ?? '').trim();
      const trimmedEndpoint = (endpoint ?? '').trim() || DEFAULT_ENDPOINT;
      const isConnected = trimmedKey.length > 0;
      this.state = {
        apiKey: trimmedKey,
        endpoint: trimmedEndpoint,
        isConnected,
        isHydrated: true,
      };
      if (isConnected) {
        this.initialiseSDK(trimmedKey, trimmedEndpoint);
      }
    } catch {
      // AsyncStorage failures (rare — typically a fresh install) are
      // non-fatal. Mark hydrated so the UI doesn't hang on a spinner.
      this.state = { ...this.state, isHydrated: true };
    }
    this.emit();
  }

  /** Called from `<Connect />` when the user submits. Persists the
   *  creds, kicks off SDK init, and flips the store to "connected"
   *  which causes the root layout to swap to `<Tabs />`. */
  async connect(apiKey: string, endpoint: string): Promise<void> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;
    const trimmedEndpoint = endpoint.trim() || DEFAULT_ENDPOINT;
    await AsyncStorage.setItem(STORAGE_API_KEY, trimmedKey);
    await AsyncStorage.setItem(STORAGE_ENDPOINT, trimmedEndpoint);
    this.state = {
      apiKey: trimmedKey,
      endpoint: trimmedEndpoint,
      isConnected: true,
      isHydrated: true,
    };
    this.initialiseSDK(trimmedKey, trimmedEndpoint);
    this.emit();
  }

  /** Wipe persisted creds and flip the store back to "not connected".
   *  The native SDK keeps running in-memory (no shutdown API on the
   *  RN bridge yet) but the next cold launch starts fresh, matching
   *  the iOS / Android example UX. */
  async disconnect(): Promise<void> {
    await AsyncStorage.multiRemove([STORAGE_API_KEY, STORAGE_ENDPOINT]);
    this.state = {
      apiKey: '',
      endpoint: DEFAULT_ENDPOINT,
      isConnected: false,
      isHydrated: true,
    };
    this.emit();
  }

  getSnapshot = (): ConnectionSnapshot => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Boot the native SDK once. Idempotent — repeated calls during a
   *  process lifetime are no-ops. */
  private initialiseSDK(apiKey: string, endpoint: string) {
    if (this.initialisedSdk) return;
    this.initialisedSdk = true;
    try {
      // Lazy require so the connect screen still renders on hosts
      // where the native module isn't linked (Expo Go, web preview).
      const {
        Sankofa,
        SankofaSwitch,
        SankofaConfig,
        SankofaPulse,
      } = require('sankofa-react-native');
      const { setSankofaSwitch, setSankofaConfig, setSankofaPulse } = require('./sankofaClient');
      const { DEMO_FLAG_DEFAULTS, DEMO_CONFIG_DEFAULTS } = require('./sankofaDemo');

      Sankofa.initialize(apiKey, {
        endpoint,
        debug: true,
        recordSessions: true,
        maskAllInputs: true,
        trackLifecycleEvents: true,
        enableCatch: true,
        catchEnvironment: inferEnv(apiKey) ?? 'dev',
        appVersion: '1.0.0',
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

      const switches = new SankofaSwitch({ defaults: DEMO_FLAG_DEFAULTS });
      const config = new SankofaConfig({ defaults: DEMO_CONFIG_DEFAULTS });
      setSankofaSwitch(switches);
      setSankofaConfig(config);

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
    } catch (e) {
      console.warn('[Sankofa] Native module not available — connect screen still works for web preview.', e);
    }
  }
}

export function inferEnv(apiKey: string): 'test' | 'live' | null {
  if (apiKey.startsWith('sk_test_')) return 'test';
  if (apiKey.startsWith('sk_live_')) return 'live';
  return null;
}

export const sankofaConnection = new Store();
