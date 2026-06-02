import { render } from '@testing-library/react-native';

import { HrGlyph } from '../HrGlyph';

it('renders with the provided color and testID', () => {
  const { getByTestId } = render(<HrGlyph color="#fff" testID="hr-glyph" />);
  expect(getByTestId('hr-glyph')).toBeTruthy();
});
