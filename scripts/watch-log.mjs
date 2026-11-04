export const WATCH_BUNDLE_IDS = { phone: 'app.omnibike', watch: 'app.omnibike.watchkitapp' };

export function parseWatchLog(contents, target) {
  const label = target === 'phone' ? 'iPhone' : 'Watch';
  const header = contents.match(new RegExp(`^=== ${label} WC log started (.+) ===$`, 'm'));
  const startedAt = header ? Date.parse(header[1]) : Number.NaN;
  const activationPattern =
    target === 'phone'
      ? /\[WC-iPhone\] resolveActivation: error=(\S+) state=(\d+)/g
      : /\[WC-Watch\] activationDidCompleteWith state=(\d+) error=(\S+)/g;
  const activation = [...contents.matchAll(activationPattern)].at(-1);
  const activated =
    target === 'phone'
      ? activation?.[1] === 'nil' && activation?.[2] === '2'
      : activation?.[1] === '2' && activation?.[2] === 'nil';
  const startupMarker =
    target === 'phone'
      ? '[WC-iPhone] OnCreate: registering workoutSessionMirroringStartHandler'
      : '[WC-Watch] applicationDidFinishLaunching';
  const companionLine = contents.split('\n').findLast((line) => line.includes('[WC-iPhone] emitCompanionState '));
  const companionMatch = companionLine?.match(
    /available=(true|false) paired=(true|false) installed=(true|false) activationState=(\d+) reachable=(true|false)/,
  );
  const reachabilityLine = contents
    .split('\n')
    .findLast((line) =>
      /\[WC-iPhone\] (sessionReachabilityDidChange|emitCompanionState|resolveActivation:|activate:).*reachable=(true|false)/.test(
        line,
      ),
    );
  const reachability = reachabilityLine?.match(/reachable=(true|false)/);

  return {
    startedAt: Number.isFinite(startedAt) ? new Date(startedAt).toISOString() : null,
    startupVerified: Number.isFinite(startedAt) && contents.includes(startupMarker) && activated,
    companion: companionMatch
      ? {
          available: companionMatch[1] === 'true',
          paired: companionMatch[2] === 'true',
          installed: companionMatch[3] === 'true',
          activationState: Number(companionMatch[4]),
          reachable: companionMatch[5] === 'true',
          line: companionLine,
        }
      : null,
    reachable: reachability ? reachability[1] === 'true' : companionMatch ? companionMatch[5] === 'true' : null,
  };
}
