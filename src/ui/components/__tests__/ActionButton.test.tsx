import { render } from '@testing-library/react-native';

import { ActionButton } from '../ActionButton';
import { noir } from '../../theme';

const flatten = (s: unknown) => (Array.isArray(s) ? Object.assign({}, ...s.flat(Infinity).filter(Boolean)) : s);

it('renders a noir secondary button with the AA-compliant indigoText label', () => {
  const { getByText } = render(<ActionButton label="Edit" onPress={() => {}} variant="secondary" scheme="noir" />);
  expect(flatten(getByText('Edit').props.style)).toMatchObject({ color: noir.indigoText });
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

it('exposes the disabled state and an explanatory hint to assistive tech', () => {
  const { getByRole } = render(
    <ActionButton
      label="Start Ride"
      onPress={() => {}}
      disabled
      accessibilityHint="Connect your smart bike to start a ride."
    />,
  );
  const button = getByRole('button');
  expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  expect(button.props.accessibilityHint).toBe('Connect your smart bike to start a ride.');
});
