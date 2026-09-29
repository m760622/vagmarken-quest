/**
 * MY COLLECTION — مجموعتي / Min samling
 * Every sign is a card in an album. A short session mixes the signs that are due for review
 * (the ones you missed most first) with a few new ones. Each correct answer moves a card up
 * one of five levels and pushes its next review further away (spaced repetition);
 * a miss drops it two levels. Level 5 is "mastered".
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language, SignCategory, TrafficSign } from '@/types/game';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Home, Album, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { useCollection } from '@/hooks/useCollection';
import { streakBonus } from '@/hooks/useGame';
import { recordEvent } from '@/lib/progress';
import { getMistakes } from '@/lib/mistakes';
import { useAudio } from '@/hooks/useAudio';
import { buildChoices } from '@/lib/gameLogic';
import {
  MAX_LEVEL, arrangeSession, collectionStats, dueWithin, getCollection, nextDueIn, planSession, recordCollectionAnswer, waitParts,
  type SessionPlan,
} from '@/lib/collection';
import { signDescription, signName, signNameSecondary } from '@/lib/signName';
import SpeakButton from './SpeakButton';

const CORAL = 'hsl(12 90% 64%)';
const ALL_IDS = TRAFFIC_SIGNS.map(s => s.id);

interface CollectionGameProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

type View = 'album' | 'session' | 'summary';
type Step = 'meet' | 'ask' | 'feedback';

interface Answered {
  id: string;
  correct: boolean;
  before: number;   // level before the answer (0 = not collected yet)
  after: number;
  isNew: boolean;
  early: boolean;   // a correct answer on a card that was not due yet: the level stays put
}

const AR_UNITS = {
  min: ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'],
  h: ['ساعة', 'ساعتين', 'ساعات', 'ساعة'],
  d: ['يوم', 'يومين', 'أيام', 'يومًا'],
};

function waitText(ms: number, lang: Language): string {
  const { n, unit } = waitParts(ms);
  if (lang === 'ar') {
    const forms = AR_UNITS[unit];
    const word = n === 1 ? forms[0] : n === 2 ? forms[1] : n <= 10 ? forms[2] : forms[3];
    return n <= 2 ? `بعد ${word}` : `بعد ${n} ${word}`;
  }
  if (lang === 'sv') return `om ${n} ${unit === 'min' ? 'min' : unit === 'h' ? 'tim' : n === 1 ? 'dag' : 'dagar'}`;
  return `in ${n} ${unit === 'min' ? 'min' : unit === 'h' ? 'h' : n === 1 ? 'day' : 'days'}`;
}

function newSignsLabel(n: number, lang: Language): string {
  if (lang === 'ar') return n === 1 ? 'إشارة جديدة' : n === 2 ? 'إشارتان جديدتان' : `${n} إشارات جديدة`;
  if (lang === 'sv') return n === 1 ? 'Ny skylt' : `${n} nya skyltar`;
  return n === 1 ? 'New sign' : `${n} new signs`;
}

const tileClass = (level: number) =>
  level >= MAX_LEVEL ? 'border-emerald-400/80 bg-emerald-500/10'
  : level >= 3 ? 'border-sky-400/70 bg-sky-500/5'
  : level >= 1 ? 'border-amber-400/70 bg-amber-500/5'
  : 'border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))]';

const dotClass = (level: number) => (level >= MAX_LEVEL ? 'bg-emerald-400' : level >= 3 ? 'bg-sky-400' : 'bg-amber-400');

export default function CollectionGame({ lang, category, onHome, muted = false, onToggleMute }: CollectionGameProps) {
  const store = useCollection();
  const { playCorrect, playWrong } = useAudio(muted);
  const isRtl = lang === 'ar';
  const L = (en: string, sv: string, ar: string) => (lang === 'en' ? en : lang === 'sv' ? sv : ar);

  const [view, setView]         = useState<View>('album');
  const [now, setNow]           = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plan, setPlan]         = useState<SessionPlan | null>(null);
  const [newIds, setNewIds]     = useState<Set<string>>(new Set());
  const [meetAt, setMeetAt]       = useState<Record<number, string[]>>({});
  const [cursor, setCursor]     = useState(0);
  const [step, setStep]         = useState<Step>('ask');
  const [choices, setChoices]   = useState<TrafficSign[]>([]);
  const [picked, setPicked]     = useState<string | null>(null);
  const [results, setResults]   = useState<Answered[]>([]);
  const [last, setLast]         = useState<Answered | null>(null);
  const [streak, setStreak]     = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  const pool = useMemo(
    () => (category === 'all' ? TRAFFIC_SIGNS : TRAFFIC_SIGNS.filter(s => s.category === category)),
    [category],
  );
  const stats = collectionStats(store, ALL_IDS);
  const nextPlan = useMemo(() => planSession(store, pool, getMistakes(), now), [store, pool, now]);

  const cardAt = (i: number) => (plan ? TRAFFIC_SIGNS.find(s => s.id === plan.ids[i]) : undefined);
  const card = cardAt(cursor);

  // Small phones: start each card from the top, and bring the result card (and its Next button) into view
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view !== 'session') return;
    if (step === 'feedback') {
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [view, step, cursor]);

  const openCard = useCallback((i: number, ids: string[], groups: Record<number, string[]>) => {
    const sign = TRAFFIC_SIGNS.find(s => s.id === ids[i]);
    if (!sign) return;
    setCursor(i);
    setChoices(buildChoices(sign, TRAFFIC_SIGNS));
    setPicked(null);
    setLast(null);
    setStep(groups[i] ? 'meet' : 'ask');
  }, []);

  const startSession = useCallback(() => {
    const clock = Date.now();
    const p = planSession(getCollection(), pool, getMistakes(), clock);
    if (p.ids.length === 0) return;
    const fresh = new Set(p.ids.filter(id => !getCollection()[id]));
    const { order, meetAt: groups } = arrangeSession(getCollection(), p.ids);
    setNow(clock);
    setPlan({ ...p, ids: order });
    setNewIds(fresh);
    setMeetAt(groups);
    setResults([]);
    setStreak(0);
    setMaxStreak(0);
    setSelectedId(null);
    setView('session');
    openCard(0, order, groups);
  }, [pool, openCard]);

  const choose = useCallback((choiceId: string) => {
    if (step !== 'ask' || !card) return;
    const correct = choiceId === card.id;
    const current = getCollection()[card.id];
    const early = !!current && current.due > Date.now();
    const { before, after } = recordCollectionAnswer(card.id, correct);
    const newStreak = correct ? streak + 1 : 0;
    recordEvent({
      type: 'answer', signId: card.id, correct, streak: correct ? newStreak : undefined,
      pickedId: correct ? undefined : choiceId,
      otherIds: correct ? choices.filter(c => c.id !== card.id).map(c => c.id) : undefined,
    });
    if (correct) playCorrect(); else playWrong();

    const rec: Answered = { id: card.id, correct, before, after, isNew: newIds.has(card.id), early: early && correct };
    setPicked(choiceId);
    setStreak(newStreak);
    setMaxStreak(m => Math.max(m, newStreak));
    setResults(r => [...r, rec]);
    setLast(rec);
    setStep('feedback');
  }, [step, card, choices, streak, newIds, playCorrect, playWrong]);

  const nextCard = useCallback(() => {
    if (!plan) return;
    if (cursor + 1 >= plan.ids.length) {
      setNow(Date.now());
      setView('summary');
      return;
    }
    openCard(cursor + 1, plan.ids, meetAt);
  }, [plan, cursor, meetAt, openCard]);

  const backToAlbum = useCallback(() => {
    setNow(Date.now());
    setView('album');
  }, []);

  const correctCount = results.filter(r => r.correct).length;
  const collected = results.filter(r => r.isNew).length;
  const levelUps = results.filter(r => !r.isNew && r.after > r.before).length;
  const total = plan?.ids.length ?? 0;
  const earned = useFinishGame(view === 'summary', {
    mode: 'collection',
    xp: 15 + correctCount * 3 + collected * 2 + streakBonus(maxStreak),
    correct: correctCount,
    total,
    maxStreak,
  });

  const title = t(lang, 'modeCollection');
  const labels = CATEGORY_LABELS_I18N[lang];
  const levelName = (level: number) =>
    level >= MAX_LEVEL ? L('Mastered', 'Behärskad', 'متقنة')
    : level >= 3 ? L('Known', 'Känd', 'معروفة')
    : level >= 1 ? L('Learning', 'Under inlärning', 'قيد التعلّم')
    : L('New', 'Ny', 'جديدة');

  const muteButton = onToggleMute && (
    <button
      onClick={onToggleMute}
      className="w-7 h-7 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center text-xs hover:border-[hsl(var(--option-hover-border))] transition-colors"
      aria-label={muted ? 'Unmute' : 'Mute'}
    >{muted ? '🔇' : '🔊'}</button>
  );

  const segments = (
    <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex" role="img"
      aria-label={`${stats.mastered} / ${stats.total}`}>
      <div className="h-full bg-emerald-400" style={{ width: `${(stats.mastered / stats.total) * 100}%` }} />
      <div className="h-full bg-sky-400" style={{ width: `${(stats.known / stats.total) * 100}%` }} />
      <div className="h-full bg-amber-400" style={{ width: `${(stats.learning / stats.total) * 100}%` }} />
    </div>
  );

  /* ── Session summary ─────────────────────────────────────────── */
  if (view === 'summary') {
    const ratio = total ? correctCount / total : 0;
    const clock = now;
    const upNext = nextDueIn(store, ALL_IDS, clock);
    const dueNow = dueWithin(store, ALL_IDS, clock);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl mb-3">{ratio >= 0.9 ? '🏆' : ratio >= 0.6 ? '📚' : '🌱'}</div>
        <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">
          {ratio >= 0.9 ? L('Great session!', 'Fantastiskt pass!', 'جلسة رائعة!')
            : ratio >= 0.6 ? L('Good progress', 'Bra framsteg', 'تقدّم جيد')
            : L('Every miss is a step forward', 'Varje miss är ett steg framåt', 'كل خطأ خطوة للأمام')}
        </h1>
        <div className="mt-2 mb-3"><XpChip earned={earned} lang={lang} /></div>
        {ratio >= 0.6 && <Confetti />}

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs my-4">
          <div className="p-3 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span dir="ltr" className="block text-2xl font-black text-emerald-400 tabular-nums">{correctCount}/{total}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="block text-2xl font-black tabular-nums" style={{ color: CORAL }}>{collected}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{L('New signs collected', 'Nya skyltar samlade', 'إشارات جديدة جُمعت')}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="block text-2xl font-black text-sky-400 tabular-nums">{levelUps}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{L('Level-ups', 'Nivåhöjningar', 'ترقّيات المستوى')}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="block text-2xl font-black text-amber-400 tabular-nums">{maxStreak}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'streak')}</span>
          </div>
        </div>

        <div className="w-full max-w-xs mb-4 text-start">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{L('Your album', 'Ditt album', 'ألبومك')}</span>
            <span dir="ltr" className="text-sm font-black text-emerald-400 tabular-nums">{stats.mastered}/{stats.total} {L('mastered', 'behärskade', 'متقنة')}</span>
          </div>
          {segments}
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
            {dueNow > 0
              ? L(`${dueNow} signs are ready to review now.`, `${dueNow} skyltar är redo att repeteras nu.`, `${dueNow} إشارة جاهزة للمراجعة الآن.`)
              : upNext !== null
              ? L(`Next review ${waitText(upNext, lang)}. Coming back then is what makes it stick.`, `Nästa repetition ${waitText(upNext, lang)}. Att komma tillbaka då gör att det fastnar.`, `المراجعة التالية ${waitText(upNext, lang)}. العودة في موعدها هي ما يثبّت الحفظ.`)
              : ''}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={startSession}
            className="py-3.5 rounded-2xl btn-hue hue-coral font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Album className="w-4 h-4" />
            {L('Another session', 'Ett pass till', 'جلسة أخرى')}
          </button>
          <button
            onClick={backToAlbum}
            className="py-3 rounded-2xl border-2 border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] text-[hsl(var(--foreground))] font-semibold hover:border-[hsl(var(--option-hover-border))] transition-all"
          >
            {L('Back to my collection', 'Tillbaka till min samling', 'العودة إلى مجموعتي')}
          </button>
        </div>
      </div>
    );
  }

  /* ── Session: meet, ask, feedback ────────────────────────────── */
  if (view === 'session' && plan && card) {
    const wasRight = step === 'feedback' && last?.correct;
    return (
      <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <button onClick={backToAlbum} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              {L('← Album', '← Album', '← الألبوم')}
            </button>
            <h1 className="text-sm font-display font-bold text-[hsl(var(--foreground))]">{title}</h1>
            <div className="flex items-center gap-1.5">
              <span dir="ltr" className="text-xs font-bold tabular-nums" style={{ color: CORAL }}>{cursor + 1}/{plan.ids.length}</span>
              {muteButton}
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((cursor + (step === 'feedback' ? 1 : 0)) / plan.ids.length) * 100}%`, background: CORAL }} />
          </div>
        </div>

        <div className="px-4 pb-6 max-w-lg mx-auto w-full flex flex-col items-center">
          {step === 'meet' && (() => {
            // the new signs of this group are shown together, then asked one by one in the same order
            const group = (meetAt[cursor] ?? [card.id])
              .map(id => TRAFFIC_SIGNS.find(sg => sg.id === id))
              .filter((sg): sg is TrafficSign => !!sg);
            return (
              <>
                <div className="w-full rounded-3xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] px-4 py-5 pop-in">
                  <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-extrabold" style={{ background: 'hsl(12 90% 64% / 0.16)', color: CORAL }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      {newSignsLabel(group.length, lang)}
                    </span>
                  </div>
                  <ul className="mt-4 flex flex-col gap-3">
                    {group.map(sg => {
                      const sub = signNameSecondary(sg, lang);
                      return (
                        <li key={sg.id} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--option-border))] bg-[hsl(var(--background))]/40 p-3 text-start">
                          {/* the speaker sits under the sign, so the text keeps its width on narrow phones */}
                          <div className="shrink-0 w-[76px] flex flex-col items-center gap-2">
                            <SignDisplay sign={sg} size="sm" />
                            {lang !== 'en' && <SpeakButton text={sg.name} lang={lang} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {/* Long Swedish compounds ("Hastighetsbegränsning") may break rather than stick out on a 320px screen */}
                            <p className="text-[15px] min-[360px]:text-base font-display font-extrabold text-[hsl(var(--foreground))] leading-snug [overflow-wrap:anywhere]">{signName(sg, lang)}</p>
                            {sub && <bdi dir="ltr" className="block text-xs font-semibold opacity-75 mt-0.5 [overflow-wrap:anywhere]">{sub}</bdi>}
                            <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))] mt-1.5 [overflow-wrap:anywhere]">{signDescription(sg, lang)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {/* stays in reach even when three signs push the page below the fold */}
                <div className="sticky bottom-3 mt-4 w-full">
                  <button
                    onClick={() => setStep('ask')}
                    className="w-full py-3.5 rounded-2xl btn-hue hue-coral font-display font-extrabold shadow-lg active:scale-[0.98] transition-all"
                  >
                    {group.length > 1
                      ? L('Got them, quiz me', 'Uppfattat, testa mig', 'فهمتها، اختبرني')
                      : L('Got it, quiz me', 'Uppfattat, testa mig', 'فهمت، اختبرني')}
                  </button>
                </div>
              </>
            );
          })()}

          {step !== 'meet' && (
            <>
              <p className="text-sm font-display font-bold text-[hsl(var(--muted-foreground))] mb-3">
                {L('What is this sign?', 'Vad är det här för skylt?', 'ما هذه الإشارة؟')}
              </p>
              <div className="w-[min(60vw,220px)] aspect-square rounded-3xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center mb-4">
                <SignDisplay sign={card} size="lg" />
              </div>

              <div className="w-full flex flex-col gap-2.5">
                {choices.map(choice => {
                  const isAnswer = choice.id === card.id;
                  const isPicked = picked === choice.id;
                  const sub = signNameSecondary(choice, lang);
                  return (
                    <button
                      key={choice.id}
                      onClick={() => choose(choice.id)}
                      disabled={step === 'feedback'}
                      className={cn(
                        'w-full text-start px-4 py-3 rounded-2xl border-2 transition-all duration-200 min-h-[56px]',
                        step === 'ask' && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] hover:border-[hsl(var(--option-hover-border))] active:scale-[0.98]',
                        step === 'feedback' && isAnswer && 'bg-emerald-500/15 border-emerald-500/60',
                        step === 'feedback' && isPicked && !isAnswer && 'bg-rose-500/15 border-rose-500/60',
                        step === 'feedback' && !isAnswer && !isPicked && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] opacity-50',
                      )}
                    >
                      <span className="block text-sm font-bold leading-snug text-[hsl(var(--foreground))]">{signName(choice, lang)}</span>
                      {sub && <bdi dir="ltr" className="block text-xs font-medium opacity-70 mt-0.5 text-start">{sub}</bdi>}
                    </button>
                  );
                })}
              </div>

              {step === 'feedback' && last && (
                <div ref={feedbackRef} className="w-full mt-3 rounded-2xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] px-4 py-3" aria-live="polite">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={cn('text-sm font-display font-extrabold', wasRight ? 'text-emerald-300' : 'text-rose-300')}>
                      {wasRight ? L('Correct!', 'Rätt!', 'صحيح!') : L('Not quite', 'Inte riktigt', 'ليست صحيحة')}
                      {!wasRight && <span className="font-semibold text-[hsl(var(--foreground))]"> · {signName(card, lang)}</span>}
                    </p>
                    {lang !== 'en' && <SpeakButton text={card.name} lang={lang} className="-mt-1" />}
                  </div>
                  <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{signDescription(card, lang)}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-display font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--background))]/60 border border-[hsl(var(--option-border))]">
                    {last.isNew
                      ? (last.correct
                        ? L(`Collected · ${levelName(last.after)}`, `Samlad · ${levelName(last.after)}`, `جُمعت · ${levelName(last.after)}`)
                        : L('Added to your album, you will see it again soon', 'Tillagd i albumet, du får se den snart igen', 'أُضيفت إلى ألبومك، وستراها قريبًا'))
                      : last.after > last.before
                      ? (last.after >= MAX_LEVEL
                        ? L('🏆 Mastered!', '🏆 Behärskad!', '🏆 أتقنتها!')
                        : L(`⬆ Level ${last.before} → ${last.after}`, `⬆ Nivå ${last.before} → ${last.after}`, `⬆ المستوى ${last.before} ← ${last.after}`))
                      : last.after < last.before
                      ? L(`⬇ Level ${last.before} → ${last.after}, back for review soon`, `⬇ Nivå ${last.before} → ${last.after}, tillbaka snart`, `⬇ المستوى ${last.before} ← ${last.after}، ستعود قريبًا`)
                      : last.early
                      ? L(`Level ${last.after} · reviewed early, so it stays`, `Nivå ${last.after} · repeterad i förväg, nivån ligger kvar`, `المستوى ${last.after} · مراجعة مبكرة، فيبقى كما هو`)
                      : L(`Level ${last.after} · still mastered`, `Nivå ${last.after} · fortfarande behärskad`, `المستوى ${last.after} · ما زالت متقنة`)}
                  </p>
                  <button
                    onClick={nextCard}
                    className="mt-3 w-full py-2.5 rounded-xl btn-hue hue-coral font-display font-bold text-sm active:scale-[0.98] transition-all"
                  >
                    {cursor + 1 >= plan.ids.length ? L('Finish', 'Klar', 'إنهاء') : L('Next', 'Nästa', 'التالي')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Album ───────────────────────────────────────────────────── */
  const selected = selectedId ? TRAFFIC_SIGNS.find(s => s.id === selectedId) : undefined;
  const selectedState = selected ? store[selected.id] : undefined;
  const sessionSize = nextPlan.ids.length;
  const upNext = nextDueIn(store, ALL_IDS, now);

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onHome} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
            <Home className="w-3.5 h-3.5" />
            {t(lang, 'home')}
          </button>
          <h1 className="text-sm font-display font-bold text-[hsl(var(--foreground))]">{title}</h1>
          <div className="w-14 flex justify-end">{muteButton}</div>
        </div>

        {/* Progress of the whole album */}
        <div className="rounded-3xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span dir="ltr" className="inline-block">
                <span className="text-4xl font-black tabular-nums" style={{ color: CORAL }}>{stats.mastered}</span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]"> / {stats.total}</span>
              </span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{L('signs mastered', 'skyltar behärskade', 'إشارة متقنة')}</p>
            </div>
            <div className="text-end">
              <span dir="ltr" className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">{stats.total - stats.unseen}/{stats.total}</span>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{L('collected', 'samlade', 'مجموعة')}</p>
            </div>
          </div>
          {segments}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-emerald-400" />{levelName(MAX_LEVEL)} <b dir="ltr" className="text-[hsl(var(--foreground))]">{stats.mastered}</b></span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-sky-400" />{levelName(3)} <b dir="ltr" className="text-[hsl(var(--foreground))]">{stats.known}</b></span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-400" />{levelName(1)} <b dir="ltr" className="text-[hsl(var(--foreground))]">{stats.learning}</b></span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-slate-500" />{levelName(0)} <b dir="ltr" className="text-[hsl(var(--foreground))]">{stats.unseen}</b></span>
          </div>
        </div>

        {/* Start a session */}
        <button
          onClick={startSession}
          disabled={sessionSize === 0}
          className="mt-3 w-full py-4 rounded-2xl btn-hue hue-coral font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Album className="w-5 h-5" />
          {nextPlan.earlyCount > 0
            ? L('Practise early', 'Öva i förväg', 'تدريب مبكر')
            : L('Start a session', 'Starta ett pass', 'ابدأ جلسة')}
          <span dir="ltr" className="opacity-80 text-base">· {sessionSize}</span>
        </button>
        <p className="mt-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {nextPlan.earlyCount > 0
            ? L(`Nothing is due right now${upNext !== null ? ` (next ${waitText(upNext, lang)})` : ''}. A short early practice will not change levels.`,
                `Inget är aktuellt just nu${upNext !== null ? ` (nästa ${waitText(upNext, lang)})` : ''}. En kort övning i förväg ändrar inte nivåerna.`,
                `لا شيء مستحق الآن${upNext !== null ? ` (التالي ${waitText(upNext, lang)})` : ''}. التدريب المبكر القصير لا يغيّر المستويات.`)
            : L(`${nextPlan.dueCount} to review · ${nextPlan.newCount} new`, `${nextPlan.dueCount} att repetera · ${nextPlan.newCount} nya`, `${nextPlan.dueCount} للمراجعة · ${nextPlan.newCount} جديدة`)}
          {category !== 'all' && <span className="block mt-0.5 opacity-80">{labels[category]}</span>}
        </p>
      </div>

      {/* Detail of the tapped sign */}
      {selected && (
        <div className="px-4 max-w-lg mx-auto w-full">
          <div className="rounded-3xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] p-4 flex gap-4 items-center" aria-live="polite">
            <div className={cn('shrink-0', !selectedState && 'opacity-30')} style={!selectedState ? { filter: 'brightness(0)' } : undefined} aria-hidden="true">
              <SignDisplay sign={selected} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              {selectedState ? (
                <>
                  <p className="text-sm font-display font-extrabold text-[hsl(var(--foreground))] leading-snug">{signName(selected, lang)}</p>
                  {signNameSecondary(selected, lang) && <bdi dir="ltr" className="block text-xs opacity-70">{signNameSecondary(selected, lang)}</bdi>}
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">{signDescription(selected, lang)}</p>
                  <p className="text-[11px] font-bold mt-1.5" style={{ color: CORAL }}>
                    {L('Level', 'Nivå', 'المستوى')} {selectedState.level}/{MAX_LEVEL} · {levelName(selectedState.level)}
                    {' · '}
                    {selectedState.due <= now ? L('due now', 'aktuell nu', 'مستحقة الآن') : L(`review ${waitText(selectedState.due - now, lang)}`, `repetera ${waitText(selectedState.due - now, lang)}`, `مراجعتها ${waitText(selectedState.due - now, lang)}`)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-display font-extrabold text-[hsl(var(--foreground))]">{L('Not collected yet', 'Inte samlad än', 'لم تُجمع بعد')}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{labels[selected.category]}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]/80 mt-1">{L('It shows up in a session as a new sign.', 'Den dyker upp i ett pass som en ny skylt.', 'ستظهر لك في جلسة كإشارة جديدة.')}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The album */}
      <div className="px-4 pt-3 pb-8 max-w-lg mx-auto w-full">
        <div className="grid grid-cols-5 gap-2">
          {TRAFFIC_SIGNS.map(sign => {
            const level = store[sign.id]?.level ?? 0;
            return (
              <button
                key={sign.id}
                onClick={() => setSelectedId(id => (id === sign.id ? null : sign.id))}
                aria-pressed={selectedId === sign.id}
                aria-label={level > 0 ? `${signName(sign, lang)} · ${levelName(level)}` : L('Not collected yet', 'Inte samlad än', 'لم تُجمع بعد')}
                className={cn(
                  'relative aspect-square rounded-2xl border-2 overflow-hidden flex items-center justify-center transition-all active:scale-95',
                  tileClass(level),
                  selectedId === sign.id && 'ring-2 ring-offset-0',
                )}
                style={selectedId === sign.id ? { ['--tw-ring-color' as string]: CORAL } : undefined}
              >
                <div className={cn('scale-[0.8]', level === 0 && 'opacity-30')} style={level === 0 ? { filter: 'brightness(0)' } : undefined} aria-hidden="true">
                  <SignDisplay sign={sign} size="sm" />
                </div>
                {level === 0 && <span className="absolute inset-0 grid place-items-center text-lg font-black text-[hsl(var(--muted-foreground))]/70" aria-hidden="true">?</span>}
                {level > 0 && (
                  <span className="absolute bottom-1 inset-x-1.5 flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: MAX_LEVEL }, (_, i) => (
                      <i key={i} className={cn('h-[3px] flex-1 rounded-full', i < level ? dotClass(level) : 'bg-slate-700')} />
                    ))}
                  </span>
                )}
                {level >= MAX_LEVEL && <Check className="absolute top-1 end-1 w-3 h-3 text-emerald-400" strokeWidth={3.5} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
