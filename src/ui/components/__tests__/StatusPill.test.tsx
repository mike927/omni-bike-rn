import { render } from '@testing-library/react-native';

import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it.each([
    ['ready', 'Ready'],
    ['connecting', 'Connecting...'],
    ['noSignal', 'No signal'],
    ['unavailable', 'Unavailable'],
    ['off', 'Off'],
    ['paused', 'Paused'],
    ['notSetUp', 'Not set up'],
  ] as const)('renders the label for %s', (status, label) => {
    const { getByText } = render(<StatusPill status={status} />);
    expect(getByText(label)).toBeTruthy();
  });

  it('renders the connecting state without error and exposes its testID', () => {
    const { getByTestId, getByText } = render(<StatusPill status="connecting" testID="pill" />);
    expect(getByTestId('pill')).toBeTruthy();
    expect(getByText('Connecting...')).toBeTruthy();
  });

  it('uses a custom accessibilityLabel when provided', () => {
    const { getByLabelText } = render(<StatusPill status="ready" accessibilityLabel="Bluetooth HR: Ready" />);
    expect(getByLabelText('Bluetooth HR: Ready')).toBeTruthy();
  });

  it('updates the label when the status changes from connecting to ready', () => {
    const { getByText, queryByText, rerender } = render(<StatusPill status="connecting" />);
    expect(getByText('Connecting...')).toBeTruthy();
    rerender(<StatusPill status="ready" />);
    expect(getByText('Ready')).toBeTruthy();
    expect(queryByText('Connecting...')).toBeNull();
  });
});
