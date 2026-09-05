# A11 — Post-upgrade native workflow verification remains incomplete

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Blocked |
| Owner | automated remediation agent |
| Branch / PR | `docs/a11-native-verification-handoff` / https://github.com/mike927/omni-bike-rn/pull/119 |
| Last updated | 2026-09-05 |
| Type | Verification gap |
| Category | testing |
| Severity | Not applicable |
| Priority | P1 — Next |
| Evidence | Needs validation — missing physical acceptance evidence |
| Estimated effort | Medium |

## Dependencies and coordination

Run against the current build after relevant P1 fixes, especially A01/A05/A06. Later native fixes need their own rebuild/recheck.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [docs/tech-stack.md](<../../../../docs/tech-stack.md>) — audit lines/section 55–63.
- [docs/tech-stack-device-check.md](<../../../../docs/tech-stack-device-check.md>) — audit lines/section existing device protocol.
- [jest.config.js](<../../../../jest.config.js>) — audit lines/section moduleNameMapper native substitutes.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Repository evidence proves builds and a short Watch start/HR/end exchange, but BLE, Apple Health save, pause/resume, and extended background checks remain pending after the framework upgrade.

## Triggering scenario

Release confidence is needed for Expo 57 / React Native 0.86.3 and native integrations after the upgrade.

## Expected versus observed / evidence

Executed JavaScript tests substitute native transport and database modules. Their success cannot prove physical behavior. Missing evidence is not proof that those behaviors are broken.



## Impact and triage

Verification gap/P1, no defect severity: the upgrade affects core native workflows and simulated tests give limited assurance. Do not turn accepted background limitations into new requirements.

## Smallest sound correction or improvement

Use the existing device protocol on the current native build and add relevant audit failure sequences. Route device handoff through the repository manual-test-handoff skill. Retain correlated phone/Watch logs and exported workout measurements.

## Acceptance criteria and verification

- [ ] Record exact app/build revision, devices/OS versions, commands, logs and pass/fail results for the existing protocol. **Outstanding, device only.** The build revision under test is fixed (`c19673e`) and the protocol is written, but device and OS versions and every pass/fail result can only be recorded once the run happens.
- [ ] Verify physical BLE reconnect, phone/Watch pause-resume-end and Apple Health save with relevant audit regressions. **Outstanding, device only.** Steps, pass criteria and the audit regression sequences from A01 to A10 are specified in the handoff; the iOS Simulator cannot do BLE and Jest substitutes WatchConnectivity, HealthKit and SQLite.
- [x] Keep the issue open or blocked while required physical evidence is pending; record accepted platform limitations separately. Status is **Blocked** with the blocker and next action recorded below, and the accepted limitations (Watch heart rate tile reading `--` while backgrounded, TCX showing a paused ride as continuous, pre-upgrade rides exporting as continuous, the bounded 3 probe retry budget) are listed in their own handoff section so none of them can be raised as a new requirement.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05: claimed by the automated remediation agent on `docs/a11-native-verification-handoff`. This is a verification gap, not a defect, so no code changed. Produced the consolidated device pass through the repository `manual-test-handoff` skill at [`docs/audits/2026-09-05/device-verification.md`](../device-verification.md), scoped to A11 plus the device only residual of all ten tickets remediated in this run (A01 to A10), and cross-linked it from each of them. Status set to **Blocked**: every remaining acceptance item needs a paired iPhone and Apple Watch that this agent cannot drive.

## Completion / disposition record

**Change summary.** No production code changed: A11 is a verification gap, and closing it means
producing the evidence, not editing the tree. The deliverable is
[`docs/audits/2026-09-05/device-verification.md`](../device-verification.md), a single consolidated
device pass built with the repository `manual-test-handoff` skill and pinned to build `c19673e`.

It replaces ten separate device cycles with one. Beyond A11's own scope (BLE, Apple Health save,
pause and resume, extended background checks after the Expo 57 / React Native 0.86.3 upgrade), it
carries the device only residual every remediated ticket left behind:

