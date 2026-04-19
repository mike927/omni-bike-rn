import { kcalPerMinute, kcalPerSecond } from '../keytel';

describe('kcalPerMinute', () => {
  it('matches the published Keytel value for a 35-year-old male, 80kg, HR 150', () => {
    // (-55.0969 + 0.6309*150 + 0.1988*80 + 0.2017*35) / 4.184
    //  = (-55.0969 + 94.635 + 15.904 + 7.0595) / 4.184
    //  = 62.5016 / 4.184 ≈ 14.94
    const result = kcalPerMinute({ sex: 'male', heartRateBpm: 150, ageYears: 35, weightKg: 80 });
    expect(result).toBeCloseTo(14.94, 1);
  });

  it('matches the published Keytel value for a 35-year-old female, 60kg, HR 150', () => {
    // (-20.4022 + 0.4472*150 - 0.1263*60 + 0.074*35) / 4.184
    //  = (-20.4022 + 67.08 - 7.578 + 2.59) / 4.184
    //  = 41.6898 / 4.184 ≈ 9.96
    const result = kcalPerMinute({ sex: 'female', heartRateBpm: 150, ageYears: 35, weightKg: 60 });
    expect(result).toBeCloseTo(9.96, 1);
  });

  it('clamps to zero when the formula goes negative at very low HR', () => {
    const result = kcalPerMinute({ sex: 'female', heartRateBpm: 30, ageYears: 25, weightKg: 90 });
    expect(result).toBe(0);
  });

  it('scales kcalPerSecond as kcalPerMinute / 60', () => {
    const inputs = { sex: 'male' as const, heartRateBpm: 140, ageYears: 40, weightKg: 75 };
    expect(kcalPerSecond(inputs)).toBeCloseTo(kcalPerMinute(inputs) / 60, 6);
  });
});
