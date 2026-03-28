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

Configure your agent to connect to this MCP server. The setup depends on your agent:

- **Claude Code**: add to `.claude/settings.json` under `mcpServers`
- **Antigravity**: built-in Stitch MCP support
- **Codex / other agents**: add to the agent's MCP configuration file

Once connected, the agent gains access to virtual tools:

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

## Interactive Design Workflow

Design tasks that involve Stitch are collaborative. The agent drives the process, the human operates Stitch in the browser, and then the agent fetches and implements the result. Every screen or component that needs a design goes through this loop.

### Prerequisites

- MCP proxy is running (`npx @_davideast/stitch-mcp proxy`)
- Agent is connected to the Stitch MCP server

### The Loop

For each screen or component that needs a design:

#### Step 1: Agent Prepares The Prompt

The agent reads the current screen code (if it exists), understands the functional requirements from `plan.md`, and writes a ready-to-paste Stitch prompt for the human.

The prompt must include:

- **Device type**: always `Mobile` for this project
- **Screen purpose**: what the screen does and its role in the app flow
- **Key elements**: list every UI element that must appear (cards, buttons, metrics, states)
- **Interactions**: taps, swipes, toggles, transitions
- **Constraints**: dark/light theme, brand colors if defined, accessibility needs
- **Reference**: mention if the human should upload a screenshot of the current screen as a starting point

Example prompt the agent would provide:

> **Paste this into Stitch (Mobile device type):**
>
> Indoor cycling training dashboard for an iOS app. Dark theme.
> Top section: elapsed time (large, centered), current workout state indicator (Active / Paused).
> Metric grid (2x2): Speed (km/h), Heart Rate (bpm with zone color), Power (watts), Calories (kcal).
> Each metric card shows the label, current value in large text, and a small trend indicator.
> Bottom bar: Pause/Resume button (large, centered), Finish button (smaller, right side).
> The layout must work in both portrait and landscape orientations.

#### Step 2: Human Creates The Design

The human:

1. Opens [stitch.withgoogle.com](https://stitch.withgoogle.com)
2. Sets device type to **Mobile**
3. Optionally uploads a screenshot of the current screen
4. Pastes the agent-provided prompt
5. Reviews generated variations and picks the best one (or iterates)
6. Confirms to the agent that the design is ready (e.g., "done" or "design is ready")

#### Step 3: Agent Fetches And Reviews

The agent uses MCP tools to retrieve the design:

1. `get_screen_image` — visually review the design
2. `get_screen_code` — get the generated HTML/CSS

The agent then:

- Confirms the design covers all required elements
- Flags anything missing or inconsistent with the functional requirements
- If issues are found, provides an updated prompt and the loop returns to Step 2

#### Step 4: Agent Implements

Once the design is approved:

1. Convert HTML/CSS to React Native (see conversion table below)
2. Apply project conventions
3. Integrate with existing navigation and state
4. Ask the human to test on device/simulator

### Prompt Guidelines For Agents

When writing Stitch prompts, follow these rules:

- Be specific about every element — Stitch cannot infer app context
- Include exact metric names and units (e.g., "Speed (km/h)" not just "speed")
- Specify states: empty, loading, error, active, paused, disabled
- For refinement rounds, reference what to keep and what to change: "Keep the card layout but increase spacing between metric cards and make the HR value use a red accent"
- For complex screens, split into sub-prompts: design the header, metric grid, and bottom bar separately, then ask for a combined view
- Always specify dark or light theme explicitly

### Fallback Without MCP

If MCP is not available, the human can manually bridge:

1. Agent provides the Stitch prompt (same as Step 1)
2. Human creates the design in Stitch
3. Human copies the generated HTML/CSS from Stitch's code panel
4. Human pastes it into `ai/designs/<screen-name>.html`
5. Agent reads the file and continues from Step 4

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

### Apply Project Conventions After Conversion

- Use `StyleSheet.create()` for styles
- Follow `expo-router` navigation patterns
- Place components in `src/features/<domain>/components/`
- Place screens in `app/` directory only
- Use TypeScript strict mode types
- Follow the adapter pattern for any external integrations

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
