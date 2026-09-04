import { fireEvent, render } from '@testing-library/react-native';
import { ProfileCard } from '../ProfileCard';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

it('renders title, summary, hint, and Edit button', async () => {
  const onEdit = jest.fn();
  const { getByText } = await render(<ProfileCard summary="Male · 75 kg · 178 cm" onEdit={onEdit} />);
  expect(getByText('User Profile')).toBeTruthy();
  expect(getByText('Male · 75 kg · 178 cm')).toBeTruthy();
  expect(getByText('Used for calorie accuracy')).toBeTruthy();
  expect(getByText('Edit')).toBeTruthy();
});

it('calls onEdit when Edit button is pressed', async () => {
  const onEdit = jest.fn();
  const { getByText } = await render(<ProfileCard summary="Male · 75 kg · 178 cm" onEdit={onEdit} />);
  await fireEvent.press(getByText('Edit'));
  expect(onEdit).toHaveBeenCalledTimes(1);
});
