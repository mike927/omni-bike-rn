import { render } from '@testing-library/react-native';
import { SectionLabel, Eyebrow } from '../SectionLabel';

it('SectionLabel renders its title', () => {
  const { getByText } = render(<SectionLabel title="Integrations" />);
  expect(getByText('Integrations')).toBeTruthy();
});

it('Eyebrow renders its child text', () => {
  const { getByText } = render(<Eyebrow>Linked Strava bike</Eyebrow>);
  expect(getByText('Linked Strava bike')).toBeTruthy();
});
