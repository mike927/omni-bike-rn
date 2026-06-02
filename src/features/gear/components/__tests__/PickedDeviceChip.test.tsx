import { render, fireEvent } from '@testing-library/react-native';

import { PickedDeviceChip } from '../PickedDeviceChip';

it('renders the device name and a connecting status', () => {
  const { getByText } = render(<PickedDeviceChip name="Wahoo KICKR Bike" status="connecting" onSwap={jest.fn()} />);
  expect(getByText('Wahoo KICKR Bike')).toBeTruthy();
  expect(getByText('Connecting...')).toBeTruthy();
});

it('invokes onSwap when the swap control is pressed', () => {
  const onSwap = jest.fn();
  const { getByText } = render(<PickedDeviceChip name="KICKR" status="ready" onSwap={onSwap} />);
  fireEvent.press(getByText('Swap'));
  expect(onSwap).toHaveBeenCalledTimes(1);
});

it('renders an error subline instead of a status pill when errored', () => {
  const { getByText, queryByText } = render(
    <PickedDeviceChip name="Generic Fitness 5C2" status="connecting" errored onSwap={jest.fn()} />,
  );
  expect(getByText('Can’t be used')).toBeTruthy();
  expect(queryByText('Connecting...')).toBeNull();
});
