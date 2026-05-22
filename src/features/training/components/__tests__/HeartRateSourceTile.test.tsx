import { render } from '@testing-library/react-native';

import { HeartRateSourceTile } from '../HeartRateSourceTile';

describe('HeartRateSourceTile', () => {
  it('renders "{name} · {state}" when state is provided', () => {
    const { getByText } = render(<HeartRateSourceTile name="Polar H10" state="Connected" />);
    expect(getByText('Polar H10 · Connected')).toBeTruthy();
  });

  it('renders just the name when state is null', () => {
    const { getByText } = render(<HeartRateSourceTile name="No HR source" state={null} />);
    expect(getByText('No HR source')).toBeTruthy();
  });

  it('renders the "Heart Rate Source" label', () => {
    const { getByText } = render(<HeartRateSourceTile name="Apple Watch" state="Streaming" />);
    expect(getByText('Heart Rate Source')).toBeTruthy();
  });
});
