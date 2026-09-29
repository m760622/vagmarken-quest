import { useEffect, useState } from 'react';
import { getSynth, hasSwedishVoice } from '@/lib/speech';

/** Whether this device can speak Swedish. Browsers often load their voices a moment after the page. */
export function useSwedishVoice(): boolean {
  const [available, setAvailable] = useState(() => hasSwedishVoice());
  useEffect(() => {
    const synth = getSynth();
    if (!synth) return;
    const update = () => setAvailable(hasSwedishVoice(synth));
    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, []);
  return available;
}
