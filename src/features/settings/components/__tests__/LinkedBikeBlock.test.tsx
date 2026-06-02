import { render } from '@testing-library/react-native';
import { LinkedBikeBlock } from '../LinkedBikeBlock';

const defaults = {
  onLink: jest.fn(),
  onOpenProviderGear: jest.fn(),
};

it('branch 1: savedBikeName null → shows "Save a bike first", no Link button', () => {
  const { getByText, queryByText } = render(
    <LinkedBikeBlock
      savedBikeName={null}
      currentLink={null}
      status="not_linked"
      needsReconnect={false}
      errorMessage={null}
      {...defaults}
    />,
  );
  expect(getByText('Save a bike first')).toBeTruthy();
  expect(queryByText('Link Bike')).toBeNull();
  expect(queryByText('Relink Bike')).toBeNull();
});

it('branch 2: linked → shows "Linked to Canyon Aeroad" and "Relink Bike" button', () => {
  const { getByText } = render(
    <LinkedBikeBlock
      savedBikeName="Zipro"
      currentLink={{ providerGearName: 'Canyon Aeroad', stale: false }}
      status="linked"
      needsReconnect={false}
      errorMessage={null}
      {...defaults}
    />,
  );
  expect(getByText('Linked to Canyon Aeroad')).toBeTruthy();
  expect(getByText('Relink Bike')).toBeTruthy();
});

it('branch 3: not linked → shows "Not linked" and "Link Bike" button', () => {
  const { getByText } = render(
    <LinkedBikeBlock
      savedBikeName="Zipro"
      currentLink={null}
      status="not_linked"
      needsReconnect={false}
      errorMessage={null}
      {...defaults}
    />,
  );
  expect(getByText('Not linked')).toBeTruthy();
  expect(getByText('Link Bike')).toBeTruthy();
});

it('branch 4: no_provider_gear → shows "No Strava bikes found" and "Open Strava Gear" button', () => {
  const { getByText } = render(
    <LinkedBikeBlock
      savedBikeName="Zipro"
      currentLink={null}
      status="no_provider_gear"
      needsReconnect={false}
      errorMessage={null}
      {...defaults}
    />,
  );
  expect(getByText('No Strava bikes found')).toBeTruthy();
  expect(getByText('Open Strava Gear')).toBeTruthy();
});
