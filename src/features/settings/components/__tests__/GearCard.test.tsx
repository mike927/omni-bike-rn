import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { GearCard } from '../GearCard';

it('selectable card calls onSelectPress and exposes selected a11y state', async () => {
  const onSelect = jest.fn();
  const { getByTestId } = await render(
    <GearCard
      icon="heart"
      name="Polar H10"
      kind="Chest strap"
      status="ready"
      selected
      onSelectPress={onSelect}
      headerTestId="hr-tile-bluetooth"
    />,
  );
  const body = getByTestId('hr-tile-bluetooth');
  expect(body.props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(body);
  expect(onSelect).toHaveBeenCalled();
});

it.each([
  [true, 'Selected'],
  [false, 'Not selected'],
] as const)('shows selection %s separately from readiness', async (selected, label) => {
  const { getByText } = await render(
    <GearCard
      icon="heart"
      name="Polar H10"
      kind="Chest strap"
      status="ready"
      selected={selected}
      onSelectPress={() => {}}
      headerTestId="t"
    />,
  );
  expect(getByText(`Chest strap · ${label}`)).toBeTruthy();
  expect(getByText('Ready')).toBeTruthy();
});

it('expand-only card (selected undefined) is role=button with expanded state, not selected', async () => {
  const { getByTestId } = await render(
    <GearCard
      icon="bicycle"
      name="Zipro"
      kind="Smart trainer"
      status="ready"
      expandable
      expanded={false}
      headerTestId="bike-tile-header"
      chevronTestId="bike-tile-chevron"
      onToggleExpand={() => {}}
    />,
  );
  const body = getByTestId('bike-tile-header');
  expect(body.props.accessibilityRole).toBe('button');
  expect(body.props.accessibilityState?.selected).toBeUndefined();
  expect(body.props.accessibilityState).toMatchObject({ expanded: false });
  expect(getByTestId('bike-tile-chevron')).toBeTruthy();
});

it('renders actions only when expanded; chevron toggle does not select', async () => {
  const onToggle = jest.fn();
  const { getByTestId, queryByText, rerender, getByText } = await render(
    <GearCard
      icon="heart"
      name="Polar"
      kind="Chest strap"
      status="ready"
      selected={false}
      onSelectPress={() => {}}
      expandable
      expanded={false}
      chevronTestId="hr-strap-chevron"
      onToggleExpand={onToggle}
      actions={<Text>ACTIONS</Text>}
      headerTestId="hr-tile-bluetooth"
    />,
  );
  expect(queryByText('ACTIONS')).toBeNull();
  await fireEvent.press(getByTestId('hr-strap-chevron'));
  expect(onToggle).toHaveBeenCalled();
  await rerender(
    <GearCard
      icon="heart"
      name="Polar"
      kind="Chest strap"
      status="ready"
      selected={false}
      onSelectPress={() => {}}
      expandable
      expanded
      chevronTestId="hr-strap-chevron"
      onToggleExpand={onToggle}
      actions={<Text>ACTIONS</Text>}
      headerTestId="hr-tile-bluetooth"
    />,
  );
  expect(getByText('ACTIONS')).toBeTruthy();
});
