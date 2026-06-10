import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const derivedDataPath = path.join(projectRoot, 'ios', 'build', 'release-derived-data');
const iphoneAppPath = path.join(derivedDataPath, 'Build', 'Products', 'Release-iphoneos', 'omnibikern.app');
const watchAppPath = path.join(derivedDataPath, 'Build', 'Products', 'Release-watchos', 'OmniBikeWatch Watch App.app');

const xcodeDestination = process.env.OMNI_IOS_XCODE_DESTINATION ?? 'platform=iOS,name=iPhone 16 PRO (Michal)';
const iphoneInstallDevice = process.env.OMNI_IOS_DEVICE ?? 'iPhone 16 PRO (Michal)';
const watchInstallDevice = process.env.OMNI_WATCH_DEVICE ?? '31EEC0B4-4AEC-5124-898A-BDD1E34DB07E';

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

function assertAppBundle(label, appPath) {
  if (!existsSync(appPath)) {
    throw new Error(`${label} app bundle was not produced at ${appPath}`);
  }
}

loadDotEnv();

run('xcodebuild', [
  '-workspace',
  'ios/omnibikern.xcworkspace',
  '-scheme',
  'omnibikern',
  '-configuration',
  'Release',
  '-destination',
  xcodeDestination,
  '-derivedDataPath',
  derivedDataPath,
  'build',
]);

assertAppBundle('iPhone', iphoneAppPath);
assertAppBundle('Watch', watchAppPath);

run('xcrun', ['devicectl', 'device', 'install', 'app', '--device', iphoneInstallDevice, iphoneAppPath]);
run('xcrun', ['devicectl', 'device', 'install', 'app', '--device', watchInstallDevice, watchAppPath]);
