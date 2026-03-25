---
name: react-native-perf
description: React Native performance optimization guidelines for FPS, TTI, bundle size, memory leaks, re-renders, and animations. Use when debugging jank, optimizing startup, reducing bundle size, or profiling.
---

# React Native Performance

Source: [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) (Callstack, MIT license)
Based on "The Ultimate Guide to React Native Optimization" by Callstack.

## When to Apply

Reference these guidelines when:

- Debugging slow/janky UI or animations
- Investigating memory leaks (JS or native)
- Optimizing app startup time (TTI)
- Reducing bundle or app size
- Writing native modules (Turbo Modules)
- Profiling React Native performance
- Reviewing React Native code for performance

## Priority-Ordered Guidelines

| Priority | Category | Impact | Focus |
|----------|----------|--------|-------|
| 1 | FPS & Re-renders | CRITICAL | Lists, memoization, state |
| 2 | Bundle Size | CRITICAL | Tree shaking, barrel imports |
| 3 | TTI Optimization | HIGH | Startup, preloading, mmap |
| 4 | Native Performance | HIGH | Turbo Modules, threading |
| 5 | Memory Management | MEDIUM-HIGH | Leak hunting, cleanup |
| 6 | Animations | MEDIUM | Reanimated worklets |

## Optimization Workflow

Follow this cycle for any performance issue: **Measure -> Optimize -> Re-measure -> Validate**

1. **Measure**: Capture baseline metrics (FPS, TTI, bundle size) before changes
2. **Optimize**: Apply the targeted fix
3. **Re-measure**: Run the same measurement to get updated metrics
4. **Validate**: Confirm improvement (e.g., FPS 45->60, TTI 3.2s->1.8s, bundle 2.1MB->1.6MB)

If metrics did not improve, revert and try the next suggested fix.

## Critical: FPS & Re-renders

**Profile first:**

```bash
# Open React Native DevTools
# Press 'j' in Metro, or shake device -> "Open DevTools"
```

**Common fixes:**

- Replace ScrollView with FlatList/FlashList for lists
- Use React Compiler for automatic memoization
- Use atomic state (Jotai/Zustand) to reduce re-renders
- Use `useDeferredValue` for expensive computations

## Critical: Bundle Size

**Analyze bundle:**

```bash
npx react-native bundle \
  --entry-file index.js \
  --bundle-output output.js \
  --platform ios \
  --sourcemap-output output.js.map \
  --dev false --minify true

npx source-map-explorer output.js --no-border-checks
```

**Common fixes:**

- Avoid barrel imports (import directly from source)
- Remove unnecessary Intl polyfills (Hermes has native support)
- Enable tree shaking (Expo SDK 52+ or Re.Pack)

## High: TTI Optimization

**Common fixes:**

- Disable JS bundle compression on Android (enables Hermes mmap)
- Use native navigation (react-native-screens)
- Preload commonly-used expensive screens before navigating to them
- Only measure cold starts (exclude warm/hot/prewarm)

## High: Native Performance

**Profile native:**

- iOS: Xcode Instruments -> Time Profiler
- Android: Android Studio -> CPU Profiler

**Common fixes:**

- Use background threads for heavy native work
- Prefer async over sync Turbo Module methods
- Use C++ for cross-platform performance-critical code

## Problem -> Fix Mapping

| Problem | Fix |
|---------|-----|
| App feels slow/janky | Measure FPS -> Profile React components |
| Too many re-renders | Profile components -> Use React Compiler or atomic state |
| Slow startup (TTI) | Measure TTI -> Analyze bundle -> Reduce initial load |
| Large app size | Analyze bundle -> Remove barrel imports -> Enable tree shaking |
| Memory growing | Hunt JS memory leaks or native memory leaks |
| Animation drops frames | Use Reanimated worklets on UI thread |
| List scroll jank | Replace ScrollView with FlashList |
| TextInput lag | Use uncontrolled components |
| Native module slow | Use Turbo Modules with async methods |

## Key Rules

### Lists

- ALWAYS use FlashList or FlatList for lists, never ScrollView with `.map()`
- Memoize list item components
- Stabilize callback references passed to list items
- Avoid inline style objects in list items
- Extract functions outside render in list items
- Use `estimatedItemSize` with FlashList

### Animations

- Animate only `transform` and `opacity` (GPU-friendly properties)
- Use `useDerivedValue` for computed animations
- Use `Gesture.Tap` instead of Pressable for animated interactions
- Run animation logic on UI thread via Reanimated worklets

### State Management

- Minimize state subscriptions — subscribe to specific slices
- Use dispatcher pattern for callbacks to avoid re-renders
- Show fallback on first render for async data

### Rendering

- Always wrap text strings in `<Text>` components
- Avoid falsy `&&` for conditional rendering (use ternary or null checks)

### Navigation

- Use native stack navigators over JS-based navigators
- Prefer `react-native-screens` for native screen management

### Images

- Use `expo-image` for all image rendering
- Specify width and height to avoid layout shifts
- Use appropriate `contentFit` mode
