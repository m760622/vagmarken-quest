import { LayoutGrid } from 'lucide-react';
import { SignCategory } from '@/types/game';

/* ── Category icon: the actual shape/colour of that sign family ───── */
export function CategoryIcon({ category, className }: { category: SignCategory | 'all'; className?: string }) {
  const common = { viewBox: '0 0 24 24', className, 'aria-hidden': true } as const;
  switch (category) {
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 3.2 21.4 19.8H2.6Z" fill="#fff" stroke="#E11D48" strokeWidth="2.6" strokeLinejoin="round" />
          <rect x="11.1" y="9" width="1.8" height="5.4" rx=".9" fill="#111827" />
          <circle cx="12" cy="16.6" r="1.1" fill="#111827" />
        </svg>
      );
    case 'prohibition':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" fill="#fff" stroke="#E11D48" strokeWidth="3" />
          <path d="M6.6 17.4 17.4 6.6" stroke="#E11D48" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'mandatory':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#1D4ED8" />
          <path d="M12 17V8m0 0-3.6 3.6M12 8l3.6 3.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'priority':
      return (
        <svg {...common}>
          <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="2.2" transform="rotate(45 12 12)" fill="#fff" stroke="#111827" strokeWidth="1.2" />
          <rect x="7.4" y="7.4" width="9.2" height="9.2" rx="1.4" transform="rotate(45 12 12)" fill="#FBBF24" />
        </svg>
      );
    case 'additional':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="10" rx="2" fill="#fff" stroke="#111827" strokeWidth="1.6" />
          <rect x="6.5" y="11" width="11" height="2" rx="1" fill="#111827" />
        </svg>
      );
    case 'information':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#1D4ED8" />
          <rect x="11.1" y="10.6" width="1.8" height="6" rx=".9" fill="#fff" />
          <circle cx="12" cy="7.9" r="1.2" fill="#fff" />
        </svg>
      );
    default:
      return <LayoutGrid className={className} />;
  }
}
