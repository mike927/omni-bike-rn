import { readFileSync } from 'node:fs';
import { validateEvidence } from './verification.mjs';

if (!process.argv[2]) throw new Error('Usage: npm run ios:release:evidence -- logs/releases/<receipt>.json');
const verdict = validateEvidence(process.cwd(), JSON.parse(readFileSync(process.argv[2], 'utf8')));
console.warn(JSON.stringify(verdict, null, 2));
if (!verdict.current) process.exitCode = 1;
