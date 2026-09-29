import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SignCategory, Language, HighScore, TrafficSign } from '@/types/game';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import MenuScreen from './MenuScreen';
import CategorySheet from './CategorySheet';
import { CategoryIcon } from './CategoryIcon';
import { CATEGORY_HUE } from '@/constants/categories';
import SignDisplay from './SignDisplay';
import {
  Play, Puzzle, Layers, Lock, Zap, Brain, Calendar, Search, X, Menu, Flame, ListChecks,
  ShieldCheck, ChevronUp, ChevronDown, ChevronRight, Check, History, ClipboardCheck, Gamepad2, type LucideIcon,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { UNLOCK_THRESHOLD } from '@/hooks/useProgression';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { useMistakes, useProgress } from '@/hooks/useProgress';
import { usePlayer } from '@/hooks/usePlayer';
import { displayStreak, streakAtRisk } from '@/lib/player';

type Difficulty = 'easy' | 'medium' | 'hard';
type GameMode = 'quiz' | 'match' | 'learn' | 'blitz' | 'memory' | 'daily' | 'review' | 'exam';

interface ProgressionInfo {
  hardUnlocked: boolean;
  bestMediumPct: number;
}

interface StartScreenProps {
  onStart: (category: SignCategory | 'all', difficulty: Difficulty, signPool?: TrafficSign[], options?: { review?: boolean }) => void;
  onStartMode: (mode: 'match' | 'learn' | 'blitz' | 'memory' | 'daily' | 'exam', category: SignCategory | 'all') => void;
  scores: HighScore[];
  onClearScores: () => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  progression: ProgressionInfo;
  muted: boolean;
  onToggleMute: () => void;
}

const MODES: { id: GameMode; icon: LucideIcon; labelKey: string; descKey: string; hue: string }[] = [
  { id: 'learn',  icon: Layers,   labelKey: 'modeLearn',  descKey: 'modeLearnDesc',  hue: '199 92% 58%' },
  { id: 'exam',   icon: ClipboardCheck, labelKey: 'modeExam', descKey: 'modeExamDesc', hue: '84 78% 55%' },
  { id: 'review', icon: History,  labelKey: 'modeReview', descKey: 'modeReviewDesc', hue: '350 89% 64%' },
  { id: 'quiz',   icon: Play,     labelKey: 'modeQuiz',   descKey: 'modeQuizDesc',   hue: 'var(--brand)' },
  { id: 'daily',  icon: Calendar, labelKey: 'modeDaily',  descKey: 'modeDailyDesc',  hue: '32 96% 58%' },
  { id: 'blitz',  icon: Zap,      labelKey: 'modeBlitz',  descKey: 'modeBlitzDesc',  hue: '52 98% 56%' },
  { id: 'memory', icon: Brain,    labelKey: 'modeMemory', descKey: 'modeMemoryDesc', hue: '266 90% 70%' },
  { id: 'match',  icon: Puzzle,   labelKey: 'modeMatch',  descKey: 'modeMatchDesc',  hue: '330 88% 66%' },
];

/* The four games share one expandable card, so the mode list stays short */
const GAME_IDS: GameMode[] = ['daily', 'blitz', 'memory', 'match'];
const GAMES_HUE = '292 84% 66%';
/* Space kept free above the sticky start bar when scrolling revealed cards into view */
const START_BAR_CLEARANCE = 128;
const modeOf = (id: GameMode) => MODES.find(m => m.id === id) ?? MODES[0];

const DIFFICULTY_HUE: Record<Difficulty, string> = {
  easy: '152 70% 50%',
  medium: '42 96% 56%',
  hard: '0 84% 62%',
};

/* Real signs floating in the hero. Missing ids are skipped safely. */
const findSign = (id: string) => TRAFFIC_SIGNS.find(s => s.id === id);
const HERO_LEFT = findSign('A15');
const HERO_CENTER = findSign('B2');
const HERO_RIGHT = findSign('C31');

/* ── Night-road hero stage ───────────────────────────────────────── */
function RoadStage({ compact }: { compact: boolean }) {
  return (
    <div className={cn('relative mt-1 select-none', compact ? 'h-[104px] sm:h-[130px]' : 'h-[200px] sm:h-[250px]')} aria-hidden="true">
      {/* Headlight glow */}
      <div
        className="glow-breathe absolute left-1/2 top-[8%] -translate-x-1/2 w-72 h-72 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(closest-side, hsl(var(--brand) / 0.5), hsl(var(--accent-2) / 0.2) 62%, transparent)' }}
      />

      {/* Road in perspective */}
      <div
        className="absolute inset-x-0 bottom-[-6%] h-[64%] overflow-hidden"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 34%, #000 58%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 34%, #000 58%, transparent 100%)',
        }}
      >
        <div
          className="absolute -left-[35%] -right-[35%] bottom-0 h-[230px]"
          style={{ transformOrigin: '50% 100%', transform: 'perspective(230px) rotateX(58deg)' }}
        >
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, hsl(var(--foreground) / 0.2), hsl(var(--brand) / 0.08))' }} />
          <div className="absolute inset-y-0 left-[24%] w-[7px]" style={{ background: 'hsl(var(--brand) / 0.85)', boxShadow: '0 0 16px hsl(var(--brand) / 0.7)' }} />
          <div className="absolute inset-y-0 right-[24%] w-[7px]" style={{ background: 'hsl(var(--brand) / 0.85)', boxShadow: '0 0 16px hsl(var(--brand) / 0.7)' }} />
          <div className="road-dashes absolute inset-y-0 left-1/2 -translate-x-1/2 w-[9px]" />
        </div>
      </div>

      {/* Floating real signs — kept to the content width on wide screens */}
      <div className="absolute inset-0 max-w-xl mx-auto">
        {HERO_LEFT && !compact && (
          <div className="absolute left-[3%] sm:left-[10%] bottom-[16%] z-10">
            <div className="sign-float" style={{ '--rot': '-9deg', '--dur': '6.5s', '--delay': '-1.2s' } as CSSProperties}>
              <div className="scale-[0.72] sm:scale-90 origin-bottom" style={{ filter: 'drop-shadow(0 14px 22px hsl(var(--accent-2) / 0.35))' }}>
                <SignDisplay sign={HERO_LEFT} size="md" />
              </div>
            </div>
          </div>
        )}
        {HERO_CENTER && (
          <div className={cn('absolute left-1/2 -translate-x-1/2 z-20 origin-bottom', compact ? 'bottom-[14%] scale-[0.5] sm:scale-[0.62]' : 'bottom-[20%] scale-[0.82] sm:scale-100')}>
            <div className="sign-float" style={{ '--rot': '0deg', '--dur': '7.5s', '--delay': '-3s' } as CSSProperties}>
              <div style={{ filter: 'drop-shadow(0 18px 30px hsl(var(--brand) / 0.45))' }}>
                <SignDisplay sign={HERO_CENTER} size="lg" />
              </div>
            </div>
          </div>
        )}
        {HERO_RIGHT && !compact && (
          <div className="absolute right-[3%] sm:right-[10%] bottom-[16%] z-10">
            <div className="sign-float" style={{ '--rot': '9deg', '--dur': '6s', '--delay': '-2.4s' } as CSSProperties}>
              <div className="scale-[0.72] sm:scale-90 origin-bottom" style={{ filter: 'drop-shadow(0 14px 22px hsl(var(--accent-2) / 0.35))' }}>
                <SignDisplay sign={HERO_RIGHT} size="md" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Section heading ─────────────────────────────────────────────── */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-[15px] font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2.5">
      <span className="w-1.5 h-4 rounded-full bg-brand-gradient" />
      {children}
    </h2>
  );
}

