import { render } from '@testing-library/react-native';

import { APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID } from '../../../../services/export/providerIds';
import { ProviderStatusIcons } from '../ProviderStatusIcons';

describe('ProviderStatusIcons', () => {
  it('renders nothing when uploadedProviderIds is empty', () => {
    const { queryByLabelText } = render(<ProviderStatusIcons uploadedProviderIds={[]} />);

    expect(queryByLabelText('Exported to Strava')).toBeNull();
    expect(queryByLabelText('Exported to Apple Health')).toBeNull();
  });

  it('renders the Strava icon when strava is present', () => {
    const { getByLabelText, queryByLabelText } = render(
      <ProviderStatusIcons uploadedProviderIds={[STRAVA_PROVIDER_ID]} />,
    );

    expect(getByLabelText('Exported to Strava')).toBeTruthy();
    expect(queryByLabelText('Exported to Apple Health')).toBeNull();
  });

  it('renders the Apple Health icon when apple_health is present', () => {
    const { getByLabelText, queryByLabelText } = render(
      <ProviderStatusIcons uploadedProviderIds={[APPLE_HEALTH_PROVIDER_ID]} />,
    );

    expect(getByLabelText('Exported to Apple Health')).toBeTruthy();
    expect(queryByLabelText('Exported to Strava')).toBeNull();
  });

  it('renders both icons in canonical order regardless of input order', () => {
    const { getAllByRole } = render(
      <ProviderStatusIcons uploadedProviderIds={[APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID]} />,
    );

    const icons = getAllByRole('image');
    const labels = icons.map((icon: { props: { accessibilityLabel?: string } }) => icon.props.accessibilityLabel);

    expect(labels).toEqual(['Exported to Strava', 'Exported to Apple Health']);
  });
});
