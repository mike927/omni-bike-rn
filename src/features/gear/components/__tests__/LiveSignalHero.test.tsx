import { render } from '@testing-library/react-native';

import { LiveSignalHero } from '../LiveSignalHero';

it('renders bike metrics when confirmed', () => {
  const { getByText } = render(
    <LiveSignalHero
      target="bike"
      confirmed
      bikeMetrics={{ speed: 31.4, cadence: 91, power: 124, distance: 200 }}
      hrBpm={null}
    />,
  );
  expect(getByText('124')).toBeTruthy(); // power
  expect(getByText('91')).toBeTruthy(); // cadence
  expect(getByText('31.4')).toBeTruthy(); // speed km/h
  expect(getByText('0.2')).toBeTruthy(); // distance 200 m -> km
});

it('renders placeholders for bike before a signal', () => {
  const { getAllByText } = render(<LiveSignalHero target="bike" confirmed={false} bikeMetrics={null} hrBpm={null} />);
  expect(getAllByText('—').length).toBe(4);
});

it('renders a missing optional bike field as a placeholder', () => {
  const { getByText } = render(
    <LiveSignalHero target="bike" confirmed bikeMetrics={{ speed: 30, cadence: 88, power: 110 }} hrBpm={null} />,
  );
  expect(getByText('110')).toBeTruthy();
  expect(getByText('—')).toBeTruthy(); // distance missing
});

it('renders a large BPM for HR when confirmed', () => {
  const { getByText } = render(<LiveSignalHero target="hr" confirmed bikeMetrics={null} hrBpm={142} />);
  expect(getByText('142')).toBeTruthy();
});

it('renders a BPM placeholder for HR before a signal', () => {
  const { getByText } = render(<LiveSignalHero target="hr" confirmed={false} bikeMetrics={null} hrBpm={null} />);
  expect(getByText('—')).toBeTruthy();
});
