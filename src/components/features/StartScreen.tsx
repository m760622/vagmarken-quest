import { useState, type CSSProperties, type ReactNode } from 'react';
import { SignCategory, Language, HighScore, TrafficSign } from '@/types/game';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import HighScorePanel from './HighScorePanel';
import PlayerCard from './PlayerCard';
import BadgesPanel from './BadgesPanel';
import SignDisplay from './SignDisplay';
import {
  Play, Languages, Puzzle, Layers, Lock, Zap, Brain, Calendar, Search, X, Sun, Moon,
  ShieldCheck, LayoutGrid, Check, History, ClipboardCheck, type LucideIcon,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { UNLOCK_THRESHOLD } from '@/hooks/useProgression';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { useMistakes } from '@/hooks/useProgress';
import { usePlayer } from '@/hooks/usePlayer';

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
}

/* ── Accent colours (HSL triples so they can take an alpha) ───────── */
const CATEGORY_HUE: Record<SignCategory | 'all', string> = {
  all: 'var(--brand)',
  warning: '38 95% 56%',
  prohibition: '0 84% 62%',
  mandatory: '217 91% 64%',
  priority: '48 96% 55%',
  information: '199 92% 58%',
  additional: '250 70% 72%',
};

const MODES: { id: GameMode; icon: LucideIcon; labelKey: string; descKey: string; hue: string }[] = [
  { id: 'quiz',   icon: Play,     labelKey: 'modeQuiz',   descKey: 'modeQuizDesc',   hue: 'var(--brand)' },
  { id: 'exam',   icon: ClipboardCheck, labelKey: 'modeExam', descKey: 'modeExamDesc', hue: '84 78% 55%' },
  { id: 'daily',  icon: Calendar, labelKey: 'modeDaily',  descKey: 'modeDailyDesc',  hue: '32 96% 58%' },
  { id: 'blitz',  icon: Zap,      labelKey: 'modeBlitz',  descKey: 'modeBlitzDesc',  hue: '52 98% 56%' },
  { id: 'memory', icon: Brain,    labelKey: 'modeMemory', descKey: 'modeMemoryDesc', hue: '266 90% 70%' },
  { id: 'match',  icon: Puzzle,   labelKey: 'modeMatch',  descKey: 'modeMatchDesc',  hue: '330 88% 66%' },
  { id: 'learn',  icon: Layers,   labelKey: 'modeLearn',  descKey: 'modeLearnDesc',  hue: '199 92% 58%' },
  { id: 'review', icon: History,  labelKey: 'modeReview', descKey: 'modeReviewDesc', hue: '350 89% 64%' },
];

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

/* ── Category icon: the actual shape/colour of that sign family ───── */
function CategoryIcon({ category, className }: { category: SignCategory | 'all'; className?: string }) {
  const common = { viewBox: '0 0 24 24', className, 'aria-hidden': true } as const;
  switch (category) {
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 3.2 21.4 19.8H2.6Z" fill="#fff" stroke="#E11D48" strokeWidth="2.6" strokeLinejoin="round" />
          <rect x="11.1" y="9" width="1.8" height="5.4" rx=".9" fill="#111827" />
          <circle cx="12" cy="16.6" r="1.1" fill="#111827" />
        </svg>
      );
    case 'prohibition':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" fill="#fff" stroke="#E11D48" strokeWidth="3" />
          <path d="M6.6 17.4 17.4 6.6" stroke="#E11D48" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'mandatory':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#1D4ED8" />
          <path d="M12 17V8m0 0-3.6 3.6M12 8l3.6 3.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'priority':
      return (
        <svg {...common}>
          <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="2.2" transform="rotate(45 12 12)" fill="#fff" stroke="#111827" strokeWidth="1.2" />
          <rect x="7.4" y="7.4" width="9.2" height="9.2" rx="1.4" transform="rotate(45 12 12)" fill="#FBBF24" />
        </svg>
      );
    case 'additional':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="10" rx="2" fill="#fff" stroke="#111827" strokeWidth="1.6" />
          <rect x="6.5" y="11" width="11" height="2" rx="1" fill="#111827" />
        </svg>
      );
    case 'information':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#1D4ED8" />
          <rect x="11.1" y="10.6" width="1.8" height="6" rx=".9" fill="#fff" />
          <circle cx="12" cy="7.9" r="1.2" fill="#fff" />
        </svg>
      );
    default:
      return <LayoutGrid className={className} />;
  }
}

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

