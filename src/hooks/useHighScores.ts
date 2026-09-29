import { useState, useCallback } from 'react';
import { HighScore, SignCategory } from '@/types/game';

const STORAGE_KEY = 'vagmarken_highscores';
const MAX_SCORES = 10;

function loadScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HighScore[];
  } catch {
    return [];
  }
}

function saveScores(scores: HighScore[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // ignore
  }
}

export function useHighScores() {
  const [scores, setScores] = useState<HighScore[]>(loadScores);

  const addScore = useCallback((
    score: number,
    correct: number,
    total: number,
    category: SignCategory | 'all',
    difficulty: 'easy' | 'medium' | 'hard',
  ) => {
    const entry: HighScore = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      score,
      correct,
      total,
      category,
      difficulty,
      date: new Date().toISOString(),
    };

    setScores(prev => {
      const updated = [...prev, entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SCORES);
      saveScores(updated);
      return updated;
    });
  }, []);

  const clearScores = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setScores([]);
  }, []);

  return { scores, addScore, clearScores };
}
