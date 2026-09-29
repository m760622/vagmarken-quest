import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A Map-backed localStorage, so the store can be loaded fresh with chosen contents. */
function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  });
  return data;
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('confusions store', () => {
  it('starts empty without stored data', async () => {
    stubStorage();
    const { getConfusions } = await import('@/lib/confusions');
    expect(getConfusions()).toEqual({});
  });

  it('loads stored data and drops what is malformed', async () => {
    stubStorage({ 'vq-confusions': JSON.stringify({ A1: { A2: 2, A3: -4, A4: 'x', A1: 5 }, B1: 'no' }) });
    const { getConfusions } = await import('@/lib/confusions');
    expect(getConfusions()).toEqual({ A1: { A2: 2 } });
  });

  it('survives corrupt JSON and missing storage', async () => {
    stubStorage({ 'vq-confusions': '{not json' });
    expect((await import('@/lib/confusions')).getConfusions()).toEqual({});
    vi.resetModules();
    vi.unstubAllGlobals();                                  // no localStorage at all (private mode, node)
    const { getConfusions, recordConfusion } = await import('@/lib/confusions');
    expect(getConfusions()).toEqual({});
    expect(() => recordConfusion('A1', 'A2')).not.toThrow();
    expect(getConfusions()).toEqual({ A1: { A2: 1 } });    // still works in memory
  });

  it('saves what it records, and eases it when the pair is disproved', async () => {
    const data = stubStorage();
    const { getConfusions, recordConfusion, resolveConfusions } = await import('@/lib/confusions');
    recordConfusion('A1', 'A2');
    recordConfusion('A1', 'A2');
    expect(JSON.parse(data.get('vq-confusions')!)).toEqual({ A1: { A2: 2 } });
    resolveConfusions('A1', ['A2', 'A9']);
    expect(getConfusions()).toEqual({ A1: { A2: 1 } });
    expect(JSON.parse(data.get('vq-confusions')!)).toEqual({ A1: { A2: 1 } });
    resolveConfusions('A1', ['A2']);
    expect(getConfusions()).toEqual({});
  });

  it('does not write when nothing changed', async () => {
    const data = stubStorage();
    const { recordConfusion, resolveConfusions } = await import('@/lib/confusions');
    resolveConfusions('A1', ['A2']);
    recordConfusion('A1', 'A1');
    expect(data.has('vq-confusions')).toBe(false);
  });
});
