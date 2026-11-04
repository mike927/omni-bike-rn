/* eslint sonarjs/no-os-command-from-path: off -- Native logger checks use the installed Swift toolchain. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseWatchLog } from '../watch-log.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
for (const [target, sourcePath] of [
  ['phone', 'modules/watch-connectivity/ios/WatchConnectivityModule.swift'],
  ['watch', 'ios/OmniBikeWatch Watch App/WorkoutManager.swift'],
]) {
  test(`${target} native log header preserves the startup millisecond`, { skip: process.platform !== 'darwin' }, () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omni-native-log-'));
    try {
      const documents = path.join(root, 'documents');
      mkdirSync(documents);
      const source = readFileSync(path.join(projectRoot, sourcePath), 'utf8');
      const start = source.indexOf('enum WCFileLog {');
      const end = source.indexOf('\n}', start) + 2;
      // NOTE: Compile the production logger with a pinned clock and an isolated Documents directory.
      const logger = source
        .slice(start, end)
        .replaceAll('Date()', 'Date(timeIntervalSince1970: 1793826908.9)')
        .replace(
          'FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!',
          `URL(fileURLWithPath: ${JSON.stringify(documents)})`,
        );
      const swiftPath = path.join(root, 'Logger.swift');
      writeFileSync(
        swiftPath,
        `import Foundation\n${logger}\nprint(try String(contentsOf: WCFileLog.url, encoding: .utf8))\n`,
      );
      const executable = path.join(root, 'logger');
      execFileSync(
        'swiftc',
        ['-swift-version', '5', '-module-cache-path', path.join(root, 'cache'), '-o', executable, swiftPath],
        { stdio: 'pipe' },
      );
      const header = execFileSync(executable, { encoding: 'utf8' });
      assert.equal(parseWatchLog(header, target).startedAt, '2026-11-04T21:15:08.900Z');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
