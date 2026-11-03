/* eslint sonarjs/no-os-command-from-path: off -- These developer commands intentionally use the active toolchain on PATH. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const execution = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
if (execution.error) throw execution.error;
const report = JSON.parse(execution.stdout);
if (report.error || !report.metadata?.vulnerabilities || ![0, 1].includes(execution.status)) {
  throw new Error(`Audit unavailable: ${report.error?.summary ?? execution.stderr}`);
}
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities)) {
  for (const advisory of vulnerability.via.filter((entry) => typeof entry === 'object')) {
    const existing = advisories.get(advisory.source);
    advisories.set(advisory.source, {
      id: advisory.source,
      package: advisory.name,
      severity: advisory.severity,
      url: advisory.url,
      paths: [...new Set([...(existing?.paths ?? []), ...vulnerability.nodes])].sort(),
    });
  }
}
const summary = {
  capturedAt: new Date().toISOString(),
  counts: report.metadata.vulnerabilities,
  advisories: [...advisories.values()],
};
mkdirSync('logs/audits', { recursive: true });
writeFileSync('logs/audits/current.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync('logs/audits/summary.json', JSON.stringify(summary, null, 2) + '\n');
console.warn(JSON.stringify(summary, null, 2));
const baselineIndex = process.argv.indexOf('--baseline');
const previous = baselineIndex < 0 ? [] : JSON.parse(readFileSync(process.argv[baselineIndex + 1], 'utf8')).advisories;
const previousIds = new Set(previous.map((advisory) => `${advisory.id}:${advisory.severity}`));
const newSevere = summary.advisories.filter(
  (advisory) =>
    ['high', 'critical'].includes(advisory.severity) && !previousIds.has(`${advisory.id}:${advisory.severity}`),
);
if (newSevere.length) process.exitCode = 1;
