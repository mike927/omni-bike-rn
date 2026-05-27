import { render } from '@testing-library/react-native';

import { HeartRateSourceTile } from '../HeartRateSourceTile';

describe('HeartRateSourceTile', () => {
  it('renders the name and a status pill when status is provided', () => {
    const { getByText } = render(<HeartRateSourceTile name="Polar H10" status="ready" />);
    expect(getByText('Polar H10')).toBeTruthy();
    expect(getByText('Ready')).toBeTruthy();
  });

  it('renders just the name when status is null', () => {
    const { getByText, queryByText } = render(<HeartRateSourceTile name="No HR source" status={null} />);
    expect(getByText('No HR source')).toBeTruthy();
    expect(queryByText('Ready')).toBeNull();
  });

  it('renders the "Heart Rate Source" label', () => {
    const { getByText } = render(<HeartRateSourceTile name="Apple Watch" status="ready" />);
    expect(getByText('Heart Rate Source')).toBeTruthy();
  });
});
