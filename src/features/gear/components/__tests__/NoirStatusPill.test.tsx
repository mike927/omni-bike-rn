import { render } from '@testing-library/react-native';

import { NoirStatusPill } from '../NoirStatusPill';

it('renders the canonical label for a status', () => {
  const { getByText } = render(<NoirStatusPill status="ready" />);
  expect(getByText('Ready')).toBeTruthy();
});

it('renders the connecting label', () => {
  const { getByText } = render(<NoirStatusPill status="connecting" />);
  expect(getByText('Connecting...')).toBeTruthy();
});
