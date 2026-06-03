# Omni Bike — Home Screen Theme Mockups (shared spec)

You are producing ONE self-contained HTML mockup of the **Home screen** of **Omni Bike**, an
indoor-cycling app (think Strava / Apple Fitness quality bar, but this is a training app for smart
bikes / turbo trainers). The user is reviewing 10 of these side by side to pick ONE design system
for the whole app. Your job: make YOUR assigned aesthetic direction unforgettable and cohesive.

## Hard rules (identical across all 10 — do NOT change)

1. **Single file, no build step.** Pure HTML + CSS (+ a tiny bit of vanilla JS only if needed for a
   micro-interaction). Fonts via Google Fonts `<link>`. No frameworks, no external images except
   inline SVG or CSS. Inline `<style>` in the file. Must open directly in a browser.
2. **Render inside a phone frame.** The screen content lives in a device of **390 × 844 CSS px**
   (iPhone-ish), rounded screen corners ~`44px`, on a neutral page background that suits your theme
   (a soft studio backdrop, gradient, or flat tone). Center it vertically and horizontally with
   generous margin so it reads as a device mockup. A subtle bezel/shadow is good. A status bar
   (time **9:41**, signal/wifi/battery glyphs) sits at the top of the screen. A bottom tab bar with
   3 items — **Home (active), Train, Profile** — sits pinned at the bottom. Content between them
   scrolls conceptually but should fit/feel complete in the 844px height.
3. **Show ALL of this content** (you may reorganize, rename labels, merge, add supporting stats, and
   restructure into heroes/rows/cards however your aesthetic wants — but every piece of info below
   must be present and legible):
   - **Greeting / identity:** a header. Athlete name is **Michal**. App name **Omni Bike**.
     Today is **Mon, Jun 1**. A short motivating subtitle is welcome.
   - **Primary action — Start a ride.** The dominant CTA. Label it "Start Ride" / "Start Training" /
     "Quick Start" (your choice). This is the hero of the screen; it must feel like the obvious tap.
   - **Smart Bike status:** device name **Wahoo KICKR Bike**, status **Ready** (connected/good).
   - **Heart Rate status:** device name **Polar H10**, status **Ready**. (Optionally also show an
     **Apple Watch — Off** secondary source.)
   - Status is shown as a small color-coded **pill/chip** (a colored dot + word). "Ready" = positive.
   - **Latest workout** recap card: **Sat, May 30** · duration **42:18** · distance **18.4 km** ·
     **512 kcal** · avg power **187 W** · avg HR **142 bpm**. Include a "View summary" affordance.
   - **One ambient/weekly stat** of your choosing to add life: e.g. this-week total
     **3 rides · 1h 58m · 632 kcal**, or a 7-day streak, or a small bar/spark visualization. Keep it
     real-looking, not lorem.
4. **Quality bar:** production-grade, meticulous spacing, real type hierarchy, cohesive palette,
   tasteful motion (a single orchestrated load reveal with staggered `animation-delay`, and hover/
   press affordances). NO generic AI look: avoid Inter/Roboto/Arial/system-ui as your display face,
   avoid the cliché purple-gradient-on-white, avoid cookie-cutter card grids unless the direction
   demands it. Commit fully to YOUR direction.
5. **Self-label.** In a corner of the page background (outside the device), show a small caption:
   the theme number + name + "light"/"dark" (e.g. `01 · Aurora Glass · dark`). Keep it unobtrusive.
6. Use **accessible contrast** for all text. Touch targets feel ≥44px. Real, legible numbers.

## Sample data to use verbatim
- Athlete: Michal · App: Omni Bike · Date header: Mon, Jun 1
- Smart Bike: Wahoo KICKR Bike — Ready
- Heart Rate: Polar H10 — Ready (optional: Apple Watch — Off)
- Latest workout: Sat, May 30 · 42:18 · 18.4 km · 512 kcal · 187 W avg · 142 bpm avg
- This week: 3 rides · 1h 58m · 632 kcal

## Output
Write your file to the exact path you are told. Nothing else. Make it beautiful.
