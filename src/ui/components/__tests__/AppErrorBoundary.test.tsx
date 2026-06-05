import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '../AppErrorBoundary';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderBoundary(retry: () => Promise<void> = jest.fn()) {
  render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <AppErrorBoundary error={new Error('boom from a screen')} retry={retry} />
    </SafeAreaProvider>,
  );
  return { retry };
}

describe('AppErrorBoundary', () => {
  it('renders a recoverable fallback instead of a white screen', () => {
    renderBoundary();

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('calls retry when the user taps Try again', () => {
    const retry = jest.fn(() => Promise.resolve());
    renderBoundary(retry);

    fireEvent.press(screen.getByText('Try again'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
