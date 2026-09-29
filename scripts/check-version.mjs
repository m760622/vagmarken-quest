// Fails when package.json's version is not higher than the one on origin/main.
// Run before pushing a change: `npm run version:check`.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const parse = v => v.split('-')[0].split('.').map(n => Number.parseInt(n, 10));
const compare = (a, b) => {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

const current = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
let base;
try {
  base = JSON.parse(execSync('git show origin/main:package.json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()).version;
} catch {
  console.log(`version ${current}: origin/main not available here, nothing to compare with`);
  process.exit(0);
}

if (compare(current, base) > 0) {
  console.log(`OK  version ${current} is higher than origin/main (${base})`);
} else {
  console.error(`FAIL  version ${current} is not higher than origin/main (${base}). Bump it: npm version <patch|minor|major> --no-git-tag-version`);
  process.exit(1);
}
