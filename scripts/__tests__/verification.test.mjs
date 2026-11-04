/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
    assert.equal(validateEvidence(root, { ...receipt, launches: { phone: 'verified' } }).launchVerified, false);
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

function withLaunchEvidence(verify) {
  const root = mkdtempSync(path.join(tmpdir(), 'omni-launch-evidence-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    writeFileSync(path.join(root, '.gitignore'), 'logs/\n');
    mkdirSync(path.join(root, 'logs'));
    const contents =
      '=== iPhone WC log started 2026-11-04 21:15:08 +0000 ===\n' +
      '[22:15:08.264] [WC-iPhone] OnCreate: registering workoutSessionMirroringStartHandler\n' +
      '[22:15:08.336] [WC-iPhone] resolveActivation: error=nil state=2 reachable=false\n' +
      '[22:15:08.336] [WC-iPhone] emitCompanionState available=false paired=true installed=false activationState=2 reachable=false\n';
    writeFileSync(path.join(root, 'logs/phone.log'), contents);
    const receipt = {
      source: captureSource(root),
      mode: 'phone',
      result: 'installed',
      finishedAt: '2026-11-04T21:14:57.512Z',
      devices: { phone: 'TEST-PHONE' },
      launches: { phone: 'verified' },
      launchEvidence: {
        phone: {
          path: 'logs/phone.log',
          device: 'TEST-PHONE',
          bundleId: 'app.omnibike',
          sha256: createHash('sha256').update(contents).digest('hex'),
          capturedAt: '2026-11-04T21:16:00.000Z',
        },
      },
    };
    verify(root, receipt);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('startup evidence does not certify companion availability', () => {
  withLaunchEvidence((root, receipt) => {
    const verdict = validateEvidence(root, receipt);
    assert.equal(verdict.launchVerified, true);
    assert.equal(verdict.companionVerified, false);
  });
});

for (const [name, mutate] of [
  [
    'wrong device',
    (receipt) => {
      receipt.launchEvidence.phone.device = 'OTHER-PHONE';
    },
  ],
  [
    'wrong bundle',
    (receipt) => {
      receipt.launchEvidence.phone.bundleId = 'app.omnibike.watchkitapp';
    },
  ],
  [
    'log predating installation',
    (receipt) => {
      receipt.finishedAt = '2026-11-04T21:16:00.000Z';
    },
  ],
  [
    'invalid capture time',
    (receipt) => {
      receipt.launchEvidence.phone.capturedAt = 'invalid';
    },
  ],
  [
    'changed log',
    (receipt, root) => {
      writeFileSync(path.join(root, 'logs/phone.log'), 'replaced');
    },
  ],
  [
    'failed activation',
    (receipt, root) => {
      const logPath = path.join(root, 'logs/phone.log');
      const contents = readFileSync(logPath, 'utf8').replace('error=nil state=2', 'error=failed state=0');
      writeFileSync(logPath, contents);
      receipt.launchEvidence.phone.sha256 = createHash('sha256').update(contents).digest('hex');
    },
  ],
  [
    'missing log',
    (receipt, root) => {
      rmSync(path.join(root, 'logs/phone.log'));
    },
  ],
]) {
  test(`rejects ${name} as launch evidence`, () => {
    withLaunchEvidence((root, receipt) => {
      mutate(receipt, root);
      assert.equal(validateEvidence(root, receipt).launchVerified, false);
    });
  });
}
