// Fails when package.json's version is not higher than the version in a base commit.
//   npm run version:check                       base = origin/main (run this before pushing a change)
//   node scripts/check-version.mjs --base <sha>  base = <sha> (the deploy workflow passes the previous tip of main)
// Exit codes: 0 ok, or skipped because there is nothing to compare with (a new branch, a commit that is
// not in this clone); 1 the version was not raised; 2 bad arguments.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const parse = v => String(v).split('-')[0].split('.').map(n => Number.parseInt(n, 10));
const compare = (a, b) => {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

const inCI = !!process.env.GITHUB_ACTIONS;
const args = process.argv.slice(2);
const at = args.indexOf('--base');
const base = at >= 0 ? args[at + 1] : 'origin/main';

// Only plain refs and commit ids: the value is handed to git
if (!base || !/^[A-Za-z0-9_./^~@{}][A-Za-z0-9_./^~@{}-]*$/.test(base)) {
  console.error(`${inCI ? '::error::' : ''}FAIL  --base needs a commit or ref, got "${base ?? ''}"`);
  process.exit(2);
}

const skip = reason => {
  console.log(`${inCI ? '::warning::' : ''}version check skipped: ${reason}`);
  process.exit(0);
};
if (/^0+$/.test(base)) skip('this push has no earlier commit (a new branch)');

const current = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')).version;
let baseVersion;
try {
  const text = execFileSync('git', ['show', `${base}:package.json`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  baseVersion = JSON.parse(text).version ?? '0.0.0';
} catch {
  skip(`${base} is not available here, nothing to compare with`);
}

if (compare(current, baseVersion) > 0) {
  console.log(`OK  version ${current} is higher than ${base} (${baseVersion})`);
} else {
  console.error(`${inCI ? '::error::' : ''}FAIL  version ${current} is not higher than ${base} (${baseVersion}). Bump it: npm version <patch|minor|major> --no-git-tag-version`);
  process.exit(1);
}
