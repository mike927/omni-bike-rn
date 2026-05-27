import { render } from '@testing-library/react-native';

import { SourceRow } from '../SourceRow';

describe('SourceRow', () => {
  it('renders label, device name, and the status pill label', () => {
    const { getByText } = render(<SourceRow label="Bluetooth HR" deviceName="HRM-Dual:031993" status="connecting" />);
    expect(getByText('Bluetooth HR')).toBeTruthy();
    expect(getByText('HRM-Dual:031993')).toBeTruthy();
    expect(getByText('Connecting...')).toBeTruthy();
  });

  it('omits the device-name sub-line when deviceName is absent', () => {
    const { getByText, queryByText } = render(<SourceRow label="Apple Watch" status="unavailable" />);
    expect(getByText('Apple Watch')).toBeTruthy();
    expect(getByText('Unavailable')).toBeTruthy();
    expect(queryByText('HRM-Dual:031993')).toBeNull();
  });
});
