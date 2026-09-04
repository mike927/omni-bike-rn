import { render } from '@testing-library/react-native';

import { StatusPill } from '../StatusPill';
import { noirPillTones } from '../../theme';

describe('StatusPill', () => {
  it.each([
    ['ready', 'Ready'],
    ['connecting', 'Connecting...'],
    ['noSignal', 'No signal'],
    ['unavailable', 'Unavailable'],
    ['paused', 'Paused'],
    ['notSetUp', 'Not set up'],
  ] as const)('renders the label for %s', async (status, label) => {
    const { getByText } = await render(<StatusPill status={status} />);
    expect(getByText(label)).toBeTruthy();
  });

  it('renders the connecting state without error and exposes its testID', async () => {
    const { getByTestId, getByText } = await render(<StatusPill status="connecting" testID="pill" />);
    expect(getByTestId('pill')).toBeTruthy();
    expect(getByText('Connecting...')).toBeTruthy();
  });

  it('uses a custom accessibilityLabel when provided', async () => {
    const { getByLabelText } = await render(<StatusPill status="ready" accessibilityLabel="Bluetooth HR: Ready" />);
    expect(getByLabelText('Bluetooth HR: Ready')).toBeTruthy();
  });

  it('updates the label when the status changes from connecting to ready', async () => {
    const { getByText, queryByText, rerender } = await render(<StatusPill status="connecting" />);
    expect(getByText('Connecting...')).toBeTruthy();
    await rerender(<StatusPill status="ready" />);
    expect(getByText('Ready')).toBeTruthy();
    expect(queryByText('Connecting...')).toBeNull();
  });
});

it('renders noir tone colors when scheme is noir', async () => {
  const { getByTestId } = await render(<StatusPill status="ready" scheme="noir" testID="pill" />);
  const pill = getByTestId('pill');
  expect(pill.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ backgroundColor: noirPillTones.good.bg })]),
  );
});
