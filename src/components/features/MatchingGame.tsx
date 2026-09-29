import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TrafficSign, Language, SignCategory } from '@/types/game';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { t, CATEGORY_LABELS_I18N } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useAudio } from '@/hooks/useAudio';
import { useFinishGame } from '@/hooks/usePlayer';
import { cn } from '@/lib/utils';
import { Timer, Trophy, RotateCcw, Home, Check, Star, Flame } from 'lucide-react';

const PAIR_COUNT = 6;
const MATCH_POINTS = 50;
const MISMATCH_PENALTY = 10;

interface MatchingGameProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
  muted?: boolean;
}

interface Tile {
  id: string;       // unique tile id (sign.id + '-sign' or '-name')
  signId: string;
  type: 'sign' | 'name';
  matched: boolean;
  selected: boolean;
  order?: number;   // 1-based order in which the pair was matched
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Long Swedish compounds shrink so they never break mid-word. */
function nameSize(name: string): string {
  const longest = Math.max(...name.split(/\s+/).map(w => w.length));
  return longest > 15 ? 'text-[12px]' : longest > 12 ? 'text-[13.5px]' : 'text-[15px]';
}

function buildTiles(category: SignCategory | 'all'): Tile[] {
  let pool = category === 'all' ? TRAFFIC_SIGNS : TRAFFIC_SIGNS.filter(s => s.category === category);
  if (pool.length < PAIR_COUNT) pool = TRAFFIC_SIGNS;
  const picked = shuffle(pool).slice(0, PAIR_COUNT);
  const make = (sign: TrafficSign, type: Tile['type']): Tile => ({
    id: `${sign.id}-${type}`, signId: sign.id, type, matched: false, selected: false,
  });
  // Each column gets its own shuffle so row order never reveals a pair.
  return [
    ...shuffle(picked).map(sg => make(sg, 'name')),
    ...shuffle(picked).map(sg => make(sg, 'sign')),
  ];
}

export default function MatchingGame({ lang, category, onHome, muted = false }: MatchingGameProps) {
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(category));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState<string[]>([]);
  const { playCorrect, playWrong, playCombo } = useAudio(muted);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isRtl = lang === 'ar';

