# Expo UI Reference

Source: [expo/skills](https://github.com/expo/skills) (official Expo team, MIT license)

## Code Style

- Escape nested backticks and quotes in template literals.
- Always use import statements at the top of the file.
- Always use kebab-case for file names, e.g. `comment-card.tsx`.
- Always remove old route files when moving or restructuring navigation.
- Never use special characters in file names.
- Configure `tsconfig.json` path aliases and prefer aliases over relative imports for refactors.

## Routes

- Routes belong in the `app` directory.
- Never co-locate components, types, or utilities in the `app` directory.
- Ensure the app always has a route that matches `/`, even if it lives inside a group route.

## Library Preferences

- Never use removed React Native modules such as `Picker`, `WebView`, `SafeAreaView`, or `AsyncStorage`.
- Never use legacy `expo-permissions`.
- Prefer `expo-audio` and `expo-video` over `expo-av`.
- Prefer `expo-image` and `react-native-safe-area-context`.
- Prefer `process.env.EXPO_OS` over `Platform.OS`.
- Prefer React Native primitives over intrinsic web elements.

## Responsiveness

- Prefer `ScrollView`, `FlatList`, and `SectionList` with `contentInsetAdjustmentBehavior="automatic"`.
- Prefer flexbox over the Dimensions API.
- Prefer `useWindowDimensions` over `Dimensions.get()`.

## Behavior

- Use `expo-haptics` conditionally on iOS for delight.
- A stacked route usually starts with a `ScrollView`.
- Prefer `headerSearchBarOptions` for search bars.
- Use `<Text selectable />` for copyable values.
- Consider compact large-number formatting such as `1.4M` or `38k`.

## Styling

- Follow Apple Human Interface Guidelines.
- Prefer gap and padding over scattered margin.
- Ensure both top and bottom safe areas are handled.
- Use inline styles unless reuse clearly favors `StyleSheet.create()`.
- Add meaningful enter and exit animations for state changes.
- Use `{ borderCurve: 'continuous' }` for rounded corners unless the shape should be capsule-like.
- Use navigation titles instead of custom in-page page titles.
- When padding a `ScrollView`, prefer `contentContainerStyle`.
- CSS and Tailwind are not supported here.

## Text And Shadows

- Add `selectable` to important data and error text.
- Use `{ fontVariant: 'tabular-nums' }` for counters.
- Prefer `boxShadow`; do not use legacy elevation/shadow props.

## Navigation

- Use `<Link />` from `expo-router` for route changes.
- Use `_layout.tsx` files to define stacks.
- Prefer Stack modals and sheets over custom modal scaffolding.

## Example Route Shape

```text
app/
  _layout.tsx
  (index,search)/
    _layout.tsx
    index.tsx
    search.tsx
```
