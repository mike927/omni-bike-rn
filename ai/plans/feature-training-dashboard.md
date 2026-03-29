# Plan: Functional Training Dashboard Screen

Branch: `feature/training-dashboard`

## Summary

Implement the next `plan.md` item as a focused Phase 3 change: turn `/training` into the real in-session workout dashboard without pulling in later work like orientation-specific layouts, persistence, crash recovery, finish confirmation, or summary upload actions.

## Key Changes

- Rework the existing training route screen into a functional, utilitarian ride dashboard built around the five planned headline metrics: elapsed time, speed, heart rate, power, and calories.
- Keep cadence, resistance, distance, and connection/source status as secondary information rather than removing them, since the data already exists and helps riders verify device health during a session.
- Keep the current session controls on the training screen: `Start`, `Pause`, `Resume`, `Finish`, and `View Summary`, with behavior unchanged from the current hook/store implementation.
- Improve the disconnected-bike state on the training screen: keep the route accessible, disable `Start`, and add a clear recovery action that sends the user to bike setup or back to the setup hub instead of only showing passive helper text.
- Tighten the information hierarchy so the screen reads as “live workout first” rather than “generic shell with cards,” while still using the project’s existing shared UI primitives unless a small dashboard-specific presentation helper is needed.
- Leave Home, History, Settings, and Summary structurally intact. Only make minor copy or CTA adjustments outside `/training` if they are necessary to keep the flow coherent.

## Public APIs / Interfaces

- No new cross-feature contract is required.
- Reuse the existing `useTrainingSession` and `useDeviceConnection` hooks as the screen data source.
- Do not change session-state semantics in the store or hook for this task.
- If the screen needs derived display data, keep it local to the training feature as presentation logic rather than changing shared domain types.

## Explicit Scope Boundaries

- Do not bundle portrait/landscape-specific layout work from the next plan item.
- Do not add DB persistence, interrupted-session restore, finish confirmation, bike-stop prompt UX, save/upload/export actions, or Live Activities.
- Do not redesign the app shell into new route groups or separate connect flows in this task; the existing route structure is sufficient.

## Test Plan

- Update screen tests to cover the new dashboard hierarchy and disconnected-bike recovery CTA.
- Verify idle state with no connected bike: primary metrics render, `Start` is disabled, and the user gets a clear next action.
- Verify idle state with connected bike: `Start` is enabled and no disconnected recovery UI is shown.
- Verify active state: live metrics render with the five primary metrics prominent and the correct action buttons visible.
- Verify paused state: `Resume` and `Finish` are available, and active-only controls are hidden.
- Verify finished state: `View Summary` is shown and in-session controls are hidden.
- Verify heart-rate display prefers the merged session value and still presents a sensible fallback when HR is unavailable.
- Run the relevant Jest screen tests plus the existing training hook/store tests to ensure no behavioral regression.

## Assumptions And Defaults

- Scope is limited to "dashboard only," matching the next `plan.md` item exactly.
- UX style is functional/utilitarian for this phase; premium visual polish is deferred to Phase 7.
- The training route remains accessible without a bike connection; it should guide recovery instead of redirecting immediately.
- The five planned metrics are primary, while cadence/resistance/source status remain visible as secondary data.
- Current `finish()` behavior remains as-is for now; the later dedicated finish-flow task will own confirmation and auto-save behavior.
