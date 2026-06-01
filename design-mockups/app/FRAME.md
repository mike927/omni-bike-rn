# Calm Noir — shared frame & rules for every screen mockup

You are building ONE screen of **Omni Bike** (indoor-cycling app) as a single static HTML file in the
**Calm Noir** dark design system. ALL visual style comes from the shared stylesheet `calm-noir.css`
(same folder). Do NOT redefine the look — use its classes/tokens. You may add a small `<style>` block
ONLY for screen-specific one-offs (e.g. a particular chart), reusing the CSS variables.

## File skeleton (copy exactly, fill the marked parts)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Omni Bike · {SCREEN NAME}</title>
<link rel="stylesheet" href="calm-noir.css" />
</head>
<body>
  <div class="device">
    <div class="screen">
      {STATUS BAR}            <!-- always -->
      {NAVBAR or nothing}     <!-- pushed screens only; tab screens skip it -->
      <div class="content">
        ... screen content using design-system classes, each top block gets reveal d1..d8 ...
      </div>
      {TABBAR or ACTION-BAR}  <!-- tab screens: .tabbar ; pushed screens: optional .action-bar -->
      <div class="home-indicator"></div>
    </div>
  </div>
  <div class="caption"><b>{NN · Screen Name}</b> · dark</div>
</body>
</html>
```

## Status bar (paste verbatim, always present)

```html
<div class="statusbar">
  <span>9:41</span>
  <span class="glyphs">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
      <rect x="0" y="8" width="3" height="4" rx="1" fill="#eef1f6"/>
      <rect x="5" y="5" width="3" height="7" rx="1" fill="#eef1f6"/>
      <rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="#eef1f6"/>
      <rect x="15" y="0" width="3" height="12" rx="1" fill="#eef1f6"/>
    </svg>
    <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
      <path d="M8.5 2.2c2.7 0 5.2 1 7.1 2.8l-1.5 1.6A7.9 7.9 0 0 0 8.5 4.3 7.9 7.9 0 0 0 2.9 6.6L1.4 5C3.3 3.2 5.8 2.2 8.5 2.2Z" fill="#eef1f6"/>
      <path d="M8.5 6.1c1.6 0 3.1.6 4.2 1.7l-1.6 1.6A3.7 3.7 0 0 0 8.5 8.3c-1 0-2 .4-2.7 1.1L4.3 7.8A6 6 0 0 1 8.5 6.1Z" fill="#eef1f6"/>
      <circle cx="8.5" cy="11" r="1.3" fill="#eef1f6"/>
    </svg>
    <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
      <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="#eef1f6" stroke-opacity="0.4"/>
      <rect x="2" y="2" width="17" height="9" rx="2" fill="#eef1f6"/>
      <rect x="24" y="4" width="1.6" height="5" rx="0.8" fill="#eef1f6" fill-opacity="0.45"/>
    </svg>
  </span>
</div>
```

## Tab bar (paste verbatim on the 3 TAB screens — Home, History, Settings)

The app has exactly three tabs: **Home · History · Settings**. Set `active` on the current one.

```html
<div class="tabbar">
  <div class="tab {active on Home}">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 11l8-6.5L20 11v8a1.5 1.5 0 0 1-1.5 1.5H15v-5h-6v5H5.5A1.5 1.5 0 0 1 4 19v-8Z" fill="currentColor"/></svg>
    Home
  </div>
  <div class="tab {active on History}">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 3v5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 7.5v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    History
  </div>
  <div class="tab {active on Settings}">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"/>
      <path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.92 1.2V20a2 2 0 1 1-4 0v-.06a1.7 1.7 0 0 0-2.92-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 6.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 11 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.06a1.7 1.7 0 0 0 2.92 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 11a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.06a1.7 1.7 0 0 0-1.54 1Z" stroke="currentColor" stroke-width="1.5"/>
    </svg>
    Settings
  </div>
</div>
```

## Pushed-screen nav bar (screens reached by push: Onboarding-substeps, Gear Setup, Training, Summary, User Profile, Provider Gear Link)

```html
<div class="navbar">
  <div class="nav-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <div class="nav-title">{Title}</div>
  <div></div>  <!-- or a .nav-right-link like "Skip" -->
</div>
```
Pushed screens use `.navbar` at top and DO NOT show the `.tabbar`. If the screen has one dominant
primary action (e.g. "Use This HR Source", "Save"), pin it in a bottom `.action-bar`; otherwise let
content scroll.

## Hard rules
- 390×844 device, exact frame from `calm-noir.css`. Content must feel complete within the height
  (it's fine if a lower section is partially clipped by the tab bar like a real scroll view).
- Use the EXACT copy/labels given in your screen brief (quote real strings).
- **No user accounts exist** — never show a personal name or a user avatar. No "Michal", no "M" chip.
- Status uses the `.pill` component with the right tone class (`good`=Ready/teal, `working`=Connecting/amber pulsing, `attention`=No signal/coral, `inactive`/`off`=gray).
- Give the screen ONE tasteful staggered load reveal (`reveal d1..d8` on top-level blocks).
- Real, legible numbers. Accessible contrast (the CSS already handles it). Touch targets ≥44px.
- Self-label caption in the corner: `{NN · Screen Name} · dark`.
- Inline SVG only for icons/illustrations — no external images.
