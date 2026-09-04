import { render } from '@testing-library/react-native';
import { SectionLabel, Eyebrow } from '../SectionLabel';

it('SectionLabel renders its title', async () => {
  const { getByText } = await render(<SectionLabel title="Integrations" />);
  expect(getByText('Integrations')).toBeTruthy();
});

it('Eyebrow renders its child text', async () => {
  const { getByText } = await render(<Eyebrow>Linked Strava bike</Eyebrow>);
  expect(getByText('Linked Strava bike')).toBeTruthy();
});
