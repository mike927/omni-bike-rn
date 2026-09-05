# Audit verification evidence and limitations

[Audit index](README.md) · Baseline `965cbec` · Original audit: 2026-09-05

This is a historical record of checks executed during the original audit, not evidence that any tracked issue has been fixed. Later agents record fresh results in their individual issue files.

## Installed versions inspected

Expo 57.0.19; React 19.2.3; React Native 0.86.3; Zustand 5.0.15; expo-sqlite 57.0.2; Drizzle ORM 0.45.2; react-native-ble-plx 3.5.1.

## Executed existing checks

| Command / scope | Result |
| --- | --- |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run db:check` | Passed; this is not a real-device persistence test. |
| `npm run test:changed -- --runInBand --watchman=false` | Selected no tests on clean main; no regression assurance from this invocation. |
| Targeted training/persistence/export/initialization suites below | 12 suites, 198 tests passed. |
| Targeted BLE/HR/Watch/reconnection suites below | 10 suites, 176 tests passed. |
| Connectivity group repeated with `--detectOpenHandles` | 176 tests passed; no open handles reported. |
| `git diff --check` and final working-tree status | Passed; clean at audit completion. |

The initial connectivity run emitted Jest's delayed-exit warning but exited successfully. The diagnostic rerun did not reproduce it. The rerun is not an additional 176 unique tests.

### Training, persistence, exports and initialization

```sh
npm run test -- --runInBand --watchman=false --runTestsByPath \
  src/services/training/__tests__/sessionAccumulator.test.ts \
  src/store/__tests__/trainingSessionStore.test.ts \
  src/services/metronome/__tests__/MetronomeEngine.test.ts \
  src/features/training/hooks/__tests__/useTrainingSession.test.ts \
  src/features/training/hooks/__tests__/useTrainingSessionPersistence.test.ts \
  src/features/training/hooks/__tests__/useInterruptedSessionRecovery.test.ts \
  src/services/export/__tests__/uploadOrchestrator.test.ts \
  src/services/export/formats/__tests__/tcxSerializer.test.ts \
  src/services/db/__tests__/trainingSessionRepository.test.ts \
  src/services/db/__tests__/providerUploadRepository.test.ts \
  src/bootstrap/__tests__/useAppInitialization.test.ts \
  src/services/health/__tests__/appleHealthAdapter.test.ts
```

### Connectivity

```sh
npm run test -- --runInBand --watchman=false --runTestsByPath \
  src/services/ble/__tests__/StandardHrAdapter.test.ts \
  src/services/ble/__tests__/ZiproRaveAdapter.test.ts \
  src/services/hr/__tests__/hrSource.test.ts \
  src/services/hr/__tests__/hrStatus.test.ts \
  src/services/hr/__tests__/useEffectiveHrSource.test.ts \
  src/features/training/hooks/__tests__/useDeviceConnection.test.ts \
  src/features/gear/hooks/__tests__/useAutoReconnect.test.ts \
  src/features/gear/hooks/__tests__/useWatchHr.test.ts \
  src/services/watch/__tests__/WatchHrAdapter.test.ts \
  src/features/training/hooks/__tests__/useWatchRemoteControl.test.ts
```

The diagnostic invocation added `--detectOpenHandles` to this same group.

## Additional controlled reproductions

The audit ran read-only Node stdin harnesses, transpiling actual application TypeScript in memory. React lifecycle reproductions used installed React/test-renderer and real application hook/store/engine code with controlled device dependencies and timer callbacks. No harness files were retained; these observations must be turned into permanent regression tests during remediation.

| Issue | Input / sequence | Observed |
| --- | --- | --- |
| A01 | Dashboard start → Back → reopen | Active phase with zero recording timers. |
| A01 | Home bike-start → Dashboard Pause/Resume → one simulated second | Two timers; elapsedSeconds advanced by two. |
| A02 | Inject draft creation error, then Finish | Active with null session ID after failure; Finish returned null and reset to Idle. |
| A04 | 60 ticks at 200 W; no HR/bike energy | 0 kcal rather than approximately 11.47 from the existing power formula. |
| A06 | Manual pause → bike Paused → bike Started | Phase became Active. |
| A07 | Bike distance counters 500, 520, 10, 25 | App total 35 m; exported raw trackpoints 500, 520, 10, 25 m. |

These harnesses did not exercise native BLE/HealthKit or a physical SQLite database. Other confirmed findings rely on static control-flow/data-flow traces, detailed in their tickets.

## Coverage weaknesses

- Lifecycle tests mock engine starts/stops and miss multi-consumer timing (A01).
- A calorie test explicitly preserves the wrong power fallback (A04).
- The draft-failure test accepts skipped samples without requiring user-visible recovery (A02).
- Native and SQLite substitutes in Jest do not prove real transport, migration or physical persistence behavior.

## Not executed / accepted limitations

No full `ci:gate`, native build, provider upload or physical-device test was performed during the audit. Prior build/device evidence in [tech-stack.md](../../tech-stack.md) was read, not rerun.

Documented Watch wake-on-start sideload limitations, accepted true-background HR gaps and deferred Android parity were not treated as new defects. See [background feasibility](../../apple-watch/background-hr-feasibility.md), [wake-on-start](../../apple-watch/wake-on-start.md) and [ROADMAP.md](../../../ROADMAP.md).

Existing security/dependency concerns were not independently re-audited. `.env` was not read. Passing checks do not imply the codebase is bug-free.

## Official documentation consulted

- [React effect lifecycle](https://react.dev/reference/react/useEffect)
- [React Navigation screen lifecycle](https://reactnavigation.org/docs/navigation-lifecycle/)
- [BLE PLX disconnection observer](https://dotintent.github.io/react-native-ble-plx/#blemanagerondevicedisconnected); availability was also checked in installed 3.5.1 source.
- [HealthKit elapsed time and pause events](https://developer.apple.com/documentation/healthkit/hkworkoutbuilder/elapsedtime(at:))

Some Apple documentation pages did not render through the browser tool; indexed official documentation supplied the duration semantics. Native display outcomes remain unverified.
