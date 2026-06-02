import { fireEvent, render } from '@testing-library/react-native';

import { AddGearTile } from '../AddGearTile';
import { noir } from '../../theme';

const flatten = (s: unknown) => (Array.isArray(s) ? Object.assign({}, ...s.flat(Infinity).filter(Boolean)) : s);

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

  it('renders noir label color', () => {
    const { getByText } = render(<AddGearTile label="Set Up Smart Bike" onPress={() => {}} scheme="noir" />);
    expect(flatten(getByText('Set Up Smart Bike').props.style)).toMatchObject({ color: noir.indigoSoft });
  });
});
