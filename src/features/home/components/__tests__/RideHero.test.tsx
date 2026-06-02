import { fireEvent, render } from '@testing-library/react-native';
import { RideHero } from '../RideHero';

const props = {
  kicker: 'Ready when you are',
  title: 'Start Ride',
  subline: 'KICKR Bike · Polar H10',
  variant: 'primary' as const,
  onPress: jest.fn(),
};

it('renders title and subline', () => {
  const { getByText } = render(<RideHero {...props} />);
  expect(getByText('Start Ride')).toBeTruthy();
  expect(getByText('KICKR Bike · Polar H10')).toBeTruthy();
});

it('fires onPress when enabled', () => {
  const onPress = jest.fn();
  const { getByRole } = render(<RideHero {...props} onPress={onPress} />);
  fireEvent.press(getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('does not fire onPress when disabled', () => {
  const onPress = jest.fn();
  const { getByRole } = render(<RideHero {...props} disabled onPress={onPress} />);
  fireEvent.press(getByRole('button'));
  expect(onPress).not.toHaveBeenCalled();
});
