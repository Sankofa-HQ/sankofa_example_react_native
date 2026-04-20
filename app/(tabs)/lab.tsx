import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEMO_CONFIG,
  DEMO_CONFIG_DESCRIPTIONS,
  DEMO_FLAGS,
  DEMO_FLAG_DESCRIPTIONS,
  type PricingTier,
} from '@/lib/sankofaDemo';
import {
  getDiscount,
  getMaintenanceEnabled,
  getMaxUploads,
  getPricingTiers,
  getSankofaSwitch,
  getSupportUrl,
  getThemeColors,
  useDemoConfig,
  useDemoFlags,
} from '@/lib/sankofaClient';

// Sankofa SDK entry for screen-tagging — optional, tolerated if missing.
let useSankofaScreen: (name: string) => void = () => {};
try {
  useSankofaScreen = require('sankofa-react-native').useSankofaScreen;
} catch {}

const CARD_BG = '#1A1A2E';
const BORDER = '#2A2A3E';
const MUTED = '#6B7280';

export default function LabScreen() {
  useSankofaScreen('Lab');
  const flags = useDemoFlags();
  const config = useDemoConfig();

  const theme = getThemeColors(config);
  const maintenance = getMaintenanceEnabled(config);
  const supportUrl = getSupportUrl(config);
  const maxUploads = getMaxUploads(config);
  const discount = getDiscount(config);
  const tiers = getPricingTiers(config);

  const newHome = flags[DEMO_FLAGS.NEW_HOME_LAYOUT]?.value;
  const ctaVariant = flags[DEMO_FLAGS.CHECKOUT_CTA_VARIANT]?.variant ?? 'control';
  const onboardingV2 = flags[DEMO_FLAGS.ONBOARDING_V2_ROLLOUT]?.value;
  const aiHalted = flags[DEMO_FLAGS.AI_SUMMARY_KILL_SWITCH]?.value;
  const pricingArm = flags[DEMO_FLAGS.AB_PRICING_PAGE]?.variant ?? 'A';
  const premiumBadge = flags[DEMO_FLAGS.PREMIUM_BADGE_VISIBLE]?.value;

  const ctaLabel =
    ctaVariant === 'blue' ? 'Try it free' :
    ctaVariant === 'red'  ? 'Upgrade now' :
    'Get started';
  const ctaBg =
    ctaVariant === 'blue' ? '#2563eb' :
    ctaVariant === 'red'  ? '#dc2626' :
    theme.primary;

  const tiersOrdered: PricingTier[] = pricingArm === 'B' ? [...tiers].reverse() : tiers;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero — driven by new_home_layout + theme_colors */}
        <View
          style={[
            styles.heroCard,
            newHome && { borderColor: theme.accent, backgroundColor: theme.primary + '22' },
          ]}
        >
          <Text style={styles.eyebrow}>{newHome ? 'HERO LAYOUT: V2' : 'HERO LAYOUT: CLASSIC'}</Text>
          <Text style={styles.heroTitle}>
            {newHome ? 'Analytics for modern teams' : 'Ship analytics in minutes'}
          </Text>
          <Text style={styles.heroSub}>
            Driven by <Text style={styles.code}>new_home_layout</Text> and{' '}
            <Text style={styles.code}>theme_colors</Text>.
          </Text>
          <Pressable
            onPress={() => getSankofaSwitch()?.getVariant(DEMO_FLAGS.CHECKOUT_CTA_VARIANT, 'control')}
            style={[styles.cta, { backgroundColor: ctaBg }]}
          >
            <Text style={styles.ctaText}>{ctaLabel} →</Text>
          </Pressable>
          <Text style={styles.variantTag}>CTA variant: {ctaVariant}</Text>
        </View>

        {maintenance && (
          <View style={styles.maintenance}>
            <Text style={styles.maintenanceText}>
              ⚠️ Maintenance in progress — some features may be slow.
            </Text>
          </View>
        )}

        {/* AI summary + Uploads row */}
        <View style={styles.row}>
          <View style={styles.smallCard}>
            <Text style={styles.eyebrow}>AI SUMMARY</Text>
            {aiHalted ? (
              <>
                <Text style={[styles.smallTitle, { color: '#fca5a5' }]}>🛑 Paused</Text>
                <Text style={styles.smallBody}>
                  <Text style={styles.code}>ai_summary_kill_switch</Text> is halted. Halt webhooks
                  flip this instantly.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.smallTitle}>Ready for queries</Text>
                <Text style={styles.smallBody}>Kill switch clear.</Text>
              </>
            )}
          </View>

          <View style={styles.smallCard}>
            <Text style={styles.eyebrow}>UPLOADS</Text>
            <Text style={styles.smallTitle}>{maxUploads} / day</Text>
            <Pressable
              onPress={() => getSankofaSwitch()?.getFlag(DEMO_FLAGS.ONBOARDING_V2_ROLLOUT, false)}
              disabled={!onboardingV2}
              style={[
                styles.cta,
                { backgroundColor: onboardingV2 ? theme.accent : '#374151', marginTop: 8 },
              ]}
            >
              <Text style={styles.ctaText}>
                {onboardingV2 ? 'Open uploader (v2)' : 'Uploader coming soon'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Pricing card */}
        <View style={[styles.pricingCard, { borderColor: theme.primary + '55' }]}>
          <View style={styles.pricingHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PRICING — ARM {pricingArm}</Text>
              <Text style={styles.smallTitle}>
                {pricingArm === 'B' ? 'Enterprise-first pricing' : 'Simple pricing, scales with you'}
              </Text>
            </View>
            {premiumBadge && (
              <View style={[styles.badge, { borderColor: theme.primary, backgroundColor: theme.primary + '22' }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>✨ Premium</Text>
              </View>
            )}
          </View>
          <View style={styles.tierGrid}>
            {tiersOrdered.map((t) => {
              const discounted = Math.max(0, t.price * (1 - discount));
              return (
                <View key={t.name} style={styles.tierCard}>
                  <Text style={styles.tierName}>{t.name}</Text>
                  <Text style={[styles.tierPrice, { color: theme.primary }]}>
                    ${discounted.toFixed(0)}
                    <Text style={styles.tierPeriod}> /mo</Text>
                  </Text>
                  {discount > 0 && t.price > 0 && (
                    <Text style={styles.tierDiscount}>
                      {(discount * 100).toFixed(0)}% off trial
                    </Text>
                  )}
                  {t.features.map((f) => (
                    <Text key={f} style={styles.tierFeature}>• {f}</Text>
                  ))}
                </View>
              );
            })}
          </View>
        </View>

        {/* Support link */}
        <Pressable onPress={() => Linking.openURL(supportUrl)} style={styles.supportCard}>
          <Text style={styles.eyebrow}>SUPPORT</Text>
          <Text style={[styles.supportLink, { color: theme.accent }]}>{supportUrl} ↗</Text>
          <Text style={styles.smallBody}>From <Text style={styles.code}>support_url</Text>.</Text>
        </Pressable>

        {/* Flag table */}
        <Text style={styles.sectionLabel}>SANKOFA SWITCH — LIVE DECISIONS</Text>
        {Object.values(DEMO_FLAGS).map((key) => {
          const d = flags[key];
          return (
            <View key={key} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.keyText}>{key}</Text>
                <Text style={styles.descText}>{DEMO_FLAG_DESCRIPTIONS[key]}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.valueText}>
                  {d?.variant ? `${d.variant}` : String(d?.value)}
                </Text>
                <Text style={styles.reasonText}>{d?.reason ?? ''} · v{d?.version ?? 0}</Text>
              </View>
            </View>
          );
        })}

        {/* Config table */}
        <Text style={styles.sectionLabel}>SANKOFA CONFIG — TYPED REMOTE VALUES</Text>
        {Object.values(DEMO_CONFIG).map((key) => {
          const d = config[key];
          const value =
            d?.type === 'json' ? JSON.stringify(d.value) :
            typeof d?.value === 'string' ? `"${d.value}"` :
            String(d?.value);
          return (
            <View key={key} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.keyText}>{key}</Text>
                <Text style={styles.descText}>{DEMO_CONFIG_DESCRIPTIONS[key]}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', maxWidth: 160 }}>
                <Text style={styles.valueText} numberOfLines={3}>{value}</Text>
                <Text style={styles.reasonText}>
                  {d?.type ?? ''} · {d?.reason ?? ''} · v{d?.version ?? 0}
                </Text>
              </View>
            </View>
          );
        })}

        <RefreshRow />
      </ScrollView>
    </SafeAreaView>
  );
}

