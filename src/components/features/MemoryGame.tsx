/**
 * MEMORY GAME — لعبة الذاكرة / Minnet
 * 8 pairs of cards: SVG sign (face) ↔ sign name text (face).
 * Flip two cards — if they match the pair stays open, otherwise they flip back.
 * Goal: match all 8 pairs in fewest flips and least time.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language, TrafficSign } from '@/types/game';
import { t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Home, Brain, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { useAudio } from '@/hooks/useAudio';

const PAIR_COUNT = 8;

interface MemoryCard {
  id: string;         // unique card id (e.g. "A1-sign" | "A1-name")
  signId: string;     // sign id — two cards share same signId
  type: 'sign' | 'name';
  sign: TrafficSign;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCards(): MemoryCard[] {
  const selected = shuffle([...TRAFFIC_SIGNS]).slice(0, PAIR_COUNT);
  const cards: MemoryCard[] = [];
  selected.forEach(sign => {
    cards.push({ id: `${sign.id}-sign`, signId: sign.id, type: 'sign', sign });
    cards.push({ id: `${sign.id}-name`, signId: sign.id, type: 'name', sign });
  });
  return shuffle(cards);
}

interface MemoryGameProps {
  lang: Language;
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

type GamePhase = 'intro' | 'playing' | 'result';

export default function MemoryGame({ lang, onHome, muted = false, onToggleMute }: MemoryGameProps) {
  const [phase, setPhase]         = useState<GamePhase>('intro');
  const [cards, setCards]         = useState<MemoryCard[]>([]);
  const [flipped, setFlipped]     = useState<string[]>([]);   // up to 2 card ids
  const [matched, setMatched]     = useState<string[]>([]);   // matched signIds
  const [moves, setMoves]         = useState(0);
  const [elapsed, setElapsed]     = useState(0);
  const [locked, setLocked]       = useState(false);           // prevent triple flip
  const [shaking, setShaking]     = useState<string[]>([]);
  const [pairFlash, setPairFlash] = useState<string | null>(null); // signId of just-matched pair

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { playCorrect, playWrong } = useAudio(muted);
  const isRtl = lang === 'ar';

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startGame = useCallback(() => {
    setCards(buildCards());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setElapsed(0);
    setLocked(false);
    setPhase('playing');
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const handleFlip = useCallback((card: MemoryCard) => {
    if (locked) return;
    if (flipped.includes(card.id)) return;
    if (matched.includes(card.signId)) return;
    if (flipped.length >= 2) return;

    const newFlipped = [...flipped, card.id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = newFlipped.map(id => cards.find(c => c.id === id)!);

      if (a.signId === b.signId) {
        // Match!
        playCorrect();
        setPairFlash(a.signId);
        setTimeout(() => setPairFlash(null), 600);

        const newMatched = [...matched, a.signId];
        setMatched(newMatched);
        setFlipped([]);

        if (newMatched.length === PAIR_COUNT) {
          stopTimer();
          setTimeout(() => setPhase('result'), 800);
        }
      } else {
        // No match — shake + flip back
        playWrong();
        setLocked(true);
        setShaking(newFlipped);
        setTimeout(() => {
          setFlipped([]);
          setShaking([]);
          setLocked(false);
        }, 800);
      }
    }
  }, [locked, flipped, matched, cards, playCorrect, playWrong, stopTimer]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const score = Math.max(0, 1000 - moves * 20 - elapsed * 2);
  const earned = useFinishGame(phase === 'result', { mode: 'memory', xp: 30 + Math.round(score / 25), seconds: elapsed });

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 w-20 h-20 rounded-full bg-violet-500/20 border-2 border-violet-500/40 flex items-center justify-center">
          <Brain className="w-10 h-10 text-violet-400" />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">
          {lang === 'sv' ? 'Minnet' : lang === 'en' ? 'Memory' : 'الذاكرة'}
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-2 max-w-xs">
          {lang === 'en'
            ? 'Match each sign with its correct name. Find all 8 pairs in as few flips as possible!'
            : lang === 'sv'
            ? 'Para ihop varje skylt med rätt namn. Hitta alla 8 par med så få vändningar som möjligt!'
            : 'طابق كل إشارة مع اسمها الصحيح. اعثر على جميع الأزواج الـ8 بأقل عدد من التقليبات!'}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mb-8">
          {lang === 'en' ? '8 pairs · Fewer moves = higher score'
          : lang === 'sv' ? '8 par · Lägre antal drag = högre poäng'
          : '8 أزواج · أقل حركات = نقاط أعلى'}
        </p>

        {/* Preview mini cards */}
        <div className="flex gap-2 mb-8">
          {['⚠️', '⛔', '🔵', '◆'].map((emoji, i) => (
            <div key={i} className={cn(
              'w-12 h-16 rounded-xl flex items-center justify-center text-2xl border-2 transition-all duration-500',
              i % 2 === 0
                ? 'bg-[hsl(var(--option-bg))] border-violet-500/40'
                : 'bg-violet-500/10 border-violet-500/30',
            )}>
              {i % 2 === 0 ? emoji : '?'}
            </div>
          ))}
        </div>

        <button
          onClick={startGame}
          className="w-full max-w-xs py-4 rounded-2xl btn-hue hue-violet font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Brain className="w-5 h-5" />
          {lang === 'sv' ? 'Starta spelet!' : lang === 'en' ? 'Start game!' : 'ابدأ اللعبة!'}
        </button>

        <button onClick={onHome} className="mt-4 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
          {t(lang, 'home')}
        </button>
      </div>
    );
  }

  if (phase === 'result') {
    const perfect = moves <= PAIR_COUNT + 2;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl mb-4">{perfect ? '🧠' : moves <= PAIR_COUNT * 2 ? '🎯' : '📚'}</div>
        <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">
          {lang === 'en'
            ? (perfect ? 'Memory genius!' : moves <= PAIR_COUNT * 2 ? 'Great memory!' : 'Good try!')
            : perfect
            ? (lang === 'sv' ? 'Minnesgenius!' : 'عبقري الذاكرة!')
            : moves <= PAIR_COUNT * 2
            ? (lang === 'sv' ? 'Bra minne!' : 'ذاكرة جيدة!')
            : (lang === 'sv' ? 'Bra försök!' : 'محاولة جيدة!')}
        </h1>
        <div className="mt-2 mb-4"><XpChip earned={earned} lang={lang} /></div>
        {moves <= PAIR_COUNT * 2 && <Confetti />}
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6">
          {lang === 'en' ? 'You found all pairs!' : lang === 'sv' ? 'Du hittade alla par!' : 'وجدت جميع الأزواج!'}
        </p>

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-8">
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-violet-400">{score}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-amber-400">{moves}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'moves')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-sky-400">{formatTime(elapsed)}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'time')}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="py-3.5 rounded-2xl btn-hue hue-violet font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4" />
            {lang === 'sv' ? 'Spela igen' : lang === 'en' ? 'Play again' : 'العب مجدداً'}
          </button>
          <button
            onClick={onHome}
            className="py-3 rounded-2xl border-2 border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] text-[hsl(var(--foreground))] font-semibold hover:border-[hsl(var(--option-hover-border))] transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            {t(lang, 'home')}
          </button>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onHome} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            {t(lang, 'exit')}
          </button>
          <h1 className="text-sm font-display font-bold text-[hsl(var(--foreground))]">
            {lang === 'sv' ? 'Minnet' : lang === 'en' ? 'Memory' : 'الذاكرة'}
          </h1>
          <div className="flex items-center gap-1.5">
            <div className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
              <span dir="ltr" className="font-bold text-violet-400">{matched.length}/{PAIR_COUNT}</span>
            </div>
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="w-7 h-7 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center text-xs hover:border-[hsl(var(--option-hover-border))] transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >{muted ? '🔇' : '🔊'}</button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'moves')}:</span>
            <span className="text-sm font-black text-amber-400 tabular-nums">{moves}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <Timer className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-sm font-black text-sky-400 tabular-nums">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Matched progress */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-500"
            style={{ width: `${(matched.length / PAIR_COUNT) * 100}%` }}
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 px-3 pb-6 max-w-lg mx-auto w-full">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {cards.map(card => {
            const isFlipped  = flipped.includes(card.id) || matched.includes(card.signId);
            const isMatched  = matched.includes(card.signId);
            const isShaking  = shaking.includes(card.id);
            const isGlowing  = pairFlash === card.signId;

            return (
              <button
                key={card.id}
                onClick={() => handleFlip(card)}
                disabled={isMatched || locked && !isFlipped}
                className={cn(
                  'relative aspect-square rounded-2xl border-2 flex items-center justify-center overflow-hidden',
                  'transition-all duration-300 select-none',
                  !isFlipped && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] hover:border-violet-500/60 hover:bg-violet-500/10 cursor-pointer active:scale-95',
                  isFlipped && !isMatched && 'bg-slate-800 border-violet-500/40 cursor-default',
                  isMatched && 'bg-emerald-500/10 border-emerald-500/40 cursor-default',
                  isShaking && 'animate-shake border-red-500/50',
                  isGlowing && 'ring-2 ring-emerald-400/60',
                )}
                style={{ minHeight: 72 }}
              >
                {!isFlipped ? (
                  /* Card back */
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="text-2xl opacity-30">🔵</span>
                  </div>
                ) : card.type === 'sign' ? (
                  /* Sign face */
                  <div className="flex items-center justify-center p-1">
                    <SignDisplay sign={card.sign} size="sm" />
                  </div>
                ) : (
                  /* Name face */
                  <div className="flex items-center justify-center p-2 text-center">
                    <span className={cn(
                      'text-[10px] font-bold leading-tight',
                      isMatched ? 'text-emerald-300' : 'text-[hsl(var(--foreground))]',
                    )}>
                    {lang === 'ar' ? (
                      <>
                        <span className="block text-[11px]">{card.sign.nameAr}</span>
                        <span dir="ltr" className="block text-[8px] font-medium opacity-60 mt-0.5">{card.sign.name}</span>
                      </>
                    ) : lang === 'en' ? card.sign.nameEn || card.sign.name : card.sign.name}
                    </span>
                  </div>
                )}

                {/* Match overlay checkmark */}
                {isMatched && (
                  <div className="absolute top-1 right-1">
                    <span className="text-xs text-emerald-400">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
