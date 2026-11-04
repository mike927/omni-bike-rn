/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { captureSource } from './verification.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const derivedDataPath =
  process.env.OMNI_IOS_DERIVED_DATA_PATH ?? path.join(projectRoot, 'ios', 'build', 'release-derived-data');
const iphoneAppPath = path.join(derivedDataPath, 'Build', 'Products', 'Release-iphoneos', 'omnibikern.app');
const watchAppPath = path.join(derivedDataPath, 'Build', 'Products', 'Release-watchos', 'OmniBikeWatch Watch App.app');

const xcodeDestination = process.env.OMNI_IOS_XCODE_DESTINATION ?? 'platform=iOS,name=iPhone 16 PRO (Michal)';
const watchXcodeDestination = process.env.OMNI_WATCH_XCODE_DESTINATION ?? 'generic/platform=watchOS';
const iphoneInstallDevice = process.env.OMNI_IOS_DEVICE ?? 'iPhone 16 PRO (Michal)';
const watchInstallDevice = process.env.OMNI_WATCH_DEVICE ?? '31EEC0B4-4AEC-5124-898A-BDD1E34DB07E';
const deviceRetryDelayMs = Number(process.env.OMNI_IOS_DEVICE_RETRY_DELAY_MS ?? 3000);
const mode = process.argv[2] ?? 'both';
const preflightOnly = process.argv.includes('--check');
const targets = mode === 'both' ? ['phone', 'watch'] : [mode];
const schemes =
  mode === 'both'
    ? ['omnibikern', 'OmniBikeWatch Watch App']
    : [mode === 'phone' ? 'omnibikern' : 'OmniBikeWatch Watch App'];

if (!['phone', 'watch', 'both'].includes(mode)) {
  throw new Error(`Unknown iOS release mode: ${mode}. Expected phone, watch, or both.`);
}

function loadDotEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function run(command, args) {
  process.stdout.write(`\n$ ${[command, ...args].join(' ')}\n`);
  execFileSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

function runCaptured(command, args) {
  process.stdout.write(`\n$ ${[command, ...args].join(' ')}\n`);

  try {
    const stdout = execFileSync(command, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    process.stdout.write(stdout);
  } catch (error) {
    process.stdout.write(error.stdout?.toString() ?? '');
    process.stderr.write(error.stderr?.toString() ?? '');
    throw error;
  }
}

function isTransientDeviceTransportError(error) {
  const output = [error.message, error.stdout?.toString(), error.stderr?.toString()].filter(Boolean).join('\n');

  return [
    /CoreDeviceError error 4000\b/,
    /IXRemoteErrorDomain error [56]\b/,
    /RemotePairingError error 1001/,
    /com\.apple\.remote\.installcoordination_proxy/,
    /Timed out waiting for CoreDeviceService/,
  ].some((pattern) => pattern.test(output));
}

function waitBeforeDeviceRetry() {
  if (deviceRetryDelayMs > 0) {
    execFileSync('/bin/sleep', [String(deviceRetryDelayMs / 1000)]);
  }
}

function install(device, appPath) {
  const args = ['devicectl', 'device', 'install', 'app', '--device', device, appPath];
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      runCaptured('xcrun', args);
      return;
    } catch (error) {
      if (!isTransientDeviceTransportError(error) || attempt === maxAttempts) {
        throw error;
      }

      process.stderr.write(
        `Transient Apple device transport failure; retrying installation (${attempt + 1}/${maxAttempts}) in ${deviceRetryDelayMs} ms. Keep the device unlocked.\n`,
      );
      waitBeforeDeviceRetry();
    }
  }
}

function assertAppBundle(label, appPath) {
  if (!existsSync(appPath)) {
    throw new Error(`${label} app bundle was not produced at ${appPath}`);
  }
}

function assertPodsCurrent() {
  const lockPath = path.join(projectRoot, 'ios', 'Podfile.lock');
  const manifestPath = path.join(projectRoot, 'ios', 'Pods', 'Manifest.lock');
  if (
    !existsSync(lockPath) ||
    !existsSync(manifestPath) ||
    !readFileSync(lockPath).equals(readFileSync(manifestPath))
  ) {
    throw new Error('Pods are missing or out of date. Run: cd ios && pod install --no-repo-update');
  }
}

