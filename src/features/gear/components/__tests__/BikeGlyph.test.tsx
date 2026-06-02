import { render } from '@testing-library/react-native';

import { BikeGlyph } from '../BikeGlyph';

it('renders with the provided color and testID', () => {
  const { getByTestId } = render(<BikeGlyph color="#fff" testID="bike-glyph" />);
  expect(getByTestId('bike-glyph')).toBeTruthy();
});
