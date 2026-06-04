import { render } from '@testing-library/react-native';

import { EffortStatTile } from '../EffortStatTile';

describe('EffortStatTile', () => {
  it('renders label, value, unit and peak', () => {
    const { getByText } = render(
      <EffortStatTile label="AVG POWER" value="214" unit="W" peakLabel="412 W" accent="power" />,
    );
    expect(getByText('AVG POWER')).toBeTruthy();
    expect(getByText('214')).toBeTruthy();
    expect(getByText('412 W')).toBeTruthy();
  });

  it('omits the peak row when peakLabel is null', () => {
    const { queryByText } = render(
      <EffortStatTile label="AVG HR" value="--" unit="bpm" peakLabel={null} accent="hr" />,
    );
    expect(queryByText(/Max/)).toBeNull();
  });
});
