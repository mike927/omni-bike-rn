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
| `successInk` | `#0a7d72` | Darkened teal — status-pill text on `success` tint |
| `warningInk` | `#a96a06` | Darkened amber — status-pill text on `warning` tint |
| `dangerInk` | `#c4283a` | Darkened coral — status-pill text on `danger` tint |
| `tabInactive` | `#7b8794` | Inactive tab icon/label; status-pill text/dot for `inactive` tone |

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
| xs | 12 | Inline chip |
| sm | 14 | Compact tile, micro card |
| md | 16 | Metric tile, callout, history row, summary strip |
| lg | 20 | Input, device row, tab bar |
| xl | 24 | Section card |
| 2xl | 28 | Hero card |
| pill | 999 | Action buttons, status pills |

## Device & Connection Status Vocabulary

Canonical, app-wide status labels for devices and HR sources — defined once in
`src/types/deviceStatus.ts` (`DeviceStatus` + `DEVICE_STATUS_LABELS`) and rendered
identically on every surface (Home, Settings, Training). **One label per state; never invent
ad-hoc wording.** Always rendered as a color-coded **status pill** (`StatusPill` — see below),
never as plain `Name · Status` text. The device name and its status never share a single line.

| State | Label | Meaning |
|---|---|---|
| `notSetUp` | Not set up | no device saved / paired |
| `connecting` | Connecting... | BLE attempt in flight, or watch ride waking (before the first sample) |
| `ready` | Ready | usable (idle) / live-streaming (in-workout) |
| `paused` | Paused | active workout, source intentionally paused |
| `noSignal` | No signal | locked source, no fresh data for >15 s |
| `unavailable` | Unavailable | saved / selected but not reachable now |
| `off` | Off | exists but not the selected source |

In-workout the HR tile resolves `paused → ready → connecting → noSignal` (state machine in
`hrStatus.ts`); idle readiness gates each source on its own connection (watch companion presence,
BLE strap link, bike FTMS link). Integration links (**Strava**, **Apple Health**) use
**Connected / Not connected** — a separate account-linking domain, deliberately NOT part of this
device vocabulary.

## Status Pill (`StatusPill`)

The single component for rendering any `DeviceStatus` on a read-only surface
(`src/ui/components/StatusPill.tsx`). A `pill`-radius chip: a colored dot + the
`deviceStatusLabel` text on a tinted background. Each status maps to one of four **tones** via
`deviceStatusTone(status)` (`src/types/deviceStatus.ts`); the tone resolves to palette
tokens — no raw hex in the component. Per tone: **dot** = `success` / `warning` / `danger` /
`tabInactive`; **text** = `successInk` / `warningInk` / `dangerInk` / `tabInactive`; **background**
= that tone's color at ~16% alpha, except `inactive` which uses `surfaceMuted` (the designated pill
fill).

| Tone | Statuses | Dot / accent | Reads as |
|---|---|---|---|
| `good` | `ready` | `success` `#10b5a4` (teal) | usable / live |
| `working` | `connecting` | `warning` `#f5a524` (amber), **dot pulses** | in progress |
| `attention` | `noSignal` | `danger` `#ef4b5c` (coral) | needs a look |
| `inactive` | `unavailable`, `off`, `paused`, `notSetUp` | `tabInactive` `#7b8794` (gray) | not active |

- Only `connecting` animates — the dot pulses (opacity loop, `react-native-reanimated`). All other
  states render a static dot.
- a11y: the label text carries the status for screen readers; the dot is decorative. Callers may
  pass `accessibilityLabel` for extra context (e.g. the device name).
- **One chip everywhere.** Used by the Home Smart Bike + Heart Rate cards (via `SourceRow`), the
  Settings `GearTile`, and the Training Smart Bike-status pill + `HeartRateSourceTile`. Never re-style the status
  inline — always render `StatusPill`.

### Calm Noir StatusPill tones

On dark surfaces (Home screen, tab bar chrome) pass `scheme="noir"` to `StatusPill`. The component
selects `noirPillTones` (`src/ui/theme.ts`) instead of the default light `TONE_COLORS`. All four
tones map to the same logical meaning; only the exact hex values differ to read well on `noir.bg`
(`#0b0e13`).

| Tone | Statuses | Background | Foreground (text + dot accent) | Dot |
|---|---|---|---|---|
| `good` | `ready` | `rgba(16, 181, 164, 0.12)` | `#4fd8c8` (mintSoft) | `#10b5a4` (mint) |
| `working` | `connecting` | `rgba(245, 165, 36, 0.12)` | `#f7c065` (amber light) | `#f5a524` (amber) |
| `attention` | `noSignal` | `rgba(239, 75, 92, 0.14)` | `#f4818d` (coral light) | `#ef4b5c` (coral) |
| `inactive` | `unavailable`, `off`, `paused`, `notSetUp` | `rgba(255, 255, 255, 0.04)` | `#6b7384` (ink3) | `#4a5260` (dim) |

## Source Row (`SourceRow`)

Reusable label / device / status row for the Home cards (`src/ui/components/SourceRow.tsx`): a muted
category **label** on the left (e.g. `Bluetooth HR`, `Apple Watch`, or the bike name), an optional
**device-name sub-line** beneath it (`textSoft`, single line, ellipsized), and a right-pinned
`StatusPill`. When a card lists more than one source (the Heart Rate card), a hairline `border`
divider separates the rows. The chip never truncates; the device name yields space. The Home Heart
Rate card always shows the **Bluetooth HR** row, the **Apple Watch** row when the Watch is a platform
option, and a **Bike pulse** row when the bike is the effective HR source — so the source actually in
effect is never invisible. The Apple Watch row reads `Off` unless the Watch is the effective primary.

