import { basalKcalForWindow, bmrKcalPerDay } from '../mifflinStJeor';

describe('bmrKcalPerDay', () => {
  it('matches the published Mifflin–St Jeor value for a 30-year-old male, 80kg, 180cm', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmrKcalPerDay({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })).toBeCloseTo(1780, 0);
  });

  it('matches the published Mifflin–St Jeor value for a 30-year-old female, 60kg, 165cm', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(bmrKcalPerDay({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 30 })).toBeCloseTo(1320.25, 2);
  });
});

describe('basalKcalForWindow', () => {
  it('returns BMR for a full 24-hour window', () => {
    const inputs = { sex: 'male' as const, weightKg: 80, heightCm: 180, ageYears: 30 };
    expect(basalKcalForWindow(inputs, 86400)).toBeCloseTo(1780, 0);
  });

  it('pro-rates BMR linearly to a 1-hour window', () => {
    const inputs = { sex: 'male' as const, weightKg: 80, heightCm: 180, ageYears: 30 };
    expect(basalKcalForWindow(inputs, 3600)).toBeCloseTo(1780 / 24, 1);
  });

  it('returns zero for non-positive durations', () => {
    const inputs = { sex: 'female' as const, weightKg: 60, heightCm: 165, ageYears: 30 };
    expect(basalKcalForWindow(inputs, 0)).toBe(0);
    expect(basalKcalForWindow(inputs, -10)).toBe(0);
  });
});
