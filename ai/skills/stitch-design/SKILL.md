---
name: stitch-design
description: Use when using Google Stitch to explore mobile UI concepts, prepare Stitch prompts, or convert Stitch output into React Native components.
---

# Stitch Design Workflow

## Collaborative Loop

- The agent prepares a prompt that names the screen purpose, key elements, interactions, and constraints.
- The human creates or refines the design in Stitch and signals when the result is ready.
- The agent reviews the generated output, checks it against the requirements, and converts the accepted design into React Native code.
- Without MCP, the human can save exported HTML/CSS locally and the agent reads that file instead.

## Repo Conventions

- Generate mobile-first layouts for this app.
- Treat Stitch output as a structural starting point, not production-ready code.
- Convert generated web markup into React Native primitives and repo conventions before merging.
- Validate the converted screen on device or simulator before accepting it.

## Read Next When Needed

- CLI and MCP setup, prompt-writing details, and HTML/CSS conversion notes: [references/stitch-design-reference.md](references/stitch-design-reference.md)

## Community Sources

- **Generic frontend design principles** — Claude Code plugin `frontend-design:frontend-design` (when available); otherwise consult general mobile-UI design references through the human designer loop described above.
