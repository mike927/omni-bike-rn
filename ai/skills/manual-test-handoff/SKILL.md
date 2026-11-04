---
name: manual-test-handoff
description: >-
  Use whenever you hand off an on-device or manual verification to the user in this
  Expo/React Native bike app — building/installing to the iPhone or Apple Watch, or testing
  HR / WatchConnectivity / BLE / metronome / background-lifecycle behavior that unit tests
  can't prove. Produces a structured, sectioned handoff (what's verified, build/refresh
  preconditions, device-by-device steps, explicit pass/fail criteria, what to report) so the
  user knows exactly what to do and the agent verifies from logs, not by eye. Trigger even
  when the user only says "test it", "try it on device", "manual test", "let's verify",
  "check it on the phone/watch", "does it work now", or right after you finish or merge a
  change that can only be confirmed on a real device. Always route on-device verification
  through this skill rather than improvising a step list.
---

# Manual Test Handoff

## Why this exists

On-device behavior (HR streaming, WatchConnectivity, BLE, background lifecycle) can't be
proven by jest. The risk is a vague "try it and see" that wastes a device cycle and gets
judged by eye. This skill makes every manual-test handoff **complete and log-driven**: the
user gets unambiguous steps and pass criteria, and the agent confirms the result from
captured native `wc.log` / Metro traces — facts, not impressions. A device cycle is expensive; never spend
one on a handoff that's missing a precondition or a pass criterion.

## Required structure

Produce the handoff in **these sections, in this order**. Scale each to the test; omit a
section only if it genuinely doesn't apply (say so).

1. **What we're verifying** — 1–2 lines: the change under test and the exact behavior(s).
   Tie to the spec's acceptance criteria when one exists (`docs/superpowers/specs/…`).
