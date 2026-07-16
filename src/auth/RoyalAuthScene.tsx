import type { ReactNode } from 'react';
import { RoyalBrandMark } from '../ui/RoyalBrandMark';

interface RoyalAuthSceneProps {
  readonly children?: ReactNode;
  readonly loadingText?: string;
}

function AnimatedBrazier({ side }: { readonly side: 'left' | 'right' }) {
  return (
    <div className={`royal-auth-brazier royal-auth-brazier-${side}`} aria-hidden="true">
      <span className="royal-auth-fire royal-auth-fire-back" />
      <span className="royal-auth-fire royal-auth-fire-mid" />
      <span className="royal-auth-fire royal-auth-fire-front" />
      <span className="royal-auth-fire-glow" />
      <span className="royal-auth-smoke" />
    </div>
  );
}

export function RoyalAuthScene({ children, loadingText }: RoyalAuthSceneProps) {
  return (
    <main className="royal-auth-scene royal-auth-scene--illustrated">
      <div className="royal-auth-backdrop royal-auth-backdrop--illustrated" aria-hidden="true" />
      <AnimatedBrazier side="left" />
      <AnimatedBrazier side="right" />
      <div className="royal-auth-particles" aria-hidden="true" />
      <div className="royal-auth-mist" aria-hidden="true" />
      <div className="royal-auth-content royal-auth-content--prototype">
        <RoyalBrandMark variant="stacked" />
        {loadingText ? <p className="royal-auth-loading" role="status">{loadingText}</p> : children}
      </div>
    </main>
  );
}
