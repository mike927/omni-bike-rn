/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { parseWatchLog, WATCH_BUNDLE_IDS } from './watch-log.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export function captureSource(root) {
  const candidates = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  const files = {};
  for (const name of [...new Set(candidates)].sort()) {
    if (/(^|\/)\.env(?:\.|$)/.test(name) || /\.(pem|key|p12|mobileprovision)$/.test(name)) continue;
    if (/^(logs|node_modules|\.claude\/worktrees|\.worktrees)\//.test(name)) continue;
    try {
      const filename = path.join(root, name);
      files[name] = lstatSync(filename).isFile() ? hash(readFileSync(filename)) : 'non-file';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      files[name] = 'deleted';
    }
  }
  let head = null;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* Initial repositories have no commit. */
  }
  const nativeFiles = Object.fromEntries(
    Object.entries(files).filter(([name]) => /^(ios\/|modules\/|plugins\/|app\.config\.|package.*\.json$)/.test(name)),
  );
  const dirty = execFileSync('git', ['status', '--porcelain=v1', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  return {
    head,
    dirty,
    files,
    digest: hash(JSON.stringify(files)),
    nativeDigest: hash(JSON.stringify(nativeFiles)),
  };
}

export function validateEvidence(root, receipt) {
  const current = captureSource(root).digest === receipt.source.digest;
  const targets = receipt.mode === 'both' ? ['phone', 'watch'] : [receipt.mode];
  const evidence = Object.fromEntries(targets.map((target) => [target, validateLaunchEvidence(root, receipt, target)]));
  return {
    current,
    launchVerified:
      current &&
      receipt.result === 'installed' &&
      targets.every((target) => receipt.launches?.[target] === 'verified' && evidence[target].valid),
    companionVerified:
      current &&
      receipt.result === 'installed' &&
      evidence.phone?.valid === true &&
      evidence.phone.companion?.available === true &&
      evidence.phone.companion?.paired === true &&
      evidence.phone.companion?.installed === true &&
      evidence.phone.companion?.activationState === 2,
    evidence,
  };
}

function validateLaunchEvidence(root, receipt, target) {
  const saved = receipt.launchEvidence?.[target];
  if (!saved || typeof saved !== 'object' || !saved.path) {
    return { valid: false, reason: 'Capture device logs with npm run watch:diagnose -- --receipt <receipt.json>.' };
  }
  if (saved.device !== receipt.devices?.[target] || saved.bundleId !== WATCH_BUNDLE_IDS[target]) {
    return { valid: false, reason: 'Evidence device or bundle does not match the release receipt.' };
  }
  try {
    const contents = readFileSync(path.resolve(root, saved.path));
    if (hash(contents) !== saved.sha256) {
      return { valid: false, reason: 'Evidence log changed after capture.' };
    }
    const parsed = parseWatchLog(contents.toString(), target);
    const installedAt = Date.parse(receipt.finishedAt);
    const startedAt = Date.parse(parsed.startedAt);
    const capturedAt = Date.parse(saved.capturedAt);
    if (
      ![installedAt, startedAt, capturedAt].every(Number.isFinite) ||
      startedAt < installedAt ||
      capturedAt < startedAt
    ) {
      return { valid: false, reason: 'Evidence must show an app launch after this installation.' };
    }
    if (!parsed.startupVerified) {
      return { valid: false, reason: 'Evidence does not show successful app startup and WCSession activation.' };
    }
    return { valid: true, startedAt: parsed.startedAt, companion: parsed.companion };
  } catch {
    return { valid: false, reason: 'Evidence log cannot be read.' };
  }
}
