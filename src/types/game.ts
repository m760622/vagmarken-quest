export type SignCategory = 'warning' | 'prohibition' | 'mandatory' | 'priority' | 'information';
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
