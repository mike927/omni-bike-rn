/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import path from 'node:path';

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
  return {
    current,
    launchVerified:
      current &&
      receipt.result === 'installed' &&
      (receipt.mode === 'both' ? ['phone', 'watch'] : [receipt.mode]).every(
        (target) => receipt.launches[target] === 'verified',
      ),
  };
}
