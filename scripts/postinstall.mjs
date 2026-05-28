import { execFileSync } from 'node:child_process';

if (process.env.CI || process.env.SKIP_LIFECYCLE_SCRIPTS) {
  process.exit(0);
}

try {
  execFileSync(process.execPath, ['scripts/install-skills.mjs'], { stdio: 'inherit' });
} catch (err) {
  console.warn('[postinstall] agent-skills restore skipped:', err instanceof Error ? err.message : String(err));
}
