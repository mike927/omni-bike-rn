import { render, fireEvent } from '@testing-library/react-native';
import { LinkedBikeBlock } from '../LinkedBikeBlock';

const defaults = {
  onLink: jest.fn(),
  onOpenProviderGear: jest.fn(),
};

it('branch 1: savedBikeName null → shows "Save a bike first", no relink/link gear icon', () => {
  const { getByText, queryByLabelText } = render(
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
  expect(queryByLabelText('Link Strava bike')).toBeNull();
  expect(queryByLabelText('Relink Strava bike')).toBeNull();
});

it('branch 2: linked → shows "Linked to Canyon Aeroad" and a Relink gear icon', () => {
  const { getByText, getByLabelText } = render(
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
  expect(getByLabelText('Relink Strava bike')).toBeTruthy();
});

it('branch 3: not linked → shows "Not linked" and a Link gear icon', () => {
  const { getByText, getByLabelText } = render(
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
  expect(getByLabelText('Link Strava bike')).toBeTruthy();
});

it('branch 4: no_provider_gear → shows "No Strava bikes found" and "Open Strava Gear" link', () => {
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

it('pressing the gear icon calls onLink', () => {
  const onLink = jest.fn();
  const { getByLabelText } = render(
    <LinkedBikeBlock
      savedBikeName="Zipro"
      currentLink={{ providerGearName: 'Canyon Aeroad', stale: false }}
      status="linked"
      needsReconnect={false}
      errorMessage={null}
      onLink={onLink}
      onOpenProviderGear={jest.fn()}
    />,
  );
  fireEvent.press(getByLabelText('Relink Strava bike'));
  expect(onLink).toHaveBeenCalled();
});
