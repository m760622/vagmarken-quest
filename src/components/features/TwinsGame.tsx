/**
 * TWINS — التوأم / Tvillingar
 * The name of a sign is shown; pick the right sign among look-alikes (same shape and colour).
 * First two signs to choose from, later three. 10 rounds against the clock. After each answer
 * the right sign and, when it was mixed up, the one that was picked are explained side by side.
 */

import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language, SignCategory } from '@/types/game';
import { t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoundGame } from '@/hooks/useRoundGame';
import { useRoundScroll } from '@/hooks/useRoundScroll';
import { buildTwinRounds, type TwinRound } from '@/lib/gameLogic';
import { signDescription, signName, signNameSecondary } from '@/lib/signName';
import { l3 } from '@/lib/l3';
import SpeakButton from './SpeakButton';
import { PointsPill, RoundHeader, RoundIntro, RoundResult } from './RoundGameParts';

const TOTAL_ROUNDS = 10;
const ROUND_MS = 12_000;
const ACCENT = 'hsl(186 90% 50%)';

interface TwinsGameProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

export default function TwinsGame({ lang, category, onHome, muted = false, onToggleMute }: TwinsGameProps) {
  const L = l3(lang);
  const g = useRoundGame<TwinRound>({
    mode: 'twins',
    bestKey: 'vq-twins-best',
    roundMs: ROUND_MS,
    muted,
    advanceMs: 2200,
    build: () => buildTwinRounds(TRAFFIC_SIGNS, category, TOTAL_ROUNDS),
    signIdOf: r => r.target.id,
  });
  const feedbackRef = useRoundScroll(g.phase === 'playing', g.index, g.answered);
  const title = t(lang, 'modeTwins');

  if (g.phase === 'intro') {
    const sample = ['A1', 'A2', 'A3'].map(id => TRAFFIC_SIGNS.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
    return (
      <RoundIntro
        lang={lang}
        accent={ACCENT}
        hueClass="hue-cyan"
        icon={Columns2}
        title={title}
        description={L(
          'Read the name, then pick the right sign among look-alikes. First two to choose from, later three.',
          'Läs namnet och välj rätt skylt bland liknande. Först två att välja på, sedan tre.',
          'اقرأ الاسم ثم اختر الإشارة الصحيحة من بين إشارات متشابهة. في البداية اثنتان ثم ثلاث.',
        )}
        meta={L('10 rounds · 12 seconds each', '10 rundor · 12 sekunder var', '10 جولات · 12 ثانية لكل جولة')}
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
        hueClass="hue-cyan"
        emoji={ratio >= 0.9 ? '🔍' : ratio >= 0.6 ? '👀' : '🧐'}
        headline={ratio >= 0.9
          ? L('Sharp eyes!', 'Skarpa ögon!', 'عين ثاقبة!')
          : ratio >= 0.6
          ? L('Good eye!', 'Bra öga!', 'نظرة جيدة!')
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
  const { target, options } = round;
  const picked = g.picked ? options.find(o => o.id === g.picked) : undefined;
  const wrongPick = picked && picked.id !== target.id ? picked : undefined;
  const secondary = signNameSecondary(target, lang);
  const last = g.index + 1 >= g.total;

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

      <div className="px-4 max-w-lg mx-auto w-full">
        <p className="text-center text-sm font-display font-bold text-[hsl(var(--muted-foreground))] mb-2">
          {L('Which of these is…', 'Vilken av dessa är…', 'أيّ هذه الإشارات هي…')}
        </p>
        <div className="max-w-xs mx-auto rounded-2xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] px-4 py-3 text-center mb-4">
          <p className="text-lg font-display font-extrabold leading-snug text-[hsl(var(--foreground))]">{signName(target, lang)}</p>
          {secondary && <bdi dir="ltr" className="block text-xs font-semibold opacity-75 mt-0.5">{secondary}</bdi>}
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          {options.map((sign, i) => {
            const isTarget = sign.id === target.id;
            const isPicked = g.picked === sign.id;
            return (
              <button
                key={sign.id}
                onClick={() => g.answer(sign.id, isTarget)}
                disabled={g.answered}
                // Names would give the answer away to a screen reader: only after answering
                aria-label={g.answered
                  ? signName(sign, lang)
                  : L(`Sign ${i + 1} of ${options.length}`, `Skylt ${i + 1} av ${options.length}`, `الإشارة ${i + 1} من ${options.length}`)}
                className={cn(
                  'relative rounded-3xl border-2 p-2 flex flex-col items-center justify-center transition-all duration-200 aspect-square',
                  options.length === 3 && i === 2 && 'col-span-2 justify-self-center w-[calc(50%-6px)]',
                  !g.answered && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] hover:border-[hsl(var(--option-hover-border))] active:scale-[0.97]',
                  g.answered && isTarget && 'bg-emerald-500/15 border-emerald-500/70',
                  g.answered && isPicked && !isTarget && 'bg-rose-500/15 border-rose-500/60',
                  g.answered && !isTarget && !isPicked && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] opacity-60',
                )}
              >
                <div aria-hidden="true"><SignDisplay sign={sign} size="md" /></div>
                {g.answered && (
                  <span className="mt-1 text-[11px] leading-tight font-semibold text-[hsl(var(--foreground))] line-clamp-2 text-center">
                    {signName(sign, lang)}
                  </span>
                )}
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-emerald-300">{signName(target, lang)}</p>
                  <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{signDescription(target, lang)}</p>
                </div>
                {lang !== 'en' && <SpeakButton text={target.name} lang={lang} />}
              </div>
              {wrongPick && (
                <div>
                  <p className="text-[hsl(var(--muted-foreground))]">
                    {L('You picked: ', 'Du valde: ', 'اخترتَ: ')}
                    <span className="font-bold text-rose-300">{signName(wrongPick, lang)}</span>
                  </p>
                  <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{signDescription(wrongPick, lang)}</p>
                </div>
              )}
              {round.lookAlike && (
                <p className="text-[hsl(var(--muted-foreground))]/80">
                  {L('Same shape and colour: look at the symbol inside.', 'Samma form och färg: titta på symbolen inuti.', 'الشكل واللون نفسهما: انتبه إلى الرمز في الداخل.')}
                </p>
              )}
            </div>
            <button
              onClick={g.next}
              className="mt-3 w-full py-2.5 rounded-xl btn-hue hue-cyan font-display font-bold text-sm active:scale-[0.98] transition-all"
            >
              {last ? L('Results', 'Resultat', 'النتيجة') : L('Next', 'Nästa', 'التالي')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
