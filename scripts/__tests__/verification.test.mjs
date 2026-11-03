/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { captureSource, validateEvidence } from '../verification.mjs';

test('evidence expires when a tracked or new source file changes, without reading local secrets', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'omni-evidence-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    writeFileSync(path.join(root, 'package-lock.json'), '{}');
    execFileSync('git', ['-C', root, 'add', 'package-lock.json']);
    const initial = captureSource(root);
    const receipt = {
      source: initial,
      mode: 'phone',
      result: 'installed',
      launches: { phone: 'not-tested' },
    };
    assert.equal(validateEvidence(root, receipt).current, true);
    assert.equal(validateEvidence(root, { ...receipt, launches: {} }).launchVerified, false);
    assert.equal(validateEvidence(root, { ...receipt, launches: { phone: 'verified' } }).launchVerified, true);
    assert.equal(
      validateEvidence(root, { ...receipt, mode: 'both', launches: { phone: 'verified' } }).launchVerified,
      false,
    );
    writeFileSync(path.join(root, '.env'), 'SECRET=never-read');
    assert.equal(captureSource(root).digest, initial.digest);
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src/new.ts'), 'export const value = 1;');
    assert.equal(validateEvidence(root, receipt).current, false);
    assert.equal(validateEvidence(root, receipt).launchVerified, false);
    rmSync(path.join(root, 'src/new.ts'));
    writeFileSync(path.join(root, 'package-lock.json'), '{"changed":true}');
    assert.equal(validateEvidence(root, receipt).current, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
