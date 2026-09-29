/**
 * Speaking a Swedish sign name with the browser's own speech synthesis. There is no audio file and
 * no server: it only works when the device has a Swedish voice, so callers ask first
 * (hasSwedishVoice) and hide the button otherwise. Speech starts only from a tap.
 */

export interface VoiceLike {
  lang: string;
  localService?: boolean;
}

/** A Swedish voice from the list ("sv-SE", "sv_SE" or "sv"), preferring one that runs on the device (it starts sooner). */
export function pickSwedishVoice<T extends VoiceLike>(voices: readonly T[]): T | undefined {
  const swedish = voices.filter(v => /^sv([-_]|$)/i.test(v.lang));
  return swedish.find(v => v.localService) ?? swedish[0];
}

export const getSynth = (): SpeechSynthesis | undefined =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

export function hasSwedishVoice(synth: Pick<SpeechSynthesis, 'getVoices'> | undefined = getSynth()): boolean {
  try {
    return !!synth && !!pickSwedishVoice(synth.getVoices());
  } catch {
    return false;
  }
}

/** Slightly slower than normal speech: the names are for learners. */
export const SPEECH_RATE = 0.9;

/** Speaks `text` in Swedish, stopping whatever is being said. False when there is nothing to speak with. */
export function speakSwedish(
  text: string,
  synth: Pick<SpeechSynthesis, 'getVoices' | 'cancel' | 'speak'> | undefined = getSynth(),
  Utterance: typeof SpeechSynthesisUtterance | undefined = typeof SpeechSynthesisUtterance === 'undefined' ? undefined : SpeechSynthesisUtterance,
): boolean {
  if (!synth || !Utterance) return false;
  try {
    const voice = pickSwedishVoice(synth.getVoices());
    if (!voice) return false;
    synth.cancel();
    const utterance = new Utterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = SPEECH_RATE;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
