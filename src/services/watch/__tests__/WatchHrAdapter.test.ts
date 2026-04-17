import { WatchHrAdapter } from '../WatchHrAdapter';
import { WatchConnectivity } from 'watch-connectivity';

jest.mock('watch-connectivity', () => ({
  WatchConnectivity: {
    activate: jest.fn(),
    startWatchApp: jest.fn(),
    endMirroredWorkout: jest.fn(),
    addListener: jest.fn(),
  },
}));

describe('WatchHrAdapter', () => {
  let adapter: WatchHrAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    (WatchConnectivity.activate as jest.Mock).mockResolvedValue(undefined);
    (WatchConnectivity.startWatchApp as jest.Mock).mockResolvedValue(undefined);
    (WatchConnectivity.endMirroredWorkout as jest.Mock).mockResolvedValue(undefined);
    adapter = new WatchHrAdapter();
  });

  describe('connect', () => {
    it('activates the WCSession and mirrors an HKWorkoutSession to the Watch', async () => {
      await adapter.connect();

      expect(WatchConnectivity.activate).toHaveBeenCalledTimes(1);
      expect(WatchConnectivity.startWatchApp).toHaveBeenCalledTimes(1);
    });

    it('rejects if WCSession activation fails', async () => {
      const error = new Error('WCSession not supported');
      (WatchConnectivity.activate as jest.Mock).mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toThrow('WCSession not supported');
      expect(WatchConnectivity.startWatchApp).not.toHaveBeenCalled();
    });

    it('rejects if mirroring the workout session fails', async () => {
      (WatchConnectivity.startWatchApp as jest.Mock).mockRejectedValue(
        new Error('Apple Watch app could not be mirrored'),
      );

      await expect(adapter.connect()).rejects.toThrow('Apple Watch app could not be mirrored');
    });
  });

  describe('disconnect', () => {
    it('ends the iPhone-primary workout session', async () => {
      await adapter.disconnect();

      expect(WatchConnectivity.endMirroredWorkout).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToHeartRate', () => {
    it('registers a listener on the onWatchHr event and forwards HR values', () => {
      const hrCallback = jest.fn();
      const removeFn = jest.fn();
      (WatchConnectivity.addListener as jest.Mock).mockReturnValue({ remove: removeFn });

      const sub = adapter.subscribeToHeartRate(hrCallback);

      expect(WatchConnectivity.addListener).toHaveBeenCalledWith('onWatchHr', expect.any(Function));

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
