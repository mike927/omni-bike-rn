import { fireEvent, render } from '@testing-library/react-native';

import { SwipeableGearRow } from '../SwipeableGearRow';

it('exposes Replace and Forget swipe actions that call their handlers', () => {
  const onReplace = jest.fn();
  const onForget = jest.fn();
  const { getByText } = render(
    <SwipeableGearRow
      icon="bicycle"
      name="Rave"
      kind="Smart trainer"
      status="unavailable"
      onReplace={onReplace}
      onForget={onForget}
    />,
  );
  fireEvent.press(getByText('Replace'));
  expect(onReplace).toHaveBeenCalledTimes(1);
  fireEvent.press(getByText('Forget'));
  expect(onForget).toHaveBeenCalledTimes(1);
});

it('renders an inline Connect chip when provided and fires it', () => {
  const onConnect = jest.fn();
  const { getByText } = render(
    <SwipeableGearRow
      icon="bicycle"
      name="Rave"
      kind="Smart trainer"
      status="unavailable"
      connect={{ label: 'Connect', onPress: onConnect }}
      onReplace={() => {}}
      onForget={() => {}}
    />,
  );
  fireEvent.press(getByText('Connect'));
  expect(onConnect).toHaveBeenCalledTimes(1);
});

it('omits the Connect chip when not provided (e.g. connected)', () => {
  const { queryByText } = render(
    <SwipeableGearRow
      icon="bicycle"
      name="Rave"
      kind="Smart trainer"
      status="ready"
      onReplace={() => {}}
      onForget={() => {}}
    />,
  );
  expect(queryByText('Connect')).toBeNull();
});

it('selectable row calls onSelectPress and exposes selected a11y state', () => {
  const onSelect = jest.fn();
  const { getByTestId } = render(
    <SwipeableGearRow
      icon="heart"
      name="Polar H10"
      kind="Chest strap"
      status="ready"
      selected
      onSelectPress={onSelect}
      bodyTestId="hr-tile-bluetooth"
      onReplace={() => {}}
      onForget={() => {}}
    />,
  );
  const body = getByTestId('hr-tile-bluetooth');
  expect(body.props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(body);
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('appends "· primary" to the kind when selected', () => {
  const { getByText } = render(
    <SwipeableGearRow
      icon="heart"
      name="Polar H10"
      kind="Chest strap"
      status="ready"
      selected
      onSelectPress={() => {}}
      onReplace={() => {}}
      onForget={() => {}}
    />,
  );
  expect(getByText('Chest strap · primary')).toBeTruthy();
});

it('a non-selectable row (bike) does not call onSelectPress and has no selected state', () => {
  const { getByTestId } = render(
    <SwipeableGearRow
      icon="bicycle"
      name="Rave"
      kind="Smart trainer"
      status="ready"
      bodyTestId="bike-tile-header"
      onReplace={() => {}}
      onForget={() => {}}
    />,
  );
  const body = getByTestId('bike-tile-header');
  expect(body.props.accessibilityState?.selected).toBeUndefined();
});
