import { useCallback, useRef, useEffect } from 'react';

/**
 * Web Audio API sound engine for Vägmärken Quest.
 * All sounds are synthesised — no file dependencies.
 * Pass `muted=true` to silence all output.
 */
export function useAudio(muted = false) {
  const ctxRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = useRef(muted);

  // Keep ref in sync without re-creating callbacks
  mutedRef.current = muted;

  const getCtx = (): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return ctxRef.current;
  };

  const stopTick = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  /**
   * Pleasant chime — two sine tones rising (C5 → E5)
   */
  const playCorrect = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.36);
      });
    } catch {
      // silent fail if audio not available
    }
  }, []);

  /**
   * Short descending buzz — two detuned sawtooth oscillators
   */
  const playWrong = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [220, 185].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        osc.frequency.linearRampToValueAtTime(freq * 0.7, now + i * 0.08 + 0.2);
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.22);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.24);
      });
    } catch {
      // silent fail
    }
  }, []);

  /**
   * Single short tick click sound
   */
  const playTick = useCallback((urgent: boolean) => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(urgent ? 880 : 440, now);
      gain.gain.setValueAtTime(urgent ? 0.09 : 0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // silent fail
    }
  }, []);

  /** Play one enveloped note. */
  const note = (ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };

  /**
   * Streak chime — a quick rising arpeggio that climbs higher with the streak.
   */
  const playCombo = useCallback((streak: number) => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      const base = 523.25 * Math.pow(1.122, Math.min(8, Math.max(0, streak - 2)));
      [1, 1.25, 1.5, 2].forEach((mul, i) => note(ctx, base * mul, now + i * 0.065, 0.32, 'triangle', 0.16));
    } catch {
      // silent fail
    }
  }, []);

  /**
   * Level-up fanfare.
   */
  const playLevelUp = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        note(ctx, f, now + i * 0.11, 0.55, 'sine', 0.2);
        note(ctx, f * 2, now + i * 0.11, 0.35, 'triangle', 0.05);
      });
    } catch {
      // silent fail
    }
  }, []);

  /**
   * Start countdown ticks. Interval is 1000ms normally, 400ms in last 3 secs.
   * Call stopTick() to cancel.
   */
  const startTicking = useCallback((timeLeft: number) => {
    stopTick();
    const urgent = timeLeft <= 3;
    playTick(urgent);
    const interval = urgent ? 400 : 1000;
    tickIntervalRef.current = setInterval(() => {
      playTick(urgent);
    }, interval);
  }, [playTick, stopTick]);

  // Cleanup
  useEffect(() => () => { stopTick(); }, [stopTick]);

  return { playCorrect, playWrong, playTick, playCombo, playLevelUp, startTicking, stopTick };
}
