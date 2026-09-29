import { useMemo, type CSSProperties } from 'react';

const COLORS = [
  'hsl(168 92% 58%)', // mint
  'hsl(318 92% 66%)', // magenta
  'hsl(45 100% 60%)', // sign yellow
  'hsl(199 92% 62%)', // sky
  'hsl(266 90% 72%)', // violet
];

interface ConfettiProps {
  count?: number;
  /** Seconds the fastest piece takes to fall. */
  duration?: number;
}

/** Pure-CSS confetti burst; ignores pointer events and honours reduced motion. */
export default function Confetti({ count = 44, duration = 2.8 }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => Math.random() * n;
        return {
          left: r(100),
          delay: r(0.7),
          dur: duration * (0.75 + r(0.6)),
          w: 6 + r(6),
          h: 9 + r(9),
          drift: (r(1) - 0.5) * 220,
          spin: 360 + r(720),
          color: COLORS[i % COLORS.length],
          round: i % 4 === 0,
        };
      }),
    [count, duration],
  );

  return (
    <div className="confetti pointer-events-none fixed inset-0 overflow-hidden z-[70]" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.round ? p.w : p.h,
            borderRadius: p.round ? '9999px' : '2px',
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
