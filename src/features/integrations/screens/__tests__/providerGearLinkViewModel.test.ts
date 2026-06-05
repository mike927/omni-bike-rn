import { providerBikeMetaLabel } from '../providerGearLinkViewModel';

describe('providerBikeMetaLabel', () => {
  it('primary + match', () => {
    expect(providerBikeMetaLabel({ isPrimary: true }, true)).toBe('Possible match · Primary bike in provider account');
  });
  it('match only', () => {
    expect(providerBikeMetaLabel({ isPrimary: false }, true)).toBe('Possible match');
  });
  it('primary only', () => {
    expect(providerBikeMetaLabel({ isPrimary: true }, false)).toBe('Primary bike in provider account');
  });
  it('neither', () => {
    expect(providerBikeMetaLabel({ isPrimary: false }, false)).toBe('Provider bike');
  });
});
