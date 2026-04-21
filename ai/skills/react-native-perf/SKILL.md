---
name: react-native-perf
description: Use when profiling or fixing React Native performance issues such as jank, startup latency, bundle size, re-renders, memory leaks, or animation drops.
---

# React Native Performance

## Core Rules

- Measure first, change one thing, then re-measure with the same method.
- Prioritize the current bottleneck: frame drops, startup time, bundle size, memory growth, or animation cost.
- Prefer list virtualization, smaller subscriptions, direct imports, and UI-thread animations over broad rewrites.
- Revert performance changes that do not improve the measured metric.

## Common High-Signal Fixes

- Use `FlatList` or `FlashList` instead of `ScrollView` for large lists.
- Use React Compiler patterns and precise state subscriptions to cut re-renders.
- Reduce startup work before first interaction.
- Prefer Reanimated worklets for animation-heavy interactions.
- Audit imports and dependencies when bundle size is the problem.

## Read Next When Needed

- Profiling commands, problem-to-fix mapping, and detailed rules: [references/react-native-perf-reference.md](references/react-native-perf-reference.md)
