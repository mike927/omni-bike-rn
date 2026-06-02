import { render, fireEvent } from '@testing-library/react-native';

import { NearbyDeviceRow } from '../NearbyDeviceRow';

it('renders name and id and fires onSelect', () => {
  const onSelect = jest.fn();
  const { getByText } = render(<NearbyDeviceRow name="TACX NEO 2T" deviceId="9C:55:AA:310" onSelect={onSelect} />);
  expect(getByText('TACX NEO 2T')).toBeTruthy();
  fireEvent.press(getByText('Select'));
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('falls back to Unknown Device when name is null', () => {
  const { getByText } = render(<NearbyDeviceRow name={null} deviceId="AB:CD" onSelect={jest.fn()} />);
  expect(getByText('Unknown Device')).toBeTruthy();
});
