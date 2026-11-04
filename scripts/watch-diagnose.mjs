import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { readDeviceInfo, runDeviceCommand } from './apple-device.mjs';
import { parseWatchLog, WATCH_BUNDLE_IDS } from './watch-log.mjs';
import { validateEvidence } from './verification.mjs';
import { compareCompanionBundles } from './watch-build.mjs';

const projectRoot = process.cwd();
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  if (flag === '--help') {
    process.stdout.write(
      'Usage: npm run watch:diagnose -- [--phone <device>] [--watch <device>] [--output <directory>] [--receipt <release.json>]\n',
    );
    process.exit(0);
  }
  if (!['--phone', '--watch', '--output', '--receipt'].includes(flag) || !process.argv[index + 1]) {
    throw new Error(`Unknown or incomplete option: ${flag}`);
  }
  options[flag.slice(2)] = process.argv[index + 1];
}
const receipt = options.receipt ? JSON.parse(readFileSync(options.receipt, 'utf8')) : null;
if (receipt && (!validateEvidence(projectRoot, receipt).current || receipt.result !== 'installed')) {
  throw new Error('The release receipt must describe an installed build of the current source.');
}
const capturedAt = new Date().toISOString();
const requestedOutput = path.resolve(options.output ?? path.join('logs', 'watch-diagnostics', String(Date.now())));
let existingAncestor = requestedOutput;
const missingSegments = [];
while (!existsSync(existingAncestor)) {
  missingSegments.unshift(path.basename(existingAncestor));
  existingAncestor = path.dirname(existingAncestor);
}
const outputDirectory = path.join(realpathSync(existingAncestor), ...missingSegments);
const relativeOutput = path.relative(projectRoot, outputDirectory);
if (relativeOutput !== '..' && !relativeOutput.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeOutput)) {
  const generatedPaths = ['phone.log', 'watch.log', 'summary.json'].map((name) => path.join(outputDirectory, name));
  const unignoredPath = generatedPaths.find(
    (filename) =>
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- Git resolves this repository's output ignore rules.
      spawnSync('git', ['check-ignore', '--quiet', '--', filename], {
        cwd: projectRoot,
        stdio: 'ignore',
      }).status !== 0,
  );
  if (unignoredPath)
    throw new Error(
      'Diagnostic output inside the repository must be Git-ignored. Use logs/watch-diagnostics or an external directory.',
    );
}
mkdirSync(outputDirectory, { recursive: true });
const devices = {
  phone: options.phone ?? receipt?.devices.phone ?? process.env.OMNI_IOS_DEVICE ?? 'iPhone 16 PRO (Michal)',
  watch:
    options.watch ?? receipt?.devices.watch ?? process.env.OMNI_WATCH_DEVICE ?? '31EEC0B4-4AEC-5124-898A-BDD1E34DB07E',
};

function inspectDevice(target, device) {
  const inspection = { device, bundleId: WATCH_BUNDLE_IDS[target], transport: 'unavailable', errors: [] };
  const collect = (stage, action) => {
    try {
      action();
    } catch (error) {
      const message = (error.stderr?.toString() || error.message).trim().split('\n').slice(0, 4).join('\n');
      inspection.errors.push({ stage, message });
    }
  };
  collect('details', () => {
    const details = readDeviceInfo(device, 'details');
    inspection.identifier = details.deviceIdentifier;
    inspection.transport = 'reachable';
  });
  if (inspection.transport === 'unavailable') return inspection;
  collect('lockState', () => {
    inspection.lockState = readDeviceInfo(device, 'lockState');
  });
  collect('apps', () => {
    const installed = readDeviceInfo(device, 'apps', ['--bundle-id', inspection.bundleId]);
    inspection.appInstalled = installed.apps.some((app) => app.bundleIdentifier === inspection.bundleId);
  });
  collect('log', () => {
    const logPath = path.join(outputDirectory, `${target}.log`);
    process.stderr.write(`Capturing ${device}: Documents/wc.log\n`);
    runDeviceCommand([
      'device',
      'copy',
      'from',
      '--device',
      device,
      '--domain-type',
      'appDataContainer',
      '--domain-identifier',
      inspection.bundleId,
      '--source',
      'Documents/wc.log',
      '--destination',
      logPath,
    ]);
    const contents = readFileSync(logPath);
    inspection.log = parseWatchLog(contents.toString(), target);
    inspection.evidence = {
      path: path.relative(projectRoot, logPath),
      device,
      bundleId: inspection.bundleId,
      sha256: createHash('sha256').update(contents).digest('hex'),
      capturedAt: new Date().toISOString(),
    };
  });
  if (inspection.errors.length) inspection.transport = 'partial';
  return inspection;
}

