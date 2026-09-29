/**
 * Player progress beyond XP: lifetime stats, badges and daily missions.
 * Game modes only report events via `recordEvent()`; everything else
 * (missions, badges, XP rewards, toasts) is derived here.
 */
import { toast } from 'sonner';
import { Language } from '@/types/game';
import { displayStreak, getPlayer, grantXp, levelFromXp } from '@/lib/player';
import { recordMistake, resolveMistake } from '@/lib/mistakes';
import { recordConfusion, resolveConfusions } from '@/lib/confusions';
import { readLang } from '@/lib/prefs';

export type GameMode = 'quiz' | 'review' | 'daily' | 'blitz' | 'memory' | 'match' | 'exam' | 'reveal' | 'odd' | 'collection' | 'twins' | 'classify';

export type GameEvent =
  /** pickedId: the sign chosen instead (wrong answers); otherIds: the other options that were shown (right answers) */
  | { type: 'answer'; signId: string; correct: boolean; streak?: number; pickedId?: string; otherIds?: readonly string[] }
  | { type: 'game'; mode: GameMode; correct?: number; total?: number; maxStreak?: number; seconds?: number };

type L10n = Record<Language, string>;

/* ── Catalogs ────────────────────────────────────────────────────── */
interface MissionDef { id: string; target: number; xp: number; icon: string; text: L10n }

export const MISSIONS: MissionDef[] = [
  { id: 'correct15', target: 15, xp: 25, icon: '🎯', text: { en: 'Answer 15 signs correctly', sv: 'Svara rätt på 15 skyltar', ar: 'أجب صحيحًا عن 15 لافتة' } },
  { id: 'games3',    target: 3,  xp: 25, icon: '🎮', text: { en: 'Play 3 games', sv: 'Spela 3 spel', ar: 'العب 3 ألعاب' } },
  { id: 'streak5',   target: 5,  xp: 30, icon: '🔥', text: { en: 'Get 5 correct in a row', sv: 'Få 5 rätt i rad', ar: 'أجب 5 إجابات صحيحة متتالية' } },
  { id: 'daily',     target: 1,  xp: 30, icon: '📅', text: { en: 'Finish the Daily Challenge', sv: 'Klara den dagliga utmaningen', ar: 'أكمل التحدي اليومي' } },
  { id: 'match',     target: 1,  xp: 20, icon: '🧩', text: { en: 'Finish a Matching game', sv: 'Klara ett matchningsspel', ar: 'أنهِ لعبة المطابقة' } },
  { id: 'quiz80',    target: 1,  xp: 35, icon: '🏆', text: { en: 'Score 80%+ in a quiz', sv: 'Få minst 80 % i ett quiz', ar: 'حقق 80% أو أكثر في اختبار' } },
];

const ALL_DONE_BONUS = 40;
const CORE_MODES = ['quiz', 'daily', 'blitz', 'memory', 'match'];

