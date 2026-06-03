import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const customSkillsRoot = 'ai/skills';
const discoveryRoots = ['.agents/skills', '.claude/skills'];
const npmCliPath = process.env.npm_execpath;

if (!npmCliPath) {
  throw new Error('Run this script through npm: npm run skills:install');
}

const restoreResult = spawnSync(
  process.execPath,
  [npmCliPath, 'exec', '--yes', 'skills', '--', 'experimental_install'],
  {
    stdio: 'inherit',
  },
);

syncCustomSkillLinks();

if (restoreResult.error) {
  throw restoreResult.error;
}

if (restoreResult.status !== 0) {
  process.exit(restoreResult.status ?? 1);
}

function syncCustomSkillLinks() {
  if (!existsSync(customSkillsRoot)) {
    return;
  }

  const customSkillNames = readdirSync(customSkillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(customSkillsRoot, name, 'SKILL.md')));

  for (const skillName of customSkillNames) {
    const sourcePath = join(customSkillsRoot, skillName);

    for (const discoveryRoot of discoveryRoots) {
      const linkPath = join(discoveryRoot, skillName);
      ensureSymlink(sourcePath, linkPath);
    }
  }
}

function ensureSymlink(sourcePath, linkPath) {
  mkdirSync(dirname(linkPath), { recursive: true });

  const existingStats = readLinkStats(linkPath);

  if (existingStats) {
    const stats = existingStats;

    if (!stats.isSymbolicLink()) {
      throw new Error(
        `${linkPath} exists and is not a symlink. Move custom source to ${sourcePath} before installing.`,
      );
    }

    const currentTarget = readlinkSync(linkPath);
    const desiredTarget = relative(dirname(linkPath), sourcePath);

    if (currentTarget === desiredTarget) {
      return;
    }

    unlinkSync(linkPath);
  }

  symlinkSync(relative(dirname(linkPath), sourcePath), linkPath, 'dir');
}

function readLinkStats(path) {
  try {
    return lstatSync(path);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return undefined;
    }

    throw err;
  }
}
