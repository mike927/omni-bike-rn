# A03 — Interrupted uploads remain permanently uploading

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | Not started |
| Owner | Unassigned |
| Branch / PR | None |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | High |
| Priority | P1 — Next |
| Evidence | Confirmed — static persisted-state trace |
| Estimated effort | Medium |

## Dependencies and coordination

Independent of session recording fixes. Provider-specific recovery stays behind ExportProvider.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [src/services/db/providerUploadRepository.ts](<../../../../src/services/db/providerUploadRepository.ts>) — audit lines/section 135–157.
- [src/services/export/uploadOrchestrator.ts](<../../../../src/services/export/uploadOrchestrator.ts>) — audit lines/section 67–117.
- [src/bootstrap/useAppInitialization.ts](<../../../../src/bootstrap/useAppInitialization.ts>) — audit lines/section 29–117.
- [src/services/export/StravaExportProvider.ts](<../../../../src/services/export/StravaExportProvider.ts>) — audit lines/section 35–82.
- [src/services/export/AppleHealthExportProvider.ts](<../../../../src/services/export/AppleHealthExportProvider.ts>) — audit lines/section 20–34.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

The upload claim persists `uploading` before awaiting the provider. Only ready/failed rows can be claimed. Neither startup nor retry reconciles abandoned uploading rows.

## Triggering scenario

Terminate the process after a durable upload claim but before the final local status update, then relaunch and retry that workout/provider pair.

## Expected versus observed / evidence

The persisted row remains uploading and the orchestrator returns “Upload already in progress.” No current-process operation exists. Expected: a recoverable abandoned operation, including the possibility that remote submission already succeeded.



## Impact and triage

High/P1: individual interrupted uploads remain blocked across launches, and normal retry offers no recovery. Local workout data remains intact.

## Smallest sound correction or improvement

Distinguish live operations from abandoned persisted attempts. Add provider-aware reconciliation and retain remote operation/activity identity when available. Do not blindly reset and resend: the provider may already have accepted the workout. Keep provider-specific details behind the existing adapter contract.

## Acceptance criteria and verification

- [ ] Restart against the same database after interruption before submission, during processing, and after remote success before local acknowledgement.
- [ ] Ensure each case converges to a recoverable or uploaded state without duplicate remote export.
- [ ] Retain concurrent-request exclusion while allowing abandoned attempts to recover.
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