function readCommand(command, args) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  }).trim();
}

function assertSharedSchemes() {
  if (!existsSync(path.join(projectRoot, 'ios', 'omnibikern.xcworkspace'))) {
    throw new Error(
      'Restore the checked-in iOS workspace. Do not run expo prebuild --clean; it removes the Watch target.',
    );
  }
  const listing = JSON.parse(readCommand('xcodebuild', ['-list', '-json', '-workspace', 'ios/omnibikern.xcworkspace']));
  for (const scheme of schemes) {
    if (!listing.workspace.schemes.includes(scheme)) {
      throw new Error(
        `Missing shared Xcode scheme: ${scheme}. Restore it under ios/omnibikern.xcodeproj/xcshareddata/xcschemes.`,
      );
    }
  }
}

function assertSigningIdentity() {
  const identities = readCommand('security', ['find-identity', '-v', '-p', 'codesigning']);
  const summary = identities.split('\n').at(-1);
  const validCount = Number.parseInt(summary, 10);
  if (!Number.isFinite(validCount) || validCount === 0) {
    throw new Error(
      'No valid code-signing identity. Open Xcode → Settings → Accounts and configure an Apple Development certificate for the project team.',
    );
  }
}

function readDeviceInfo(device, category) {
  const output = readCommand('xcrun', [
    'devicectl',
    'device',
    'info',
    category,
    '--device',
    device,
    '--timeout',
    '15',
    '--json-output',
    '-',
  ]);
  return JSON.parse(output).result;
}

function assertDeviceReady(target, device) {
  const label = target === 'phone' ? 'iPhone' : 'Watch';
  const reconnectHelp = `Keep the ${label} awake and nearby, connect the iPhone by USB, and check pairing in Device Hub. Watch pairing is under Settings → Privacy & Security → Developer Mode → this Mac → Pair.`;
  let details;
  try {
    details = readDeviceInfo(device, 'details');
  } catch {
    throw new Error(`${label} is not reachable (${device}). ${reconnectHelp}`);
  }
  if (details.properties.hardware.reality !== 'physical') {
    throw new Error(`${label} must be a physical device; simulator destinations are not supported by this command.`);
  }
  if (details.properties.connection.pairingState !== 'paired') {
    throw new Error(`${label} is not paired with this Mac. ${reconnectHelp}`);
  }
  if (!details.properties.state.developerModeStatus.enabled) {
    throw new Error(`Enable Developer Mode on the ${label}, restart it, and confirm Turn On after reboot.`);
  }
  let lockState;
  try {
    lockState = readDeviceInfo(device, 'lockState');
  } catch {
    throw new Error(`${label} did not respond to a live readiness query. ${reconnectHelp}`);
  }
  if (lockState.passcodeRequired !== false || lockState.unlockedSinceBoot !== true) {
    throw new Error(`Unlock the ${label} with its passcode and keep it awake until installation finishes.`);
  }
}

function build(scheme, destination) {
  const args = [
    '-workspace',
    'ios/omnibikern.xcworkspace',
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
  ];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      run('xcodebuild', args);
      return;
    } catch (error) {
      if (error.status !== 70 || attempt === maxAttempts) {
        throw error;
      }

      process.stderr.write(
        `Xcode could not acquire the device destination; retrying build (${attempt + 1}/${maxAttempts}) in ${deviceRetryDelayMs} ms. Keep the device unlocked.\n`,
      );
      waitBeforeDeviceRetry();
    }
  }
}

