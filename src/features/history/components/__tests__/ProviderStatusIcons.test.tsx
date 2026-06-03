import { render } from '@testing-library/react-native';

import { APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID } from '../../../../services/export/providerIds';
import { noir } from '../../../../ui/theme';
import { ProviderStatusIcons, providerIconColor } from '../ProviderStatusIcons';

describe('providerIconColor', () => {
  it('uses the Calm Noir mint for a synced provider, never a brand colour', () => {
    expect(providerIconColor(true)).toBe(noir.mintSoft);
    expect(providerIconColor(true)).not.toBe('#FC4C02'); // not Strava orange
  });

  it('uses the muted ink tone for an un-synced provider', () => {
    expect(providerIconColor(false)).toBe(noir.ink3);
  });
});

describe('ProviderStatusIcons', () => {
  it('always renders both providers, marking only the synced one', () => {
    const { getByLabelText } = render(<ProviderStatusIcons uploadedProviderIds={[STRAVA_PROVIDER_ID]} />);

    expect(getByLabelText('Uploaded to Strava')).toBeTruthy();
    expect(getByLabelText('Not synced to Apple Health')).toBeTruthy();
  });

  it('marks both providers as not synced when nothing is uploaded', () => {
    const { getByLabelText } = render(<ProviderStatusIcons uploadedProviderIds={[]} />);

    expect(getByLabelText('Not uploaded to Strava')).toBeTruthy();
    expect(getByLabelText('Not synced to Apple Health')).toBeTruthy();
  });

  it('marks both providers as synced when both are uploaded', () => {
    const { getByLabelText } = render(
      <ProviderStatusIcons uploadedProviderIds={[APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID]} />,
    );

    expect(getByLabelText('Uploaded to Strava')).toBeTruthy();
    expect(getByLabelText('Synced to Apple Health')).toBeTruthy();
  });

  it('renders providers in canonical order regardless of input order', () => {
    const { getAllByRole } = render(
      <ProviderStatusIcons uploadedProviderIds={[APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID]} />,
    );

    const labels = getAllByRole('image').map(
      (icon: { props: { accessibilityLabel?: string } }) => icon.props.accessibilityLabel,
    );

    expect(labels).toEqual(['Uploaded to Strava', 'Synced to Apple Health']);
  });
});
