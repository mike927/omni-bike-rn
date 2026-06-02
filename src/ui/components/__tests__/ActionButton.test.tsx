import { render } from '@testing-library/react-native';

import { ActionButton } from '../ActionButton';
import { noir } from '../../theme';

const flatten = (s: unknown) => (Array.isArray(s) ? Object.assign({}, ...s.flat(Infinity).filter(Boolean)) : s);

it('renders a noir secondary button with indigoSoft label', () => {
  const { getByText } = render(<ActionButton label="Edit" onPress={() => {}} variant="secondary" scheme="noir" />);
  expect(flatten(getByText('Edit').props.style)).toMatchObject({ color: noir.indigoSoft });
});

it('applies sm sizing to the label', () => {
  const { getByText } = render(
    <ActionButton label="Edit" onPress={() => {}} variant="secondary" scheme="noir" size="sm" />,
  );
  expect(flatten(getByText('Edit').props.style)).toMatchObject({ fontSize: 13 });
});

it('still renders the light scheme by default', () => {
  const { getByText } = render(<ActionButton label="Save" onPress={() => {}} />);
  expect(getByText('Save')).toBeTruthy();
});
