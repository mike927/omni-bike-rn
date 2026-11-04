/* eslint sonarjs/no-os-command-from-path: off -- The fixture supplies a controlled xcrun executable. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureSource, validateEvidence } from '../verification.mjs';
import { parseWatchLog } from '../watch-log.mjs';
import { compareCompanionBundles } from '../watch-build.mjs';

const script = fileURLToPath(new URL('../watch-diagnose.mjs', import.meta.url));

test('companion association depends on bundle identities and signing teams rather than binary identity', () => {
  const watch = {
    bundleId: 'app.omnibike.watchkitapp',
    companionBundleId: 'app.omnibike',
    team: 'TEAM',
    codeHash: null,
  };
  const bundles = { phone: { bundleId: 'app.omnibike', team: 'TEAM' }, watch, embeddedWatch: { ...watch } };
  assert.equal(compareCompanionBundles(bundles).matched, true);
  assert.equal(compareCompanionBundles({ ...bundles, watch: { ...watch, team: 'OTHER' } }).matched, false);
});

test('a later activation snapshot supersedes an earlier reachability callback', () => {
  const contents =
    '[WC-iPhone] sessionReachabilityDidChange reachable=true\n' +
    '[WC-iPhone] emitCompanionState available=true paired=true installed=true activationState=2 reachable=false\n';
  assert.equal(parseWatchLog(contents, 'phone').reachable, false);
});

function diagnoseFixture(
  installed,
  verify,
  { watchOffline = false, withReceipt = false, lockStateFailure = false } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), 'omni-watch-diagnose-'));
  try {
    mkdirSync(path.join(root, 'bin'));
    writeFileSync(
      path.join(root, 'bin/xcrun'),
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const device = args[args.indexOf('--device') + 1];
if (device === 'WATCH' && ${watchOffline}) { process.stderr.write('Connection reset by peer (CoreDeviceError error 4000)'); process.exit(1); }
if (device === 'WATCH' && args.includes('lockState') && ${lockStateFailure}) { process.stderr.write('Command timeout of 15.0 seconds exceeded'); process.exit(2); }
if (args.includes('copy')) {
  const contents = device === 'PHONE'
    ? '=== iPhone WC log started 2026-11-04 21:15:08 +0000 ===\\n[WC-iPhone] OnCreate: registering workoutSessionMirroringStartHandler\\n[WC-iPhone] resolveActivation: error=nil state=2 reachable=false\\n[WC-iPhone] emitCompanionState available=${installed} paired=true installed=${installed} activationState=2 reachable=false\\n'
    : '=== Watch WC log started 2026-11-04 21:15:07 +0000 ===\\n[WC-Watch] applicationDidFinishLaunching\\n[WC-Watch] activationDidCompleteWith state=2 error=nil reachable=false\\n';
  fs.writeFileSync(args[args.indexOf('--destination') + 1], contents);
} else {
  const result = args.includes('apps') ? {apps: [{bundleIdentifier: device === 'PHONE' ? 'app.omnibike' : 'app.omnibike.watchkitapp'}]}
    : args.includes('lockState') ? {passcodeRequired: false, unlockedSinceBoot: true}
    : {deviceIdentifier: device, properties: {hardware: {reality: 'physical'}, connection: {pairingState: 'paired'}}};
  process.stdout.write(JSON.stringify({result}));
}
`,
      { mode: 0o755 },
    );
    const args = [script, '--phone', 'PHONE', '--watch', 'WATCH', '--output', path.join(root, 'report')];
    if (withReceipt) {
      execFileSync('git', ['init', '-q', root]);
      writeFileSync(path.join(root, '.gitignore'), 'logs/\nreport/\n');
      mkdirSync(path.join(root, 'logs'));
      const receipt = {
        source: captureSource(root),
        mode: 'both',
        result: 'installed',
        devices: { phone: 'PHONE', watch: 'WATCH' },
        finishedAt: '2026-11-04T21:14:57.512Z',
        launches: { phone: 'not-tested', watch: 'not-tested' },
      };
      writeFileSync(path.join(root, 'logs/release.json'), JSON.stringify(receipt));
      args.push('--receipt', path.join(root, 'logs/release.json'));
    }
    const execution = spawnSync(process.execPath, args, {
      cwd: root,
      env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, OMNI_IOS_DEVICE_RETRY_DELAY_MS: '0' },
      encoding: 'utf8',
    });
    verify(root, execution);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('detects an installed Watch app that the iPhone does not recognize as a companion', () => {
  diagnoseFixture(false, (root, execution) => {
    assert.equal(execution.status, 1);
    const report = JSON.parse(readFileSync(path.join(root, 'report/summary.json'), 'utf8'));
    assert.equal(report.devices.watch.appInstalled, true);
    assert.equal(report.companion.installed, false);
    assert.equal(report.reachable, false);
    assert.equal(report.verdict, 'companion-unavailable');
  });
});

test('an idle but installed companion remains available when live messaging is unreachable', () => {
  diagnoseFixture(true, (root, execution) => {
    assert.equal(execution.status, 0);
    const report = JSON.parse(readFileSync(path.join(root, 'report/summary.json'), 'utf8'));
    assert.equal(report.companion.available, true);
    assert.equal(report.reachable, false);
    assert.equal(report.verdict, 'companion-available');
  });
});

test('a failed Watch Mac tunnel does not overwrite iPhone companion detection', () => {
  diagnoseFixture(
    true,
    (root, execution) => {
      assert.equal(execution.status, 0);
      const report = JSON.parse(readFileSync(path.join(root, 'report/summary.json'), 'utf8'));
      assert.equal(report.devices.watch.transport, 'unavailable');
      assert.equal(report.companion.available, true);
    },
    { watchOffline: true },
  );
});

test('attaches captured device logs to a release receipt and detects later tampering', () => {
  diagnoseFixture(
    true,
    (root, execution) => {
      assert.equal(execution.status, 0, execution.stderr);
      const receipt = JSON.parse(readFileSync(path.join(root, 'logs/release.json'), 'utf8'));
      const verdict = validateEvidence(root, receipt);
      assert.equal(verdict.launchVerified, true);
      assert.equal(verdict.companionVerified, true);
      writeFileSync(path.join(root, 'report/watch.log'), 'changed');
      assert.equal(validateEvidence(root, receipt).launchVerified, false);
    },
    { withReceipt: true },
  );
});

test('a lock-state timeout preserves later installed-app and Watch-log evidence', () => {
  diagnoseFixture(
    true,
    (root, execution) => {
      assert.equal(execution.status, 0);
      const report = JSON.parse(readFileSync(path.join(root, 'report/summary.json'), 'utf8'));
      assert.equal(report.devices.watch.transport, 'partial');
      assert.equal(report.devices.watch.appInstalled, true);
      assert.equal(report.devices.watch.log.startupVerified, true);
      assert.equal(report.devices.watch.errors[0].stage, 'lockState');
    },
    { lockStateFailure: true },
  );
});
