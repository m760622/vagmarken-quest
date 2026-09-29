import { TrafficSign } from '@/types/game';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SignDisplayProps {
  sign: TrafficSign;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeMap = {
  sm: { px: 64,  outer: 64,  inner: 44, stroke: 5,  fontSize: 18, labelSize: 'text-[10px]' },
  md: { px: 112, outer: 112, inner: 78, stroke: 7,  fontSize: 32, labelSize: 'text-xs' },
  lg: { px: 152, outer: 152, inner: 106, stroke: 9, fontSize: 44, labelSize: 'text-sm' },
};

/* ── SVG fallback sign renderers ─────────────────────────────────── */

function WarningSign({ size, symbol }: { size: typeof sizeMap['sm']; symbol: string }) {
  const s = size.outer;
  const pad = size.stroke + 2;
  const pts = `${s / 2},${pad} ${s - pad},${s - pad} ${pad},${s - pad}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <polygon points={pts} fill="white" stroke="#DC2626" strokeWidth={size.stroke} strokeLinejoin="round" />
      <text x={s / 2} y={s * 0.72} textAnchor="middle" dominantBaseline="middle" fontSize={size.fontSize}>{symbol}</text>
    </svg>
  );
}

function GiveWaySign({ size }: { size: typeof sizeMap['sm'] }) {
  const s = size.outer;
  const pad = size.stroke + 2;
  const pts = `${pad},${pad} ${s - pad},${pad} ${s / 2},${s - pad}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <polygon points={pts} fill="white" stroke="#DC2626" strokeWidth={size.stroke} strokeLinejoin="round" />
      <polygon
        points={`${pad + size.stroke * 2},${pad + size.stroke * 1.5} ${s - pad - size.stroke * 2},${pad + size.stroke * 1.5} ${s / 2},${s - pad - size.stroke * 1.5}`}
        fill="#DC2626" stroke="none"
      />
    </svg>
  );
}

function StopSign({ size }: { size: typeof sizeMap['sm'] }) {
  const s = size.outer;
  const c = s / 2;
  const r = c - size.stroke / 2 - 1;
  const angle = (i: number) => ((i * 45 - 22.5) * Math.PI) / 180;
  const pts = Array.from({ length: 8 }, (_, i) =>
    `${c + r * Math.cos(angle(i))},${c + r * Math.sin(angle(i))}`
  ).join(' ');
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <polygon points={pts} fill="#DC2626" stroke="#111" strokeWidth={size.stroke * 0.4} />
      <text x={c} y={c + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size.fontSize * 0.55} fill="white" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="1"
      >STOP</text>
    </svg>
  );
}

function PrioritySign({ size, hollow }: { size: typeof sizeMap['sm']; hollow?: boolean }) {
  const s = size.outer;
  const c = s / 2;
  const r = c - size.stroke;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <rect x={c - r * 0.72} y={c - r * 0.72} width={r * 1.44} height={r * 1.44}
        rx={size.stroke * 0.8} fill={hollow ? 'white' : '#FBBF24'} stroke={hollow ? '#FBBF24' : '#92400E'}
        strokeWidth={size.stroke * 0.8} transform={`rotate(45 ${c} ${c})`}
      />
      {hollow && (
        <rect x={c - r * 0.44} y={c - r * 0.44} width={r * 0.88} height={r * 0.88}
          rx={size.stroke * 0.4} fill="none" stroke="#FBBF24" strokeWidth={size.stroke * 0.7}
          transform={`rotate(45 ${c} ${c})`}
        />
      )}
    </svg>
  );
}

function ProhibitionSign({ size, symbol }: { size: typeof sizeMap['sm']; symbol: string }) {
  const s = size.outer;
  const c = s / 2;
  const r = c - size.stroke / 2 - 1;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <circle cx={c} cy={c} r={r} fill="white" stroke="#DC2626" strokeWidth={size.stroke} />
      <text x={c} y={c + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size.fontSize}>{symbol}</text>
    </svg>
  );
}

function MandatorySign({ size, symbol }: { size: typeof sizeMap['sm']; symbol: string }) {
  const s = size.outer;
  const c = s / 2;
  const r = c - size.stroke * 0.4;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <circle cx={c} cy={c} r={r} fill="#1D4ED8" />
      <text x={c} y={c + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size.fontSize} fill="white">{symbol}</text>
    </svg>
  );
}

function InformationSign({ size, symbol }: { size: typeof sizeMap['sm']; symbol: string }) {
  const s = size.outer;
  const w = s;
  const h = s * 0.78;
  const y0 = (s - h) / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <rect x={size.stroke * 0.5} y={y0 + size.stroke * 0.5} width={w - size.stroke} height={h - size.stroke}
        rx={size.stroke * 1.2} fill="#1D4ED8"
      />
      <text x={s / 2} y={s / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size.fontSize}>{symbol}</text>
    </svg>
  );
}

/* ── SVG fallback selector ───────────────────────────────────────── */
function FallbackSign({ sign, size }: { sign: TrafficSign; size: typeof sizeMap['sm'] }) {
  if (sign.id === 'B1') return <GiveWaySign size={size} />;
  if (sign.id === 'B2') return <StopSign size={size} />;
  if (sign.id === 'B4') return <PrioritySign size={size} />;
  if (sign.id === 'B5') return <PrioritySign size={size} hollow />;
  if (sign.category === 'warning')     return <WarningSign size={size} symbol={sign.symbol} />;
  if (sign.category === 'prohibition') return <ProhibitionSign size={size} symbol={sign.symbol} />;
  if (sign.category === 'mandatory')   return <MandatorySign size={size} symbol={sign.symbol} />;
  if (sign.category === 'information') return <InformationSign size={size} symbol={sign.symbol} />;
  if (sign.category === 'priority')    return <WarningSign size={size} symbol={sign.symbol} />;
  return <InformationSign size={size} symbol={sign.symbol} />;
}

/* ── Official image with fallback ───────────────────────────────── */
function OfficialSignImage({
  sign,
  size,
}: {
  sign: TrafficSign;
  size: typeof sizeMap['sm'];
}) {
  const [failed, setFailed] = useState(false);

  if (!sign.imageUrl || failed) {
    return <FallbackSign sign={sign} size={size} />;
  }

  return (
    <img
      src={sign.imageUrl}
      alt={sign.name}
      width={size.px}
      height={size.px}
      className="object-contain select-none"
      style={{ width: size.px, height: size.px, imageRendering: 'crisp-edges' }}
      onError={() => setFailed(true)}
      loading="eager"
    />
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function SignDisplay({ sign, size = 'md', showLabel = false }: SignDisplayProps) {
  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="drop-shadow-xl">
        <OfficialSignImage sign={sign} size={s} />
      </div>
      {showLabel && (
        <div className="text-center mt-1">
          <p className="text-xs font-mono text-[hsl(var(--sign-code))]">{sign.code}</p>
          <p className={cn('font-semibold text-[hsl(var(--foreground))] max-w-[140px] text-center leading-tight', s.labelSize)}>
            {sign.name}
          </p>
        </div>
      )}
    </div>
  );
}
