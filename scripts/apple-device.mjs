/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active Xcode toolchain. */
import { execFileSync } from 'node:child_process';

export function isTransientDeviceTransportError(error) {
  const output = [error.message, error.stdout?.toString(), error.stderr?.toString()].filter(Boolean).join('\n');
  return (
    error.code === 'ETIMEDOUT' ||
    /CoreDeviceError error 4000\b|IXRemoteErrorDomain error [56]\b|RemotePairingError error 1001|com\.apple\.remote\.installcoordination_proxy|Timed out waiting for CoreDeviceService|Command timeout of .* seconds exceeded|Connection reset by peer/.test(
      output,
    )
  );
}

export function runDeviceCommand(args) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return execFileSync('xcrun', ['devicectl', ...args, '--timeout', '15'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 20_000,
      });
    } catch (error) {
      if (attempt === 2 || !isTransientDeviceTransportError(error)) throw error;
      process.stderr.write(`Transient device transport failure; retrying ${args[2]} (2/2).\n`);
      const delay = Number(process.env.OMNI_IOS_DEVICE_RETRY_DELAY_MS ?? 3000);
      if (delay > 0) execFileSync('/bin/sleep', [String(delay / 1000)]);
    }
  }
}

export function readDeviceInfo(device, category, extraArgs = []) {
  process.stderr.write(`Checking ${device}: ${category}\n`);
  const output = runDeviceCommand(['device', 'info', category, '--device', device, ...extraArgs, '--json-output', '-']);
  return JSON.parse(output).result;
}
