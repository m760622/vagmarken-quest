import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Runs scripts/check-version.mjs itself, in a throw-away git repository with a known history.
const SCRIPT = fileURLToPath(new URL('../../../scripts/check-version.mjs', import.meta.url));

let dir = '';
const sha: Record<string, string> = {};

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf-8' }).trim();

function commit(name: string, version: string | null) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(version === null ? { name: 'x' } : { name: 'x', version }));
  git('add', 'package.json');
  git('commit', '-q', '--allow-empty', '-m', name);   // empty when the version did not change
  sha[name] = git('rev-parse', 'HEAD');
}

/** Runs the check in the repo as GitHub Actions would not: no CI annotations in the output. */
function check(...args: string[]) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GITHUB_ACTIONS: '' } });
    return { code: 0, out: stdout };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'check-version-'));
  git('init', '-q');
  commit('c1', '1.0.0');
  commit('c2', '1.1.0');   // raised
  commit('c3', '1.1.0');   // not raised
  commit('c4', '1.10.0');  // raised: 10 > 1 as numbers, not as text
  commit('c5', '1.9.9');   // lowered
  commit('c6', null);      // no version field at all
  commit('c7', '0.0.1');   // has a version after a commit without one
});

afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

describe('scripts/check-version.mjs --base', () => {
  it('passes when the version is higher than in the base commit', () => {
    git('checkout', '-q', sha.c2);
    const r = check('--base', sha.c1);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK');
    expect(r.out).toContain('1.1.0');
    expect(r.out).toContain('1.0.0');
  });

  it('fails when the version is the same', () => {
    git('checkout', '-q', sha.c3);
    const r = check('--base', sha.c2);
    expect(r.code).toBe(1);
    expect(r.out).toContain('not higher');
    expect(r.out).toContain('npm version');
  });

  it('compares the parts as numbers: 1.10.0 is higher than 1.1.0', () => {
    git('checkout', '-q', sha.c4);
    expect(check('--base', sha.c3).code).toBe(0);
  });

  it('fails when the version went down', () => {
    git('checkout', '-q', sha.c5);
    expect(check('--base', sha.c4).code).toBe(1);
  });

  it('treats a base without a version as 0.0.0', () => {
    git('checkout', '-q', sha.c7);
    expect(check('--base', sha.c6).code).toBe(0);
    git('checkout', '-q', sha.c6);
    expect(check('--base', sha.c6).code).toBe(1);     // still no version: 0.0.0 is not higher than 0.0.0
  });

  it('skips a brand new branch (GitHub sends an all-zero "before")', () => {
    git('checkout', '-q', sha.c3);
    const r = check('--base', '0000000000000000000000000000000000000000');
    expect(r.code).toBe(0);
    expect(r.out).toContain('skipped');
  });

  it('skips, and says so, when the base commit is not in the clone', () => {
    const r = check('--base', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    expect(r.code).toBe(0);
    expect(r.out).toContain('skipped');
    expect(r.out).toContain('not available');
  });

  it('rejects an argument that could be read as a git option', () => {
    expect(check('--base', '--help').code).toBe(2);
    expect(check('--base').code).toBe(2);
    expect(check('--base', 'a b').code).toBe(2);
  });

  it('uses origin/main when there is no --base (the check before pushing)', () => {
    git('checkout', '-q', sha.c2);
    expect(check().out).toContain('skipped');                    // no origin/main in this repo
    git('update-ref', 'refs/remotes/origin/main', sha.c1);
    const ok = check();
    expect(ok.code).toBe(0);
    expect(ok.out).toContain('origin/main');
    git('update-ref', 'refs/remotes/origin/main', sha.c2);
    expect(check().code).toBe(1);                               // same version as origin/main
  });
});
