import { useState } from 'react';
import { Language, SignCategory } from '@/types/game';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { t, CATEGORY_LABELS_I18N } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, RotateCcw, Home, Layers } from 'lucide-react';
import SpeakButton from './SpeakButton';

interface LearnModeProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
}

const AR_DESCRIPTIONS: Record<string, string> = {
  A1:  'تحذير من منعطف خطير أمامك.',
  A13: 'تحذير من معبر للمشاة أمامك.',
  A15: 'تحذير من وجود أطفال قرب الطريق.',
  A16: 'تحذير من الدرّاجين وسائقي الموبيد.',
  A19: 'تحذير من حيوانات على الطريق أو قربه.',
  A20: 'تحذير من أعمال إنشاء أمامك.',
  A22: 'تحذير من إشارات مرور أمامك.',
  A28: 'تحذير من تقاطع طرق.',
  A35: 'تحذير من تقاطع سكة حديد مع حواجز.',
  A10: 'تحذير من طريق زلق.',
  A8:  'تحذير من سطح طريق غير مستوٍ.',
  A24: 'تحذير من رياح جانبية قوية.',
  B1:  'يجب عليك إعطاء الأولوية للمركبات المتقاطعة.',
  B2:  'يجب عليك التوقف وإعطاء الأولوية.',
  B3:  'يشير إلى معبر للمشاة.',
  B4:  'أنت على طريق ذو أولوية.',
  B5:  'ينتهي طريق الأولوية.',
  C1:  'ممنوع الدخول بالمركبات.',
  C27: 'ممنوع التجاوز.',
  C31: 'السرعة القصوى المسموح بها.',
  C35: 'ممنوع الوقوف.',
  C39: 'ممنوع التوقف والوقوف.',
  C25: 'ممنوع الانعطاف في التقاطع.',
  C26: 'ممنوع الدوران.',
  D1:  'اتجاه القيادة الإلزامي.',
  D3:  'دوار — الدوران إلزامي.',
  D4:  'مسار دراجات إلزامي.',
  D5:  'مسار مشاة إلزامي.',
  D6:  'مسار مشترك للمشاة والدراجات.',
  E1:  'أنت على طريق سريع.',
  E2:  'ينتهي الطريق السريع.',
  E5:  'منطقة مبنية.',
  E16: 'حركة المرور باتجاه واحد.',
  E19: 'موقف سيارات مسموح به.',
};

const CATEGORY_BADGE_CLS: Record<string, string> = {
  warning:     'bg-amber-500/20 text-amber-400 border-amber-500/40',
  prohibition: 'bg-red-500/20 text-red-400 border-red-500/40',
  mandatory:   'bg-blue-500/20 text-blue-400 border-blue-500/40',
  priority:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  information: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
  additional: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

export default function LearnMode({ lang, category, onHome }: LearnModeProps) {
  const signs = category === 'all'
    ? TRAFFIC_SIGNS
    : TRAFFIC_SIGNS.filter(s => s.category === category);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const isRtl = lang === 'ar';

  const sign = signs[index];
  const description = lang === 'ar'
    ? (AR_DESCRIPTIONS[sign.id] ?? sign.descriptionAr ?? sign.description)
    : lang === 'en'
    ? (sign.descriptionEn ?? sign.description)
    : sign.description;
  const badgeCls = CATEGORY_BADGE_CLS[sign.category];
  const total = signs.length;

  const go = (dir: 'prev' | 'next') => {
    setDirection(dir === 'next' ? 'left' : 'right');
    setFlipped(false);
    setTimeout(() => {
      setIndex(i => dir === 'next' ? (i + 1) % total : (i - 1 + total) % total);
      setDirection(null);
    }, 180);
  };

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 pt-6 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onHome} className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-3 py-1.5 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            {t(lang, 'exit')}
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[hsl(var(--brand))]" />
            <h1 className="text-base font-black text-[hsl(var(--foreground))]">{t(lang, 'learnMode')}</h1>
          </div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{index + 1}/{total}</span>
        </div>
        <div className="text-xs text-center text-[hsl(var(--muted-foreground))]">
          {CATEGORY_LABELS_I18N[lang][category]} · {t(lang, 'tapToReveal')}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4 max-w-lg mx-auto w-full">
        <div className="h-1.5 rounded-full bg-[hsl(var(--option-bg))] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand))] to-[hsl(var(--brand-light))] transition-all duration-500"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex flex-col items-center px-4 pb-8 max-w-lg mx-auto w-full">
        <div
          onClick={() => setFlipped(f => !f)}
          className={cn(
            'w-full max-w-sm cursor-pointer select-none',
            'transition-all duration-200',
            direction === 'left' && 'translate-x-[-30px] opacity-0',
            direction === 'right' && 'translate-x-[30px] opacity-0',
          )}
          style={{ perspective: '800px' }}
        >
          {/* Card */}
          <div
            className="relative w-full"
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s cubic-bezier(.4,0,.2,1)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: 320,
            }}
          >
            {/* Front — sign */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] p-8"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <SignDisplay sign={sign} size="lg" />
              <div className="mt-6 flex items-center gap-2">
                <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border font-mono', badgeCls)}>
                  {sign.code}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t(lang, 'tapToReveal')}
                </span>
              </div>
            </div>

            {/* Back — name + description */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-[hsl(var(--brand))]/50 bg-[hsl(var(--option-bg))] p-8 text-center"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <span className={cn('text-xs font-black px-3 py-1 rounded-full border font-mono mb-4', badgeCls)}>
                {sign.code}
              </span>
              <h2 className="text-lg font-black text-[hsl(var(--foreground))] leading-tight mb-3">
                {lang === 'ar' ? sign.nameAr : sign.name}
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                {description}
              </p>
              <p dir="ltr" className="text-xs text-[hsl(var(--muted-foreground))]/70 mt-3 italic">
                {lang === 'sv' ? sign.nameEn : sign.name}
              </p>
              {flipped && <SpeakButton text={sign.name} lang={lang} className="mt-3" />}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-4 mt-8">
          <button
            onClick={() => go('prev')}
            className="w-12 h-12 rounded-2xl border-2 border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] flex items-center justify-center hover:border-[hsl(var(--option-hover-border))] transition-all hover:scale-105"
          >
            {isRtl ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {/* Dot indicators — show up to 7 */}
          <div className="flex gap-1.5 items-center">
            {Array.from({ length: Math.min(total, 7) }).map((_, i) => {
              const dotIndex = total <= 7 ? i : Math.round((i / 6) * (total - 1));
              const isActive = total <= 7 ? i === index : Math.abs(dotIndex - index) < total / 7;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    isActive ? 'w-4 h-2 bg-[hsl(var(--brand))]' : 'w-2 h-2 bg-[hsl(var(--option-border))]',
                  )}
                />
              );
            })}
          </div>

          <button
            onClick={() => go('next')}
            className="w-12 h-12 rounded-2xl border-2 border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] flex items-center justify-center hover:border-[hsl(var(--option-hover-border))] transition-all hover:scale-105"
          >
            {isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Flip hint */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setFlipped(f => !f)}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {flipped ? t(lang, 'showSign') : t(lang, 'showAnswer')}
          </button>
        </div>
      </div>
    </div>
  );
}
