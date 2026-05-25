import { availableHrSources, resolveDefaultPrimary } from '../hrSource';

describe('availableHrSources', () => {
  it('offers watch only when supported, strap only when saved, bike always', () => {
    expect(availableHrSources({ watchSupported: true, savedHrStrapName: 'Polar H10' })).toEqual([
      'watch',
      'bluetooth',
      'bike',
    ]);
    expect(availableHrSources({ watchSupported: false, savedHrStrapName: null })).toEqual(['bike']);
    expect(availableHrSources({ watchSupported: false, savedHrStrapName: 'Polar H10' })).toEqual(['bluetooth', 'bike']);
  });
});

describe('resolveDefaultPrimary', () => {
  it('picks highest available: watch > bluetooth > bike', () => {
    expect(resolveDefaultPrimary(['watch', 'bluetooth', 'bike'])).toBe('watch');
    expect(resolveDefaultPrimary(['bluetooth', 'bike'])).toBe('bluetooth');
    expect(resolveDefaultPrimary(['bike'])).toBe('bike');
  });
});
