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
  Settings `GearTile`, and the Training `ConnectionFooter` (Smart Bike + Heart Rate rows). Never
  re-style the status inline — always render `StatusPill`. In particular, never show status as plain
  `Name · Status` text: the device name and its status never share a single line.

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
Rate card always shows the **Bluetooth HR** row and the **Apple Watch** row when the Watch is a
platform option — so the source actually in effect is never invisible. The Apple Watch row reads
`Off` unless the Watch is the effective primary.

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
- Smart Bike and Bluetooth HR cards are always present (muted when not saved).

## Gear / HR-Source Tiles

Pattern for device & HR-source rows in Settings → "My Gear" — the icon-led **`GearCard`**
(`src/features/settings/components/GearCard.tsx`), rendered in Calm Noir under flat section labels
(`SectionLabel` / `Eyebrow`, no `SectionCard` box). One tile per device (never list a device twice).
Each tile shows a **leading Ionicons icon box** (mirroring Home's `DeviceCard`), the device **name**,
a **`kind`** sub-label, and a right-pinned **`StatusPill`** (`scheme="noir"`). The selected HR
source's kind reads "`<kind> · primary`" — an explicit selection cue alongside the accent bar. The
trainer device is labelled **Smart Bike** everywhere it appears (Home card title, this section's
label, the Training connection footer). Two distinct interactions, two distinct affordances:

- **Selection** (HR sources only): tap the tile body → it becomes the primary source, shown by a
  **4px leading accent bar** (`primary`) + `primarySubtle` tint + bold `primary` name. **No radio.**
  Exactly one HR source selected at a time. a11y: `accessibilityState={{ selected }}`. When at least
  one source is available and the user hasn't picked one, the selected tile is the **effective
  default** — the availability-ranked fallback `watch → bluetooth` (`resolveEffectivePrimary`). With
  no watch and no saved strap there is **no HR source**, and the Heart-Rate status reads
  **Not set up** (the "Add Bluetooth HR" CTA is the path forward). A primary that loses its backing
  device (e.g. a forgotten Bluetooth strap) falls back to that default.
- **Management** (only tiles that have actions — the Smart Bike and a Bluetooth strap): a **right-edge
  chevron** (`Ionicons` `chevron-down`/`chevron-up`, `textMuted` → `primary` when open) reveals
  Connect / Replace / Forget **inside** the tile on tap; the chevron rotates 180° when open.
  Action buttons are conditionally rendered (absent from the tree until expanded). The chevron is
  a separate press target from the body (expanding never selects).
- Tiles with nothing to manage (**Apple Watch**) have **no chevron**.
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
  button, keeping the row clean). Delete is also exposed to assistive tech via an
  `accessibilityActions` "Delete workout" action (VoiceOver rotor), so it isn't pointer-only.
- **Provider status icons** (`ProviderStatusIcons`) — every row shows *all* known providers using
  their real glyphs (Strava `FontAwesome5 strava`, Apple Health `Ionicons heart`) but recoloured to
  the app palette: **`noir.mintSoft` when synced, `noir.ink3` when not**. Brand colours (e.g. Strava
  orange `#FC4C02`) are never used — the colour means "synced / not synced", not the brand.

## Training dashboard

The live ride screen (`src/features/training/`, mockup `design-mockups/app/screen-04-training-D-pairs.html`)
is Calm Noir, **Direction D — "Featured Pairs"**. It is a pushed screen: `headerShown: false`, its own
`SafeAreaView` over `noir.bg`, an in-screen back chevron + `Training` title, and a **pinned bottom
control bar** (outside the scroll) hosting the phase-driven actions.

- **Timer header** (`RideTimerCard`) — a `noir.card` strip with an `Elapsed · {READY|ACTIVE|PAUSED}`
  eyebrow and the big `mm:ss` (`formatDuration`). A small mint **recording dot** shows while a ride
  is live (a recording indicator, *not* a device-status pill).
- **Featured pair** (`FeatureMetricCard`) — two hero cards: **Power** (W) carrying a live
  `PowerTrend` sparkline, and **Heart Rate** (mint `accent`, bpm, `--` when null) carrying the
  resolved HR **source name** (identity only — status lives in the footer pill, never as text).
- **Secondary metrics** (`SecondaryMetricsRow`) — four equal chips: Speed · Distance · Cadence ·
  Calories (whole-number kcal). All from `currentMetrics` / session totals.
