import type { RoyalBrandVariant } from './types';

interface RoyalBrandMarkProps {
  readonly variant?: RoyalBrandVariant;
  readonly className?: string;
}

export function RoyalBrandMark({ variant = 'full', className = '' }: RoyalBrandMarkProps) {
  const showWordmark = variant === 'full' || variant === 'stacked';
  return (
    <div className={`royal-brand royal-brand--${variant}${className ? ` ${className}` : ''}`} aria-label={showWordmark ? 'RoyalStory' : 'RoyalStory crown'}>
      <svg className="royal-brand__crown" viewBox="0 0 120 82" aria-hidden="true">
        <path d="M10 59 19 19l28 23L60 8l13 34 28-23 9 40-12 15H22Z" />
        <path className="royal-brand__gem" d="m60 28 12 12-12 18-12-18Z" />
        <path className="royal-brand__base" d="M22 62h76v13H22Z" />
      </svg>
      {showWordmark ? <span className="royal-brand__wordmark">RoyalStory</span> : null}
      {showWordmark ? <span className="royal-brand__ornament" aria-hidden="true">◆</span> : null}
    </div>
  );
}