  const later = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(setTimeout(fn, ms));
  }, []);
  const clearLater = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // start timer
  useEffect(() => {
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearLater();
    };
  }, [clearLater]);

  // stop timer when done
  useEffect(() => {
    if (done && timerRef.current) clearInterval(timerRef.current);
  }, [done]);

  const signMap = useMemo(() => Object.fromEntries(TRAFFIC_SIGNS.map(s => [s.id, s])) as Record<string, TrafficSign>, []);
  const pairsFound = tiles.filter(x => x.matched).length / 2;

  // Final score adds a speed bonus; stars come from how few moves were needed
  const timeBonus = Math.max(0, 90 - seconds) * 2;
  const finalScore = score + timeBonus;
  const stars = moves <= PAIR_COUNT + 2 ? 3 : moves <= PAIR_COUNT * 2 ? 2 : 1;
  const earned = useFinishGame(done, { mode: 'match', xp: 30 + stars * 10, seconds });

  const handleTile = useCallback((tileId: string) => {
    if (done) return;
    const tile = tiles.find(x => x.id === tileId);
    if (!tile || tile.matched || tile.selected) return;

    if (!selectedId) {
      setSelectedId(tileId);
      setTiles(prev => prev.map(x => x.id === tileId ? { ...x, selected: true } : x));
      return;
    }

    const first = tiles.find(x => x.id === selectedId)!;

    // Two taps in the same column: just move the selection, no penalty.
    if (first.type === tile.type) {
      setSelectedId(tileId);
      setTiles(prev => prev.map(x =>
        x.id === tileId ? { ...x, selected: true } : x.id === selectedId ? { ...x, selected: false } : x,
      ));
      return;
    }

    setMoves(m => m + 1);
    setSelectedId(null);

    if (first.signId === tile.signId && first.type !== tile.type) {
      // Match — chain them for a combo
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setScore(sc => sc + MATCH_POINTS * Math.min(nextCombo, 4));
      if (nextCombo >= 2) playCombo(nextCombo + 2); else playCorrect();

      const order = tiles.filter(x => x.matched).length / 2 + 1;
      const updated = tiles.map(x =>
        x.id === selectedId || x.id === tileId ? { ...x, matched: true, selected: false, order } : x,
      );
      setTiles(updated);
      if (updated.every(x => x.matched)) later(() => setDone(true), 700);
    } else {
      // No match — shake, reset combo, deselect
      playWrong();
      setCombo(0);
      setScore(sc => Math.max(0, sc - MISMATCH_PENALTY));
      setShake([selectedId, tileId]);
      later(() => {
        setShake([]);
        setTiles(prev => prev.map(x =>
          x.id === selectedId || x.id === tileId ? { ...x, selected: false } : x,
        ));
      }, 500);
    }
  }, [tiles, selectedId, done, combo, playCorrect, playWrong, playCombo, later]);

  const restart = () => {
    clearLater();
    setTiles(buildTiles(category));
    setSelectedId(null);
    setMoves(0);
    setSeconds(0);
    setScore(0);
    setCombo(0);
    setDone(false);
    setShake([]);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 pt-6 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onHome}
            className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-3 py-1.5 rounded-lg glass"
          >
            {t(lang, 'exit')}
          </button>
          <h1 className="font-display text-base font-bold text-[hsl(var(--foreground))]">{t(lang, 'matchingGame')}</h1>
          <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-16 justify-end">
            <Timer className="w-3.5 h-3.5" />
            <span>{seconds}s</span>
          </div>
        </div>

        {/* Live stats */}
        <div className="flex items-center gap-2">
          <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-display font-extrabold text-sm text-yellow-400 tabular-nums">{score}</span>
          </div>
          <div className="glass rounded-full px-3 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] tabular-nums">
            {t(lang, 'moves')}: {moves}
          </div>
          <div
            dir="ltr"
            className={cn(
              'ms-auto rounded-full px-3 py-1.5 flex items-center gap-1 text-xs font-extrabold tabular-nums transition-all',
              combo >= 2 ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/40 scale-105' : 'glass text-[hsl(var(--muted-foreground))]',
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            ×{Math.max(1, Math.min(combo, 4))}
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-[hsl(var(--foreground))]/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-500"
            style={{ width: `${(pairsFound / PAIR_COUNT) * 100}%` }}
          />
        </div>
        <div className="text-xs text-center text-[hsl(var(--muted-foreground))] mt-2">
          {CATEGORY_LABELS_I18N[lang][category]} · {t(lang, 'matchInstruction')}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-24 max-w-lg mx-auto w-full">
        {done ? (
          <div className="flex flex-col items-center justify-center gap-5 pt-6">
            <Confetti />
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <Star
                  key={n}
                  className={cn(
                    'w-10 h-10 pop-in',
                    n <= stars ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]' : 'text-[hsl(var(--foreground))]/15',
                  )}
                  style={{ animationDelay: `${n * 0.18}s` }}
                />
              ))}
            </div>
            <h2 className="font-display text-3xl font-extrabold text-brand-gradient pb-1">{t(lang, 'matchDone')}</h2>
            <XpChip earned={earned} lang={lang} />
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              <div className="glass flex flex-col items-center p-4 rounded-2xl">
                <Trophy className="w-5 h-5 text-yellow-400 mb-1" />
                <span className="font-display text-2xl font-extrabold">{finalScore}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
              </div>
              <div className="glass flex flex-col items-center p-4 rounded-2xl">
                <Timer className="w-5 h-5 text-[hsl(var(--brand))] mb-1" />
                <span className="font-display text-2xl font-extrabold">{seconds}s</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'time')}</span>
              </div>
              <div className="glass flex flex-col items-center p-4 rounded-2xl">
                <Check className="w-5 h-5 text-emerald-400 mb-1" />
                <span className="font-display text-2xl font-extrabold">{moves}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'moves')}</span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 gap-3 max-w-sm">
              <button onClick={onHome} className="glass flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-display font-bold hover:border-[hsl(var(--option-hover-border))] active:scale-[0.98] transition-all">
                <Home className="w-4 h-4" /> {t(lang, 'home')}
              </button>
              <button onClick={restart} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-gradient text-[hsl(var(--primary-foreground))] text-sm font-display font-bold shadow-glow transition-all hover:brightness-110 active:scale-[0.98]">
                <RotateCcw className="w-4 h-4" /> {t(lang, 'playAgain')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              tiles.filter(x => x.type === 'name'),
              tiles.filter(x => x.type === 'sign'),
            ].map((column, ci) => (
              <div
                key={ci}
                className="grid grid-rows-6 gap-2.5 h-[calc(100dvh-250px)] min-h-[540px] max-h-[760px]"
              >
                {column.map(tile => {
                  const sign = signMap[tile.signId];
                  const isSelected = tile.selected;
                  const isMatched = tile.matched;
                  const isShaking = shake.includes(tile.id);
                  const isName = tile.type === 'name';

                  return (
                    <button
                      key={tile.id}
                      onClick={() => handleTile(tile.id)}
                      disabled={isMatched}
                      className={cn(
                        'relative h-full w-full rounded-2xl border-2 flex items-center justify-center overflow-hidden transition-all duration-200 active:scale-95',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                        isMatched && 'match-burst border-emerald-400/60 bg-emerald-500/15 scale-[0.97]',
                        isSelected && !isMatched && 'border-[hsl(var(--brand))] bg-[hsl(var(--brand))]/15 scale-[1.03] shadow-glow',
                        !isSelected && !isMatched && !isShaking && (isName
                          ? 'glass border-[hsl(var(--brand))]/30 bg-[hsl(var(--brand))]/[0.07] hover:border-[hsl(var(--option-hover-border))]'
                          : 'glass hover:border-[hsl(var(--option-hover-border))]'),
                        isShaking && 'animate-shake border-red-500/70 bg-red-500/15',
                      )}
                    >
                      {isName && lang === 'ar' ? (
                        <div className="px-3 text-center w-full">
                          <p className="text-[15px] font-bold text-[hsl(var(--foreground))] leading-snug line-clamp-2">{sign.nameAr}</p>
                          <p dir="ltr" className="mt-1 text-[10.5px] leading-tight text-[hsl(var(--muted-foreground))] line-clamp-2 break-words">
                            <span className="font-mono font-bold text-[hsl(var(--sign-code))]">{sign.code}</span> · {sign.name}
                          </p>
                        </div>
                      ) : isName ? (
                        <div className="px-3 text-center w-full">
                          <p className="text-[12px] font-mono font-bold text-[hsl(var(--sign-code))] leading-tight">{sign.code}</p>
                          <p className={cn('font-semibold text-[hsl(var(--foreground))] leading-tight mt-1 line-clamp-3 break-words', nameSize(lang === 'en' ? (sign.nameEn || sign.name) : sign.name))}>
                            {lang === 'en' ? (sign.nameEn || sign.name) : sign.name}
                          </p>
                        </div>
                      ) : (
                        <div className="scale-[1.1]">
                          <SignDisplay sign={sign} size="sm" />
                        </div>
                      )}
                      {isMatched && (
                        <span className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full bg-emerald-500 text-white grid place-items-center pop-in font-display font-extrabold text-[13px] leading-none tabular-nums shadow-md">
                          {tile.order}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
