---
description: Produce a structured, log-driven on-device manual-test handoff
argument-hint: "[what to test — or blank to infer from current work]"
---

Use the `manual-test-handoff` skill to produce a structured on-device manual-test handoff.

**Target of this test:** $ARGUMENTS

If no target is given, infer it from the current in-progress change and the latest spec's
acceptance criteria (`docs/superpowers/specs/…`).

Follow the skill's required structure exactly and in order: **What we're verifying →
Preconditions → Steps (numbered, one action each) → Pass criteria (table, incl. what a fail
looks like) → Evidence capture (the exact `devicectl`/Metro commands you will run) → What to
report back → Troubleshooting branches.**

Keep it tight (lead with the one-line "what we're verifying", use the pass-criteria table).
Split the work: the **user** does the physical device actions; **you** pull and read the
logs (`wc.log` / Metro `[WC-JS]`) and deliver a fact-based verdict — never judge by eye.
