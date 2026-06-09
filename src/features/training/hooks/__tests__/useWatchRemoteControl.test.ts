import { renderHook, act } from '@testing-library/react-native';

import { useWatchRemoteControl, type WatchRemoteControlHandlers } from '../useWatchRemoteControl';

// ── Module mock ────────────────────────────────────────────────────────────────

type ControlPayload = { action: string; sentAtMs?: number };
type ControlListener = (payload: ControlPayload) => void;

let mockWcAvailable = true;

jest.mock('watch-connectivity', () => {
  const listeners: Record<string, ControlListener> = {};
  return {
    __listeners: listeners,
    get isWatchConnectivityAvailable() {
      return mockWcAvailable;
    },
    WatchConnectivity: {
      addListener: jest.fn((event: string, cb: ControlListener) => {
        listeners[event] = cb;
        return { remove: jest.fn() };
      }),
    },
  };
});

function getMock() {
  return jest.requireMock('watch-connectivity') as {
    __listeners: Record<string, ControlListener>;
    WatchConnectivity: { addListener: jest.Mock };
  };
}

function emitPayload(payload: ControlPayload) {
  act(() => {
    getMock().__listeners.onWatchControlRequest?.(payload);
  });
}

function emit(action: string) {
  emitPayload({ action });
}

beforeEach(() => {
  mockWcAvailable = true;
  jest.clearAllMocks();
  for (const key of Object.keys(getMock().__listeners)) {
    delete getMock().__listeners[key];
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeHandlers() {
  return { onPause: jest.fn(), onResume: jest.fn(), onFinish: jest.fn() };
}

describe('useWatchRemoteControl', () => {
  it('subscribes to onWatchControlRequest on mount', () => {
    const handlers = makeHandlers();
    renderHook(() => useWatchRemoteControl(handlers));
    expect(getMock().WatchConnectivity.addListener).toHaveBeenCalledWith('onWatchControlRequest', expect.any(Function));
  });

  it('routes a "pause" request to onPause only', () => {
    const handlers = makeHandlers();
    renderHook(() => useWatchRemoteControl(handlers));
    emit('pause');
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    expect(handlers.onResume).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('routes a "resume" request to onResume only', () => {
    const handlers = makeHandlers();
    renderHook(() => useWatchRemoteControl(handlers));
    emit('resume');
    expect(handlers.onResume).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('routes an "end" request to onFinish only', () => {
    const handlers = makeHandlers();
    renderHook(() => useWatchRemoteControl(handlers));
    emit('end');
    expect(handlers.onFinish).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onResume).not.toHaveBeenCalled();
  });

  it('ignores unknown actions', () => {
    const handlers = makeHandlers();
    renderHook(() => useWatchRemoteControl(handlers));
    emit('explode');
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onResume).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('ignores stale queued control requests', () => {
    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    const handlers = makeHandlers();
    renderHook(() => useWatchRemoteControl(handlers));
    emitPayload({ action: 'end', sentAtMs: 59_999 });
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('dispatches to the latest handler without re-subscribing on re-render', () => {
    const first = makeHandlers();
    const second = makeHandlers();
    const { rerender } = renderHook((props: { h: WatchRemoteControlHandlers }) => useWatchRemoteControl(props.h), {
      initialProps: { h: first },
    });

    rerender({ h: second });
    emit('pause');

    expect(second.onPause).toHaveBeenCalledTimes(1);
    expect(first.onPause).not.toHaveBeenCalled();
    // Listener registered exactly once across the re-render.
    expect(getMock().WatchConnectivity.addListener).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', () => {
    const handlers = makeHandlers();
    const { unmount } = renderHook(() => useWatchRemoteControl(handlers));
    const sub = getMock().WatchConnectivity.addListener.mock.results[0]?.value as { remove: jest.Mock };
    unmount();
    expect(sub.remove).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe (and does not throw) when unavailable (Android)', () => {
    mockWcAvailable = false;
    const handlers = makeHandlers();
    expect(() => renderHook(() => useWatchRemoteControl(handlers))).not.toThrow();
    expect(getMock().WatchConnectivity.addListener).not.toHaveBeenCalled();
  });
});
