import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const derivedDataPath =
  process.env.OMNI_IOS_DERIVED_DATA_PATH ?? path.join(projectRoot, 'ios', 'build', 'release-derived-data');
const iphoneAppPath = path.join(derivedDataPath, 'Build', 'Products', 'Release-iphoneos', 'omnibikern.app');
const watchAppPath = path.join(derivedDataPath, 'Build', 'Products', 'Release-watchos', 'OmniBikeWatch Watch App.app');

const xcodeDestination = process.env.OMNI_IOS_XCODE_DESTINATION ?? 'platform=iOS,name=iPhone 16 PRO (Michal)';
const watchXcodeDestination =
  process.env.OMNI_WATCH_XCODE_DESTINATION ?? 'platform=watchOS,id=00008310-0001705C026A601E';
const iphoneInstallDevice = process.env.OMNI_IOS_DEVICE ?? 'iPhone 16 PRO (Michal)';
const watchInstallDevice = process.env.OMNI_WATCH_DEVICE ?? '31EEC0B4-4AEC-5124-898A-BDD1E34DB07E';
const deviceRetryDelayMs = Number(process.env.OMNI_IOS_DEVICE_RETRY_DELAY_MS ?? 3000);
const mode = process.argv[2] ?? 'both';

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

loadDotEnv();

if (mode === 'phone' || mode === 'both') {
  build('omnibikern', xcodeDestination);
}

if (mode === 'watch' || mode === 'both') {
  build('OmniBikeWatch Watch App', watchXcodeDestination);
}

if (mode === 'phone' || mode === 'both') {
  assertAppBundle('iPhone', iphoneAppPath);
  install(iphoneInstallDevice, iphoneAppPath);
}

if (mode === 'watch' || mode === 'both') {
  assertAppBundle('Watch', watchAppPath);
  install(watchInstallDevice, watchAppPath);
}
