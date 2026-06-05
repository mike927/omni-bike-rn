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

Icons are **sourced as-is from Lucide** (MIT) — never hand-author/approximate icon paths (see
`AGENTS.md` → Icons & assets). Keep the `class="lucide lucide-*"` marker so sourced icons stay
identifiable.

```html
<div class="statusbar">
  <span>9:41</span>
  <span class="glyphs">
    <svg class="lucide lucide-signal" xmlns="http://www.w3.org/2000/svg" width="15" height="13" viewBox="0 0 24 24" fill="none" stroke="#eef1f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
    <svg class="lucide lucide-wifi" xmlns="http://www.w3.org/2000/svg" width="16" height="13" viewBox="0 0 24 24" fill="none" stroke="#eef1f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>
    <svg class="lucide lucide-battery-full" xmlns="http://www.w3.org/2000/svg" width="24" height="13" viewBox="0 0 24 24" fill="none" stroke="#eef1f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v4"/><path d="M14 10v4"/><path d="M22 14v-4"/><path d="M6 10v4"/><rect x="2" y="6" width="16" height="12" rx="2"/></svg>
  </span>
</div>
```

## Tab bar (paste verbatim on the 3 TAB screens — Home, History, Settings)

The app has exactly three tabs: **Home · History · Settings**. Set `active` on the current one.

```html
<div class="tabbar">
  <div class="tab {active on Home}">
    <svg class="lucide lucide-house" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    Home
  </div>
  <div class="tab {active on History}">
    <svg class="lucide lucide-history" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
    History
  </div>
  <div class="tab {active on Settings}">
    <svg class="lucide lucide-settings" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
    Settings
  </div>
</div>
```

## Pushed-screen nav bar (screens reached by push: Onboarding-substeps, Gear Setup, Training, Summary, User Profile, Provider Gear Link)

```html
<div class="navbar">
  <div class="nav-btn"><svg class="lucide lucide-chevron-left" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></div>
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
- **Icons must be sourced as-is** from a license-clean set (Lucide / Feather / Ionicons; Simple Icons
  for brand marks like Strava) — never hand-author or approximate icon SVG paths (`AGENTS.md` → Icons
  & assets). Keep the `class="lucide lucide-*"` / `class="si-strava"` marker. Brand marks are
  recolored to the palette (mint/indigo) — never brand orange. Bespoke *illustrations* (diagrams,
  charts, connectors) are exempt.
