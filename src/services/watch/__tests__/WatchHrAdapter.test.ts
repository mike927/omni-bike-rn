import { WatchHrAdapter } from '../WatchHrAdapter';
import { WatchConnectivity } from 'watch-connectivity';

jest.mock('watch-connectivity', () => ({
  WatchConnectivity: {
    activate: jest.fn(),
    sendMessage: jest.fn(),
    addListener: jest.fn(),
  },
}));

describe('WatchHrAdapter', () => {
  let adapter: WatchHrAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    (WatchConnectivity.sendMessage as jest.Mock).mockReturnValue(true);
    adapter = new WatchHrAdapter();
  });

  describe('connect', () => {
    it('activates the WCSession and sends startHr command', async () => {
      (WatchConnectivity.activate as jest.Mock).mockResolvedValue(undefined);

      await adapter.connect();

      expect(WatchConnectivity.activate).toHaveBeenCalledTimes(1);
      expect(WatchConnectivity.sendMessage).toHaveBeenCalledWith({ cmd: 'startHr' });
    });

    it('rejects if WCSession activation fails', async () => {
      const error = new Error('WCSession not supported');
      (WatchConnectivity.activate as jest.Mock).mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toThrow('WCSession not supported');
      expect(WatchConnectivity.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects if the Watch is not reachable when sending startHr', async () => {
      (WatchConnectivity.activate as jest.Mock).mockResolvedValue(undefined);
      (WatchConnectivity.sendMessage as jest.Mock).mockReturnValue(false);

      await expect(adapter.connect()).rejects.toThrow('Apple Watch is not reachable');
    });
  });

  describe('disconnect', () => {
    it('sends stopHr command to the Watch', async () => {
      await adapter.disconnect();

      expect(WatchConnectivity.sendMessage).toHaveBeenCalledWith({ cmd: 'stopHr' });
    });
  });

  describe('subscribeToHeartRate', () => {
    it('registers a listener on the onWatchHr event and forwards HR values', () => {
      const hrCallback = jest.fn();
      const removeFn = jest.fn();
      (WatchConnectivity.addListener as jest.Mock).mockReturnValue({ remove: removeFn });

      const sub = adapter.subscribeToHeartRate(hrCallback);

      expect(WatchConnectivity.addListener).toHaveBeenCalledWith('onWatchHr', expect.any(Function));

      // Simulate the native module calling back with an HR value
      const listenerCallback = (WatchConnectivity.addListener as jest.Mock).mock.calls[0][1] as (payload: {
        hr: number;
      }) => void;
      listenerCallback({ hr: 72 });

      expect(hrCallback).toHaveBeenCalledWith(72);

      sub.remove();
      expect(removeFn).toHaveBeenCalled();
    });
  });
});