- **Connection footer** (`ConnectionFooter`) — the canonical status surface: a Smart Bike row and a
  Heart Rate row, each `name` + right-pinned `StatusPill` (`scheme="noir"`).
- **Controls** (`RideControls`) — phase-driven `ActionButton`s (`scheme="noir"`): `Start Ride`
  (idle, disabled until the bike is connected) → `Pause` + `Finish` (active) → `Resume` + `Finish`
  (paused). When the bike drops while idle/paused, a `DisconnectedCallout` offers Set Up / Back Home.
- **Power sparkline buffer** — a screen-local ring buffer (`usePowerTrend`, ~60 samples); a display
  concern only, never written to the session store/engine.
- The phase → label/controls/callout mapping is a pure, unit-tested view-model
  (`deriveTrainingView`, mirroring `homeViewModel`).

## Training summary

The ride-finished screen (`src/features/training/screens/TrainingSummaryScreen.tsx`, mockup
`design-mockups/app/screen-05-training-summary-A-finisher.html`) is Calm Noir,
**Direction A — "Finisher"**. Pushed screen: `headerShown: false`, its own `SafeAreaView` over
`noir.bg`, in-screen back chevron + `Summary` title, and a **pinned bottom bar** hosting
`Discard` (danger) + `Save`/`Done` (primary). It surfaces per-second sample data the DB already
stores rather than only the final instantaneous reading.

- **Ride-complete hero** (`RideCompleteHero`) — a `noirGradient.cta` card with a ✓ badge,
  `RIDE COMPLETE` eyebrow, the big **distance** headline, and a pill sub-row (date · moving time ·
  calories).
- **Effort tiles** (`EffortStatTile`, 2×2) — **averages** for Power · HR · Speed · Cadence, each
  with a mint `Max …` **peak** sub-line. Power tile = indigo lightning, HR tile = mint heart.
- **Power trend** — the whole ride's power, downsampled to ≤12 averaged buckets, drawn with the
  same `PowerTrend` bars as the live screen (shown only when samples exist).
- **Share row** — compact combined `Strava` + `Apple Health` `ActionButton`s (`scheme="noir"`),
  preserving the upload state machine (ready → uploading → `✓` / `Retry`), plus a `Recorded on …`
  gear caption from the session's bike/HR snapshots.
- Averages/peaks/trend/gear are a pure, unit-tested view-model (`deriveSummaryView`). The
  final-snapshot fallback applies **only when no samples were persisted**; with samples present the
  screen trusts them (so a ride with no HR source reads `--`, not a stale final reading).

## User Profile

The body-metrics screen (`src/features/settings/screens/UserProfileScreen.tsx`, mockup
`design-mockups/app/screen-08-user-profile-A-athlete.html`) is Calm Noir, **Direction A —
"Athlete card"**. Pushed screen: `headerShown: false`, own `SafeAreaView` over `noir.bg`, in-screen
back chevron + `User Profile` title. **No user accounts** — never a name or avatar; this is body
data, not a profile identity.

- **Athlete hero** (`AthleteHeroCard`) — a `noir.card` "Body Profile" stat card: a 2×2 grid of
  Sex · Age · Weight · Height (Age derived from DOB) plus a **calorie-accuracy badge** with a
  one-line caption. Pure, unit-tested view-model `deriveProfileView` (reuses `deriveAgeYears` /
  `toKeytelInputs` / `toMifflinInputs`): all four fields → **Best** (mint); Keytel-complete but no
  height → **Good** (amber); otherwise → **Set up** (gray). The hero never renders a provider name.
- **Sync from a provider** — `Sync from Apple Health` / `Sync from Strava`
  (`ActionButton scheme="noir"`), disabled until that provider is connected; success/error status
  line beneath.
- **Personal fields** — Sex (segmented Male/Female), Date of Birth, Weight (kg), Height (cm); each
  row keeps its **source badge** (`Apple Health` / `Strava` / `Manual`) and a per-field Clear action.
  The blur-preserve editing rules and the explicit-sync-wins-per-field contract are unchanged.
- **How this is used** + **Clear All Fields** (danger) explain the Keytel / Mifflin–St Jeor usage.

## Link Provider Bike

Provider-gear linking (`src/features/integrations/screens/ProviderGearLinkScreen.tsx`, mockup
`design-mockups/app/screen-09-provider-gear-link-D-garage.html`) is Calm Noir, **Direction D —
"Garage browser"**. Pushed screen: `headerShown: false`, own `SafeAreaView` over `noir.bg`,
in-screen back chevron + `Link Provider Bike` title, and a **pinned bottom action bar**.

