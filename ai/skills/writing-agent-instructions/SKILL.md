---
name: writing-agent-instructions
description: Use when creating or editing an agent instruction file — AGENTS.md, CLAUDE.md, GEMINI.md, CODEX.md, .cursorrules, or any file an AI agent loads every session. Trigger on any such edit, even a small one — adding a section, documenting a rule or decision, or trimming a file that has grown verbose.
---

# Writing Agent Instructions

## Overview

An agent instruction file is a **contract the model executes**, not documentation a human reads. It loads into every session — every line costs context, and a wrong line costs behavior.

**Core test for every line: "Does this change what the agent does?"** If no, cut it. If cutting it would let the agent do the *wrong* thing, it is load-bearing — keep it, compress it. **Terseness never outranks correctness.**

## When NOT to use

Human-facing docs — README, guides, ADRs. Those want rationale and narrative. This skill is only for files an agent executes.

## Rules

1. **Directive, not rationale.** State the rule. Cut "because…", "this matters since…", justifying metrics, history.
2. **No mechanism explainers.** Name the command/tool; don't explain how it works internally — the agent reads `--help` or the source.
3. **No edge-case catalogs.** Keep an edge case only if the agent would take a *different action* for it.
4. **One rule per line, imperative.** "Branch before editing." — not "You should always make sure to…". Terse ≠ run-on: one line per rule, and keep structure (headings, list items, the one disambiguating example) that helps the agent parse — that changes behavior, so it stays.
5. **Match the file's density and voice.** New text reads like the lines around it. New or empty file: imperative, list-first, no preamble — open with the first rule or a one-line scope.
6. **Cross-reference, don't inline.** Point to `package.json`, a script, or a doc instead of restating it. When a topic needs more than a few lines the agent rarely reads, move the detail to a doc and leave a one-line pointer.
7. **Don't re-teach baseline competence.** The agent already knows git, file IO, running tests. State only what is project-specific or non-default.

## Placement & conflicts

- **One rule, one home.** Tool/model-agnostic → AGENTS.md. Tool-specific → that tool's file (e.g. CLAUDE.md), which points back at AGENTS.md. Never state the same rule in two files — link.
- **Grep before adding.** Search the file (and any parent instruction file) for the topic first. If your new rule contradicts an existing one, edit that line — don't append a second. Two rules on one topic is a bug.

## Keep a "why" only when it changes behavior

Keep a *why* only when **both** hold: the action it prevents is **costly or irreversible**, AND the bare rule looks **arbitrary or wrong** enough that an agent would plausibly override it. One clause, inline. If you can't name the concrete bad outcome, it's general justification — cut it.

- ✅ "Never run `prebuild --clean` — it wipes the watch target." (irreversible + looks innocuous)
- ✅ Record of a *rejected* option when re-litigating it is costly: "No pre-push test hook — pre-commit already gates."
- ❌ A preference no one would destructively undo (formatting, naming, tool choice) — state it bare.

**If the user explicitly asks for the why:** put the reasoning in the commit message or a linked doc, and say so. The contract gets the rule, not the explanation — unless it clears the gate above. Don't inline it; don't silently drop it.

## Trimming

Trimming a verbose file also means **deleting rules that no longer match reality**. Verify each rule still holds before keeping it for terseness's sake — a terse file full of stale directives is the worse failure.

## Before / after

Rule: "run changed-only tests in dev, full suite in CI." *(illustrative excerpt, not prescribed text)*

❌ Verbose:
> ## Testing
> During development run `npm run test:changed`… **Mechanism:** diffs the working tree, then walks the module graph… **Edge cases:** *no matching tests* → exits 0… [~200 words of rationale + mechanism + edge cases]

✅ Directive:
> **Tests (dev):** `npm run test:changed` (branch-affected only); full suite is CI's job. Green = "changed tests pass," not "all." *(last clause kept on purpose — it stops a false "all green" claim, so it changes behavior)*

## Common mistakes

| Mistake | Fix |
|---|---|
| Explaining how a tool works | Name it; link `--help` / source. |
| Re-stating `package.json` scripts | Cross-reference. |
| "You should always make sure to…" | "Do X." |
| Cut a flag's reason, then the flag itself | If the reason is the only thing stopping a wrong action, keep it — compress. |

## Red flags — STOP

- Wrote "because", "the reason", "this matters", or a *justifying* metric (16s→4s) → cut it (move it to the commit message). A *threshold* metric that **is** the rule (`--maxWorkers=2`, `< 2MB`) → keep it.
- Explaining a mechanism the agent can look up → cut.
- Your addition is longer than the section around it → compress.
- Documenting a decision's *history* instead of the *rule* → cut, unless it clears the "why" gate.
- About to append a rule on a topic already covered → edit the existing line instead.
