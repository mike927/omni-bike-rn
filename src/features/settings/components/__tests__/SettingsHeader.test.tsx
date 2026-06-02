import { render } from '@testing-library/react-native';
import { SettingsHeader } from '../SettingsHeader';

it('renders title and subtitle', () => {
  const { getByText } = render(
    <SettingsHeader title="Settings" subtitle="Manage your preferences and integrations." />,
  );
  expect(getByText('Settings')).toBeTruthy();
  expect(getByText('Manage your preferences and integrations.')).toBeTruthy();
});