interface BadgeCtx { stats: Stats; dayStreak: number; level: number }
export interface BadgeDef {
  id: string;
  icon: string;
  target: number;
  name: L10n;
  desc: L10n;
  value: (c: BadgeCtx) => number;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_game', icon: '🏁', target: 1, value: c => c.stats.games,
    name: { en: 'First lap', sv: 'Första varvet', ar: 'الجولة الأولى' },
    desc: { en: 'Finish any game', sv: 'Avsluta ett valfritt spel', ar: 'أنهِ أي لعبة' } },
  { id: 'streak5', icon: '🔥', target: 5, value: c => c.stats.bestStreak,
    name: { en: 'On a roll', sv: 'På gång', ar: 'في حالة ممتازة' },
    desc: { en: '5 correct answers in a row', sv: '5 rätt i rad', ar: '5 إجابات صحيحة متتالية' } },
  { id: 'streak10', icon: '⚡', target: 10, value: c => c.stats.bestStreak,
    name: { en: 'Unstoppable', sv: 'Ostoppbar', ar: 'لا يُوقَف' },
    desc: { en: '10 correct answers in a row', sv: '10 rätt i rad', ar: '10 إجابات صحيحة متتالية' } },
  { id: 'perfect_quiz', icon: '💯', target: 1, value: c => c.stats.perfectQuiz,
    name: { en: 'Perfect score', sv: 'Full pott', ar: 'العلامة الكاملة' },
    desc: { en: 'Get every question right in a quiz', sv: 'Svara rätt på allt i ett quiz', ar: 'أجب عن كل أسئلة اختبار بشكل صحيح' } },
  { id: 'explorer', icon: '🧭', target: 5, value: c => c.stats.modes.filter(m => CORE_MODES.includes(m)).length,
    name: { en: 'Explorer', sv: 'Upptäckare', ar: 'المستكشف' },
    desc: { en: 'Play Quiz, Daily, Blitz, Memory and Match', sv: 'Spela Quiz, Daglig, Blitz, Memory och Matcha', ar: 'العب الاختبار واليومي وبليتز والذاكرة والمطابقة' } },
  { id: 'speedster', icon: '⏱️', target: 1, value: c => (c.stats.bestMatchSeconds !== null && c.stats.bestMatchSeconds <= 40 ? 1 : 0),
    name: { en: 'Speed matcher', sv: 'Snabbmatchare', ar: 'سريع المطابقة' },
    desc: { en: 'Finish Matching in 40 seconds or less', sv: 'Klara Matcha på 40 sekunder', ar: 'أنهِ المطابقة في 40 ثانية أو أقل' } },
  { id: 'blitz_ace', icon: '🎯', target: 1, value: c => (c.stats.bestBlitzPct >= 80 ? 1 : 0),
    name: { en: 'Blitz ace', sv: 'Blitzess', ar: 'بطل بليتز' },
    desc: { en: 'Reach 80% accuracy in Blitz', sv: 'Nå 80 % rätt i Blitz', ar: 'حقق دقة 80% في بليتز' } },
  { id: 'scholar', icon: '🎓', target: 25, value: c => c.stats.solved.length,
    name: { en: 'Sign scholar', sv: 'Skyltkännare', ar: 'عالِم اللافتات' },
    desc: { en: 'Answer 25 different signs correctly', sv: 'Svara rätt på 25 olika skyltar', ar: 'أجب صحيحًا عن 25 لافتة مختلفة' } },
  { id: 'fixer', icon: '🛠️', target: 5, value: c => c.stats.fixed,
    name: { en: 'Mistake fixer', sv: 'Felrättare', ar: 'مصحّح الأخطاء' },
    desc: { en: 'Fully fix 5 signs you got wrong', sv: 'Rätta till 5 skyltar du missat', ar: 'أتقن 5 لافتات كنت تخطئ فيها' } },
  { id: 'exam_pass', icon: '📝', target: 1, value: c => c.stats.examPassed,
    name: { en: 'Exam ready', sv: 'Provklar', ar: 'جاهز للامتحان' },
    desc: { en: 'Pass a mock exam (80%+)', sv: 'Klara ett övningsprov (80 %+)', ar: 'انجح في امتحان تجريبي (80% فأكثر)' } },
  { id: 'day3', icon: '📅', target: 3, value: c => c.dayStreak,
    name: { en: '3-day streak', sv: '3 dagar i rad', ar: '3 أيام متتالية' },
    desc: { en: 'Play 3 days in a row', sv: 'Spela 3 dagar i rad', ar: 'العب 3 أيام متتالية' } },
  { id: 'day7', icon: '🗓️', target: 7, value: c => c.dayStreak,
    name: { en: 'Week warrior', sv: 'Veckokrigare', ar: 'بطل الأسبوع' },
    desc: { en: 'Play 7 days in a row', sv: 'Spela 7 dagar i rad', ar: 'العب 7 أيام متتالية' } },
  { id: 'level5', icon: '⭐', target: 5, value: c => c.level,
    name: { en: 'Level 5', sv: 'Nivå 5', ar: 'المستوى 5' },
    desc: { en: 'Reach level 5', sv: 'Nå nivå 5', ar: 'صِل إلى المستوى 5' } },
];

