import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SwipeableRow } from '../SwipeableRow';

const forget = (onPress: () => void) =>
  ({ key: 'forget', label: 'Forget', icon: 'trash-outline', tone: 'danger', onPress }) as const;

it('renders its children', async () => {
  const { getByText } = await render(
    <SwipeableRow actions={[forget(() => {})]}>
      <Text>Rave</Text>
    </SwipeableRow>,
  );
  expect(getByText('Rave')).toBeTruthy();
});

it('exposes each action as a reachable button that fires its handler', async () => {
  const onForget = jest.fn();
  const { getByLabelText } = await render(
    <SwipeableRow actions={[forget(onForget)]}>
      <Text>Rave</Text>
    </SwipeableRow>,
  );
  await fireEvent.press(getByLabelText('Forget'));
  expect(onForget).toHaveBeenCalledTimes(1);
});

it('renders one button per action', async () => {
  const { getByLabelText } = await render(
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

it('tracks a changing actions prop (geometry stays in sync while mounted)', async () => {
  const { getByLabelText, queryByLabelText, rerender } = await render(
    <SwipeableRow actions={[forget(() => {})]}>
      <Text>Rave</Text>
    </SwipeableRow>,
  );
  expect(queryByLabelText('Replace')).toBeNull();

  await rerender(
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
