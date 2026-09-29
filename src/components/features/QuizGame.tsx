import { useGame, streakBonus, LIFELINES_PER_GAME, TIMER_SECONDS } from '@/hooks/useGame';
import { useHighScores } from '@/hooks/useHighScores';
import { useProgression } from '@/hooks/useProgression';
import { useMute } from '@/hooks/useMute';
import { useLang } from '@/hooks/useLang';
import { useState } from 'react';
import StartScreen from './StartScreen';
import ResultScreen from './ResultScreen';
import MatchingGame from './MatchingGame';
import LearnMode from './LearnMode';
import BlitzGame from './BlitzGame';
import MemoryGame from './MemoryGame';
import DailyChallenge from './DailyChallenge';
import ExamGame from './ExamGame';
import ScoreBar from './ScoreBar';
import SignDisplay from './SignDisplay';
import AnswerOptions from './AnswerOptions';
import ExplanationCard from './ExplanationCard';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import { SignCategory } from '@/types/game';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { getMistakes } from '@/lib/mistakes';
import { cn } from '@/lib/utils';
import AnswerName from './AnswerName';

const ARC_SIZE      = 64;
const RADIUS        = 27;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function TimerArc({ timeLeft, total }: { timeLeft: number; total: number }) {
  const fraction = Math.max(0, timeLeft / total);
  const offset   = CIRCUMFERENCE * (1 - fraction);
  const isUrgent = timeLeft <= 3;
  const c = ARC_SIZE / 2;

  return (
    <div
      className={cn('relative grid place-items-center rounded-full bg-[hsl(var(--card))]', isUrgent && 'animate-pulse')}
      style={{
        width: ARC_SIZE,
        height: ARC_SIZE,
        boxShadow: isUrgent
          ? '0 0 26px hsl(0 84% 60% / 0.6)'
          : '0 10px 24px -8px hsl(var(--brand) / 0.55)',
      }}
    >
      <svg className="absolute inset-0" width={ARC_SIZE} height={ARC_SIZE} viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}>
        <circle cx={c} cy={c} r={RADIUS} fill="none" stroke="hsl(var(--option-border))" strokeWidth="5" />
        <circle
          cx={c} cy={c} r={RADIUS}
          fill="none"
          stroke={isUrgent ? 'hsl(0 84% 60%)' : 'hsl(var(--brand))'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={cn(
        'relative font-display text-xl font-extrabold tabular-nums transition-colors',
        isUrgent ? 'text-red-400' : 'text-[hsl(var(--foreground))]',
        timeLeft === 0 && 'opacity-50',
      )}>
        {timeLeft}
      </span>
    </div>
  );
}

type GameMode = 'quiz' | 'match' | 'learn' | 'blitz' | 'memory' | 'daily' | 'exam';

