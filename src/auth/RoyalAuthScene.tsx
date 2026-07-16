import type { ReactNode } from 'react';
import { RoyalStoryLogo } from './RoyalStoryLogo';

interface RoyalAuthSceneProps {
  readonly children?: ReactNode;
  readonly loadingText?: string;
}

function Brazier({ side }: { readonly side: 'left' | 'right' }) {
  return (
    <div className={`royal-auth-brazier royal-auth-brazier-${side}`} aria-hidden="true">
      <span className="royal-auth-brazier-bowl" />
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
    <main className="royal-auth-scene">
      <div className="royal-auth-backdrop" aria-hidden="true" />
      <div className="royal-auth-moonlight royal-auth-moonlight-left" aria-hidden="true" />
      <div className="royal-auth-moonlight royal-auth-moonlight-right" aria-hidden="true" />
      <div className="royal-auth-architecture" aria-hidden="true">
        <span className="royal-auth-arch royal-auth-arch-left" />
        <span className="royal-auth-arch royal-auth-arch-center" />
        <span className="royal-auth-arch royal-auth-arch-right" />
        <span className="royal-auth-column royal-auth-column-left" />
        <span className="royal-auth-column royal-auth-column-right" />
      </div>
      <div className="royal-auth-throne" aria-hidden="true">
        <span className="royal-auth-throne-crown">♛</span>
      </div>
      <div className="royal-auth-carpet" aria-hidden="true" />
      <div className="royal-auth-banner royal-auth-banner-left" aria-hidden="true"><span>♛</span></div>
      <div className="royal-auth-banner royal-auth-banner-right" aria-hidden="true"><span>♛</span></div>
      <Brazier side="left" />
      <Brazier side="right" />
      <div className="royal-auth-floor-light royal-auth-floor-light-left" aria-hidden="true" />
      <div className="royal-auth-floor-light royal-auth-floor-light-right" aria-hidden="true" />
      <div className="royal-auth-particles" aria-hidden="true" />
      <div className="royal-auth-mist" aria-hidden="true" />
      <div className="royal-auth-vignette" aria-hidden="true" />
      <div className="royal-auth-content">
        <RoyalStoryLogo />
        {loadingText ? <p className="royal-auth-loading" role="status">{loadingText}</p> : children}
      </div>
    </main>
  );
}
