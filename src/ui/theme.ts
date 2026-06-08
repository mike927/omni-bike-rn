const MINT_TEAL = '#10b5a4';

export const palette = {
  background: '#f4f7fb',
  surface: '#ffffff',
  surfaceMuted: '#eef4ff',
  border: '#d9e2ec',
  text: '#0a0a0a',
  textMuted: '#52606d',
  textSoft: '#3a4550',
  primary: '#2e3dff',
  primarySubtle: '#dbeafe',
  secondary: MINT_TEAL,
  tertiary: '#8b5cf6',
  success: MINT_TEAL,
  warning: '#f5a524',
  danger: '#ef4b5c',
  dangerBg: '#ffe5e8',
  dangerBorder: '#f7b5bd',
  successInk: '#0a7d72', // darkened success — status-pill text on success tint
  warningInk: '#a96a06', // darkened warning — status-pill text on warning tint
  dangerInk: '#c4283a', // darkened danger — status-pill text on danger tint
  accent: MINT_TEAL,
  tabInactive: '#7b8794',
} as const;

export const gradient = {
  aurora: ['#2e3dff', '#8b5cf6', '#10b5a4'] as const,
  cool: ['#10b5a4', '#2e3dff'] as const,
} as const;

// --- Calm Noir (dark) — onboarding is the first surface; reused app-wide later.
export const noir = {
  bg: '#0b0e13',
  card: '#161b24',
  cardAlt: '#1b212c',
  card3: '#1f2735',
  ink: '#eef1f6',
  ink2: '#9aa3b2',
  // ink3 is the dimmest *text* tier — lightened from #6b7384 so body/caption text
  // clears WCAG AA (4.5:1) on both noir.bg and noir.card (it failed at ~4.06:1 / 3.63:1).
  ink3: '#828b9c',
  hairline: '#232a35',
  indigo: '#2e3dff',
  // indigoSoft is the accent for *icons, bars, and borders* (non-text → 3:1).
  indigoSoft: '#5663ff',
  // indigoText is the same accent for *text* — lightened so indigo labels clear AA
  // (4.5:1) on dark surfaces, where indigoSoft only reaches ~3.3–4.3:1.
  indigoText: '#8c96ff',
  indigoPress: '#2330d8',
  mint: '#10b5a4',
  mintSoft: '#4fd8c8',
  amber: '#f5a524',
  amberSoft: '#f7c46b',
  danger: '#ef4b5c',
  dangerSoft: '#ff8a93',
} as const;

export const noirGradient = {
  // illustration circle: indigo top-left → deep navy
  hero: ['#2e3dff', '#1a1f8f', '#0e1230'] as const,
  // soft mint glow layered bottom-right
  heroGlow: ['rgba(16,181,164,0.55)', 'rgba(16,181,164,0)'] as const,
  // primary CTA hero — bright indigo sweep
  cta: ['#2e3dff', '#3a47ff', '#5663ff'] as const,
} as const;

// Calm Noir StatusPill tones — dark-surface equivalents of TONE_COLORS.
export const noirPillTones = {
  good: { bg: 'rgba(16, 181, 164, 0.12)', fg: '#4fd8c8', dot: '#10b5a4' },
  working: { bg: 'rgba(245, 165, 36, 0.12)', fg: '#f7c065', dot: '#f5a524' },
  attention: { bg: 'rgba(239, 75, 92, 0.14)', fg: '#f4818d', dot: '#ef4b5c' },
  inactive: { bg: 'rgba(255, 255, 255, 0.04)', fg: '#828b9c', dot: '#4a5260' },
} as const;