## Home Device Card (`DeviceCard`)

The noir-first pattern for representing a device on the Home screen (`src/features/home/components/DeviceCard.tsx`).
Each card shows: a **rounded icon box** (Ionicons glyph, `indigoSoft` tint), the device **name** in
primary ink (bold, single line, ellipsized), a **kind** sub-label (`ink3`, e.g. `Smart Bike`,
`Heart Rate · Chest strap`), and a right-pinned `StatusPill` with `scheme="noir"`. When the device
is not set up or not the effective source, the card is **muted**: the icon box and name shift to
`ink3`/`#1d222b` to signal it is present but inactive.

Resolver-driven visibility (same rules as `SourceRow`):
- **Apple Watch** card is rendered only when the Watch is a platform option (`watchAvailable` from
  `useWatchHrControls`).
- **Bike pulse** card is rendered only when the bike is the effective primary HR source
  (`effectivePrimary === 'bike'` from `useWatchHrControls`).
- Smart Bike and Bluetooth HR cards are always present (muted when not saved).

## Gear / HR-Source Tiles

Pattern for device & HR-source rows in Settings → "My Gear" — the icon-led **`GearCard`**
(`src/features/settings/components/GearCard.tsx`), rendered in Calm Noir under flat section labels
(`SectionLabel` / `Eyebrow`, no `SectionCard` box). One tile per device (never list a device twice).
Each tile shows a **leading Ionicons icon box** (mirroring Home's `DeviceCard`), the device **name**,
a **`kind`** sub-label, and a right-pinned **`StatusPill`** (`scheme="noir"`). The selected HR
source's kind reads "`<kind> · primary`" — an explicit selection cue alongside the accent bar. The
trainer device is labelled **Smart Bike** everywhere it appears (Home card title, this section's
label, the Training connection pill); the bike-derived HR source keeps its distinct name **Bike
pulse**. Two distinct interactions, two distinct affordances:

- **Selection** (HR sources only): tap the tile body → it becomes the primary source, shown by a
  **4px leading accent bar** (`primary`) + `primarySubtle` tint + bold `primary` name. **No radio.**
  Exactly one HR source selected at a time. a11y: `accessibilityState={{ selected }}`. Until the
  user picks one, the selected tile is the **effective default** — the availability-ranked fallback
  `watch → bluetooth → bike` (`resolveEffectivePrimary`) — so a tile is always shown selected, never
  "nothing selected". A primary that loses its backing device (e.g. a forgotten Bluetooth strap)
  falls back to that default.
- **Management** (only tiles that have actions — the Smart Bike and a Bluetooth strap): a **right-edge
  chevron** (`Ionicons` `chevron-down`/`chevron-up`, `textMuted` → `primary` when open) reveals
  Connect / Replace / Forget **inside** the tile on tap; the chevron rotates 180° when open.
  Action buttons are conditionally rendered (absent from the tree until expanded). The chevron is
  a separate press target from the body (expanding never selects).
- Tiles with nothing to manage (**Apple Watch**, **Bike pulse**) have **no chevron**.
- The **Smart Bike** tile is an **expander, not a selectable** — no accent bar; tapping it toggles its
  management; a11y: `accessibilityRole="button"` + `accessibilityState={{ expanded }}`.
- **Empty slots use `AddGearTile`** (`src/ui/components/AddGearTile.tsx`) — a **dashed**, full-width
  tap-to-add tile (`Ionicons add` + label in `primary`), visually distinct from a populated tile.
  The no-bike state is **＋ Set Up Smart Bike**. (The no-strap HR state still uses the plain
  full-width **Add Bluetooth HR** `ActionButton`.)

## History list

History (`src/features/history/`, mockup `design-mockups/app/screen-06-history.html`) is fully Calm Noir.

- **Screen head** — in-screen `History` title + `Your completed rides.` subline (the tab uses
  `headerShown: false`); the screen owns its `SafeAreaView` over `noir.bg`.
- **Summary strip** (`HistorySummaryStrip`) — one `noir.card` strip split into three hairline-divided
  cells (`This Month` rides · `Distance` km · `Time`), aggregated over the **current calendar month**
  via the pure `deriveHistorySummary(sessions, now)`.
- **History row** (`WorkoutHistoryListItem`) — `noir.card`, radius `md`, showing date
  (`Sat, May 30`) + a compact metrics line (`18.4 km · 1h 2m · 512 kcal`), provider icons, and a
  trailing chevron. **Tap** opens the ride summary; **long press** confirms delete (no inline trash
  button, keeping the row clean — the `accessibilityHint` advertises the long-press action).
- **Provider status icons** (`ProviderStatusIcons`) — every row shows *all* known providers using
  their real glyphs (Strava `FontAwesome5 strava`, Apple Health `Ionicons heart`) but recoloured to
  the app palette: **`noir.mintSoft` when synced, `noir.ink3` when not**. Brand colours (e.g. Strava
  orange `#FC4C02`) are never used — the colour means "synced / not synced", not the brand.

## Illustration Style

Flat illustration with soft gradients in the brand palette. No photorealism. No text inside illustrations. Square aspect for hero illustrations. Consistent line weight and color treatment across all screens — illustrations in the same flow MUST share style.

## Dark / Light Migration Status

The **Home**, **History**, and **Settings** screens — and the **bottom tab bar** — are all fully
migrated to the Calm Noir dark theme. Every tab screen hides the navigation header
(`headerShown: false`) and renders its own in-content Calm Noir header over `noir.bg`; the shared
**tab bar chrome** (background, borders, icon tints) is the dark bar. No tab screen needs a
light-header override anymore, so the former `LIGHT_SCREEN_OPTIONS` in `app/(tabs)/_layout.tsx` has
been removed.