function inspectBuiltPair() {
  const products = path.join(
    process.env.OMNI_IOS_DERIVED_DATA_PATH ?? path.join(projectRoot, 'ios/build/release-derived-data'),
    'Build/Products',
  );
  const phone = path.join(products, 'Release-iphoneos/omnibikern.app');
  const locations = {
    phone,
    watch: path.join(products, 'Release-watchos/OmniBikeWatch Watch App.app'),
    embeddedWatch: path.join(phone, 'Watch/OmniBikeWatch Watch App.app'),
  };
  const bundles = {};
  for (const [target, location] of Object.entries(locations)) {
    if (!existsSync(location)) continue;
    const metadata = { path: location };
    bundles[target] = metadata;
    try {
      const readKey = (key) =>
        execFileSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', path.join(location, 'Info.plist')], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
      metadata.bundleId = readKey('CFBundleIdentifier');
      if (target !== 'phone') metadata.companionBundleId = readKey('WKCompanionAppBundleIdentifier');
      const signing = spawnSync('/usr/bin/codesign', ['-dvvv', location], { encoding: 'utf8' });
      metadata.team = signing.stderr?.match(/^TeamIdentifier=(.+)$/m)?.[1] ?? null;
      metadata.codeHash = signing.stderr?.match(/^CDHash=(.+)$/m)?.[1] ?? null;
    } catch {
      metadata.error = 'Could not inspect built bundle metadata.';
    }
  }
  return { bundles, ...compareCompanionBundles(bundles) };
}

const inspections = Object.fromEntries(
  Object.entries(devices).map(([target, device]) => [target, inspectDevice(target, device)]),
);
const companion = inspections.phone.log?.companion ?? null;
const verdict = companion ? (companion.available ? 'companion-available' : 'companion-unavailable') : 'inconclusive';
const summary = {
  capturedAt,
  devices: inspections,
  builtPair: inspectBuiltPair(),
  companion,
  reachable: inspections.phone.log?.reachable ?? null,
  verdict,
};
if (receipt) {
  receipt.launchEvidence ??= {};
  receipt.launches ??= {};
  const targets = receipt.mode === 'both' ? ['phone', 'watch'] : [receipt.mode];
  for (const target of targets) {
    if (inspections[target].evidence) receipt.launchEvidence[target] = inspections[target].evidence;
    const inspection = validateEvidence(projectRoot, receipt).evidence[target];
    receipt.launches[target] = inspection?.valid ? 'verified' : 'not-tested';
  }
  summary.release = validateEvidence(projectRoot, receipt);
  writeFileSync(options.receipt, JSON.stringify(receipt, null, 2) + '\n');
}
writeFileSync(path.join(outputDirectory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
for (const [target, inspection] of Object.entries(inspections)) {
  process.stdout.write(
    `${target} ↔ Mac: ${inspection.transport}; app installed: ${inspection.appInstalled ?? 'unknown'}${inspection.errors.length ? '; details in report' : ''}\n`,
  );
}
process.stdout.write(
  `Companion (last native log): ${verdict}; live reachability (last native log): ${summary.reachable ?? 'unknown'}\n`,
);
process.stdout.write(`Report: ${path.join(outputDirectory, 'summary.json')}\n`);
process.exitCode = verdict === 'inconclusive' ? 2 : verdict === 'companion-unavailable' ? 1 : 0;
if (summary.release && !summary.release.launchVerified) process.exitCode = 1;
