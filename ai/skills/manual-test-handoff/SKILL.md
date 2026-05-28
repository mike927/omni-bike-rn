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
`wc.log` / Metro traces — facts, not impressions. A device cycle is expensive; never spend
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
     changed (see the *Build / refresh level* table for which). Showing all three forces a
     conscious choice and prevents the classic misses (a JS change never reloaded, a
     watch-native change a CLI install never pushed). Nesting: an iPhone rebuild includes the
     JS bundle, and a watch matched-pair Xcode build rebuilds both apps — so when a higher
     level is ✅ the lower rows can be ❌ (included). For a ❌ row, put the reason in `Confirm`
     (e.g. "skip — no JS changed").
   - `Action` / `Where` / `Confirm` = the concrete action, the surface, and the signal it's
     satisfied. In `Where`, **name in-app surfaces explicitly** — e.g. "mobile app →
     Settings tab", not bare "Settings" — so they aren't confused with the **iOS system
     Settings** app. Reserve "iOS Settings" for the system app; use "iTerm/terminal" or "Xcode"
     for the Mac. Fold any "if not, fix" into `Confirm` parenthetically.
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
   companion unavailable, etc.). Reference the relevant memory note.

**Evidence capture is YOUR internal step — do NOT render it as a section.** After the user
reports "done", run the log-pull/grep commands from *Project command reference* yourself and
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

## Project command reference (this app)

Devices (re-check with `xcrun devicectl list devices` if they change):
- iPhone 16 PRO (Michal): `2E90B0A0-D835-559D-805A-FC4A92CA995F` — bundle `com.anonymous.omnibikern`
- Apple Watch Ultra 2: `31EEC0B4-4AEC-5124-898A-BDD1E34DB07E` — bundle `com.anonymous.omnibikern.watchkitapp`

**Pull the phone's native WC log** (reliable; logs `paired/installed/reachable`, HR receipt, session, reachability):
```bash
xcrun devicectl device copy from --device 2E90B0A0-D835-559D-805A-FC4A92CA995F \
  --domain-type appDataContainer --domain-identifier com.anonymous.omnibikern \
  --source Documents/wc.log --destination /tmp/wc-iphone.log
```

**Pull the watch's native WC log** (needs a stable CoreDevice tunnel — see troubleshooting):
```bash
xcrun devicectl device copy from --device 31EEC0B4-4AEC-5124-898A-BDD1E34DB07E \
  --domain-type appDataContainer --domain-identifier com.anonymous.omnibikern.watchkitapp \
  --source Documents/wc.log --destination /tmp/wc-watch.log
```

**Read Metro JS traces** (`[WC-JS] …`): use the `iterm-mcp` `read_terminal_output` tool on the
single Metro pane (per `AGENTS.md`/`CLAUDE.md`).

**Build / refresh level** — derive from what changed and state it in Preconditions:

| Changed | Needs | How |
|---|---|---|
| JS/TS only | **Metro reload** | Fast Refresh, or press `r` in the Metro pane — no native build |
| iPhone native (`ios/omnibikern/**`, `modules/*/ios/**.swift`) | **mobile app rebuild** | `npm run ios -- "iPhone 16 PRO (Michal)"` or Xcode run (`omnibikern` scheme) |
| Watch native (`ios/OmniBikeWatch Watch App/**`) | **Watch companion rebuild** | **matched pair from Xcode** (`omnibikern` scheme) — CLI can't push the watch app |

Gotchas: a JS change tested without reloading proves nothing; `npm run ios` installs the
**mobile app only** (CLI can't push the watch app), so any watch-native change needs the
matched Xcode install or `isWatchAppInstalled` reads false → Watch shows "Unavailable"
(memory `watch-companion-install-mismatch`).

## Log-line glossary (what to grep / what it means)

- `[WC-iPhone] emitCompanionState available=X paired=Y installed=Z` — companion presence;
  `installed=false` = watch app not a matched companion of this phone build.
- `[WC-iPhone] sessionReachabilityDidChange reachable=X` — WC live-messaging reachability
  (true ≈ both apps foreground). Transient; does NOT drive the availability label.
- `[WC-iPhone] mirrored workoutSession didReceiveDataFromRemoteWorkoutSession hr=N` — phone
  received HR over the mirrored HKWorkoutSession (the background-capable channel).
- `[WC-iPhone] didReceiveMessage keys=[…hr…]` / `didReceiveApplicationContext …` — other HR
  delivery channels.
- `[WC-Watch] sendHrToPhone …` — the watch is sending HR (~1 Hz while collecting).
- `[WC-Watch] appState -> active|inactive|background` — watch app lifecycle.
- `[WC-JS] availability X -> Y (reason)` — the JS availability state machine transitions.
- `[WC-JS] mobile appState -> active|background` — mobile app lifecycle.

Freshness: the JS HR tile uses `HR_NO_SIGNAL_TIMEOUT_MS = 15000` — no HR for >15 s ⇒
"No signal". So a >15 s gap in HR-receipt timestamps is the thing to look for.

## Troubleshooting branches (reference, don't reinvent)

- **Watch shows "Unavailable" despite the app being open** → `installed=false`. Reinstall the
  matched pair from Xcode. (memory `watch-companion-install-mismatch`)
- **`devicectl` transport / "preparation error" pulling the watch log** → stuck CoreDevice
  tunnel: USB-tether the iPhone, ensure same Wi-Fi + firewall allows Xcode, restart Xcode.
  (memory `watch_reconnect_fix`)
- **iOS won't launch app on install** ("device is locked") → unlock the phone and relaunch;
  no rebuild needed.

## Example (concrete)

**What we're verifying:** background-HR-sync — HR stays live (or recovers instantly on
foreground) while the mobile app is backgrounded mid-ride; "No signal" only on real loss.

**Preconditions:**

| Do? | Action | Where | Confirm |
|---|---|---|---|
| ❌ | Reload Metro (JS) | iTerm: press `r` | skip — no JS changed |
| ❌ | Rebuild mobile app | `npm run ios -- "iPhone 16 PRO (Michal)"` | skip — no iOS-native change |
| ❌ | Rebuild Watch app (matched pair) | Xcode → `omnibikern` scheme | skip — no watch-native change |
| ✅ | Set primary HR source → Apple Watch | mobile app → **Settings tab** | Apple Watch selected |
| ✅ | Check the watch HR tile | mobile app → **Home tab** | reads **idle** (if "Unavailable" → reinstall matched pair from Xcode) |
| ✅ | Make sure Metro is running | iTerm / terminal | `:8081` up |

**Steps:**

| # | On | Action | What you should see |
|---|---|---|---|
| 1 | 📱 mobile app | Start a workout | live HR on the tile |
| 2 | 📱 mobile app | Background it (home / switch apps) >30 s | screen off / another app |
| 3 | 📱 mobile app | Reopen it | tile returns |
| 4 | ⌚ watch app | Force-quit (Dock → swipe up) | — |

**Pass criteria:**

| Check | Expected |
|---|---|
| Foreground after background | HR live within ~1 s (not "No signal") |
| Watch app force-quit | ~15 s → "No signal" (not a frozen value, not bike) |

**Report back:** run steps 1–4, then say "done"; I pull the log and give the fact-based verdict.
