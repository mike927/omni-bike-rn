/* eslint sonarjs/no-os-command-from-path: off -- The fixture supplies a controlled npm executable. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const auditScript = fileURLToPath(new URL('../dependency-audit.mjs', import.meta.url));
function auditFixture(report, verify) {
  const root = mkdtempSync(path.join(tmpdir(), 'omni-audit-'));
  try {
    mkdirSync(path.join(root, 'bin'));
    writeFileSync(
      path.join(root, 'bin/npm'),
      `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(report))});process.exit(1);`,
      { mode: 0o755 },
    );
    const execution = spawnSync(process.execPath, [auditScript], {
      cwd: root,
      env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}` },
      encoding: 'utf8',
    });
    verify(root, execution);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('audit endpoint errors fail without saving a clean report', () => {
  auditFixture({ error: { summary: 'network unavailable' } }, (root, execution) => {
    assert.notEqual(execution.status, 0);
    assert.match(execution.stderr, /Audit unavailable/);
    assert.equal(existsSync(path.join(root, 'logs/audits/summary.json')), false);
  });
});

test('audit summaries deduplicate advisory IDs and retain dependency paths', () => {
  const advisory = { source: 42, name: 'vulnerable-package', severity: 'high', url: 'https://example.test/advisory' };
  auditFixture(
    {
      metadata: { vulnerabilities: { high: 2 } },
      vulnerabilities: {
        parent: { via: ['vulnerable-package'], nodes: ['node_modules/parent'] },
        first: { via: [advisory], nodes: ['node_modules/first'] },
        second: { via: [advisory], nodes: ['node_modules/second'] },
      },
    },
    (root, execution) => {
      assert.equal(execution.status, 1);
      const summary = JSON.parse(readFileSync(path.join(root, 'logs/audits/summary.json'), 'utf8'));
      assert.equal(summary.advisories.length, 1);
      assert.deepEqual(summary.advisories[0].paths, ['node_modules/first', 'node_modules/second']);
    },
  );
});
