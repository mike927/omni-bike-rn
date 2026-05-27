import { fireEvent, render } from '@testing-library/react-native';

import { AddGearTile } from '../AddGearTile';

describe('AddGearTile', () => {
  it('renders the label', () => {
    const { getByText } = render(<AddGearTile label="Set Up Smart Bike" onPress={() => {}} />);
    expect(getByText('Set Up Smart Bike')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<AddGearTile label="Set Up Smart Bike" onPress={onPress} />);
    fireEvent.press(getByText('Set Up Smart Bike'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
