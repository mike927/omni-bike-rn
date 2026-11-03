/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 3) throw new Error('Use Node 24.3 or newer on the 24 line (see .nvmrc).');
const expoRoot = path.dirname(require.resolve('expo/package.json'));
execFileSync(process.execPath, [path.join(expoRoot, 'bin/cli'), 'install', '--check'], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_DOTENV: '1' },
});
execFileSync('npm', ['ls', '--all', '--json'], {
  stdio: ['ignore', 'ignore', 'inherit'],
});
console.warn('Dependency matrix and installed tree passed.');
