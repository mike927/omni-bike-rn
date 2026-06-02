import { TrainingPhase } from '../../../../types/training';
import { deriveHeader, deriveRideHero } from '../homeViewModel';

const base = {
  phase: TrainingPhase.Idle,
  hasSavedBike: true,
  bikeConnected: true,
  reconnecting: false,
  bikeName: 'KICKR Bike',
  hrName: 'Polar H10',
};

describe('deriveRideHero', () => {
  it('resume when a session is active', () => {
    const hero = deriveRideHero({ ...base, phase: TrainingPhase.Active });
    expect(hero).toMatchObject({ variant: 'primary', title: 'Resume Ride', disabled: false, route: '/training' });
  });

  it('resume when a session is paused', () => {
    expect(deriveRideHero({ ...base, phase: TrainingPhase.Paused }).title).toBe('Resume Ride');
  });

  it('setup when no bike is saved', () => {
    const hero = deriveRideHero({ ...base, hasSavedBike: false, bikeConnected: false });
    expect(hero).toMatchObject({
      variant: 'setup',
      title: 'Set up your Smart Bike',
      route: '/gear-setup',
      disabled: false,
    });
  });

  it('start (enabled) when bike connected and idle', () => {
    const hero = deriveRideHero(base);
    expect(hero).toMatchObject({ variant: 'primary', title: 'Start Ride', disabled: false, route: '/training' });
    expect(hero.subline).toBe('KICKR Bike · Polar H10');
  });

  it('start (disabled) when bike saved but not connected', () => {
    const hero = deriveRideHero({ ...base, bikeConnected: false, reconnecting: true });
    expect(hero).toMatchObject({ variant: 'primary', title: 'Start Ride', disabled: true, route: null });
    expect(hero.subline).toContain('Reconnecting');
  });

  it('omits a missing HR name from the subline', () => {
    expect(deriveRideHero({ ...base, hrName: null }).subline).toBe('KICKR Bike');
  });
});

describe('deriveHeader', () => {
  it('setup tone when no bike saved', () => {
    expect(deriveHeader({ hasSavedBike: false, bikeConnected: false })).toMatchObject({
      greeting: "Let's get set up",
    });
  });

  it('ready tone when gear connected', () => {
    expect(deriveHeader({ hasSavedBike: true, bikeConnected: true }).greeting).toBe('Ready to ride?');
  });
});
