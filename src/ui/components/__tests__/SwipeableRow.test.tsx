import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SwipeableRow } from '../SwipeableRow';

const forget = (onPress: () => void) =>
  ({ key: 'forget', label: 'Forget', icon: 'trash-outline', tone: 'danger', onPress }) as const;

it('renders its children', () => {
  const { getByText } = render(
    <SwipeableRow actions={[forget(() => {})]}>
      <Text>Rave</Text>
    </SwipeableRow>,
  );
  expect(getByText('Rave')).toBeTruthy();
});

it('exposes each action as a reachable button that fires its handler', () => {
  const onForget = jest.fn();
  const { getByLabelText } = render(
    <SwipeableRow actions={[forget(onForget)]}>
      <Text>Rave</Text>
    </SwipeableRow>,
  );
  fireEvent.press(getByLabelText('Forget'));
  expect(onForget).toHaveBeenCalledTimes(1);
});

it('renders one button per action', () => {
  const { getByLabelText } = render(
    <SwipeableRow
      actions={[
        { key: 'replace', label: 'Replace', icon: 'swap-horizontal-outline', onPress: () => {} },
        forget(() => {}),
      ]}>
      <Text>Rave</Text>
    </SwipeableRow>,
  );
  expect(getByLabelText('Replace')).toBeTruthy();
  expect(getByLabelText('Forget')).toBeTruthy();
});