const UI: Record<string, L10n> = {
  badge: { en: 'New badge', sv: 'Ny bricka', ar: 'شارة جديدة' },
  mission: { en: 'Mission complete', sv: 'Uppdrag klart', ar: 'أنجزت مهمة' },
  allDone: { en: 'All missions done!', sv: 'Alla uppdrag klara!', ar: 'أنجزت كل مهام اليوم!' },
};

/* ── State ───────────────────────────────────────────────────────── */
interface Stats {
  games: number;
  correct: number;
  answered: number;
  bestStreak: number;
  modes: string[];
  solved: string[];
  fixed: number;
  perfectQuiz: number;
  bestMatchSeconds: number | null;
  bestBlitzPct: number;
  examPassed: number;
}

export interface MissionState { id: string; progress: number; done: boolean }

export interface ProgressState {
  stats: Stats;
  badges: Record<string, string>; // badge id -> unlock date (ISO)
  missionsDate: string;
  missions: MissionState[];
  allDoneAwarded: boolean;
}

const STORAGE_KEY = 'vq-progress';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Same three missions for a given date (step 2 mod 6 keeps them distinct). */
function pickMissions(date: string): MissionState[] {
  const h = hash(date) % MISSIONS.length;
  return [0, 2, 4].map(o => ({ id: MISSIONS[(h + o) % MISSIONS.length].id, progress: 0, done: false }));
}

const emptyStats = (): Stats => ({
  games: 0, correct: 0, answered: 0, bestStreak: 0, modes: [], solved: [], fixed: 0,
  perfectQuiz: 0, bestMatchSeconds: null, bestBlitzPct: 0, examPassed: 0,
});

function fresh(): ProgressState {
  const d = today();
  return { stats: emptyStats(), badges: {}, missionsDate: d, missions: pickMissions(d), allDoneAwarded: false };
}

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Partial<ProgressState>;
    const base = fresh();
    return {
      stats: { ...base.stats, ...(p.stats ?? {}) },
      badges: p.badges ?? {},
      missionsDate: p.missionsDate ?? base.missionsDate,
      missions: Array.isArray(p.missions) && p.missions.length ? p.missions : base.missions,
      allDoneAwarded: !!p.allDoneAwarded,
    };
  } catch {
    return fresh();
  }
}

let state: ProgressState = load();
const listeners = new Set<() => void>();

function commit(next: ProgressState): void {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
  listeners.forEach(l => l());
}

export const getProgress = () => state;