- **Garage header** — a provider chip showing **provider identity only** (e.g. `Strava`, mint
  accent — never brand orange; **no `Connected`/status claim** unless backed by a verified
  connection state) + a `Linking to · {bike}` context line, then the **Your Omni Bike** card with
  the current link status (none / linked / stale).
- **Available Provider Bikes** (`AvailableProviderBikeList` → `ProviderBikeRow`) — **tap-to-select**
  rows (`BikeGlyph` + name + meta); the selected row carries the 4px indigo accent-bar treatment
  (mirroring the Settings gear-selection pattern), and a mint **Possible match** pill marks computed
  matches. Meta strings come from the pure `providerBikeMetaLabel` view-model.
- **States preserved** — bike-required, reconnect-required, loading, no-provider-gear, and error each
  render as a noir card with the original copy; a dashed **Open Strava Gear** footer also covers the
  no-gear path.
- **Actions** — `Link Bike` (disabled until a bike is selected), `Skip for Now`, and `Unlink`
  (danger, shown only when a link exists).

## Watch companion (Calm Noir)

The Apple Watch app (`ios/OmniBikeWatch Watch App/ContentView.swift`, mockups in
`design-mockups/watch/`) is Calm Noir, **Direction 02 "Big Number"**. It mirrors the phone's
ride flow on the wrist without duplicating it: the Watch surfaces **live HR**, **elapsed time**,
an **honest status**, and **on-wrist controls** — the bike metrics (Power/Speed/Cadence/Distance)
stay on the phone. The screen uses **OLED black** (`#000`) rather than `noir.bg` so the Always-On
state is cheaper to drive; all accents are the canonical tokens (mint `#10b5a4` / mintSoft
`#4fd8c8`, amber `#f5a524`, danger `#ef4b5c`, ink `#eef1f6` / ink3 `#6b7384`).

- **Active** — a status pill (the `DeviceStatus` vocabulary: **Ready / Connecting… / No signal /
  Paused**, same tones as the phone `StatusPill`), the **HR numeral hero** (mintSoft, `--` before
  the first sample), the **elapsed** `mm:ss` (from the workout builder, excludes paused time), and
  phase-driven controls: **Pause + End** (active) → **Resume + End** (paused). Pause is amber-tinted,
  Resume is mint-filled, End is danger-tinted.
- **Idle** — a calm "Ready to ride · Start your ride on iPhone" prompt (Start stays on the phone,
  where the BLE bike connects).
- **Always-On** (`isLuminanceReduced`) — status + HR + elapsed only, no buttons, dimmed.
- **Status derivation** — `Connecting…` (active, no sample yet) → `Ready` (fresh HR) → `No signal`
  (HR stalled > 8 s) → `Paused` (session paused).

**Controls are "watch-as-remote"** (the iPhone owns the ride): tapping Pause/Resume/End sends a
`watchControl` request to the iPhone, which runs the **same** `useTrainingSession` action a phone tap
would — so the engine, the bike FTMS state, persistence, navigation, and the Watch's own
`HKWorkoutSession` all stay in lockstep. See
[`watch-iphone-communication.md`](docs/apple-watch/watch-iphone-communication.md).

## Illustration Style

Flat illustration with soft gradients in the brand palette. No photorealism. No text inside illustrations. Square aspect for hero illustrations. Consistent line weight and color treatment across all screens — illustrations in the same flow MUST share style.

## Dark / Light Migration Status

The **Home**, **History**, and **Settings** screens — the **bottom tab bar**, and the pushed
**Training** dashboard — are all fully migrated to the Calm Noir dark theme. Every tab screen hides
the navigation header (`headerShown: false`) and renders its own in-content Calm Noir header over
`noir.bg`; the shared **tab bar chrome** (background, borders, icon tints) is the dark bar. No tab
screen needs a light-header override anymore, so the former `LIGHT_SCREEN_OPTIONS` in
`app/(tabs)/_layout.tsx` has been removed. Training is a pushed screen with `headerShown: false`
(its `contentStyle` background is `noir.bg`) and its own in-screen back header.

The pushed **User Profile** and **Link Provider Bike** screens are now Calm Noir too — both
`headerShown: false` with a `noir.bg` `contentStyle` and their own in-screen back header (see their
sections below). The **only** surface still on the old light `palette` is the root `_layout`
error/loading fallback (small placeholder views, not a full screen).
