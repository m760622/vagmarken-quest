/**
 * CLASSIFY — صنّفها / Sortera
 * A sign is shown; pick its category (warning, prohibition, mandatory, information, priority, plate).
 * The categories take turns, so the small ones come up as often as the big ones. After each answer
 * the game shows how reliably this shape and colour points to that category, counted over the signs
 * in the app; that is the rule of thumb that helps with a sign you have not learned yet.
 * The category chosen on the home screen is not used: it would give the answer away.
 */

import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language } from '@/types/game';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoundGame } from '@/hooks/useRoundGame';
import { useRoundScroll } from '@/hooks/useRoundScroll';
import { buildClassifyRounds, CLASSIFY_ORDER, lookFact, type ClassifyRound } from '@/lib/gameLogic';
import { EXCEPTION_NOTE, lookSentence } from '@/lib/classifyText';
import { signDescription, signName } from '@/lib/signName';
import { l3 } from '@/lib/l3';
import { PointsPill, RoundHeader, RoundIntro, RoundResult } from './RoundGameParts';

const TOTAL_ROUNDS = 10;
const ROUND_MS = 8_000;
const ACCENT = 'hsl(24 94% 58%)';

interface ClassifyGameProps {
  lang: Language;
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

export default function ClassifyGame({ lang, onHome, muted = false, onToggleMute }: ClassifyGameProps) {
  const L = l3(lang);
  const g = useRoundGame<ClassifyRound>({
    mode: 'classify',
    bestKey: 'vq-classify-best',
    roundMs: ROUND_MS,
    muted,
    advanceMs: 2200,
    build: () => buildClassifyRounds(TRAFFIC_SIGNS, TOTAL_ROUNDS),
    signIdOf: r => r.sign.id,
  });
  const feedbackRef = useRoundScroll(g.phase === 'playing', g.index, g.answered);
  const title = t(lang, 'modeClassify');
  const labels = CATEGORY_LABELS_I18N[lang];

  if (g.phase === 'intro') {
    const sample = ['A1', 'C1', 'D1'].map(id => TRAFFIC_SIGNS.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
    return (
      <RoundIntro
        lang={lang}
        accent={ACCENT}
        hueClass="hue-orange"
        icon={Tags}
        title={title}
        description={L(
          'Which kind of sign is it? Warning, prohibition, mandatory, information, priority or plate. Learn to read the shape and the colour.',
          'Vilken sorts skylt är det? Varning, förbud, påbud, information, väjning eller tilläggstavla. Lär dig läsa form och färg.',
          'ما نوع هذه الإشارة؟ تحذير أم منع أم إلزام أم معلومات أم أولوية أم لوحة إضافية. تعلّم قراءة الشكل واللون.',
        )}
        meta={L('10 rounds · 8 seconds each', '10 rundor · 8 sekunder var', '10 جولات · 8 ثوانٍ لكل جولة')}
        sample={sample}
        onStart={g.start}
        onHome={onHome}
      />
    );
  }

  if (g.phase === 'result') {
    const ratio = g.correctCount / g.total;
    return (
      <RoundResult
        lang={lang}
        accent={ACCENT}
        hueClass="hue-orange"
        emoji={ratio >= 0.9 ? '🏷️' : ratio >= 0.6 ? '🎯' : '🔎'}
        headline={ratio >= 0.9
          ? L('You read signs like a pro!', 'Du läser skyltar som ett proffs!', 'تقرأ الإشارات كمحترف!')
          : ratio >= 0.6
          ? L('Good reading!', 'Bra läsning!', 'قراءة جيدة!')
          : L('Keep practising', 'Fortsätt öva', 'واصل التدريب')}
        earned={g.earned}
        newRecord={g.newRecord}
        score={g.score}
        correct={g.correctCount}
        total={g.total}
        best={g.best}
        onAgain={g.start}
        onHome={onHome}
      />
    );
  }

  const round = g.round;
  if (!round) return null;
  const { sign, answer } = round;
  const last = g.index + 1 >= g.total;
  const fact = lookFact(TRAFFIC_SIGNS, sign);
  const sentence = lookSentence(TRAFFIC_SIGNS, sign, lang, labels[answer]);

  return (
    <div className="min-h-screen flex flex-col" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <RoundHeader
        lang={lang}
        accent={ACCENT}
        title={title}
        index={g.index}
        total={g.total}
        score={g.score}
        streak={g.streak}
        remaining={g.remaining}
        answered={g.answered}
        seconds={ROUND_MS / 1000}
        muted={muted}
        onToggleMute={onToggleMute}
        onHome={onHome}
      />

      <div className="px-4 max-w-lg mx-auto w-full flex flex-col items-center">
        <p className="text-sm font-display font-bold text-[hsl(var(--muted-foreground))] mb-3">
          {L('What kind of sign is this?', 'Vilken sorts skylt är det här?', 'ما نوع هذه الإشارة؟')}
        </p>
        <div className="w-[min(46vw,176px)] aspect-square rounded-3xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center mb-4">
          <SignDisplay sign={sign} size="lg" />
        </div>

        <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
          {CLASSIFY_ORDER.map(cat => {
            const isAnswer = cat === answer;
            const isPicked = g.picked === cat;
            return (
              <button
                key={cat}
                onClick={() => g.answer(cat, isAnswer)}
                disabled={g.answered}
                className={cn(
                  // Very narrow phones: less padding and a smaller font, and a long Swedish word may break rather than push the page wider
                  'min-h-[52px] px-2 min-[360px]:px-3 py-2 rounded-2xl border-2 text-[13px] min-[360px]:text-sm font-bold leading-snug text-center [overflow-wrap:anywhere] transition-all duration-200',
                  !g.answered && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--option-hover-border))] active:scale-[0.97]',
                  g.answered && isAnswer && 'bg-emerald-500/15 border-emerald-500/70 text-[hsl(var(--foreground))]',
                  g.answered && isPicked && !isAnswer && 'bg-rose-500/15 border-rose-500/60 text-[hsl(var(--foreground))]',
                  g.answered && !isAnswer && !isPicked && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] text-[hsl(var(--foreground))] opacity-50',
                )}
              >
                {labels[cat]}
              </button>
            );
          })}
        </div>

        <PointsPill answered={g.answered} wasRight={g.wasRight} gained={g.gained} />
      </div>

      {g.answered && (
        <div ref={feedbackRef} className="px-4 pb-6 pt-1 max-w-lg mx-auto w-full" aria-live="polite">
          <div className="rounded-2xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] px-4 py-3">
            <p className={cn('text-sm font-display font-extrabold mb-2', g.wasRight ? 'text-emerald-300' : 'text-rose-300')}>
              {g.wasRight
                ? L('Correct!', 'Rätt!', 'صحيح!')
                : g.picked === null
                ? L("Time's up", 'Tiden är slut', 'انتهى الوقت')
                : L('Not quite', 'Inte riktigt', 'ليست صحيحة')}
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">{signName(sign, lang)}</p>
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{signDescription(sign, lang)}</p>
              </div>
              <p className="text-[hsl(var(--muted-foreground))]">
                {L('Category: ', 'Kategori: ', 'الفئة: ')}
                <span className="font-bold text-emerald-300">{labels[answer]}</span>
              </p>
              {sentence && <p className="text-[hsl(var(--muted-foreground))]/90 leading-relaxed">{sentence}</p>}
              {fact.exception && <p className="font-semibold" style={{ color: ACCENT }}>{EXCEPTION_NOTE[lang]}</p>}
            </div>
            <button
              onClick={g.next}
              className="mt-3 w-full py-2.5 rounded-xl btn-hue hue-orange font-display font-bold text-sm active:scale-[0.98] transition-all"
            >
              {last ? L('Results', 'Resultat', 'النتيجة') : L('Next', 'Nästa', 'التالي')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
