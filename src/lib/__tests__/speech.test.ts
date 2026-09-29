import { describe, expect, it } from 'vitest';
import { hasSwedishVoice, pickSwedishVoice, SPEECH_RATE, speakSwedish } from '@/lib/speech';

const voice = (lang: string, localService = false, name = lang) => ({ lang, localService, name });

describe('pickSwedishVoice', () => {
  it('finds Swedish in the usual spellings: sv-SE, sv_SE and sv', () => {
    expect(pickSwedishVoice([voice('en-US'), voice('sv-SE')])?.lang).toBe('sv-SE');
    expect(pickSwedishVoice([voice('sv_SE')])?.lang).toBe('sv_SE');
    expect(pickSwedishVoice([voice('SV')])?.lang).toBe('SV');
  });

  it('prefers a voice that runs on the device', () => {
    const list = [voice('sv-SE', false, 'network'), voice('sv-SE', true, 'device')];
    expect(pickSwedishVoice(list)?.name).toBe('device');
  });

  it('does not take other languages that start with the same letters', () => {
    expect(pickSwedishVoice([voice('svc-XX'), voice('sw-KE'), voice('en-GB'), voice('ar-SA')])).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(pickSwedishVoice([])).toBeUndefined();
  });
});

function fakeSynth(voices: ReturnType<typeof voice>[]) {
  const calls: string[] = [];
  const spoken: { text: string; lang: string; rate: number; voice: unknown }[] = [];
  return {
    calls, spoken,
    synth: {
      getVoices: () => voices as unknown as SpeechSynthesisVoice[],
      cancel: () => { calls.push('cancel'); },
      speak: (u: SpeechSynthesisUtterance) => { calls.push('speak'); spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice }); },
    },
  };
}
class FakeUtterance { text: string; lang = ''; rate = 1; voice: unknown = null; constructor(text: string) { this.text = text; } }
const Utt = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;

describe('speakSwedish', () => {
  it('cancels what is being said, then speaks the text slowly with the Swedish voice', () => {
    const f = fakeSynth([voice('en-US'), voice('sv-SE', true)]);
    expect(speakSwedish('Varning för älg', f.synth, Utt)).toBe(true);
    expect(f.calls).toEqual(['cancel', 'speak']);
    expect(f.spoken[0]).toMatchObject({ text: 'Varning för älg', lang: 'sv-SE', rate: SPEECH_RATE });
    expect((f.spoken[0].voice as { lang: string }).lang).toBe('sv-SE');
  });

  it('does nothing and returns false without a Swedish voice (nothing is cancelled either)', () => {
    const f = fakeSynth([voice('en-US')]);
    expect(speakSwedish('Stopp', f.synth, Utt)).toBe(false);
    expect(f.calls).toEqual([]);
  });

  it('returns false when speech synthesis is missing', () => {
    expect(speakSwedish('Stopp', undefined, Utt)).toBe(false);
    expect(speakSwedish('Stopp', fakeSynth([voice('sv-SE')]).synth, undefined)).toBe(false);
  });

  it('does not throw when the browser does', () => {
    const broken = { getVoices: () => { throw new Error('nope'); }, cancel: () => undefined, speak: () => undefined };
    expect(speakSwedish('Stopp', broken, Utt)).toBe(false);
    expect(hasSwedishVoice(broken)).toBe(false);
  });
});

describe('hasSwedishVoice', () => {
  it('is true only when a Swedish voice is installed', () => {
    expect(hasSwedishVoice(fakeSynth([voice('sv-SE')]).synth)).toBe(true);
    expect(hasSwedishVoice(fakeSynth([voice('en-US')]).synth)).toBe(false);
    expect(hasSwedishVoice(fakeSynth([]).synth)).toBe(false);
  });
});
