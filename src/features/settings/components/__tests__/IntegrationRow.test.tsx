import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { IntegrationRow } from '../IntegrationRow';

it('renders all four texts: name, statusLabel, action, and children', () => {
  const { getByText } = render(
    <IntegrationRow
      icon={<Text>icon</Text>}
      name="Strava"
      statusLabel="Connected"
      connected
      action={<Text>Disconnect</Text>}>
      <Text>nested</Text>
    </IntegrationRow>,
  );
  expect(getByText('Strava')).toBeTruthy();
  expect(getByText('Connected')).toBeTruthy();
  expect(getByText('Disconnect')).toBeTruthy();
  expect(getByText('nested')).toBeTruthy();
});
