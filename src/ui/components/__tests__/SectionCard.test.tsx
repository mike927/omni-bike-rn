import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SectionCard } from '../SectionCard';

describe('SectionCard', () => {
  it('renders title, description, and children', () => {
    const { getByText } = render(
      <SectionCard title="Bike" description="KICKR">
        <Text>Status: Connected</Text>
      </SectionCard>,
    );
    expect(getByText('Bike')).toBeTruthy();
    expect(getByText('KICKR')).toBeTruthy();
    expect(getByText('Status: Connected')).toBeTruthy();
  });

  it('fires onPress when the card is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <SectionCard title="Bike" onPress={onPress}>
        <Text>body</Text>
      </SectionCard>,
    );
    fireEvent.press(getByText('Bike'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without a press handler when onPress is omitted', () => {
    const { getByText } = render(
      <SectionCard title="Latest Workout">
        <Text>body</Text>
      </SectionCard>,
    );
    expect(getByText('Latest Workout')).toBeTruthy();
  });
});