| Ticket | Residual folded into the pass |
| --- | --- |
| A01 (`7081c13`) | On-wrist End navigating imperatively from the root with no ride screen mounted; Jest proves it only against a mocked `expo-router` |
| A02 (`0d0270b`) | Explicitly **not** covered: forcing a real SQLite write failure needs a fault injecting build, and is recorded as such |
| A03 (`b62193e`) | Force quit mid upload plus relaunch against the same SQLite file, and a real provider round trip proving no duplicate after a user approved resend |
| A04 (`4333181`) | The energy only FTMS path over real Bluetooth, conditional on such a machine being available |
| A05 (`3f2f839`) | Five device only items, including the load bearing one: that `Subscription.remove()` really deregisters natively. A probe against a no-op `remove()` reproduces the full original defect even on shipped code, so step 20 of the pass is the only thing that closes it |
| A06 (`cd1bbb7`) | Manual pause surviving a bike `Started` event, from the screen and from the wrist |
| A07 (`f1be65d`) | Migration `0002_damp_ink` applied by the app's own runner on a real populated device database, and a workout relative distance on an exported activity |
| A08 (`8e7d5d9`) | A rebuilt native module, a real paused ride, a trailing pause, and the Health app read rather than the app's own log |
| A09 (`c19673e`) | Matched pair install (the wire format gained `sentAtMs`), the four ordering sequences, and the `endIssued` latch, whose two site safety argument is structural and has no executable coverage |
| A10 (`ed5ffa1`) | Physical BLE drop and recover on both the bike and the strap, on the designed cadence |

A12 is deliberately out of scope and is named in the pass as an accepted, tracked behaviour so the
tester does not report it: TCX still shows a paused ride as continuous.

**Branch / PR.** `docs/a11-native-verification-handoff`, https://github.com/mike927/omni-bike-rn/pull/119.

**Executed commands and outcomes.**

| Command | Outcome |
| --- | --- |
| `npm run ci:gate` | Green, exit 0. Lint clean at `--max-warnings 0`, `tsc --noEmit` clean, 116 suites / 1191 tests passed |
| `git diff main...HEAD \| grep '^+' \| grep -P '\x{2014}\|\x{2013}'` | No output: no long dash added on any line of this branch |

Verification limits: this branch is documentation only, so a green gate says nothing about the
behaviours the pass exists to check. That is the whole point of the ticket.

**Physical-device results.** None. That is the blocker.

**Blocker and next concrete action.** Every remaining acceptance item needs a paired iPhone 16 PRO and
Apple Watch Ultra 2, installed as a **matched pair from Xcode** (A09 changed the iPhone to Watch wire
format, and A08 and A09 both changed native code, so no CLI install and no Metro reload substitutes
for it). The agent cannot drive a physical ride, a Bluetooth power cut, or the iOS Health app.

Next action, for a human with the devices: run
[`docs/audits/2026-09-05/device-verification.md`](../device-verification.md) end to end, about 80
minutes, then report the step numbers of anything that did not match. The agent then pulls the phone
and Watch `wc.log` plus `Documents/apple-health.ndjson`, renders the per criterion verdict, records
the build revision, device and OS versions here, and ticks the matching device box in A03, A05, A08,
A09 and A10. Only then can A11 move to Done.

**Remaining limitations.**

- Status is **Blocked** rather than In progress. The pipeline contract's default for device dependent
  acceptance is In progress, and the five sibling tickets in this run used it; A11 differs in that no
  implementation work exists to be underway, so the tracker's own definition of Blocked ("cannot
  proceed; record blocker, owner and next action") is the truthful reading. The coordinator may flip
  it to In progress without changing any of the substance above.
- Two of A11's five acceptance boxes stay unticked, and no other ticket's device box was ticked. A
  handoff is not evidence.
- A02 and part of A04 are not reachable by any manual pass and are recorded as such rather than
  silently folded in.
- The pass deliberately does not test accepted platform limitations. In particular the Watch heart
  rate tile reading `--` while the Watch app is backgrounded is watchOS suspend and batch behaviour,
  named in the handoff as something not to report, per this ticket's own instruction not to turn
  accepted background limitations into new requirements.
