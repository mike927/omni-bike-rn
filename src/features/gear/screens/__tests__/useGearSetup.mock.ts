import type { useGearSetup } from '../../hooks/useGearSetup';

/**
 * Mutable mock shape for `useGearSetup` used by `GearSetupScreen.test.tsx`.
 *
 * Derived from the hook's own return type via `ReturnType<typeof useGearSetup>`
 * so the mock cannot drift from the hook contract. Tests mutate a module-scope
 * instance of this type per-case and reset it in `beforeEach`.
 */
export type UseGearSetupMockState = ReturnType<typeof useGearSetup>;
