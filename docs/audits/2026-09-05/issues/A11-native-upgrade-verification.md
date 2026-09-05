# A11 — Post-upgrade native workflow verification remains incomplete

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
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

- [ ] Record exact app/build revision, devices/OS versions, commands, logs and pass/fail results for the existing protocol.
- [ ] Verify physical BLE reconnect, phone/Watch pause-resume-end and Apple Health save with relevant audit regressions.
- [ ] Keep the issue open or blocked while required physical evidence is pending; record accepted platform limitations separately.
- [ ] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [ ] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.

## Completion / disposition record

No implementation, PR or new verification recorded yet. Before closing, replace this paragraph with:

- Change summary and commit/PR (or evidence-backed reason for deferral/rejection).
- Executed commands with outcomes and relevant regression evidence.
- Physical-device results where required, including build revision and log references.
- Remaining limitations or follow-up issue links.