export default function StartScreen({
  onStart, onStartMode, scores, onClearScores, lang, onLangChange, progression,
}: StartScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<SignCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [selectedMode, setSelectedMode] = useState<GameMode>('quiz');
  const [lockedBump, setLockedBump] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
  const { player } = usePlayer();
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

  const categories = (Object.keys(CATEGORY_HUE) as Array<SignCategory | 'all'>).map(value => ({
    value,
    label: CATEGORY_LABELS_I18N[lang][value],
  }));

  const statLabel =
    lang === 'ar' ? `${TRAFFIC_SIGNS.length} إشارة` :
    lang === 'sv' ? `${TRAFFIC_SIGNS.length} skyltar` :
    `${TRAFFIC_SIGNS.length} Signs`;

  const categoryCountLabel =
    lang === 'ar' ? '٥ فئات' :
    lang === 'sv' ? '5 kategorier' :
    '5 Categories';

  const handleDifficultyClick = (value: Difficulty, locked: boolean) => {
    if (locked) {
      setLockedBump(true);
      setTimeout(() => setLockedBump(false), 500);
      return;
    }
    setSelectedDifficulty(value);
  };

  const handleStart = () => {
    if (selectedMode === 'review') {
      if (mistakeCount === 0) return;
      const diff = (hardLocked && selectedDifficulty === 'hard') ? 'medium' : selectedDifficulty;
      onStart('all', diff, TRAFFIC_SIGNS.filter(sg => mistakeIds.includes(sg.id)), { review: true });
    } else if (selectedMode === 'quiz') {
      const diff = (hardLocked && selectedDifficulty === 'hard') ? 'medium' : selectedDifficulty;
      const pool = filteredSigns ?? undefined;
      onStart(selectedCategory, diff, pool);
    } else {
      onStartMode(selectedMode as Exclude<GameMode, 'quiz' | 'review'>, selectedCategory);
    }
  };

  const activeMode = MODES.find(m => m.id === selectedMode) ?? MODES[0];
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

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="relative">
        {/* Top bar: brand mark + controls, in flow so nothing overlaps on phones */}
        <div className="relative z-20 flex items-center justify-between gap-3 px-4 pt-4 max-w-2xl mx-auto w-full" dir="ltr">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-gradient grid place-items-center shadow-glow">
              <ShieldCheck className="w-[18px] h-[18px] text-[hsl(var(--primary-foreground))]" />
            </span>
            <span className="font-display text-sm font-bold text-[hsl(var(--foreground))] hidden min-[380px]:block">
              Vägmärken
            </span>
          </div>

          <div className="glass rounded-2xl p-1 flex items-center gap-0.5">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/10 transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <span className="w-px h-5 bg-[hsl(var(--foreground))]/15 mx-0.5" />
            <Languages className="w-3.5 h-3.5 mx-1 text-[hsl(var(--muted-foreground))]" />
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
            <h1 className={cn('rise-in font-display font-extrabold leading-tight text-brand-gradient', compact ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl')} style={{ '--rise-delay': '0.12s' } as CSSProperties}>
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
        <div className="rise-in" style={{ '--rise-delay': '0.1s' } as CSSProperties}>
          <PlayerCard lang={lang} />
        </div>

        {/* Mode selector */}
        <section className="rise-in" style={{ '--rise-delay': '0.16s' } as CSSProperties}>
          <SectionTitle>{t(lang, 'chooseMode')}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {MODES.map(m => {
              const isActive = selectedMode === m.id;
              const Icon = m.icon;
              const isQuiz = m.id === 'quiz';
              const isWide = isQuiz || m.id === 'exam';
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  aria-pressed={isActive}
                  className={cn(
                    'relative overflow-hidden text-start rounded-3xl transition-all duration-200 active:scale-[0.98]',
                    isWide ? 'col-span-2 p-4 flex items-center gap-4' : 'p-3.5 flex flex-col gap-3',
                    !isActive && 'glass hover:-translate-y-0.5',
                  )}
                  style={isActive ? {
                    background: `linear-gradient(135deg, hsl(${m.hue} / 0.24), hsl(var(--accent-2) / 0.12))`,
                    border: `1px solid hsl(${m.hue} / 0.75)`,
                    boxShadow: `0 12px 34px -12px hsl(${m.hue} / 0.6)`,
                    WebkitBackdropFilter: 'blur(16px)',
                    backdropFilter: 'blur(16px)',
                  } : undefined}
                >
                  <span
                    className={cn('grid place-items-center rounded-2xl shrink-0', isWide ? 'w-14 h-14' : 'w-11 h-11')}
                    style={{
                      background: `linear-gradient(135deg, hsl(${m.hue}), hsl(${m.hue} / 0.62))`,
                      boxShadow: `0 8px 20px -6px hsl(${m.hue} / 0.7)`,
                    }}
                  >
                    <Icon className={cn('text-[hsl(var(--primary-foreground))]', isWide ? 'w-6 h-6' : 'w-5 h-5', isQuiz && 'fill-current')} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('flex items-center gap-1.5 font-display font-bold text-[hsl(var(--foreground))] leading-tight', isWide ? 'text-lg' : 'text-[15px]')}>
                      {t(lang, m.labelKey)}
                      {m.id === 'review' && mistakeCount > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-extrabold tabular-nums">{mistakeCount}</span>
                      )}
                    </span>
                    <span className="block text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-snug">
                      {t(lang, m.descKey)}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      className="absolute top-3 end-3 w-5 h-5 rounded-full grid place-items-center"
                      style={{ background: `hsl(${m.hue})` }}
                    >
                      <Check className="w-3 h-3 text-[hsl(var(--primary-foreground))]" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              );
            })}
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

        {/* Category */}
        {selectedMode !== 'review' && selectedMode !== 'exam' && (
        <section className="rise-in" style={{ '--rise-delay': '0.28s' } as CSSProperties}>
          <SectionTitle>{t(lang, 'chooseCategory')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {categories.map(({ value, label }) => {
              const isSelected = selectedCategory === value;
              const hue = CATEGORY_HUE[value];
              return (
                <button
                  key={value}
                  onClick={() => setSelectedCategory(value)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex items-center gap-2.5 ps-2.5 pe-3 min-h-12 py-1.5 rounded-2xl text-start transition-all duration-200 active:scale-[0.97]',
                    !isSelected && 'glass hover:-translate-y-0.5',
                  )}
                  style={isSelected ? {
                    background: `hsl(${hue} / 0.16)`,
                    border: `1px solid hsl(${hue} / 0.8)`,
                    boxShadow: `0 10px 26px -12px hsl(${hue} / 0.7)`,
                  } : undefined}
                >
                  <span className="w-8 h-8 rounded-xl grid place-items-center bg-white/90 shadow-sm">
                    <CategoryIcon category={value} className="w-[22px] h-[22px] text-slate-700" />
                  </span>
                  <span className={cn(
                    'text-[13px] font-semibold leading-tight',
                    isSelected ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
                  )}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        )}

        {/* Difficulty — quiz and review */}
        {(selectedMode === 'quiz' || selectedMode === 'review') && (
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

        {/* Records: best scores + badges */}
        <section className="space-y-3">
          <HighScorePanel scores={scores} onClear={onClearScores} lang={lang} />
          <BadgesPanel lang={lang} />
        </section>

        {/* Start CTA — sticks to the bottom while you configure */}
        <div className="sticky bottom-3 z-30 space-y-2 pt-1">
          <button
            onClick={handleStart}
            disabled={selectedMode === 'review' && mistakeCount === 0}
            className={cn(
              'w-full h-16 flex items-center justify-center gap-3 rounded-[22px] font-display font-bold text-lg bg-brand-gradient text-[hsl(var(--primary-foreground))] shadow-glow transition-all hover:brightness-110 active:scale-[0.98]',
              selectedMode === 'review' && mistakeCount === 0 && 'opacity-45 grayscale cursor-not-allowed hover:brightness-100 active:scale-100',
            )}
          >
            <activeMode.icon className={cn('w-5 h-5', selectedMode === 'quiz' && 'fill-current')} />
            {startLabel}
          </button>

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
    </div>
  );
}
