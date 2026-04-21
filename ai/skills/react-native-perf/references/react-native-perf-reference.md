# React Native Performance Reference

Source: [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) (Callstack, MIT license)

## Priority Areas

| Priority | Category | Focus |
|---|---|---|
| 1 | FPS and re-renders | Lists, memoization, state |
| 2 | Bundle size | Tree shaking, direct imports |
| 3 | TTI | Startup and preload strategy |
| 4 | Native performance | Threading and Turbo Modules |
| 5 | Memory | Leak hunting and cleanup |
| 6 | Animations | Reanimated worklets |

## Profiling Commands

```bash
# React Native DevTools
# Press 'j' in Metro, or shake device and open DevTools

npx react-native bundle \
  --entry-file index.js \
  --bundle-output output.js \
  --platform ios \
  --sourcemap-output output.js.map \
  --dev false --minify true

npx source-map-explorer output.js --no-border-checks
```

## Problem To Fix Mapping

| Problem | Usual first move |
|---|---|
| UI feels janky | Measure FPS, then profile React components |
| Too many re-renders | Profile subscriptions, React Compiler patterns, selector scope |
| Slow startup | Measure TTI, then reduce initial work and inspect bundle |
| Large app size | Analyze bundle, remove barrel imports, trim dependencies |
| Memory growth | Hunt JS or native leaks |
| Animation frame drops | Move work to Reanimated worklets on the UI thread |
| List scroll jank | Replace `ScrollView` with `FlashList` or `FlatList` |
| TextInput lag | Consider uncontrolled inputs and lighter state coupling |
| Native module slow | Prefer async Turbo Module methods |

## Detailed Rules

### Lists

- Use `FlashList` or `FlatList` for large lists.
- Memoize list item components.
- Stabilize callback references passed to list items.
- Use `estimatedItemSize` with `FlashList`.

### Animations

- Animate `transform` and `opacity` when possible.
- Use `useDerivedValue` for computed animations.
- Prefer gesture handlers and Reanimated worklets for interaction-heavy flows.

### State And Rendering

- Subscribe to specific slices of state.
- Avoid broad parent subscriptions that force deep tree re-renders.
- Avoid falsy `&&` rendering when it can leak bad UI states.
- Always wrap text strings in `<Text>`.

### Images And Navigation

- Use `expo-image`.
- Set image dimensions to avoid layout shifts.
- Prefer native stack navigation and `react-native-screens`.
