import { fireEvent, render } from '@testing-library/react-native';
import { ProfileCard } from '../ProfileCard';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

it('renders title, summary, hint, and Edit button', () => {
  const onEdit = jest.fn();
  const { getByText } = render(<ProfileCard summary="Male · 75 kg · 178 cm" onEdit={onEdit} />);
  expect(getByText('User Profile')).toBeTruthy();
  expect(getByText('Male · 75 kg · 178 cm')).toBeTruthy();
  expect(getByText('Used for calorie accuracy')).toBeTruthy();
  expect(getByText('Edit')).toBeTruthy();
});

it('calls onEdit when Edit button is pressed', () => {
  const onEdit = jest.fn();
  const { getByText } = render(<ProfileCard summary="Male · 75 kg · 178 cm" onEdit={onEdit} />);
  fireEvent.press(getByText('Edit'));
  expect(onEdit).toHaveBeenCalledTimes(1);
});