export function subscribeProgress(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Roll the missions over when the calendar day changed. */
export function refreshMissions(): void {
  const d = today();
  if (state.missionsDate === d) return;
  commit({ ...state, missionsDate: d, missions: pickMissions(d), allDoneAwarded: false });
}

export const missionDef = (id: string) => MISSIONS.find(m => m.id === id)!;

/* ── Events ──────────────────────────────────────────────────────── */
export function recordEvent(e: GameEvent): void {
  refreshMissions();

  const stats: Stats = { ...state.stats, modes: [...state.stats.modes], solved: [...state.stats.solved] };
  const missions: MissionState[] = state.missions.map(m => ({ ...m }));
  const bump = (id: string, next: (cur: number) => number) => {
    const m = missions.find(x => x.id === id);
    if (m && !m.done) m.progress = Math.min(missionDef(id).target, Math.max(0, next(m.progress)));
  };

  if (e.type === 'answer') {
    stats.answered += 1;
    if (e.correct) {
      stats.correct += 1;
      if (!stats.solved.includes(e.signId)) stats.solved.push(e.signId);
      if (resolveMistake(e.signId)) stats.fixed += 1;
      if (e.otherIds?.length) resolveConfusions(e.signId, e.otherIds);
      bump('correct15', c => c + 1);
      if (e.streak) {
        stats.bestStreak = Math.max(stats.bestStreak, e.streak);
        bump('streak5', c => Math.max(c, e.streak as number));
      }
    } else {
      recordMistake(e.signId);
      if (e.pickedId) recordConfusion(e.signId, e.pickedId);
    }
  } else {
    stats.games += 1;
    if (!stats.modes.includes(e.mode)) stats.modes.push(e.mode);
    bump('games3', c => c + 1);
    if (e.maxStreak) stats.bestStreak = Math.max(stats.bestStreak, e.maxStreak);

    const pct = e.total ? (e.correct ?? 0) / e.total : 0;
    if (e.mode === 'daily') bump('daily', c => c + 1);
    if (e.mode === 'match') {
      bump('match', c => c + 1);
      if (e.seconds !== undefined) {
        stats.bestMatchSeconds = stats.bestMatchSeconds === null ? e.seconds : Math.min(stats.bestMatchSeconds, e.seconds);
      }
    }
    if ((e.mode === 'quiz' || e.mode === 'review') && pct >= 0.8) bump('quiz80', c => c + 1);
    if (e.mode === 'quiz' && e.total && e.total >= 5 && e.correct === e.total) stats.perfectQuiz = 1;
    if (e.mode === 'exam' && e.total && e.total >= 10 && pct >= 0.8) stats.examPassed = 1;
    if (e.mode === 'blitz' && e.total && e.total >= 10) stats.bestBlitzPct = Math.max(stats.bestBlitzPct, Math.round(pct * 100));
  }

  commit({ ...state, stats, missions });
  settle();
}

/** After a state change: pay out finished missions, unlock badges, notify. */
function settle(): void {
  const lang = readLang();
  const missions = state.missions.map(m => ({ ...m }));
  const finished: MissionDef[] = [];
  for (const m of missions) {
    const def = missionDef(m.id);
    if (!m.done && m.progress >= def.target) {
      m.done = true;
      finished.push(def);
    }
  }

  const player = getPlayer();
  const ctx: BadgeCtx = { stats: state.stats, dayStreak: displayStreak(player), level: levelFromXp(player.xp).level };
  const badges = { ...state.badges };
  const unlocked: BadgeDef[] = [];
  for (const b of BADGES) {
    if (!badges[b.id] && b.value(ctx) >= b.target) {
      badges[b.id] = new Date().toISOString();
      unlocked.push(b);
    }
  }

  const allDone = missions.every(m => m.done);
  const payAllDone = allDone && !state.allDoneAwarded;

  if (!finished.length && !unlocked.length && !payAllDone) return;
  commit({ ...state, missions, badges, allDoneAwarded: state.allDoneAwarded || payAllDone });

  finished.forEach(def => {
    grantXp(def.xp);
    toast.success(`${def.icon} ${UI.mission[lang]}`, { description: `${def.text[lang]} · +${def.xp} XP` });
  });
  if (payAllDone) {
    grantXp(ALL_DONE_BONUS);
    toast.success(`🎉 ${UI.allDone[lang]}`, { description: `+${ALL_DONE_BONUS} XP` });
  }
  unlocked.forEach(b => {
    toast(`${b.icon} ${UI.badge[lang]}: ${b.name[lang]}`, { description: b.desc[lang] });
  });

  // XP payouts can cross a level threshold, which may unlock further badges.
  if (finished.length || payAllDone) settle();
}

/** Value/target for a badge, used for the locked-badge progress hint. */
export function badgeProgress(b: BadgeDef, p: ProgressState): number {
  const player = getPlayer();
  const v = b.value({ stats: p.stats, dayStreak: displayStreak(player), level: levelFromXp(player.xp).level });
  return Math.min(b.target, v);
}
