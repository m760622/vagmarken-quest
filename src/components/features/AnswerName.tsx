import { TrafficSign, Language } from '@/types/game';

/** Sign name for feedback sentences: Arabic UI shows the Arabic name, then the Swedish one on its own line. */
export default function AnswerName({ sign, lang }: { sign: TrafficSign; lang: Language }) {
  if (lang !== 'ar') return <>{sign.name}</>;
  return (
    <>
      {sign.nameAr}
      <bdi dir="ltr" className="block text-xs font-semibold opacity-80 text-end mt-0.5">{sign.name}</bdi>
    </>
  );
}
