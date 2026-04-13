import { listPotentialProviderGearMatches } from '../providerGearMatcher';

import type { ProviderGearSummary } from '../../../types/providerGear';

const GEAR: ProviderGearSummary[] = [
  { providerId: 'strava', gearType: 'bike', id: 'bike-1', name: 'Rave', isPrimary: false },
  { providerId: 'strava', gearType: 'bike', id: 'bike-2', name: 'Zipro Rave', isPrimary: true },
  { providerId: 'strava', gearType: 'bike', id: 'bike-3', name: 'Road Bike', isPrimary: false },
];

describe('listPotentialProviderGearMatches', () => {
  it('returns exact normalized matches first', () => {
    expect(listPotentialProviderGearMatches('zipro rave', GEAR).map((gear) => gear.id)).toEqual(['bike-2', 'bike-1']);
  });

  it('returns substring matches as potential candidates', () => {
    expect(listPotentialProviderGearMatches('My Road Bike', GEAR).map((gear) => gear.id)).toEqual(['bike-3']);
  });

  it('returns all ambiguous matches instead of picking one', () => {
    expect(
      listPotentialProviderGearMatches('Rave', [
        { providerId: 'strava', gearType: 'bike', id: 'bike-1', name: 'Zipro Rave', isPrimary: false },
        { providerId: 'strava', gearType: 'bike', id: 'bike-2', name: 'Rave Trainer', isPrimary: false },
      ]),
    ).toHaveLength(2);
  });

  it('returns an empty array when there are no plausible matches', () => {
    expect(listPotentialProviderGearMatches('Indoor Bike', GEAR)).toEqual([]);
  });
});
