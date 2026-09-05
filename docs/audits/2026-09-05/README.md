# Codebase audit — 2026-09-05

Audit baseline: `965cbec` on `main`. This tracker preserves the evidence-based audit and provides independently claimable issues. All issues were imported as **Not started**; importing the tracker did not implement fixes or rerun the original audit.

## Assessment and scope

The highest-impact findings concern recording ownership and persistence: normal navigation can stop or double recording, and draft failure can allow a ride to continue without being saved. Preserve the shared HR resolver, calorie reducer and export-provider contract; global lifecycle ownership needs attention.

Reviewed `AGENTS.md`, `DESIGN.md`, `ROADMAP.md`, supporting platform documents, and flows across training, HR selection/status, calories, BLE/Watch connectivity, initialization, SQLite persistence, summary/export and provider uploads. `CONTEXT.md` and `docs/adr/` were absent at the audit baseline.

- [Verification evidence and audit limitations](verification.md)
- [Unvalidated hypotheses](hypotheses.md) — kept separate from confirmed findings
- [Repository roadmap](../../../ROADMAP.md)

## Issues

Each issue file's **Tracking** table is the authoritative source for its current status and owner. This index deliberately contains only stable triage so agents do not have to synchronize two per-issue status lists. No Critical/P0 finding was established.

| ID | Finding | Type | Severity | Priority | Effort |
| --- | --- | --- | --- | --- | --- |
| [A01](issues/A01-session-engine-ownership.md) | Screen-owned engines stop or double session recording | Bug | High | P1 — Next | Medium |
| [A02](issues/A02-persistence-failure-recovery.md) | Persistence failure silently leaves a ride unsaved | Bug | High | P1 — Next | Medium |
| [A03](issues/A03-interrupted-upload-recovery.md) | Interrupted uploads remain permanently uploading | Bug | High | P1 — Next | Medium |
| [A04](issues/A04-power-calorie-fallback.md) | Power calorie fallback incorrectly requires live HR | Bug | Medium | P1 — Next | Small |
| [A05](issues/A05-ble-disconnect-state.md) | BLE disconnects leave stale state and block HR reconnection | Bug | Medium | P1 — Next | Medium |
| [A06](issues/A06-manual-pause-precedence.md) | Bike Started events override manual pause | Bug | Medium | P1 — Next | Small |
| [A11](issues/A11-native-upgrade-verification.md) | Post-upgrade native workflow verification remains incomplete | Verification gap | Not applicable | P1 — Next | Medium |
| [A07](issues/A07-normalized-tcx-distance.md) | TCX exports raw bike distance counters | Bug | Medium | P2 — Planned | Medium |
| [A08](issues/A08-healthkit-paused-intervals.md) | Apple Health export loses paused intervals | Bug | Medium | P2 — Planned | Medium |
| [A09](issues/A09-watch-desired-lifecycle.md) | Watch asynchronous transitions discard newer lifecycle intent | Bug | Medium | P2 — Planned | Medium |
| [A10](issues/A10-reconnect-lifecycle-ownership.md) | Multiple screens independently own global reconnect policy | Improvement | Not applicable | P2 — Planned | Medium |

Evidence classification and category are recorded in each ticket. “Confirmed” can mean an executed controlled reproduction or a demonstrable static code path; it does not imply physical-device verification.

## Working an issue

1. Read the issue, dependencies, linked evidence and current `AGENTS.md`. Check current code; baseline line numbers may have changed.
2. Check the ticket's status and owner before starting. Claim it by setting **Status = In progress**, **Owner** to your task/agent identity, **Branch / PR**, and **Last updated**. Add a dated work-log entry. Follow the repository branch-before-editing rule and existing Superpowers workflow. Publishing the claim in the shared branch/PR makes it visible to other workers; an unshared local edit is not a distributed lock.
3. If another agent owns it, coordinate first. A01/A02/A06 share lifecycle code; A07/A08 share persistence concerns. Do not silently overwrite another worker's claim.
4. Reproduce the issue or establish the concrete maintenance benefit. Preserve documented domain rules and intentional platform decisions. The proposed correction is a starting point; choose the smallest sound design against current code.
5. Update acceptance checkboxes and the work log as work progresses. Use `npm run test:changed` for the development loop, targeted existing tests where useful, and required pre-ship checks from `AGENTS.md`. Distinguish changed-test success from the full CI gate.
6. Record exact checks and outcomes. Device-dependent acceptance follows the repo's **manual-test-handoff** skill; a unit test or native build is not a physical pass.
7. Set **Done** only after acceptance criteria are satisfied and completion evidence is recorded. If required device evidence is pending, retain **In progress** or **Blocked** and explain what is missing. Link commit/PR and follow-up issues. For a disproved bug, use **Not reproducible** with evidence rather than pretending it was fixed.
8. Keep this tracker durable: do not delete completed tickets. The roadmap contains an aggregate audit item: use `[~]` while remediation is active and `[x]` only once all tickets are Done or have an explicit documented disposition. Hypotheses remain in Future Considerations until validated and accepted as work.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Not started | Available to claim; no remediation underway. |
| In progress | Claimed; implementation or required verification is underway. |
| Blocked | Cannot proceed; record blocker, owner and next action. |
| Done | Acceptance criteria met and evidence/commit or PR recorded. |
| Deferred | Intentionally postponed; record reason and revisit condition. |
| Not reproducible | Investigation does not support the original defect; record attempted reproduction and evidence. |

Set **Last updated** whenever status or ownership changes. When handing off, record the next concrete action and outstanding checks before changing Owner.

To inspect all live tracking metadata from the repository root:

```sh
rg '^\| (Status|Owner|Branch / PR|Last updated) \|' docs/audits/2026-09-05/issues
```

## Recommended remediation sequence

1. **A01**, then **A06**: establish one session owner and preserve manual-pause intent.
2. **A02**: make durable persistence outcomes part of that lifecycle.
3. **A04**, **A05**, **A03**: repair calorie fallback, BLE disconnection recovery and abandoned uploads. These can be scoped independently; remote-success uncertainty must survive upload recovery.
4. **A11**: complete pending physical verification on the corrected build. Subsequent native changes still require focused rechecks.
5. **A07/A08**: coordinate schema work for normalized distance and lifecycle events while keeping their domain meanings separate.
6. **A09/A10**: retain Watch desired intent and consolidate reconnect ownership. A05 does not depend on the broader reconnect improvement.

Effort estimates are relative planning estimates, not time commitments. Priority reflects impact, likelihood, affected scope and workarounds; architecture preference alone is not High severity.
