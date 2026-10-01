export type SignCategory = 'warning' | 'prohibition' | 'mandatory' | 'priority' | 'information' | 'additional';
export type Language = 'sv' | 'ar' | 'en';

export interface TrafficSign {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  nameAr: string;
  category: SignCategory;
  shape: 'triangle' | 'circle' | 'square' | 'octagon' | 'diamond';
  color: 'red' | 'blue' | 'white' | 'yellow' | 'green';
  symbol: string;
  imageUrl?: string;  // Official PNG from Transportstyrelsen GlobalAssets
  /**
   * true = the texts are entered but the official image is still missing. Such a sign has no
   * imageUrl and no PNG, and is left out of every screen, game and count (see src/lib/signList.ts)
   * until the image is added and this flag is removed.
   */
  placeholder?: boolean;
  description: string;
  descriptionAr: string;
  descriptionEn?: string;
}

export interface Question {
  sign: TrafficSign;
  options: TrafficSign[];
  correctId: string;
}

export interface GameState {
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  streak: number;
  maxStreak: number;
  answers: AnswerRecord[];
  phase: 'start' | 'playing' | 'result';
  selectedCategory: SignCategory | 'all';
  difficulty: 'easy' | 'medium' | 'hard';
  lifelines: number; // remaining 50/50 lifelines
}

export interface AnswerRecord {
  questionIndex: number;
  signId: string;
  chosenId: string;
  correct: boolean;
  timeMs: number;
}

export interface HighScore {
  id: string;
  score: number;
  correct: number;
  total: number;
  category: SignCategory | 'all';
  difficulty: 'easy' | 'medium' | 'hard';
  date: string; // ISO string
}
