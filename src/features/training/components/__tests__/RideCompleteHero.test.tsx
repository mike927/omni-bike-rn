import { render } from '@testing-library/react-native';

import { RideCompleteHero } from '../RideCompleteHero';

describe('RideCompleteHero', () => {
  it('renders the ride-complete headline and totals', () => {
    const { getByText } = render(
      <RideCompleteHero
        hero={{
          distance: '28.4',
          distanceUnit: 'km',
          dateLabel: 'Sat, May 30',
          movingLabel: '1h 2m',
          caloriesLabel: '642 kcal',
        }}
      />,
    );
    expect(getByText('RIDE COMPLETE')).toBeTruthy();
    expect(getByText('28.4')).toBeTruthy();
    expect(getByText('Sat, May 30')).toBeTruthy();
    expect(getByText('1h 2m')).toBeTruthy();
    expect(getByText('642 kcal')).toBeTruthy();
  });
});
