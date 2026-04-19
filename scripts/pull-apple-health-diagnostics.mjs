#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_CONFIG_PATH = path.join(REPO_ROOT, 'app.config.ts');
const DEFAULT_OUTPUT_PATH = path.join(os.tmpdir(), 'omnibike-apple-health.ndjson');
const DEVICETCTL = 'devicectl';
const XCTRUN_PATH = '/usr/bin/xcrun';
const DEVICE_PLATFORM_IOS = 'iOS';
const DEVICE_TYPE_IPHONE = 'iPhone';
const PAIRING_STATE_PAIRED = 'paired';
const DIAGNOSTICS_SOURCE_CANDIDATES = [
  'Documents/apple-health.ndjson',
  'apple-health.ndjson',
  'Documents/diagnostics/apple-health.ndjson',
  'diagnostics/apple-health.ndjson',
];
const DEFAULT_TAIL_LINE_COUNT = 12;

function parseCliArgs(argv) {
  const options = {
    bundleId: undefined,
    device: undefined,
    output: DEFAULT_OUTPUT_PATH,
    tail: DEFAULT_TAIL_LINE_COUNT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--device' && next) {
      options.device = next;
      index += 1;
      continue;
    }

    if (current === '--bundle-id' && next) {
      options.bundleId = next;
      index += 1;
      continue;
    }

    if (current === '--output' && next) {
      options.output = path.resolve(next);
      index += 1;
      continue;
    }

    if (current === '--tail' && next) {
      const parsedTail = Number.parseInt(next, 10);
      if (!Number.isFinite(parsedTail) || parsedTail < 0) {
        throw new Error(`Invalid value for --tail: ${next}`);
      }
      options.tail = parsedTail;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return options;
}

function readBundleIdFromConfig() {
  const configContents = readFileSync(APP_CONFIG_PATH, 'utf8');
  const match = configContents.match(/bundleIdentifier:\s*'([^']+)'/u);

  if (!match) {
    throw new Error(`Could not find ios.bundleIdentifier in ${APP_CONFIG_PATH}`);
  }

  return match[1];
}

function runXcrun(args, { allowFailure = false } = {}) {
  const result = spawnSync(XCTRUN_PATH, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return result;
  }

  if (allowFailure) {
    return result;
  }

  const command = [XCTRUN_PATH, ...args].join(' ');
  const stderr = result.stderr?.trim();
  const stdout = result.stdout?.trim();
  throw new Error([`Command failed: ${command}`, stderr, stdout].filter(Boolean).join('\n'));
}

function writeStdout(message = '') {
  process.stdout.write(`${message}\n`);
}