const receiptDirectory = path.join(projectRoot, 'logs', 'releases');
mkdirSync(receiptDirectory, { recursive: true });
const receiptPath = path.join(receiptDirectory, `${Date.now()}-${process.pid}.json`);
const receipt = {
  source: captureSource(projectRoot),
  configuration: 'Release',
  mode,
  preflightOnly,
  node: process.version,
  derivedDataPath,
  destinations: { phone: xcodeDestination, watch: watchXcodeDestination },
  devices: { phone: iphoneInstallDevice, watch: watchInstallDevice },
  steps: [],
  launches: {},
  result: 'started',
  startedAt: new Date().toISOString(),
};
const saveReceipt = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
function recordStep(stage, action) {
  const step = { stage, status: 'running' };
  receipt.steps.push(step);
  saveReceipt();
  try {
    action();
    step.status = 'passed';
  } catch (error) {
    step.status = 'failed';
    throw error;
  } finally {
    saveReceipt();
  }
}

saveReceipt();
try {
  console.warn(
    'Before running: use Node 24, install packages with npm ci, and sync Pods with cd ios && pod install --no-repo-update.',
  );
  console.warn(
    'Xcode must be signed in to the project team. Keep requested devices unlocked with Developer Mode enabled, and trust this Mac/developer certificate. Prefer a USB-connected iPhone; keep the Watch nearby. Metro is not required.',
  );
  recordStep('xcode', () => {
    try {
      receipt.xcode = readCommand('xcodebuild', ['-version']);
    } catch {
      throw new Error(
        'Full Xcode is required. Select it with xcode-select, open it once to finish setup and accept its license, then retry.',
      );
    }
  });
  console.warn(
    JSON.stringify({
      node: receipt.node,
      xcode: receipt.xcode,
      mode,
      derivedDataPath,
      destinations: receipt.destinations,
    }),
  );
  recordStep('dependencies', () => run(process.execPath, ['scripts/check-dependencies.mjs']));
  recordStep('pods', assertPodsCurrent);
  recordStep('shared-schemes', assertSharedSchemes);
  recordStep('signing-identity', assertSigningIdentity);
  for (const target of targets) {
    recordStep(`device:${target}`, () =>
      assertDeviceReady(target, target === 'phone' ? iphoneInstallDevice : watchInstallDevice),
    );
  }
  console.warn(
    'Preflight passed: dependencies, Pods, shared schemes, signing identity, and requested physical devices.',
  );
  if (preflightOnly) {
    receipt.result = 'preflight-passed';
  } else {
    loadDotEnv();
    mkdirSync(derivedDataPath, { recursive: true });
    const cacheStamp = path.join(derivedDataPath, '.omni-native-inputs');
    const previous = existsSync(cacheStamp) ? readFileSync(cacheStamp, 'utf8') : null;
    const nativeInputs = `${receipt.source.nativeDigest}\n${receipt.xcode}\n${process.version}`;
    if (previous !== nativeInputs) {
      recordStep('clean-native-cache', () => {
        for (const scheme of schemes)
          run('xcodebuild', [
            '-workspace',
            'ios/omnibikern.xcworkspace',
            '-scheme',
            scheme,
            '-configuration',
            'Release',
            '-derivedDataPath',
            derivedDataPath,
            'clean',
          ]);
      });
    }
    for (const scheme of schemes)
      recordStep(`build:${scheme}`, () =>
        build(scheme, scheme === 'omnibikern' ? xcodeDestination : watchXcodeDestination),
      );
    if (captureSource(projectRoot).digest !== receipt.source.digest)
      throw new Error('Source changed during build; rebuild before installing.');
    writeFileSync(cacheStamp, nativeInputs);
    for (const target of targets) {
      const appPath = target === 'phone' ? iphoneAppPath : watchAppPath;
      recordStep(`install:${target}`, () => {
        assertAppBundle(target, appPath);
        install(target === 'phone' ? iphoneInstallDevice : watchInstallDevice, appPath);
      });
      receipt.launches[target] = 'not-tested';
    }
    receipt.result = 'installed';
  }
} catch (error) {
  receipt.result = 'failed';
  receipt.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  receipt.finishedAt = new Date().toISOString();
  saveReceipt();
  console.warn(
    `Release evidence: ${receiptPath}. Launch checks are recorded separately; installation does not prove startup.`,
  );
}
