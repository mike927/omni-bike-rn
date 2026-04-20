# Stitch Design Reference

## Setup

The [`stitch-mcp`](https://github.com/davideast/stitch-mcp) package provides CLI commands and an MCP server.

```bash
npx @_davideast/stitch-mcp init
```

Authentication options:

- OAuth via `gcloud`
- API key via `STITCH_API_KEY`

To run the MCP proxy:

```bash
npx @_davideast/stitch-mcp proxy
```

## Available Tooling

| Tool or command | Purpose |
|---|---|
| `get_screen_code` | Retrieve generated code for a screen |
| `get_screen_image` | Retrieve the screen image |
| `build_site` | Generate a full site from Stitch screens |
| `serve` | Host Stitch designs locally |
| `view` | Browse Stitch projects from the terminal |
| `site` | Generate an Astro website from screens |
| `doctor` | Diagnose configuration issues |

## Prompt Contents

A good Stitch prompt should name:

- Device type, always `Mobile` for this project
- Screen purpose
- Required UI elements
- Required interactions
- Constraints such as theme, brand, and accessibility
- Whether a screenshot should be uploaded as reference

## Prompt Writing Notes

- Be explicit about elements, states, and units.
- For refinement, name what should stay and what should change.
- For complex screens, split prompt generation into sections first, then request a combined result.
- State dark or light theme explicitly.

## HTML And CSS To React Native

| HTML or CSS | React Native |
|---|---|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` |
| `<img>` | `<Image>` |
| `<input>` | `<TextInput>` |
| `<button>` | `<Pressable>` or `<TouchableOpacity>` |
| CSS properties | React Native style values |
| `px` units | Unitless numbers |
| `className` | `style` prop |

## Conversion Rules

- Put styles in `StyleSheet.create()` or the repo's chosen style pattern.
- Follow `expo-router` navigation structure.
- Keep screens under `app/` and components under `src/features/.../components/`.
- Apply strict TypeScript and repo architecture conventions during conversion.

## Limits And Tips

- Stitch does not export production-ready React Native code.
- Always test converted components on device or simulator.
- Use Stitch for exploration, then refine in code.
- Uploading an existing screen often produces better polish passes than describing from scratch.