function RefreshRow() {
  const [note, setNote] = useState<string>('');
  return (
    <View style={{ marginTop: 16, alignItems: 'center' }}>
      <Pressable
        onPress={() => {
          try {
            // The native bridge owns handshake timing on mobile. We can't
            // force a refresh from JS yet — the next app resume will pull
            // new decisions. Log a friendly note so the Lab doesn't look
            // like a dead button.
            setNote('Next app resume will refresh the handshake.');
          } catch (e: any) {
            setNote(`Refresh unavailable: ${e?.message ?? 'unknown'}`);
          }
        }}
        style={styles.refreshBtn}
      >
        <Text style={styles.refreshText}>Refresh handshake</Text>
      </Pressable>
      {note !== '' && <Text style={styles.refreshNote}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F14' },
  scroll: { paddingHorizontal: 14, paddingBottom: 32, gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#7C7C94', marginBottom: 6 },

  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 12, color: MUTED, marginTop: 6 },
  code: { fontFamily: 'SpaceMono', color: '#F5A623', fontSize: 11 },
  cta: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  variantTag: { marginTop: 8, color: '#94a3b8', fontSize: 11 },

  maintenance: {
    backgroundColor: '#f59e0b1f',
    borderColor: '#f59e0b',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
  },
  maintenanceText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },

  row: { flexDirection: 'row', gap: 10 },
  smallCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  smallTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  smallBody: { color: MUTED, fontSize: 11, marginTop: 4 },

  pricingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  pricingHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tierCard: {
    flex: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff14',
  },
  tierName: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tierPrice: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  tierPeriod: { fontSize: 11, color: MUTED, fontWeight: '500' },
  tierDiscount: { fontSize: 10, color: '#fbbf24', marginTop: 2 },
  tierFeature: { fontSize: 10, color: MUTED, marginTop: 4 },

  supportCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  supportLink: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A5A6E',
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 4,
  },
  rowCard: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  keyText: { fontFamily: 'SpaceMono', fontSize: 12, color: '#fff', fontWeight: '700' },
  descText: { fontSize: 10, color: MUTED, marginTop: 2 },
  valueText: { fontFamily: 'SpaceMono', fontSize: 12, color: '#fda4af', fontWeight: '700' },
  reasonText: { fontSize: 9, color: MUTED, marginTop: 2, fontFamily: 'SpaceMono' },

  refreshBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#272740',
  },
  refreshText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  refreshNote: { color: MUTED, fontSize: 10, marginTop: 4 },
});