2. **Preconditions** — one **action-first checklist table** the user reads top-to-bottom:
   columns `Do?` | `Action` | `Where` | `Confirm`.
   - `Do?` = **✅ (do this)** or **❌ (skip / not needed for this test)** — a green/red glance
     tells the user which rows to act on. (Don't title it "Do this", since some rows are skips.)
   - **Always lead with the three build/refresh rows** — `Reload Metro (JS)`, `Rebuild iPhone
     app`, `Rebuild Watch app (matched pair)` — each marked ✅ (needed) or ❌ (skip) per what
     changed (see *Device workflow*). Showing all three forces a
     conscious choice and prevents the classic misses (a JS change never reloaded, a
     watch-native change that never reached the Watch). An iPhone rebuild includes the
     JS bundle. For a matched Release refresh, use the commands in the verification workflow
     and mark both device installs explicitly. For a ❌ row, put the reason in `Confirm`
     (e.g. "skip — no JS changed").
   - `Action` / `Where` / `Confirm` = the concrete action, the surface, and the signal it's
     satisfied. In `Where`, **name in-app surfaces explicitly** — e.g. "mobile app →
     Settings tab", not bare "Settings" — so they aren't confused with the **iOS system
     Settings** app. Reserve "iOS Settings" for the system app; use "terminal" or "Xcode"
     for the Mac. Fold any "if not, fix" into `Confirm` parenthetically. Before the first device action,
     state how long both devices must remain unlocked through installation and evidence capture.
     If Auto-Lock interrupts the run, offer temporarily disabling it and restoring it afterward.
3. **Steps** — render as a **table**: columns `#` | `On` | `Action` | `What you should see`.
   `On` names where the action happens — **📱 mobile app**, **⌚ watch app**, or **🤚 physical**
   (hardware/body actions like removing a strap or covering a sensor) — because this app spans
   two devices and a bare "the app" is ambiguous. **One concrete action per row** ("background
   it >30s", "force-quit it"); `What you should see` is the immediate observable for that step
   (the formal verdict lives in Pass criteria). No ambiguity about what to tap or where.
4. **Pass criteria** — a compact table mapping each check to its expected result, plus what a
   **fail** looks like (e.g. "must NOT fall back to bike"). Keep every criterion to something
   the **user can observe on the devices** (tile text, the watch timer, a number appearing) —
   **not** log lines. The user can't see Metro/`wc.log`; log evidence belongs in your Verdict's
   `Evidence` column, not in the handoff. Pull these from the acceptance criteria, don't invent.
5. **What to report back** — keep it minimal for the user: usually "say done" + flag any
   anomaly. Tell them you'll verify from logs (so the verdict is fact-based) — but don't dump
   commands at them.
6. **Branches / troubleshooting** — "if X then Y" for the known failure modes (tunnel error,
   companion unavailable, etc.). Link the relevant branch of the verification workflow.

**Evidence capture is YOUR internal step — do NOT render it as a section.** After the user
reports "done", run the log-pull/grep commands from *Device workflow* yourself and
derive the verdict. The user doesn't run them, so putting commands in the handoff is just
noise. The point — keep the verdict log-based, not by-eye — still holds; it just happens on
your side, not in the handoff.

Split the work clearly: **the user does physical-device actions; the agent pulls and reads
logs and renders the verdict.** Don't ask the user to read logs.

Match the user's answer-format preference: lead with a one-line "what we're verifying",
use a small table for pass criteria, keep prose tight.

**Lead with a `⏱ ~N min` estimate** by the title so the user knows the commitment, and make the
run abortable: **if any precondition's `Confirm` can't be met, stop and fix it first** (its row
or a build row) — a half-set-up run wastes a device cycle.

## Verdict — your reply after the user says "done"

Don't just say "works." After pulling the logs, reply in the same fact-based spirit as the
handoff:

- **One-line verdict** — ✅ pass / ❌ fail / ⚠️ inconclusive + the headline.
- **Per-criterion table** `Check | Result | Evidence` — each pass-criterion, what actually
  happened, and the **exact log line / Metro trace** that proves it (quote it, don't paraphrase).
- **Next** — what follows: ship · the localized fix · re-test · pull the watch log.

Example:

| Check | Result | Evidence |
|---|---|---|
| Background reception | ✅ | `12:35:31 didReceiveDataFromRemoteWorkoutSession hr=102` during `reachable=false` |
| Kill → No signal | ✅ | HR stops `12:36:30`; tile "No signal" ~15 s later |

**Verdict:** ✅ pass — background HR survives backgrounding. **Next:** mark the spec criteria met.

## Device workflow

Use [development verification](../../../docs/development-verification.md) for build commands,
Release receipts, device selection and connection recovery. Keep those mechanics there.

- **JS/TS only, dev client:** reload Metro with `npm run metro:reload`. A standalone Release
  needs a rebuilt phone bundle to include JS changes.
- **iPhone native:** rebuild/install the phone app; include its JS refresh in that row.
- **Watch native:** install the Watch companion as well. The Release workflow supports both
  devices and separate phone/Watch commands; `npm run ios` installs only the phone dev client.
- **Evidence:** run `npm run watch:diagnose` yourself. It captures native logs, installed-app
  identities, Mac transport readiness and available local bundle/signing metadata. For a fresh
  Release startup check, pass `--receipt <receipt.json>` to attach validated logs. The command
  is read-only on devices; the user opens the apps and performs physical actions.
- **Timing:** use a visible long-running build session; save verbose output, inspect bounded
  summaries first, and use completion waits instead of frequent unchanged polls. A passing
  Jest run establishes JS behavior only; device transport claims need device evidence.

## Interpret the evidence

- **Mac transport** is whether device queries and log capture work. A Watch tunnel failure
  does not establish that the phone cannot detect its companion.
- **Companion detection** is the last iPhone `emitCompanionState` entry. `paired=true` with
  `installed=false` can coexist with a Watch app listed as installed; inspect the bundle
  association and refresh the matched pair when appropriate, then capture fresh evidence.
- **Live reachability** is foreground messaging readiness. An installed, idle companion may
  report `reachable=false` and remain available.
- **Startup** and **companion detection** are separate receipt verdicts. Neither proves HR
  streaming, ride controls or background delivery. Check log-start/capture timestamps and
  use logs from after the installation being verified.
- **HR delivery:** phone `didReceiveDataFromRemoteWorkoutSession hr=N`, HR-bearing
  `didReceiveMessage` / `didReceiveApplicationContext`, and Watch `sendHrToPhone` establish
  sample transport. The 15-second HR freshness window produces "No signal" after silence.

For a locked phone, unlock and relaunch; rebuilding is unnecessary. For a failed Watch
Mac tunnel, follow the transport-recovery branch in the verification workflow. For UI
"Unavailable", inspect companion state before choosing an installation or transport fix.
