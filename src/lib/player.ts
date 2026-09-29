/**
 * Player profile: XP, level, rank and the day streak.
 * A tiny external store (localStorage-backed) so any game mode can call
 * `awardXp()` and every screen stays in sync via `usePlayer()`.
 */
import { Language } from '@/types/game';

const STORAGE_KEY = 'vq-player';
const FIRST_GAME_OF_DAY_BONUS = 20;

export interface PlayerState {
  xp: number;
  dayStreak: number;
  lastPlayed: string | null; // local date, YYYY-MM-DD
  gamesPlayed: number;
}

export interface Rank {
  minLevel: number;
  icon: string;
  names: Record<Language, string>;
}

export const RANKS: Rank[] = [
  { minLevel: 1,  icon: '🚶', names: { en: 'Pedestrian',   sv: 'Fotgängare',      ar: 'مشاة' } },
  { minLevel: 3,  icon: '🚲', names: { en: 'Cyclist',      sv: 'Cyklist',         ar: 'راكب دراجة' } },
  { minLevel: 5,  icon: '🛵', names: { en: 'Moped rider',  sv: 'Mopedist',        ar: 'سائق موبيد' } },
  { minLevel: 8,  icon: '🚗', names: { en: 'Driver',       sv: 'Bilförare',       ar: 'سائق' } },
  { minLevel: 12, icon: '🚚', names: { en: 'Trucker',      sv: 'Lastbilschaufför', ar: 'سائق شاحنة' } },
  { minLevel: 17, icon: '🏁', names: { en: 'Road pro',     sv: 'Trafikproffs',    ar: 'محترف الطرق' } },
  { minLevel: 23, icon: '👑', names: { en: 'Road master',  sv: 'Trafikmästare',   ar: 'سيّد الطريق' } },
  { minLevel: 30, icon: '🏆', names: { en: 'Legend',       sv: 'Legend',          ar: 'أسطورة' } },
];

/** XP needed to climb from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number; pct: number } {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  const needed = xpForLevel(level);
  return { level, into: remaining, needed, pct: Math.round((remaining / needed) * 100) };
}

export function rankFor(level: number): Rank {
  let best = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) best = r;
  return best;
}

/* ── Date helpers (local time, so "today" matches the player's day) ── */
function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const todayKey = () => dateKey(new Date());
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

/* ── Store ───────────────────────────────────────────────────────── */
const EMPTY: PlayerState = { xp: 0, dayStreak: 0, lastPlayed: null, gamesPlayed: 0 };

function load(): PlayerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<PlayerState>;
    return {
      xp: Number.isFinite(p.xp) ? Math.max(0, p.xp as number) : 0,
      dayStreak: Number.isFinite(p.dayStreak) ? Math.max(0, p.dayStreak as number) : 0,
      lastPlayed: typeof p.lastPlayed === 'string' ? p.lastPlayed : null,
      gamesPlayed: Number.isFinite(p.gamesPlayed) ? Math.max(0, p.gamesPlayed as number) : 0,
    };
  } catch {
    return EMPTY;
  }
}

let state: PlayerState = load();
const listeners = new Set<() => void>();
const levelUpListeners = new Set<(level: number, rankChanged: boolean) => void>();

export const getPlayer = () => state;

export function subscribePlayer(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function onLevelUp(cb: (level: number, rankChanged: boolean) => void): () => void {
  levelUpListeners.add(cb);
  return () => { levelUpListeners.delete(cb); };
}

/** True when the streak is alive but today's game has not been played yet. */
export function streakAtRisk(p: PlayerState): boolean {
  return p.dayStreak > 0 && p.lastPlayed !== todayKey();
}

/** Streak as it should be displayed today (broken streaks read as 0). */
export function displayStreak(p: PlayerState): number {
  if (!p.lastPlayed) return 0;
  return p.lastPlayed === todayKey() || p.lastPlayed === yesterdayKey() ? p.dayStreak : 0;
}

function commit(next: PlayerState): void {
  const before = levelFromXp(state.xp).level;
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — keep in-memory state */
  }
  listeners.forEach(l => l());

  const after = levelFromXp(next.xp).level;
  if (after > before) {
    const rankChanged = rankFor(after).minLevel !== rankFor(before).minLevel;
    levelUpListeners.forEach(l => l(after, rankChanged));
  }
}

/**
 * Add XP after a finished game. Also advances the day streak and fires the
 * level-up event when a threshold is crossed.
 */
export function awardXp(amount: number): { gained: number; bonus: number; level: number; leveledUp: boolean } {
  const base = Math.max(0, Math.round(amount));
  const today = todayKey();
  const firstToday = state.lastPlayed !== today;

  let streak = state.dayStreak;
  if (firstToday) streak = state.lastPlayed === yesterdayKey() ? streak + 1 : 1;

  const bonus = firstToday ? FIRST_GAME_OF_DAY_BONUS : 0;
  const gained = base + bonus;
  const before = levelFromXp(state.xp).level;

  commit({
    xp: state.xp + gained,
    dayStreak: streak,
    lastPlayed: today,
    gamesPlayed: state.gamesPlayed + 1,
  });

  const after = levelFromXp(state.xp).level;
  return { gained, bonus, level: after, leveledUp: after > before };
}

/** Bonus XP (missions etc.) — does not count as a game or touch the day streak. */
export function grantXp(amount: number): void {
  const gained = Math.max(0, Math.round(amount));
  if (gained === 0) return;
  commit({ ...state, xp: state.xp + gained });
}
