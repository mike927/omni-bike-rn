# Workflow Files

This folder stores tracked workflow documentation and reusable templates.

Live per-branch workflow state now lives in ignored local files under `ai/local/workflows/`.

## What Belongs Here

- Shared documentation about the workflow-file system
- Reusable tracked templates such as `_template.md`
- Guidance that should stay in the repository for all future branches

## When To Create Or Update

- Update these tracked docs when the workflow system itself changes.
- Do not create branch runtime files here anymore. Create them under `ai/local/workflows/` inside the active worktree.

## Source Of Truth

- `AGENTS.md` defines the naming rules, required workflow steps, and lifecycle policy.
- `_template.md` in this folder provides the tracked source template for new local workflow files.

Keep this README focused on the purpose of the `ai/workflows/` folder. Do not duplicate workflow policy here when `AGENTS.md` already defines it.