function withTempDir(callback) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'omnibike-apple-health-'));
  try {
    return callback(tempDir);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listDevices(tempDir) {
  const jsonOutputPath = path.join(tempDir, 'devices.json');
  runXcrun([DEVICETCTL, 'list', 'devices', '--json-output', jsonOutputPath]);
  const payload = readJsonFile(jsonOutputPath);
  return payload.result?.devices ?? [];
}

function selectDevice(devices, preferredDevice) {
  const iosDevices = devices.filter(
    (device) =>
      device.hardwareProperties?.platform === DEVICE_PLATFORM_IOS &&
      device.connectionProperties?.pairingState === PAIRING_STATE_PAIRED,
  );

  if (iosDevices.length === 0) {
    throw new Error('No paired iOS device is available through devicectl.');
  }

  if (preferredDevice) {
    const explicitMatch = iosDevices.find((device) =>
      [device.identifier, device.deviceProperties?.name, device.hardwareProperties?.udid].includes(preferredDevice),
    );

    if (!explicitMatch) {
      throw new Error(`No paired iOS device matched "${preferredDevice}".`);
    }

    return explicitMatch;
  }

  const iphoneDevices = iosDevices.filter((device) => device.hardwareProperties?.deviceType === DEVICE_TYPE_IPHONE);
  const candidates = iphoneDevices.length > 0 ? iphoneDevices : iosDevices;

  return candidates.slice().sort((left, right) => {
    const leftTimestamp = Date.parse(left.connectionProperties?.lastConnectionDate ?? '') || 0;
    const rightTimestamp = Date.parse(right.connectionProperties?.lastConnectionDate ?? '') || 0;
    return rightTimestamp - leftTimestamp;
  })[0];
}

function assertAppInstalled(deviceIdentifier, bundleId, tempDir) {
  const jsonOutputPath = path.join(tempDir, 'apps.json');
  runXcrun([
    DEVICETCTL,
    'device',
    'info',
    'apps',
    '--device',
    deviceIdentifier,
    '--bundle-id',
    bundleId,
    '--json-output',
    jsonOutputPath,
  ]);

  const payload = readJsonFile(jsonOutputPath);
  const apps = payload.result?.apps ?? [];

  if (apps.length === 0) {
    throw new Error(`App ${bundleId} is not installed on the selected device.`);
  }
}

function listDocumentsFiles(deviceIdentifier, bundleId, tempDir) {
  const jsonOutputPath = path.join(tempDir, 'documents-files.json');
  runXcrun(
    [
      DEVICETCTL,
      'device',
      'info',
      'files',
      '--device',
      deviceIdentifier,
      '--domain-type',
      'appDataContainer',
      '--domain-identifier',
      bundleId,
      '--subdirectory',
      'Documents',
      '--json-output',
      jsonOutputPath,
    ],
    { allowFailure: true },
  );

  if (!existsSync(jsonOutputPath)) {
    return [];
  }

  const payload = readJsonFile(jsonOutputPath);
  return payload.result?.files ?? [];
}

function copyDiagnosticsFile(deviceIdentifier, bundleId, outputPath) {
  for (const source of DIAGNOSTICS_SOURCE_CANDIDATES) {
    const result = runXcrun(
      [
        DEVICETCTL,
        'device',
        'copy',
        'from',
        '--device',
        deviceIdentifier,
        '--domain-type',
        'appDataContainer',
        '--domain-identifier',
        bundleId,
        '--source',
        source,
        '--destination',
        outputPath,
      ],
      { allowFailure: true },
    );

    if (result.status === 0) {
      return source;
    }
  }

  return null;
}

function printTail(outputPath, tailCount) {
  if (tailCount === 0) {
    return;
  }

  const contents = readFileSync(outputPath, 'utf8').trim().split('\n').filter(Boolean);

  const tailEntries = contents.slice(-tailCount);
  writeStdout(`\nLast ${tailEntries.length} diagnostic entr${tailEntries.length === 1 ? 'y' : 'ies'}:`);

  for (const line of tailEntries) {
    try {
      writeStdout(JSON.stringify(JSON.parse(line), null, 2));
    } catch {
      writeStdout(line);
    }
  }
}

function main() {
  const cliOptions = parseCliArgs(process.argv.slice(2));
  const bundleId = cliOptions.bundleId ?? process.env.OMNI_BIKE_BUNDLE_ID ?? readBundleIdFromConfig();
  const preferredDevice = cliOptions.device ?? process.env.OMNI_BIKE_DEVICE;

  withTempDir((tempDir) => {
    const devices = listDevices(tempDir);
    const selectedDevice = selectDevice(devices, preferredDevice);
    const selectedDeviceName = selectedDevice.deviceProperties?.name ?? selectedDevice.identifier;

    assertAppInstalled(selectedDevice.identifier, bundleId, tempDir);

    const resolvedSource = copyDiagnosticsFile(selectedDevice.identifier, bundleId, cliOptions.output);

    if (!resolvedSource) {
      const documentFiles = listDocumentsFiles(selectedDevice.identifier, bundleId, tempDir)
        .map((file) => file.relativePath)
        .sort();

      const availableFiles =
        documentFiles.length > 0 ? documentFiles.join('\n') : '(Documents is empty or unavailable)';
      throw new Error(
        [
          `Apple Health diagnostics file was not found for ${bundleId} on ${selectedDeviceName}.`,
          `Tried sources: ${DIAGNOSTICS_SOURCE_CANDIDATES.join(', ')}`,
          'Available files under Documents:',
          availableFiles,
        ].join('\n'),
      );
    }

    writeStdout(`Selected device: ${selectedDeviceName}`);
    writeStdout(`Bundle ID: ${bundleId}`);
    writeStdout(`Source path: ${resolvedSource}`);
    writeStdout(`Pulled diagnostics to: ${cliOptions.output}`);
    printTail(cliOptions.output, cliOptions.tail);
  });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pull-apple-health-diagnostics] ${message}`);
  process.exitCode = 1;
}
