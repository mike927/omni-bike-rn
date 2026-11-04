import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

type Invocation = {
  command: string;
  args: string[];
};

const projectRoot = path.resolve(__dirname, '../../..');

function runReleaseScript(
  mode: string,
  options: {
    xcodebuildFailures?: number;
    xcodebuildFailureStatus?: number;
    xcrunError?: string;
    xcrunFailures?: number;
    useDefaultWatchDestination?: boolean;
    stalePods?: boolean;
    availableSchemes?: string[];
    signingIdentities?: number;
    deviceProblem?: 'locked' | 'unpaired' | 'developer-mode' | 'offline' | 'simulator';
    checkOnly?: boolean;
  } = {},
): {
  derivedDataPath: string;
  invocations: Invocation[];
  stderr: string;
  receipt: {
    result: string;
    source: { digest: string };
    launches: Record<string, string>;
  };
  status: number | null;
} {
  const testRoot = mkdtempSync(path.join(tmpdir(), 'omni-ios-release-'));
  const fixtureRoot = path.join(testRoot, 'project');
  const fakeBin = path.join(testRoot, 'bin');
  const derivedDataPath = path.join(testRoot, 'derived-data');
  const invocationLog = path.join(testRoot, 'invocations.jsonl');
  const xcodebuildAttemptLog = path.join(testRoot, 'xcodebuild-attempts.txt');
  const receiptDirectory = path.join(fixtureRoot, 'logs', 'releases');
  const beforeReceipts = existsSync(receiptDirectory) ? new Set(readdirSync(receiptDirectory)) : new Set<string>();
  const xcrunAttemptLog = path.join(testRoot, 'xcrun-attempts.txt');
  mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  mkdirSync(path.join(fixtureRoot, 'ios', 'omnibikern.xcworkspace'), { recursive: true });
  mkdirSync(path.join(fixtureRoot, 'ios', 'Pods'), { recursive: true });
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- The integration fixture uses the active Git installation.
  execFileSync('git', ['init', '-q', fixtureRoot]);
  writeFileSync(path.join(fixtureRoot, '.gitignore'), 'logs/\n');
  writeFileSync(path.join(fixtureRoot, 'scripts/check-dependencies.mjs'), '');
  writeFileSync(path.join(fixtureRoot, 'ios/Podfile.lock'), 'PODS: current\n');
  writeFileSync(
    path.join(fixtureRoot, 'ios/Pods/Manifest.lock'),
    options.stalePods ? 'PODS: old\n' : 'PODS: current\n',
  );
  for (const script of ['ios-release.mjs', 'verification.mjs']) {
    copyFileSync(path.join(projectRoot, 'scripts', script), path.join(fixtureRoot, 'scripts', script));
  }
  mkdirSync(fakeBin);
  const fakeTool = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
if (command === 'security') {
  process.stdout.write(process.env.OMNI_RELEASE_TEST_IDENTITIES + ' valid identities found');
  process.exit(0);
}
if (command === 'xcodebuild' && args[0] === '-version') { process.stdout.write('Xcode TEST'); process.exit(0); }
if (command === 'xcodebuild' && args.includes('-list')) {
  process.stdout.write(JSON.stringify({workspace: {schemes: JSON.parse(process.env.OMNI_RELEASE_TEST_SCHEMES)}}));
  process.exit(0);
}
if (command === 'xcodebuild' && args.includes('clean')) process.exit(0);
if (command === 'xcrun' && args[1] === 'list') { process.stdout.write('TEST-IPHONE TEST-WATCH'); process.exit(0); }
if (command === 'xcrun' && args.includes('info')) {
  const device = args[args.indexOf('--device') + 1];
  const problem = device === 'TEST-WATCH' ? process.env.OMNI_RELEASE_TEST_DEVICE_PROBLEM : '';
  if (problem === 'offline') { process.stderr.write('Connection could not be established'); process.exit(1); }
  const deviceInfo = args.includes('lockState')
    ? {passcodeRequired: problem === 'locked', unlockedSinceBoot: true}
    : {properties: {
        hardware: {reality: problem === 'simulator' ? 'simulated' : 'physical'},
        state: {developerModeStatus: problem === 'developer-mode' ? {disabled: {}} : {enabled: {mode: 1}}},
        connection: {pairingState: problem === 'unpaired' ? 'unpaired' : 'paired'},
      }};
  process.stdout.write(JSON.stringify({result: deviceInfo}));
  process.exit(0);
}
fs.appendFileSync(process.env.OMNI_RELEASE_TEST_LOG, JSON.stringify({ command, args }) + '\\n');
if (command === 'xcodebuild') {
  const attemptLog = process.env.OMNI_RELEASE_TEST_XCODEBUILD_ATTEMPT_LOG;
  const attempt = fs.existsSync(attemptLog) ? Number(fs.readFileSync(attemptLog, 'utf8')) + 1 : 1;
  fs.writeFileSync(attemptLog, String(attempt));
  if (attempt <= Number(process.env.OMNI_RELEASE_TEST_XCODEBUILD_FAILURES ?? 0)) {
    process.exit(Number(process.env.OMNI_RELEASE_TEST_XCODEBUILD_FAILURE_STATUS));
  }
  const derivedDataIndex = args.indexOf('-derivedDataPath');
  const derivedDataPath = args[derivedDataIndex + 1];
  const scheme = args[args.indexOf('-scheme') + 1];
  const product = scheme === 'omnibikern'
    ? ['Release-iphoneos', 'omnibikern.app']
    : ['Release-watchos', 'OmniBikeWatch Watch App.app'];
  fs.mkdirSync(path.join(derivedDataPath, 'Build', 'Products', ...product), { recursive: true });
}
if (command === 'xcrun') {
  const attemptLog = process.env.OMNI_RELEASE_TEST_XCRUN_ATTEMPT_LOG;
  const attempt = fs.existsSync(attemptLog) ? Number(fs.readFileSync(attemptLog, 'utf8')) + 1 : 1;
  fs.writeFileSync(attemptLog, String(attempt));
  if (attempt <= Number(process.env.OMNI_RELEASE_TEST_XCRUN_FAILURES ?? 0)) {
    process.stderr.write(process.env.OMNI_RELEASE_TEST_XCRUN_ERROR);
    process.exit(1);
  }
}
`;

  for (const command of ['xcodebuild', 'xcrun', 'security']) {
    const commandPath = path.join(fakeBin, command);
    writeFileSync(commandPath, fakeTool);
    chmodSync(commandPath, 0o755);
  }

  try {
    const scriptArgs = [path.join(fixtureRoot, 'scripts/ios-release.mjs'), mode];
    if (options.checkOnly) scriptArgs.push('--check');
    const result = spawnSync(process.execPath, scriptArgs, {
      cwd: fixtureRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        OMNI_IOS_DERIVED_DATA_PATH: derivedDataPath,
        OMNI_IOS_DEVICE: 'TEST-IPHONE',
        OMNI_IOS_DEVICE_RETRY_DELAY_MS: '0',
        OMNI_IOS_XCODE_DESTINATION: 'platform=iOS,id=IPHONE-UDID',
        OMNI_RELEASE_TEST_LOG: invocationLog,
        OMNI_RELEASE_TEST_SCHEMES: JSON.stringify(
          options.availableSchemes ?? ['omnibikern', 'OmniBikeWatch Watch App'],
        ),
        OMNI_RELEASE_TEST_IDENTITIES: String(options.signingIdentities ?? 1),
        OMNI_RELEASE_TEST_DEVICE_PROBLEM: options.deviceProblem ?? '',
        OMNI_RELEASE_TEST_XCODEBUILD_ATTEMPT_LOG: xcodebuildAttemptLog,
        OMNI_RELEASE_TEST_XCODEBUILD_FAILURES: String(options.xcodebuildFailures ?? 0),
        OMNI_RELEASE_TEST_XCODEBUILD_FAILURE_STATUS: String(options.xcodebuildFailureStatus ?? 1),
        OMNI_RELEASE_TEST_XCRUN_ATTEMPT_LOG: xcrunAttemptLog,
        OMNI_RELEASE_TEST_XCRUN_ERROR: options.xcrunError ?? '',
        OMNI_RELEASE_TEST_XCRUN_FAILURES: String(options.xcrunFailures ?? 0),
        OMNI_WATCH_DEVICE: 'TEST-WATCH',
        OMNI_WATCH_XCODE_DESTINATION: options.useDefaultWatchDestination ? undefined : 'platform=watchOS,id=WATCH-UDID',
      },
    });

    const invocations = existsSync(invocationLog)
      ? readFileSync(invocationLog, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Invocation)
      : [];

    const receiptName = existsSync(receiptDirectory)
      ? readdirSync(receiptDirectory).find((name) => !beforeReceipts.has(name))
      : undefined;
    const receipt = receiptName ? JSON.parse(readFileSync(path.join(receiptDirectory, receiptName), 'utf8')) : null;
    if (receiptName) rmSync(path.join(receiptDirectory, receiptName));
    return {
      derivedDataPath,
      invocations,
      stderr: result.stderr,
      status: result.status,
      receipt,
    };
  } finally {
    rmSync(testRoot, { force: true, recursive: true });
  }
}

function buildInvocation(scheme: string, destination: string, derivedDataPath: string): Invocation {
  return {
    command: 'xcodebuild',
    args: expect.arrayContaining([
      '-scheme',
      scheme,
      '-configuration',
      'Release',
      '-destination',
      destination,
      '-derivedDataPath',
      derivedDataPath,
      '-allowProvisioningUpdates',
      'build',
    ]),
  };
}

function installInvocation(device: string, appPathSuffix: string): Invocation {
  return {
    command: 'xcrun',
    args: ['devicectl', 'device', 'install', 'app', '--device', device, expect.stringMatching(appPathSuffix)],
  };
}

describe('iOS standalone release scripts', () => {
  test.each([
    ['unpaired', 'not paired with this Mac'],
    ['developer-mode', 'Enable Developer Mode'],
    ['offline', 'not reachable'],
    ['simulator', 'must be a physical device'],
  ] as const)('rejects a Watch that is %s before compiling', (deviceProblem, message) => {
    const result = runReleaseScript('both', { deviceProblem });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
    expect(result.invocations).toEqual([]);
  });

  test('phone-only mode does not require a ready Watch or its shared scheme', () => {
    const result = runReleaseScript('phone', {
      checkOnly: true,
      deviceProblem: 'locked',
      availableSchemes: ['omnibikern'],
    });

    expect(result.status).toBe(0);
    expect(result.receipt.result).toBe('preflight-passed');
    expect(result.invocations).toEqual([]);
  });

  test('check-only mode verifies readiness without building or installing', () => {
    const result = runReleaseScript('both', { checkOnly: true });

    expect(result.status).toBe(0);
    expect(result.receipt.result).toBe('preflight-passed');
    expect(result.invocations).toEqual([]);
  });

  test('a locked Watch stops the combined release before either app is built', () => {
    const result = runReleaseScript('both', { deviceProblem: 'locked' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unlock the Watch');
    expect(result.invocations).toEqual([]);
  });

  test('missing signing credentials stop before building', () => {
    const result = runReleaseScript('both', { signingIdentities: 0 });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Xcode → Settings → Accounts');
    expect(result.invocations).toEqual([]);
  });

  test('a missing shared Watch scheme stops before building', () => {
    const result = runReleaseScript('watch', { availableSchemes: ['omnibikern'] });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing shared Xcode scheme: OmniBikeWatch Watch App');
    expect(result.invocations).toEqual([]);
  });

  test('stale Pods stop the release before any build or installation', () => {
    const result = runReleaseScript('both', { stalePods: true });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('pod install --no-repo-update');
    expect(result.invocations).toEqual([]);
    expect(result.receipt.result).toBe('failed');
  });

  test('package exposes phone, Watch, combined, and legacy combined commands', () => {
    const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      'ios:release': 'npm run ios:release:both',
      'ios:release:check': 'node scripts/ios-release.mjs both --check',
      'ios:release:both': 'node scripts/ios-release.mjs both',
      'ios:release:phone': 'node scripts/ios-release.mjs phone',
      'ios:release:watch': 'node scripts/ios-release.mjs watch',
    });
  });

  test('phone mode builds for the iPhone and installs only the phone app', () => {
    const result = runReleaseScript('phone');

    expect(result).toMatchObject({ status: 0 });
    expect(result.receipt).toMatchObject({
      result: 'installed',
      source: { digest: expect.any(String) },
    });
    expect(Object.values(result.receipt.launches)).toEqual(expect.arrayContaining(['not-tested']));
    expect(result.invocations).toEqual([
      buildInvocation('omnibikern', 'platform=iOS,id=IPHONE-UDID', result.derivedDataPath),
      installInvocation('TEST-IPHONE', '/Release-iphoneos/omnibikern\\.app$'),
    ]);
  });

  test('watch mode builds for the physical Watch and installs only the Watch app', () => {
    const result = runReleaseScript('watch');

    expect(result).toMatchObject({ status: 0 });
    expect(result.receipt).toMatchObject({
      result: 'installed',
      source: { digest: expect.any(String) },
    });
    expect(Object.values(result.receipt.launches)).toEqual(expect.arrayContaining(['not-tested']));
    expect(result.invocations).toEqual([
      buildInvocation('OmniBikeWatch Watch App', 'platform=watchOS,id=WATCH-UDID', result.derivedDataPath),
      installInvocation('TEST-WATCH', '/Release-watchos/OmniBikeWatch Watch App\\.app$'),
    ]);
  });

  test('default Watch build compiles for hardware without waiting for a device tunnel', () => {
    const result = runReleaseScript('watch', {
      useDefaultWatchDestination: true,
    });

    expect(result.status).toBe(0);
    expect(result.invocations).toEqual([
      buildInvocation('OmniBikeWatch Watch App', 'generic/platform=watchOS', result.derivedDataPath),
      installInvocation('TEST-WATCH', '/Release-watchos/OmniBikeWatch Watch App\\.app$'),
    ]);
  });

  test('both mode prepares both profiles before installing the matched pair phone first', () => {
    const result = runReleaseScript('both');

    expect(result).toMatchObject({ status: 0 });
    expect(result.receipt).toMatchObject({
      result: 'installed',
      source: { digest: expect.any(String) },
    });
    expect(Object.values(result.receipt.launches)).toEqual(expect.arrayContaining(['not-tested']));
    expect(result.invocations).toEqual([
      buildInvocation('omnibikern', 'platform=iOS,id=IPHONE-UDID', result.derivedDataPath),
      buildInvocation('OmniBikeWatch Watch App', 'platform=watchOS,id=WATCH-UDID', result.derivedDataPath),
      installInvocation('TEST-IPHONE', '/Release-iphoneos/omnibikern\\.app$'),
      installInvocation('TEST-WATCH', '/Release-watchos/OmniBikeWatch Watch App\\.app$'),
    ]);
  });

  test('retries a transient CoreDevice Watch installation failure', () => {
    const result = runReleaseScript('watch', {
      xcrunError:
        'ERROR: Failed to install the app on the device. (com.apple.dt.CoreDeviceError error 3002)\n' +
        'Could not get service com.apple.remote.installcoordination_proxy (IXRemoteErrorDomain error 5)',
      xcrunFailures: 1,
    });

    expect(result.status).toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(2);
  });

  test('retries a transient CoreDevice tunnel failure', () => {
    const result = runReleaseScript('watch', {
      xcrunError:
        'ERROR: A connection to this device could not be established. (com.apple.dt.CoreDeviceError error 4000)\n' +
        'Timed out while attempting to establish tunnel (com.apple.dt.RemotePairingError error 1001)',
      xcrunFailures: 1,
    });

    expect(result.status).toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(2);
  });

  test('does not retry a non-transport installation failure', () => {
    const result = runReleaseScript('watch', {
      xcrunError:
        'ERROR: Failed to install the app on the device. (com.apple.dt.CoreDeviceError error 3002)\n' +
        'Failed to verify code signature: A valid provisioning profile for this executable was not found. (MIInstallerErrorDomain error 13)',
      xcrunFailures: 1,
    });

    expect(result.status).not.toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(1);
  });

  test('retries the interrupted installer connection observed on the physical Watch', () => {
    const result = runReleaseScript('watch', {
      xcrunError:
        'ERROR: Failed to install the app on the device. (com.apple.dt.CoreDeviceError error 3002)\n' +
        'Connection with the remote side was unexpectedly closed (IXRemoteErrorDomain error 6)',
      xcrunFailures: 1,
    });

    expect(result.status).toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(2);
  });

  test('stops after three transient installation failures', () => {
    const result = runReleaseScript('watch', {
      xcrunError: 'ERROR: A connection could not be established. (com.apple.dt.CoreDeviceError error 4000)',
      xcrunFailures: 3,
    });

    expect(result.status).not.toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(3);
  });

  test('retries once when Xcode times out waiting for the Watch destination', () => {
    const result = runReleaseScript('watch', {
      xcodebuildFailures: 1,
      xcodebuildFailureStatus: 70,
    });

    expect(result.status).toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcodebuild')).toHaveLength(2);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(1);
  });

  test('does not retry another Xcode build failure', () => {
    const result = runReleaseScript('watch', {
      xcodebuildFailures: 1,
      xcodebuildFailureStatus: 65,
    });

    expect(result.status).not.toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcodebuild')).toHaveLength(1);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(0);
  });

  test('stops after two Xcode destination timeouts', () => {
    const result = runReleaseScript('watch', {
      xcodebuildFailures: 2,
      xcodebuildFailureStatus: 70,
    });

    expect(result.status).not.toBe(0);
    expect(result.invocations.filter(({ command }) => command === 'xcodebuild')).toHaveLength(2);
    expect(result.invocations.filter(({ command }) => command === 'xcrun')).toHaveLength(0);
  });

  test('unsupported mode fails without building or installing anything', () => {
    const result = runReleaseScript('invalid');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected phone, watch, or both');
    expect(result.invocations).toEqual([]);
  });
});
