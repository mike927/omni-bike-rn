---
description: Produce a structured, log-driven on-device manual-test handoff
argument-hint: "[what to test — or blank to infer from current work]"
---

Use the `manual-test-handoff` skill and follow its structure exactly to produce an on-device
manual-test handoff. The skill is the source of truth for the section layout — don't restate
or override it here.

**Target of this test:** $ARGUMENTS

If no target is given, infer it from the current in-progress change and the latest spec's
acceptance criteria (`docs/superpowers/specs/…`).

Reminder of the split the skill enforces: the **user** does the physical device actions; **you**
pull and read the logs (`wc.log` / Metro `[WC-JS]`) and deliver a fact-based verdict — never
judge by eye. Evidence-capture commands are your internal step, not a section in the handoff.
