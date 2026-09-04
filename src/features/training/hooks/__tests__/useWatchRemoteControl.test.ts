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

async function emitPayload(payload: ControlPayload) {
  await act(() => {
    getMock().__listeners.onWatchControlRequest?.(payload);
  });
}

async function emit(action: string) {
  await emitPayload({ action });
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
  it('subscribes to onWatchControlRequest on mount', async () => {
    const handlers = makeHandlers();
    await renderHook(() => useWatchRemoteControl(handlers));
    expect(getMock().WatchConnectivity.addListener).toHaveBeenCalledWith('onWatchControlRequest', expect.any(Function));
  });

  it('routes a "pause" request to onPause only', async () => {
    const handlers = makeHandlers();
    await renderHook(() => useWatchRemoteControl(handlers));
    await emit('pause');
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    expect(handlers.onResume).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('routes a "resume" request to onResume only', async () => {
    const handlers = makeHandlers();
    await renderHook(() => useWatchRemoteControl(handlers));
    await emit('resume');
    expect(handlers.onResume).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('routes an "end" request to onFinish only', async () => {
    const handlers = makeHandlers();
    await renderHook(() => useWatchRemoteControl(handlers));
    await emit('end');
    expect(handlers.onFinish).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onResume).not.toHaveBeenCalled();
  });

  it('ignores unknown actions', async () => {
    const handlers = makeHandlers();
    await renderHook(() => useWatchRemoteControl(handlers));
    await emit('explode');
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onResume).not.toHaveBeenCalled();
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('ignores stale queued control requests', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    const handlers = makeHandlers();
    await renderHook(() => useWatchRemoteControl(handlers));
    await emitPayload({ action: 'end', sentAtMs: 59_999 });
    expect(handlers.onFinish).not.toHaveBeenCalled();
  });

  it('dispatches to the latest handler without re-subscribing on re-render', async () => {
    const first = makeHandlers();
    const second = makeHandlers();
    const { rerender } = await renderHook(
      (props: { h: WatchRemoteControlHandlers }) => useWatchRemoteControl(props.h),
      {
        initialProps: { h: first },
      },
    );

    await rerender({ h: second });
    await emit('pause');

    expect(second.onPause).toHaveBeenCalledTimes(1);
    expect(first.onPause).not.toHaveBeenCalled();
    // Listener registered exactly once across the re-render.
    expect(getMock().WatchConnectivity.addListener).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', async () => {
    const handlers = makeHandlers();
    const { unmount } = await renderHook(() => useWatchRemoteControl(handlers));
    const sub = getMock().WatchConnectivity.addListener.mock.results[0]?.value as { remove: jest.Mock };
    await unmount();
    expect(sub.remove).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe (and does not throw) when unavailable (Android)', async () => {
    mockWcAvailable = false;
    const handlers = makeHandlers();
    await expect(renderHook(() => useWatchRemoteControl(handlers))).resolves.toBeDefined();
    expect(getMock().WatchConnectivity.addListener).not.toHaveBeenCalled();
  });
});
