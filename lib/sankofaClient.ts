import { useEffect, useState } from 'react';
import type { FlagDecision, ItemDecision, SankofaSwitchAPI, SankofaConfigAPI } from 'sankofa-react-native';

import { DEMO_CONFIG, DEMO_CONFIG_DEFAULTS, DEMO_FLAGS, DEMO_FLAG_DEFAULTS, type PricingTier, type ThemeColors } from './sankofaDemo';

// Process-wide singletons. Constructed in app/_layout.tsx right after
// Sankofa.initialize so the Traffic Cop wires up before the first
// handshake fires; read everywhere else via getSwitch/getConfig.
let switchInstance: SankofaSwitchAPI | null = null;
let configInstance: SankofaConfigAPI | null = null;

export function setSankofaSwitch(instance: SankofaSwitchAPI) {
  switchInstance = instance;
}

export function setSankofaConfig(instance: SankofaConfigAPI) {
  configInstance = instance;
}

export function getSankofaSwitch(): SankofaSwitchAPI | null {
  return switchInstance;
}

export function getSankofaConfig(): SankofaConfigAPI | null {
  return configInstance;
}

// ── useDemoFlags — subscribe to every canonical flag ──────────────────

export function useDemoFlags(): Record<string, FlagDecision> {
  const [snapshot, setSnapshot] = useState<Record<string, FlagDecision>>(readFlagSnapshot);

  useEffect(() => {
    const s = getSankofaSwitch();
    if (!s) return;
    const unsub: Array<() => void> = [];
    for (const key of Object.values(DEMO_FLAGS)) {
      unsub.push(
        s.onChange(key, () => setSnapshot(readFlagSnapshot())),
      );
    }
    // Pick up hydration from cache which lands after the first render.
    setSnapshot(readFlagSnapshot());
    return () => {
      for (const u of unsub) u();
    };
  }, []);

  return snapshot;
}

function readFlagSnapshot(): Record<string, FlagDecision> {
  const s = getSankofaSwitch();
  const out: Record<string, FlagDecision> = {};
  for (const key of Object.values(DEMO_FLAGS)) {
    out[key] = s?.getDecision(key) ?? DEMO_FLAG_DEFAULTS[key];
  }
  return out;
}

// ── useDemoConfig ─────────────────────────────────────────────────────

export function useDemoConfig(): Record<string, ItemDecision> {
  const [snapshot, setSnapshot] = useState<Record<string, ItemDecision>>(readConfigSnapshot);

  useEffect(() => {
    const c = getSankofaConfig();
    if (!c) return;
    const unsub: Array<() => void> = [];
    for (const key of Object.values(DEMO_CONFIG)) {
      unsub.push(
        c.onChange(key, () => setSnapshot(readConfigSnapshot())),
      );
    }
    setSnapshot(readConfigSnapshot());
    return () => {
      for (const u of unsub) u();
    };
  }, []);

  return snapshot;
}

function readConfigSnapshot(): Record<string, ItemDecision> {
  const c = getSankofaConfig();
  const out: Record<string, ItemDecision> = {};
  for (const key of Object.values(DEMO_CONFIG)) {
    out[key] = c?.getDecision(key) ?? DEMO_CONFIG_DEFAULTS[key];
  }
  return out;
}

// ── Typed getters tailored to the known-at-compile-time types ─────────

export function getSupportUrl(snapshot: Record<string, ItemDecision>): string {
  return (snapshot[DEMO_CONFIG.SUPPORT_URL]?.value as string) ?? 'https://support.sankofa.dev';
}

export function getMaxUploads(snapshot: Record<string, ItemDecision>): number {
  return (snapshot[DEMO_CONFIG.MAX_UPLOADS_PER_DAY]?.value as number) ?? 25;
}

export function getDiscount(snapshot: Record<string, ItemDecision>): number {
  return (snapshot[DEMO_CONFIG.TRIAL_DISCOUNT_PCT]?.value as number) ?? 0;
}

export function getMaintenanceEnabled(snapshot: Record<string, ItemDecision>): boolean {
  return (snapshot[DEMO_CONFIG.MAINTENANCE_BANNER_ENABLED]?.value as boolean) ?? false;
}

export function getPricingTiers(snapshot: Record<string, ItemDecision>): PricingTier[] {
  return (snapshot[DEMO_CONFIG.PRICING_TABLE]?.value as PricingTier[]) ?? [];
}

export function getThemeColors(snapshot: Record<string, ItemDecision>): ThemeColors {
  return (snapshot[DEMO_CONFIG.THEME_COLORS]?.value as ThemeColors) ?? { primary: '#F5A623', accent: '#6366f1' };
}
