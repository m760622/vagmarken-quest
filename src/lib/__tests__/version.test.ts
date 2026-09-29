import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BUILD, APP_VERSION, versionLabel } from '@/lib/version';

const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'));

describe('app version', () => {
  it('is the package.json version, in x.y.z form', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('comes with a build id: a short commit hash, or "dev" without git', () => {
    expect(APP_BUILD).toMatch(/^([0-9a-f]{7}|dev)$/);
  });

  it('is shown as "version · build"', () => {
    expect(versionLabel()).toBe(`${APP_VERSION} · ${APP_BUILD}`);
  });
});
