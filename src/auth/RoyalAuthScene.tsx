import type { ReactNode } from 'react';
import { RoyalStoryLogo } from './RoyalStoryLogo';

interface RoyalAuthSceneProps {
  readonly children?: ReactNode;
  readonly loadingText?: string;
}

export function RoyalAuthScene({ children, loadingText }: RoyalAuthSceneProps) {
  return (
    <main className="royal-auth-scene">
      <div className="royal-auth-backdrop" aria-hidden="true" />
      <div className="royal-auth-architecture" aria-hidden="true" />
      <div className="royal-auth-banner royal-auth-banner-left" aria-hidden="true"><span>♛</span></div>
      <div className="royal-auth-banner royal-auth-banner-right" aria-hidden="true"><span>♛</span></div>
      <div className="royal-auth-brazier royal-auth-brazier-left" aria-hidden="true">
        <span className="royal-auth-fire" />
        <span className="royal-auth-fire-glow" />
      </div>
      <div className="royal-auth-brazier royal-auth-brazier-right" aria-hidden="true">
        <span className="royal-auth-fire" />
        <span className="royal-auth-fire-glow" />
      </div>
      <div className="royal-auth-particles" aria-hidden="true" />
      <div className="royal-auth-mist" aria-hidden="true" />
      <div className="royal-auth-content">
        <RoyalStoryLogo />
        {loadingText ? <p className="royal-auth-loading" role="status">{loadingText}</p> : children}
      </div>
    </main>
  );
}