export default function QuizGame() {
  const { muted, toggleMute } = useMute();
  const { lang, setLang } = useLang();
  const {
    state, currentQuestion, selectedAnswer, showFeedback, timeLeft, eliminated,
    startGame, answerQuestion, fiftyFifty, resetGame,
  } = useGame(muted);

  const { scores, addScore, clearScores } = useHighScores();
  const { progression, recordMediumResult, justUnlocked, clearJustUnlocked } = useProgression();

  const [mode, setMode]                   = useState<GameMode>('quiz');
  const [activeCategory, setActiveCategory] = useState<SignCategory | 'all'>('all');
  const [reviewRun, setReviewRun] = useState(false); // current quiz is a mistakes review

  if (mode === 'daily') {
    return <DailyChallenge lang={lang} onHome={() => setMode('quiz')} />;
  }
  if (mode === 'exam') {
    return <ExamGame lang={lang} onHome={() => setMode('quiz')} />;
  }
  if (mode === 'blitz') {
    return <BlitzGame lang={lang} category={activeCategory} onHome={() => setMode('quiz')} muted={muted} onToggleMute={toggleMute} />;
  }
  if (mode === 'memory') {
    return <MemoryGame lang={lang} category={activeCategory} onHome={() => setMode('quiz')} muted={muted} onToggleMute={toggleMute} />;
  }
  if (mode === 'match') {
    return <MatchingGame lang={lang} category={activeCategory} onHome={() => setMode('quiz')} muted={muted} />;
  }
  if (mode === 'learn') {
    return <LearnMode lang={lang} category={activeCategory} onHome={() => setMode('quiz')} />;
  }

  if (state.phase === 'start') {
    return (
      <StartScreen
        onStart={(category, difficulty, signPool, options) => {
          setActiveCategory(category);
          setReviewRun(!!options?.review);
          startGame(category, difficulty, signPool);
        }}
        onStartMode={(m, category) => {
          setActiveCategory(category);
          setMode(m as GameMode);
        }}
        scores={scores}
        onClearScores={clearScores}
        lang={lang}
        onLangChange={setLang}
        progression={progression}
      />
    );
  }

  if (state.phase === 'result') {
    return (
      <ResultScreen
        state={state}
        lang={lang}
        onPlayAgain={() => {
          if (reviewRun) {
            // Re-pull the current list: fixed signs drop out, new mistakes join
            const ids = getMistakes();
            const pool = TRAFFIC_SIGNS.filter(sg => sg.id in ids);
            if (pool.length > 0) { startGame('all', state.difficulty, pool); return; }
            setReviewRun(false);
          }
          startGame(state.selectedCategory, state.difficulty);
        }}
        onHome={resetGame}
        isReview={reviewRun}
        // Review runs are practice: they don't post scores or count toward unlocking Hard
        onSaveScore={reviewRun ? () => undefined : addScore}
        onRecordMedium={reviewRun ? undefined : recordMediumResult}
        justUnlocked={justUnlocked}
        onDismissUnlock={clearJustUnlocked}
      />
    );
  }

  if (!currentQuestion) return null;

  const timedOut  = showFeedback && selectedAnswer === null;
  const isCorrect = showFeedback && selectedAnswer === currentQuestion.correctId;
  const isWrong   = showFeedback && selectedAnswer !== null && selectedAnswer !== currentQuestion.correctId;
  const isRtl     = lang === 'ar';

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={resetGame}
            className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-3 py-1.5 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]"
          >
            {t(lang, 'exit')}
          </button>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] text-[hsl(var(--muted-foreground))]">
            {reviewRun ? t(lang, 'modeReview') : CATEGORY_LABELS_I18N[lang][state.selectedCategory]}
          </span>
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center hover:border-[hsl(var(--option-hover-border))] transition-colors text-sm"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <ScoreBar
          score={state.score}
          streak={state.streak}
          currentQuestion={state.currentQuestion}
          totalQuestions={state.totalQuestions}
          correctCount={state.answers.filter(a => a.correct).length}
          answeredCount={state.answers.length}
        />
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center px-4 pb-8 max-w-2xl mx-auto w-full">
        <div className={cn(
          'flex flex-col items-center justify-center py-4 w-full transition-all duration-300',
          showFeedback && isCorrect && 'scale-[1.02]',
        )}>
          {/* Sign card with corner timer */}
          <div className="relative inline-flex items-center justify-center mb-5 mt-2">
            {/* Ambient glow reacts to the answer */}
            <div
              className="absolute -inset-6 rounded-full blur-3xl transition-all duration-500 pointer-events-none"
              style={{
                opacity: showFeedback ? 0.75 : 0.5,
                background: showFeedback
                  ? (isCorrect
                      ? 'radial-gradient(closest-side, hsl(152 70% 50% / 0.55), transparent)'
                      : timedOut
                      ? 'radial-gradient(closest-side, hsl(28 95% 55% / 0.5), transparent)'
                      : 'radial-gradient(closest-side, hsl(0 84% 60% / 0.5), transparent)')
                  : 'radial-gradient(closest-side, hsl(var(--brand) / 0.4), hsl(var(--accent-2) / 0.16) 65%, transparent)',
              }}
            />
            <div className={cn(
              'relative z-10 p-6 rounded-[32px] border-2 transition-all duration-300',
              !showFeedback && 'glass',
              showFeedback && isCorrect && 'border-emerald-400/70 bg-emerald-500/15',
              showFeedback && isWrong   && 'border-red-400/60 bg-red-500/10 animate-shake',
              timedOut                  && 'border-orange-400/60 bg-orange-500/10',
            )}>
              <SignDisplay sign={currentQuestion.sign} size="lg" />
            </div>
            <div className="absolute -top-4 -end-4 z-20">
              <TimerArc timeLeft={timeLeft} total={TIMER_SECONDS} />
            </div>
            {/* Streak combo pop */}
            {isCorrect && state.streak >= 3 && (
              <div key={state.streak} className="combo-float absolute -top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-display font-extrabold text-sm shadow-lg shadow-orange-500/40">
                  🔥 ×{state.streak}
                  <span className="opacity-90">+{streakBonus(state.streak)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Feedback message */}
          {showFeedback && (
            <div className={cn(
              'mt-2 px-4 py-2 rounded-full text-sm font-bold',
              isCorrect ? 'text-emerald-400 bg-emerald-500/10'
              : timedOut ? 'text-orange-400 bg-orange-500/10'
              : 'text-red-400 bg-red-500/10',
            )}>
              {isCorrect
                ? t(lang, 'correctAnswer')
                : <>{timedOut && `${t(lang, 'timeUp')} `}{t(lang, 'wrongAnswer')} <AnswerName sign={currentQuestion.sign} lang={lang} /></>}
            </div>
          )}

          {/* Explanation card */}
          {showFeedback && (
            <ExplanationCard
              sign={currentQuestion.sign}
              isCorrect={isCorrect}
              timedOut={timedOut}
              lang={lang}
            />
          )}
        </div>

        <p className="font-display text-lg font-bold text-[hsl(var(--foreground))] text-center mb-3 mt-1">
          {t(lang, 'question')}
        </p>

        {/* 50/50 lifeline */}
        {(() => {
          const canUse = !showFeedback && state.lifelines > 0 && eliminated.length === 0;
          return (
            <button
              onClick={fiftyFifty}
              disabled={!canUse}
              className={cn(
                'glass mb-4 inline-flex items-center gap-2.5 rounded-full ps-4 pe-3 py-2 transition-all',
                canUse ? 'hover:-translate-y-0.5 active:scale-95 shadow-glow' : 'opacity-40 cursor-not-allowed',
              )}
              aria-label={t(lang, 'lifeline')}
            >
              <span className="font-display font-extrabold text-sm text-[hsl(var(--brand-light))]">{t(lang, 'lifeline')}</span>
              <span className="flex gap-1">
                {Array.from({ length: LIFELINES_PER_GAME }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      i < state.lifelines ? 'bg-[hsl(var(--brand))] shadow-[0_0_8px_hsl(var(--brand))]' : 'bg-[hsl(var(--foreground))]/15',
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })()}

        <AnswerOptions
          options={currentQuestion.options}
          correctId={currentQuestion.correctId}
          selectedId={selectedAnswer}
          showFeedback={showFeedback}
          onSelect={answerQuestion}
          lang={lang}
          hiddenIds={eliminated}
        />
      </div>
    </div>
  );
}