/* ── Mode card ───────────────────────────────────────────────────── */
interface ModeCardProps {
  icon: LucideIcon;
  hue: string;
  title: string;
  desc: string;
  wide?: boolean;
  active?: boolean;
  /** aria-pressed for cards that select a mode; leave undefined for cards that open a screen or expand */
  pressed?: boolean;
  expanded?: boolean;
  badge?: number;
  fillIcon?: boolean;
  /** Replaces the selected check in the corner (open / expand arrows) */
  corner?: ReactNode;
  onClick: () => void;
  style?: CSSProperties;
  className?: string;
}

function ModeCard({
  icon: Icon, hue, title, desc, wide, active, pressed, expanded, badge, fillIcon, corner, onClick, style, className,
}: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-expanded={expanded}
      className={cn(
        'relative overflow-hidden text-start rounded-3xl transition-all duration-200 active:scale-[0.98]',
        wide ? 'col-span-2 p-4 flex items-center gap-4' : 'p-3.5 flex flex-col gap-3',
        !active && 'glass hover:-translate-y-0.5',
        className,
      )}
      style={{
        ...(active ? {
          background: `linear-gradient(135deg, hsl(${hue} / 0.24), hsl(var(--accent-2) / 0.12))`,
          border: `1px solid hsl(${hue} / 0.75)`,
          boxShadow: `0 12px 34px -12px hsl(${hue} / 0.6)`,
          WebkitBackdropFilter: 'blur(16px)',
          backdropFilter: 'blur(16px)',
        } : undefined),
        ...style,
      }}
    >
      <span
        className={cn('grid place-items-center rounded-2xl shrink-0', wide ? 'w-14 h-14' : 'w-11 h-11')}
        style={{
          background: `linear-gradient(135deg, hsl(${hue}), hsl(${hue} / 0.62))`,
          boxShadow: `0 8px 20px -6px hsl(${hue} / 0.7)`,
        }}
      >
        <Icon className={cn('text-[hsl(var(--primary-foreground))]', wide ? 'w-6 h-6' : 'w-5 h-5', fillIcon && 'fill-current')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-1.5 font-display font-bold text-[hsl(var(--foreground))] leading-tight', wide ? 'text-lg' : 'text-[15px]')}>
          {title}
          {badge !== undefined && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-extrabold tabular-nums">{badge}</span>
          )}
        </span>
        <span className="block text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-snug">
          {desc}
        </span>
      </span>
      {corner ? (
        <span
          className="absolute top-3 end-3 w-5 h-5 rounded-full grid place-items-center bg-[hsl(var(--foreground))]/10"
          aria-hidden="true"
        >
          {corner}
        </span>
      ) : active && (
        <span
          className="absolute top-3 end-3 w-5 h-5 rounded-full grid place-items-center"
          style={{ background: `hsl(${hue})` }}
        >
          <Check className="w-3 h-3 text-[hsl(var(--primary-foreground))]" strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

export default function StartScreen({
  onStart, onStartMode, scores, onClearScores, lang, onLangChange, progression, muted, onToggleMute,
}: StartScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<SignCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [selectedMode, setSelectedMode] = useState<GameMode>('quiz');
  const [gamesOpen, setGamesOpen] = useState(false);
  const gamesEndRef = useRef<HTMLDivElement>(null);
  // The games card sits low on the page: bring the cards it reveals above the sticky start bar
  useEffect(() => {
    const end = gamesEndRef.current;
    if (!gamesOpen || !end || end.getBoundingClientRect().bottom + START_BAR_CLEARANCE <= window.innerHeight) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    end.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [gamesOpen]);
  const [lockedBump, setLockedBump] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
  const { player } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const { missions } = useProgress();
  const missionsDone = missions.filter(m => m.done).length;
  const streak = displayStreak(player);
  const streakWarning = streak > 0 && streakAtRisk(player);
  // After the first finished game the hero shrinks so the modes are reachable right away
  const compact = player.gamesPlayed > 0;
  const { ids: mistakeIds, count: mistakeCount } = useMistakes();

  const isRtl = lang === 'ar';
  const hardLocked = !progression.hardUnlocked;
  const mediumProgress = Math.min(100, (progression.bestMediumPct / UNLOCK_THRESHOLD) * 100);

  // Search filter
  const query = searchQuery.trim().toLowerCase();
  const filteredSigns = query
    ? TRAFFIC_SIGNS.filter(s =>
        s.code.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.nameEn.toLowerCase().includes(query) ||
        s.nameAr.includes(query),
      )
    : null;

  const difficulties: { value: Difficulty; label: string; desc: string; locked: boolean }[] = [
    { value: 'easy',   label: t(lang, 'diffEasy'),   desc: t(lang, 'ptsEasy'),   locked: false },
    { value: 'medium', label: t(lang, 'diffMedium'), desc: t(lang, 'ptsMedium'), locked: false },
    { value: 'hard',   label: t(lang, 'diffHard'),   desc: t(lang, 'ptsHard'),   locked: hardLocked },
  ];

  const statLabel =
    lang === 'ar' ? `${TRAFFIC_SIGNS.length} إشارة` :
    lang === 'sv' ? `${TRAFFIC_SIGNS.length} skyltar` :
    `${TRAFFIC_SIGNS.length} Signs`;

  const categoryCount = new Set(TRAFFIC_SIGNS.map(s => s.category)).size;
  const categoryCountLabel =
    lang === 'ar' ? `${categoryCount.toLocaleString('ar-EG')} فئات` :
    lang === 'sv' ? `${categoryCount} kategorier` :
    `${categoryCount} Categories`;

  const handleDifficultyClick = (value: Difficulty, locked: boolean) => {
    if (locked) {
      setLockedBump(true);
      setTimeout(() => setLockedBump(false), 500);
      return;
    }
    setSelectedDifficulty(value);
  };

  const startReview = () => {
    if (mistakeCount === 0) return;
    // No difficulty choice here: review results are not saved and do not count toward unlocking Hard
    onStart('all', 'medium', TRAFFIC_SIGNS.filter(sg => mistakeIds.includes(sg.id)), { review: true });
  };

  const handleStart = () => {
    if (selectedMode === 'review') {
      startReview();
    } else if (selectedMode === 'quiz') {
      const diff = (hardLocked && selectedDifficulty === 'hard') ? 'medium' : selectedDifficulty;
      const pool = filteredSigns ?? undefined;
      onStart(selectedCategory, diff, pool);
    } else {
      onStartMode(selectedMode as Exclude<GameMode, 'quiz' | 'review'>, selectedCategory);
    }
  };

  const activeMode = modeOf(selectedMode);
  // A game picked inside the collapsed "Games" card is still shown on it
  const selectedGame = GAME_IDS.includes(selectedMode) ? modeOf(selectedMode) : null;
  // Daily, the mock exam and the mistakes review have their own fixed set of signs
  const usesCategory = selectedMode !== 'review' && selectedMode !== 'exam' && selectedMode !== 'daily';
  const startLabel =
    selectedMode === 'quiz'   ? t(lang, 'startQuiz') :
    selectedMode === 'review' ? t(lang, 'modeReview') :
    selectedMode === 'exam'   ? t(lang, 'modeExam') :
    selectedMode === 'daily'  ? t(lang, 'modeDaily') :
    selectedMode === 'blitz'  ? t(lang, 'modeBlitz') :
    selectedMode === 'memory' ? t(lang, 'modeMemory') :
    selectedMode === 'match'  ? t(lang, 'modeMatch') :
                                t(lang, 'learnMode');

  const trackingClass = isRtl ? '' : 'tracking-[0.16em] uppercase';

  // overflow-x-clip, not hidden: hidden makes this root a scroll container, and the
  // start bar below then never sticks to the bottom of the screen.
  return (
    <div className="min-h-screen flex flex-col overflow-x-clip" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="relative">
        {/* Top bar: brand mark, menu chip and language, in flow so nothing overlaps on phones */}
        <div className="relative z-20 flex items-center justify-between gap-2 px-4 pt-4 max-w-2xl mx-auto w-full" dir="ltr">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-brand-gradient grid place-items-center shadow-glow shrink-0">
              <ShieldCheck className="w-[18px] h-[18px] text-[hsl(var(--primary-foreground))]" />
            </span>
            {/* Menu chip: opens the progress / records / settings screen, with the key numbers visible */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label={t(lang, 'menu')}
              className="glass relative rounded-2xl h-10 px-3 flex items-center gap-3 text-[hsl(var(--foreground))] transition-all active:scale-[0.97]"
            >
              <Menu className="w-[18px] h-[18px]" />
              <span className={cn('flex items-center gap-1 text-xs font-extrabold tabular-nums', streak > 0 ? 'text-orange-400' : 'text-[hsl(var(--muted-foreground))]')}>
                <Flame className={cn('w-4 h-4', streak > 0 && 'fill-orange-400/40')} />
                {streak}
              </span>
              <span className={cn('flex items-center gap-1 text-xs font-extrabold tabular-nums', missionsDone === missions.length && missions.length > 0 ? 'text-emerald-400' : 'text-[hsl(var(--brand-light))]')}>
                <ListChecks className="w-4 h-4" />
                {missionsDone}/{missions.length}
              </span>
              {streakWarning && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>

          <div className="glass rounded-2xl p-1 flex items-center gap-0.5">
            {(['en', 'sv', 'ar'] as Language[]).map(l => (
              <button
                key={l}
                onClick={() => onLangChange(l)}
                className={cn(
                  'px-2.5 h-8 rounded-xl text-xs font-bold transition-all',
                  lang === l
                    ? 'bg-brand-gradient text-[hsl(var(--primary-foreground))] shadow-md'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/10',
                )}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Title block */}
        <div className="relative z-10 text-center px-6 pt-4">
          {!compact && (
          <div className="rise-in inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass mb-3" style={{ '--rise-delay': '0.05s' } as CSSProperties}>
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--brand))] shadow-[0_0_10px_hsl(var(--brand))]" />
            <span className={cn('text-[11px] font-bold text-[hsl(var(--brand-light))]', trackingClass)}>
              {t(lang, 'appBadge')}
            </span>
          </div>
          )}

          {isRtl ? (
            <h1 className={cn('rise-in font-display font-extrabold leading-tight text-brand-gradient pb-3 -mb-3', compact ? 'text-3xl sm:text-4xl' : 'text-[clamp(2.1rem,calc((100vw_-_3rem)*0.134),3rem)] sm:text-6xl')} style={{ '--rise-delay': '0.12s' } as CSSProperties}>
              {t(lang, 'appTitle')}
            </h1>
          ) : (
            <h1 className="rise-in font-display leading-none" style={{ '--rise-delay': '0.12s' } as CSSProperties}>
              <span className={cn('block font-bold tracking-[0.42em] uppercase text-[hsl(var(--muted-foreground))]', compact ? 'text-[11px] mb-0.5' : 'text-[13px] sm:text-sm mb-1.5')}>
                Vägmärken
              </span>
              <span className={cn('block font-extrabold tracking-tight text-brand-gradient pb-1', compact ? 'text-[40px] sm:text-[60px]' : 'text-[54px] sm:text-[88px]')}>
                Quest
              </span>
            </h1>
          )}

          {!compact && (
          <p className="rise-in text-[15px] text-[hsl(var(--muted-foreground))] mt-2 max-w-xs mx-auto leading-relaxed" style={{ '--rise-delay': '0.2s' } as CSSProperties}>
            {t(lang, 'appSubtitle')}
          </p>
          )}
        </div>

        <RoadStage compact={compact} />

        {/* Stat chips overlap the road */}
        {!compact && (
        <div className="relative z-20 -mt-6 flex items-center justify-center gap-2 px-4">
          <div className="glass rounded-full px-3.5 py-1.5 text-xs font-bold text-[hsl(var(--foreground))]">{statLabel}</div>
          <div className="glass rounded-full px-3.5 py-1.5 text-xs font-bold text-[hsl(var(--foreground))]">{categoryCountLabel}</div>
        </div>
        )}
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 px-4 pt-7 pb-6 max-w-2xl mx-auto w-full space-y-7">
        {/* Mode selector */}
        <section className="rise-in" style={{ '--rise-delay': '0.16s' } as CSSProperties}>
          <SectionTitle>{t(lang, 'chooseMode')}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {/* Mistakes review only has a slot once there is something to review */}
            {MODES.filter(m => ['learn', 'exam', 'review', 'quiz'].includes(m.id) && (m.id !== 'review' || mistakeCount > 0)).map(m => {
              // Learn, the exam and the mistakes review have nothing to choose first: open straight away
              const opensDirectly = m.id !== 'quiz';
              return (
                <ModeCard
                  key={m.id}
                  wide
                  icon={m.icon}
                  hue={m.hue}
                  title={t(lang, m.labelKey)}
                  desc={t(lang, m.descKey)}
                  active={selectedMode === m.id}
                  pressed={opensDirectly ? undefined : selectedMode === m.id}
                  corner={opensDirectly ? <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))] rtl:rotate-180" /> : undefined}
                  badge={m.id === 'review' ? mistakeCount : undefined}
                  fillIcon={m.id === 'quiz'}
                  onClick={() => {
                    if (m.id === 'review') startReview();
                    else if (opensDirectly) onStartMode(m.id as 'learn' | 'exam', selectedCategory);
                    else setSelectedMode(m.id);
                  }}
                />
              );
            })}

            {/* The remaining games share one expandable card */}
            <ModeCard
              wide
              icon={Gamepad2}
              hue={GAMES_HUE}
              title={t(lang, 'modeGames')}
              desc={selectedGame ? t(lang, selectedGame.labelKey) : GAME_IDS.map(id => t(lang, modeOf(id).labelKey)).join(' · ')}
              active={!!selectedGame}
              expanded={gamesOpen}
              corner={gamesOpen
                ? <ChevronUp className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                : <ChevronDown className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />}
              onClick={() => setGamesOpen(open => !open)}
            />
            {gamesOpen && GAME_IDS.map((id, i) => {
              const m = modeOf(id);
              // Daily has an intro screen of its own and opens straight away
              const opensDirectly = id === 'daily';
              return (
                <ModeCard
                  key={id}
                  icon={m.icon}
                  hue={m.hue}
                  title={t(lang, m.labelKey)}
                  desc={t(lang, m.descKey)}
                  active={selectedMode === id}
                  pressed={opensDirectly ? undefined : selectedMode === id}
                  corner={opensDirectly ? <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))] rtl:rotate-180" /> : undefined}
                  className="rise-in"
                  style={{ '--rise-delay': `${i * 0.04}s` } as CSSProperties}
                  onClick={() => (opensDirectly ? onStartMode('daily', selectedCategory) : setSelectedMode(id))}
                />
              );
            })}
            <div ref={gamesEndRef} aria-hidden="true" className="col-span-2 h-0" style={{ scrollMarginBottom: START_BAR_CLEARANCE }} />
          </div>
        </section>

        {/* Search */}
        {selectedMode !== 'review' && selectedMode !== 'exam' && (
        <section className="rise-in" style={{ '--rise-delay': '0.22s' } as CSSProperties}>
          <div className="relative">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t(lang, 'searchPlaceholder')}
              className="glass w-full h-12 ps-11 pe-11 rounded-2xl text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--brand))]/70 focus:shadow-[0_0_0_3px_hsl(var(--brand)/0.18)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full grid place-items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/10 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {query && (
            <p className={cn(
              'text-xs mt-2 px-1 flex items-center gap-1.5',
              filteredSigns && filteredSigns.length > 0
                ? 'text-[hsl(var(--brand-light))]'
                : 'text-[hsl(var(--muted-foreground))]',
            )}>
              {filteredSigns && filteredSigns.length > 0 ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--brand))]" />
                  {lang === 'sv'
                    ? `${filteredSigns.length} märken matchar · quiz begränsas till dessa`
                    : lang === 'en'
                    ? `${filteredSigns.length} signs match · quiz will use only these`
                    : `${filteredSigns.length} إشارة مطابقة · المسابقة ستقتصر عليها`}
                </>
              ) : t(lang, 'searchNoResults')}
            </p>
          )}
        </section>
        )}

        {/* Difficulty — quiz only */}
        {selectedMode === 'quiz' && (
          <section className="rise-in" style={{ '--rise-delay': '0.05s' } as CSSProperties}>
            <SectionTitle>{t(lang, 'chooseDifficulty')}</SectionTitle>
            <div className="glass rounded-3xl p-1.5 grid grid-cols-3 gap-1.5">
              {difficulties.map(({ value, label, desc, locked }) => {
                const isSel = !locked && selectedDifficulty === value;
                const hue = DIFFICULTY_HUE[value];
                return (
                  <button
                    key={value}
                    onClick={() => handleDifficultyClick(value, locked)}
                    aria-pressed={isSel}
                    className={cn(
                      'rounded-2xl py-3 px-2 flex flex-col items-center gap-0.5 transition-all active:scale-[0.97]',
                      locked && 'cursor-not-allowed opacity-70',
                      locked && lockedBump && 'animate-shake',
                      !isSel && !locked && 'hover:bg-white/5',
                    )}
                    style={isSel ? {
                      background: `hsl(${hue} / 0.18)`,
                      boxShadow: `inset 0 0 0 1.5px hsl(${hue} / 0.85), 0 8px 22px -12px hsl(${hue} / 0.8)`,
                    } : undefined}
                  >
                    <span className="flex items-center gap-1 font-display text-sm font-bold text-[hsl(var(--foreground))]">
                      {locked && <Lock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />}
                      {label}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))] text-center leading-tight">
                      {locked ? t(lang, 'hardLocked') : desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Progress toward unlocking Hard */}
            {hardLocked && (
              <div className="glass rounded-2xl mt-3 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                    {t(lang, 'unlockProgress')}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-[hsl(var(--brand-light))]">{Math.round(mediumProgress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[hsl(var(--foreground))]/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-all duration-700"
                    style={{ width: `${mediumProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5 leading-tight">
                  {t(lang, 'hardLockedHint')}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Start CTA — sticks to the bottom while you configure */}
        <div className="sticky bottom-3 z-30 space-y-2 pt-1">
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={selectedMode === 'review' && mistakeCount === 0}
              className={cn(
                'flex-1 min-w-0 h-16 flex items-center justify-center gap-3 rounded-[22px] font-display font-bold text-lg bg-brand-gradient text-[hsl(var(--primary-foreground))] shadow-glow transition-all hover:brightness-110 active:scale-[0.98]',
                selectedMode === 'review' && mistakeCount === 0 && 'opacity-45 grayscale cursor-not-allowed hover:brightness-100 active:scale-100',
              )}
            >
              <activeMode.icon className={cn('w-5 h-5 shrink-0', selectedMode === 'quiz' && 'fill-current')} />
              <span className="truncate">{startLabel}</span>
            </button>

            {/* Current category; opens the picker */}
            {usesCategory && (
              <button
                onClick={() => setCategoryOpen(true)}
                aria-haspopup="dialog"
                aria-label={`${t(lang, 'categoryShort')}: ${CATEGORY_LABELS_I18N[lang][selectedCategory]}`}
                className="glass h-16 w-[104px] shrink-0 rounded-[22px] flex flex-col items-center justify-center gap-1 px-1.5 transition-all active:scale-[0.97]"
                style={selectedCategory !== 'all' ? { border: `1px solid hsl(${CATEGORY_HUE[selectedCategory]} / 0.8)` } : undefined}
              >
                <span className="w-7 h-7 rounded-lg grid place-items-center bg-white/90 shadow-sm">
                  <CategoryIcon category={selectedCategory} className="w-[18px] h-[18px] text-slate-700" />
                </span>
                <span className="flex items-center gap-0.5 max-w-full text-[11px] font-bold leading-none text-[hsl(var(--foreground))]">
                  <span className="truncate">{CATEGORY_LABELS_I18N[lang][selectedCategory]}</span>
                  <ChevronUp className="w-3 h-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                </span>
              </button>
            )}
          </div>

          {selectedMode === 'review' && (
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
              {mistakeCount > 0 ? t(lang, 'reviewCount', { n: mistakeCount }) : t(lang, 'reviewEmpty')}
            </p>
          )}
          {selectedMode === 'quiz' && (
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
              {query && filteredSigns && filteredSigns.length > 0
                ? (lang === 'sv'
                    ? `Quiz med ${filteredSigns.length} matchande märken`
                    : lang === 'en'
                    ? `Quiz with ${filteredSigns.length} matching signs`
                    : `مسابقة من ${filteredSigns.length} إشارة مطابقة`)
                : t(lang, 'questionsNote')}
            </p>
          )}
        </div>
      </main>

      <CategorySheet
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        lang={lang}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <MenuScreen
        open={menuOpen}
        onOpenChange={setMenuOpen}
        lang={lang}
        scores={scores}
        onClearScores={onClearScores}
        theme={theme}
        onToggleTheme={toggleTheme}
        muted={muted}
        onToggleMute={onToggleMute}
      />
    </div>
  );
}
