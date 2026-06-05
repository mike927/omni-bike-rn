import { deriveProfileView } from '../userProfileViewModel';
import { EMPTY_USER_PROFILE, type UserProfile } from '../../../../types/userProfile';

const NOW = Date.parse('2026-06-05T00:00:00Z');
const full: UserProfile = { sex: 'male', dateOfBirth: '1990-04-12', weightKg: 75, heightCm: 178, sources: {} };

describe('deriveProfileView', () => {
  it('renders all-dash stats and "Set up" accuracy for an empty profile', () => {
    const vm = deriveProfileView(EMPTY_USER_PROFILE, NOW);
    expect(vm.stats.map((s) => s.value)).toEqual(['—', '—', '—', '—']);
    expect(vm.accuracy.label).toBe('Set up');
    expect(vm.accuracy.tone).toBe('inactive');
  });

  it('computes floored age and "Best" accuracy when all four fields are present', () => {
    const vm = deriveProfileView(full, NOW);
    expect(vm.stats.find((s) => s.key === 'sex')?.value).toBe('Male');
    expect(vm.stats.find((s) => s.key === 'age')?.value).toBe('36');
    expect(vm.stats.find((s) => s.key === 'weight')?.value).toBe('75');
    expect(vm.stats.find((s) => s.key === 'height')?.value).toBe('178');
    expect(vm.accuracy.label).toBe('Best');
    expect(vm.accuracy.tone).toBe('good');
  });

  it('returns "Good"/working when Keytel inputs are present but height is missing', () => {
    const vm = deriveProfileView({ ...full, heightCm: null }, NOW);
    expect(vm.accuracy.label).toBe('Good');
    expect(vm.accuracy.tone).toBe('working');
  });
});
