import { render, fireEvent } from '@testing-library/react-native';

import { NearbyDeviceRow } from '../NearbyDeviceRow';

it('renders name and id and fires onSelect', () => {
  const onSelect = jest.fn();
  const { getByText } = render(
    <NearbyDeviceRow name="TACX NEO 2T" deviceId="9C:55:AA:310" target="bike" onSelect={onSelect} />,
  );
  expect(getByText('TACX NEO 2T')).toBeTruthy();
  fireEvent.press(getByText('Select'));
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('falls back to Unknown Device when name is null', () => {
  const { getByText } = render(<NearbyDeviceRow name={null} deviceId="AB:CD" target="bike" onSelect={jest.fn()} />);
  expect(getByText('Unknown Device')).toBeTruthy();
});

it('renders the hr glyph when target is hr', () => {
  const { getByTestId } = render(
    <NearbyDeviceRow name="Polar H10" deviceId="HR:01" target="hr" onSelect={jest.fn()} />,
  );
  expect(getByTestId('hr-glyph')).toBeTruthy();
});
