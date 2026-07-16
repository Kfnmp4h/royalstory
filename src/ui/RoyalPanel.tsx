import { useId, type ReactNode } from 'react';
import type { RoyalPanelVariant } from './types';

interface RoyalPanelProps {
  readonly variant?: RoyalPanelVariant;
  readonly title?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function RoyalPanel({ variant = 'default', title, children, className = '' }: RoyalPanelProps) {
  const headingId = useId();
  const classes = `royal-panel royal-panel--${variant}${className ? ` ${className}` : ''}`;
  const corners = <>{['tl', 'tr', 'bl', 'br'].map((corner) => <span key={corner} className={`royal-panel__corner royal-panel__corner--${corner}`} aria-hidden="true" />)}</>;

  if (!title) return <section className={classes}>{corners}{children}</section>;
  return <section className={classes} role="region" aria-labelledby={headingId}>{corners}<h2 id={headingId} className="royal-panel__title">{title}</h2>{children}</section>;
}
