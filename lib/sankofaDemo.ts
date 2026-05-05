import type { FlagDecision, ItemDecision } from 'sankofa-react-native';

// Canonical demo keys — identical across all six Sankofa example
// projects. One dashboard config row drives every platform.

export const DEMO_FLAGS = {
  NEW_HOME_LAYOUT: 'new_home_layout',
  CHECKOUT_CTA_VARIANT: 'checkout_cta_variant',
  ONBOARDING_V2_ROLLOUT: 'onboarding_v2_rollout',
  AI_SUMMARY_KILL_SWITCH: 'ai_summary_kill_switch',
  AB_PRICING_PAGE: 'ab_pricing_page',
  PREMIUM_BADGE_VISIBLE: 'premium_badge_visible',
} as const;

export const DEMO_CONFIG = {
  SUPPORT_URL: 'support_url',
  MAX_UPLOADS_PER_DAY: 'max_uploads_per_day',
  TRIAL_DISCOUNT_PCT: 'trial_discount_pct',
  MAINTENANCE_BANNER_ENABLED: 'maintenance_banner_enabled',
  PRICING_TABLE: 'pricing_table',
  THEME_COLORS: 'theme_colors',
} as const;

// Demo Pulse survey IDs — match `seed_pulse` (server cmd) so a fresh
// project, once seeded, has eligible surveys for every demo flow.
export const DEMO_SURVEYS = {
  NPS_AFTER_CHECKOUT: 'psv_demo_nps_checkout',
  CSAT_SUPPORT: 'psv_demo_csat_support',
  PRODUCT_RESEARCH: 'psv_demo_product_research',
} as const;

export const DEMO_SURVEY_META: Record<
  string,
  { title: string; description: string }
> = {
  [DEMO_SURVEYS.NPS_AFTER_CHECKOUT]: {
    title: 'Post-checkout NPS',
    description:
      "Score 0–10. Detractors get a 'what went wrong' follow-up via branching.",
  },
  [DEMO_SURVEYS.CSAT_SUPPORT]: {
    title: 'Support CSAT',
    description: 'Single 1–5 star rating. Smallest possible survey.',
  },
  [DEMO_SURVEYS.PRODUCT_RESEARCH]: {
    title: 'Product research (gated)',
    description:
      "Multi-question. Targeting rule requires user_property 'plan' = 'pro'.",
  },
};

export type PricingTier = { name: string; price: number; features: string[] };
export type ThemeColors = { primary: string; accent: string };

export const DEMO_FLAG_DEFAULTS: Record<string, FlagDecision> = {
  [DEMO_FLAGS.NEW_HOME_LAYOUT]:     { value: false, reason: 'local_default', version: 0 },
  [DEMO_FLAGS.CHECKOUT_CTA_VARIANT]:{ value: true,  variant: 'control', reason: 'local_default', version: 0 },
  [DEMO_FLAGS.ONBOARDING_V2_ROLLOUT]:{ value: false, reason: 'local_default', version: 0 },
  [DEMO_FLAGS.AI_SUMMARY_KILL_SWITCH]:{ value: false, reason: 'local_default', version: 0 },
  [DEMO_FLAGS.AB_PRICING_PAGE]:     { value: true,  variant: 'A', reason: 'local_default', version: 0 },
  [DEMO_FLAGS.PREMIUM_BADGE_VISIBLE]:{ value: true,  reason: 'local_default', version: 0 },
};

export const DEMO_CONFIG_DEFAULTS: Record<string, ItemDecision> = {
  [DEMO_CONFIG.SUPPORT_URL]: {
    value: 'https://support.sankofa.dev', type: 'string', reason: 'local_default', version: 0,
  },
  [DEMO_CONFIG.MAX_UPLOADS_PER_DAY]: {
    value: 25, type: 'int', reason: 'local_default', version: 0,
  },
  [DEMO_CONFIG.TRIAL_DISCOUNT_PCT]: {
    value: 0.2, type: 'float', reason: 'local_default', version: 0,
  },
  [DEMO_CONFIG.MAINTENANCE_BANNER_ENABLED]: {
    value: false, type: 'bool', reason: 'local_default', version: 0,
  },
  [DEMO_CONFIG.PRICING_TABLE]: {
    value: [
      { name: 'Starter',    price: 0,   features: ['1 project',       '1k events/mo'] },
      { name: 'Pro',        price: 49,  features: ['Unlimited projects', '1M events/mo', 'Replay'] },
      { name: 'Enterprise', price: 199, features: ['SSO', 'Priority support', 'Audit log'] },
    ] as PricingTier[],
    type: 'json', reason: 'local_default', version: 0,
  },
  [DEMO_CONFIG.THEME_COLORS]: {
    value: { primary: '#F5A623', accent: '#6366f1' } as ThemeColors,
    type: 'json', reason: 'local_default', version: 0,
  },
};

export const DEMO_FLAG_DESCRIPTIONS: Record<string, string> = {
  [DEMO_FLAGS.NEW_HOME_LAYOUT]:        'Swap hero between classic and v2.',
  [DEMO_FLAGS.CHECKOUT_CTA_VARIANT]:   'A/B/C variant — CTA copy + colour.',
  [DEMO_FLAGS.ONBOARDING_V2_ROLLOUT]:  'Progressive rollout gate.',
  [DEMO_FLAGS.AI_SUMMARY_KILL_SWITCH]: 'Halt webhook pauses AI summary.',
  [DEMO_FLAGS.AB_PRICING_PAGE]:        'Variant A/B on pricing copy.',
  [DEMO_FLAGS.PREMIUM_BADGE_VISIBLE]:  'Show/hide premium badge.',
};

export const DEMO_CONFIG_DESCRIPTIONS: Record<string, string> = {
  [DEMO_CONFIG.SUPPORT_URL]:               'String — support link.',
  [DEMO_CONFIG.MAX_UPLOADS_PER_DAY]:       'Int — upload quota.',
  [DEMO_CONFIG.TRIAL_DISCOUNT_PCT]:        'Float 0–1 — trial discount.',
  [DEMO_CONFIG.MAINTENANCE_BANNER_ENABLED]:'Bool — maintenance banner.',
  [DEMO_CONFIG.PRICING_TABLE]:             'JSON — pricing tiers.',
  [DEMO_CONFIG.THEME_COLORS]:              'JSON — primary + accent hex.',
};
