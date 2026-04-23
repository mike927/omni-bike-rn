# Omni Bike Brand

Omni Bike is an indoor cycling app. Visual tone: modern, athletic, premium, friendly. Reference quality bar: Strava and Apple Fitness — restrained, not gamified.

`src/ui/theme.ts` is the canonical token sheet. Claude Design's `colors_and_type.css` export is the structured handoff that this file mirrors. Keep all three in sync.

## Brand Palette

Primary surfaces, text, and ink — cool off-white background with near-black ink.

| Token | Hex | Usage |
|---|---|---|
| `background` | `#f4f7fb` | App background (cool off-white) |
| `surface` | `#ffffff` | Cards, sheets, primary buttons on dark |
| `surfaceMuted` | `#eef4ff` | Inset device rows, pills, callouts |
| `border` | `#d9e2ec` | Hairline dividers |
| `text` | `#0a0a0a` | Headlines, primary ink |
| `textMuted` | `#52606d` | Secondary ink, captions |
| `textSoft` | `#3a4550` | Body copy on light surfaces |

## Brand Accent & Semantic

Brand action colors. `secondary`, `success`, and `accent` deliberately alias to the same mint teal — three semantic roles, one visual mark.

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#2e3dff` | Electric indigo — primary action, focus |
| `primarySubtle` | `#dbeafe` | Tinted primary background, hover wash |
| `secondary` | `#10b5a4` | Mint teal — secondary action |
| `tertiary` | `#8b5cf6` | Violet — tertiary, gradient mid-stop |
| `accent` | `#10b5a4` | Alias of secondary for legacy callsites |
| `success` | `#10b5a4` | Success / positive state |
| `warning` | `#f5a524` | Warm amber |
| `danger` | `#ef4b5c` | Destructive coral |
| `dangerBg` | `#ffe5e8` | Destructive button fill |
| `dangerBorder` | `#f7b5bd` | Destructive button border |
| `tabInactive` | `#7b8794` | Inactive tab icon/label |

## Gradients

Used for hero surfaces and signature CTAs. In React Native consume via `expo-linear-gradient`.

| Token | Stops | Angle |
|---|---|---|
| `gradient.aurora` | `#2e3dff → #8b5cf6 → #10b5a4` | 120° |
| `gradient.cool` | `#10b5a4 → #2e3dff` | 135° |

## Typography

Family: system stack (`-apple-system`, `BlinkMacSystemFont`, `'SF Pro Text'`, Inter, system-ui). React Native picks the platform system font (SF Pro on iOS, Roboto on Android); the system stack mirrors that for web/specimens.

| Role | Size | Weight | Line height | Letter spacing |
|---|---|---|---|---|
| Display | 44 | 800 (heavy) | 1.1 | -0.01em |
| Title | 30 | 800 (heavy) | 1.1 | -0.01em |
| H2 | 20 | 700 (bold) | 1.25 | — |
| H3 | 18 | 700 (bold) | 1.3 | — |
| Body | 16 | 400 | 1.4 | — |
| Body sm | 15 | 400 | 1.47 | — |
| Meta | 14 | 400 | 1.55 | — |
| Caption | 13 | 400 | 1.38 | — |
| Micro label | 12 | 700 | — | 0.6px (uppercase) |

## Spacing

Observed scale from existing screens. Use these step values rather than ad-hoc numbers.

`4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32`

Larger paddings used at screen scaffolding edges: `60` (top inset), `80` / `152` (bottom safe-area).

## Radii

| Token | Value | Usage |
|---|---|---|
| xs | 12 | History row, inline chip |
| sm | 14 | Compact tile, micro card |
| md | 16 | Metric tile, callout |
| lg | 20 | Input, device row, tab bar |
| xl | 24 | Section card |
| 2xl | 28 | Hero card |
| pill | 999 | Action buttons, status pills |

## Illustration Style

Flat illustration with soft gradients in the brand palette. No photorealism. No text inside illustrations. Square aspect for hero illustrations. Consistent line weight and color treatment across all screens — illustrations in the same flow MUST share style.
