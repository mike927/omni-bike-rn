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
