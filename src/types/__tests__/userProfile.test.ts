import { deriveAgeYears, toKeytelInputs, toMifflinInputs, type UserProfile } from '../userProfile';

const COMPLETE_PROFILE: UserProfile = {
  sex: 'female',
  dateOfBirth: '1990-05-12',
  weightKg: 62,
  heightCm: 168,
  sources: {},
};

describe('deriveAgeYears', () => {
  it('returns the elapsed time in years for a valid ISO DOB', () => {
    const dob = '2000-01-01';
    const now = Date.UTC(2025, 0, 1);
    expect(deriveAgeYears(dob, now)).toBeCloseTo(25, 1);
  });

  it('returns null for an unparseable DOB', () => {
    expect(deriveAgeYears('not-a-date', Date.now())).toBeNull();
  });

  it('returns null for a future DOB', () => {
    const dob = '2099-01-01';
    expect(deriveAgeYears(dob, Date.UTC(2026, 0, 1))).toBeNull();
  });
});

describe('toKeytelInputs', () => {
  it('returns null when sex is missing', () => {
    expect(toKeytelInputs({ ...COMPLETE_PROFILE, sex: null })).toBeNull();
  });
  it('returns null when DOB is missing', () => {
    expect(toKeytelInputs({ ...COMPLETE_PROFILE, dateOfBirth: null })).toBeNull();
  });
  it('returns null when weight is missing', () => {
    expect(toKeytelInputs({ ...COMPLETE_PROFILE, weightKg: null })).toBeNull();
  });
  it('returns inputs when all three required fields are present (height not required)', () => {
    const result = toKeytelInputs({ ...COMPLETE_PROFILE, heightCm: null }, Date.UTC(2025, 0, 1));
    expect(result).not.toBeNull();
    expect(result?.sex).toBe('female');
    expect(result?.weightKg).toBe(62);
    expect(result?.ageYears).toBeGreaterThan(34);
  });
});

describe('toMifflinInputs', () => {
  it('returns null when height is missing', () => {
    expect(toMifflinInputs({ ...COMPLETE_PROFILE, heightCm: null })).toBeNull();
  });
  it('returns inputs when all four required fields are present', () => {
    const result = toMifflinInputs(COMPLETE_PROFILE, Date.UTC(2025, 0, 1));
    expect(result).toMatchObject({ sex: 'female', weightKg: 62, heightCm: 168 });
    expect(result?.ageYears).toBeGreaterThan(34);
  });
});
