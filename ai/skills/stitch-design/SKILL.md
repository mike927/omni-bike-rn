---
name: stitch-design
description: Guide for using Google Stitch (stitch.withgoogle.com) to generate UI designs and convert them to React Native components. Covers MCP integration, CLI workflows, and design-to-code conversion.
---

# Stitch Design Workflow

Google Stitch is an AI-powered design tool that generates functional UI designs and frontend code from text prompts, sketches, or screenshots. It uses Gemini to produce multi-screen prototypes with exportable code.

## When To Use This Skill

- Designing new screens or refining existing UI layouts
- Generating design variations for review
- Extracting design tokens (colors, typography, spacing) from Stitch projects
- Converting Stitch-generated HTML/CSS to React Native components

## Setup

### CLI: `stitch-mcp`

The [`stitch-mcp`](https://github.com/davideast/stitch-mcp) package provides both CLI commands and an MCP server for agent integration.

```bash
npx @_davideast/stitch-mcp init
```

The guided wizard handles authentication (gcloud OAuth or API key) and MCP client configuration.

**Authentication options** (pick one):

- OAuth via `gcloud` (recommended for local dev)
- API key from Stitch settings — set `STITCH_API_KEY` environment variable

### MCP Server

Start the MCP proxy so any MCP-compatible agent can access Stitch projects:

```bash
npx @_davideast/stitch-mcp proxy
```

Register this MCP server with your host's MCP configuration (paths and file names vary per host). Once connected, the agent gains access to virtual tools:

| Tool | Purpose |
|---|---|
| `get_screen_code` | Retrieve generated code for a screen |
| `get_screen_image` | Retrieve design image for a screen |
| `build_site` | Generate a full site from Stitch screens |

### CLI Commands

| Command | Purpose |
|---|---|
| `serve` | Host Stitch designs locally on a Vite dev server |
| `view` | Browse and search Stitch projects from the terminal |
| `site` | Generate an Astro website mapping screens to routes |
| `doctor` | Diagnose configuration issues |

## Collaborative Design Loop

Stitch work is collaborative by design: the agent writes the prompt, the human operates Stitch in the browser, and the agent fetches and implements the result. The loop has four beats per screen:

- **Prompt prep** (agent) — read the current screen, understand functional requirements, produce a ready-to-paste Stitch prompt.
- **Design creation** (human) — open Stitch, set device type, optionally upload a screenshot, paste the prompt, pick a variation, signal completion.
- **Fetch and review** (agent) — use `get_screen_image` and `get_screen_code` via MCP, confirm coverage, re-prompt on gaps.
- **Implementation** (agent) — convert HTML/CSS to React Native, apply project conventions, hand off to the human for device testing.

Without MCP, the human bridges by pasting the generated HTML/CSS into `ai/designs/<screen-name>.html` and the agent reads the file in place of the `get_screen_code` call.

### What A Good Stitch Prompt Contains

- **Device type** — always `Mobile` for this project.
- **Screen purpose** — what the screen does and its role in the app flow.
- **Key elements** — every UI element that must appear (cards, buttons, metrics, states).
- **Interactions** — taps, swipes, toggles, transitions.
- **Constraints** — dark/light theme, brand colors, accessibility.
- **Reference** — whether the human should upload a screenshot as a starting point.

Example:

> **Paste this into Stitch (Mobile device type):**
>
> Indoor cycling training dashboard for an iOS app. Dark theme.
> Top section: elapsed time (large, centered), current workout state indicator (Active / Paused).
> Metric grid (2x2): Speed (km/h), Heart Rate (bpm with zone color), Power (watts), Calories (kcal).
> Each metric card shows the label, current value in large text, and a small trend indicator.
> Bottom bar: Pause/Resume button (large, centered), Finish button (smaller, right side).
> The layout must work in both portrait and landscape orientations.

### Prompt Writing Guidelines

- Be specific about every element — Stitch cannot infer app context.
- Include exact metric names and units (e.g., `Speed (km/h)` not `speed`).
- Specify all relevant states: empty, loading, error, active, paused, disabled.
- For refinement rounds, reference what to keep and what to change (`Keep the card layout but tighten the grid gap and recolor the HR value`).
- For complex screens, split into sub-prompts (header, metric grid, bottom bar) then request a combined view.
- Always specify dark or light theme.

### HTML/CSS To React Native Conversion

| HTML/CSS | React Native |
|---|---|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` |
| `<img>` | `<Image>` |
| `<input>` | `<TextInput>` |
| `<button>` | `<Pressable>` or `<TouchableOpacity>` |
| CSS properties | `StyleSheet.create()` values |
| `px` units | Unitless numbers (density-independent) |
| CSS flexbox | React Native flexbox (column default) |
| `className` | `style` prop |

### Project Conventions Applied During Conversion

- Styles live in `StyleSheet.create()`.
- Navigation follows `expo-router` patterns.
- Components live under `src/features/<domain>/components/`; screens only under `app/`.
- Types follow TypeScript strict mode.
- External integrations follow the adapter pattern.

## Key Limitations

- No direct React Native or Swift export — conversion is always required
- Generated code is a structural starting point, not production-ready
- Design token import helps consistency but does not guarantee pixel-perfect match
- Always test converted components on device or simulator before accepting

## Tips

- When prompting Stitch, describe the screen purpose and key interactions, not just visual layout
- Use Stitch for exploration and iteration, then refine in code
- For complex screens (e.g., training dashboard), generate sub-sections separately
- Export to Figma when non-developer stakeholders need to review designs
- Upload screenshots of the current screen to Stitch as a starting point — "polish this" often gives better results than describing from scratch
