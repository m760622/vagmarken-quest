import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  });
}

beforeEach(() => { vi.resetModules(); vi.doMock('sonner', () => ({ toast: Object.assign(() => undefined, { success: () => undefined, message: () => undefined }) })); stubStorage(); });
afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('sonner'); });

describe('recordEvent files mix-ups next to the mistakes', () => {
  it('a wrong answer with a picked sign records the mistake and the mix-up', async () => {
    const { recordEvent } = await import('@/lib/progress');
    const { getMistakes } = await import('@/lib/mistakes');
    const { getConfusions } = await import('@/lib/confusions');
    recordEvent({ type: 'answer', signId: 'A1', correct: false, pickedId: 'A2' });
    expect(getMistakes()).toMatchObject({ A1: 1 });
    expect(getConfusions()).toEqual({ A1: { A2: 1 } });
  });

  it('a wrong answer without a picked sign (time ran out) records only the mistake', async () => {
    const { recordEvent } = await import('@/lib/progress');
    const { getMistakes } = await import('@/lib/mistakes');
    const { getConfusions } = await import('@/lib/confusions');
    recordEvent({ type: 'answer', signId: 'A1', correct: false });
    expect(getMistakes()).toMatchObject({ A1: 1 });
    expect(getConfusions()).toEqual({});
  });

  it('a right answer with the other options eases exactly those pairs', async () => {
    const { recordEvent } = await import('@/lib/progress');
    const { getConfusions } = await import('@/lib/confusions');
    recordEvent({ type: 'answer', signId: 'A1', correct: false, pickedId: 'A2' });
    recordEvent({ type: 'answer', signId: 'A1', correct: false, pickedId: 'A3' });
    recordEvent({ type: 'answer', signId: 'A1', correct: true, otherIds: ['A2', 'A9'] });
    expect(getConfusions()).toEqual({ A1: { A3: 1 } });
  });

  it('a right answer without the other options leaves the mix-ups alone', async () => {
    const { recordEvent } = await import('@/lib/progress');
    const { getConfusions } = await import('@/lib/confusions');
    recordEvent({ type: 'answer', signId: 'A1', correct: false, pickedId: 'A2' });
    recordEvent({ type: 'answer', signId: 'A1', correct: true });
    expect(getConfusions()).toEqual({ A1: { A2: 1 } });
  });
});
