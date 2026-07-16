import type { ReactNode } from 'react';
import { RoyalBrandMark } from '../ui/RoyalBrandMark';

interface RoyalAuthSceneProps {
  readonly children?: ReactNode;
  readonly loadingText?: string;
}

export function RoyalAuthScene({ children, loadingText }: RoyalAuthSceneProps) {
  return (
    <main className="royal-auth-scene">
      <div className="royal-auth-backdrop" aria-hidden="true" />
      <div className="royal-auth-architecture" aria-hidden="true" />
      <div className="royal-auth-depth" aria-hidden="true"><span className="royal-auth-window royal-auth-window-left" /><span className="royal-auth-throne" /><span className="royal-auth-window royal-auth-window-right" /></div>
      <div className="royal-auth-carpet" aria-hidden="true" />
      <div className="royal-auth-banner royal-auth-banner-left" aria-hidden="true"><span>♛</span></div>
      <div className="royal-auth-banner royal-auth-banner-right" aria-hidden="true"><span>♛</span></div>
      <div className="royal-auth-brazier royal-auth-brazier-left" aria-hidden="true"><span className="royal-auth-fire royal-auth-fire-back" /><span className="royal-auth-fire royal-auth-fire-mid" /><span className="royal-auth-fire royal-auth-fire-front" /><span className="royal-auth-fire-glow" /><span className="royal-auth-smoke" /></div>
      <div className="royal-auth-brazier royal-auth-brazier-right" aria-hidden="true"><span className="royal-auth-fire royal-auth-fire-back" /><span className="royal-auth-fire royal-auth-fire-mid" /><span className="royal-auth-fire royal-auth-fire-front" /><span className="royal-auth-fire-glow" /><span className="royal-auth-smoke" /></div>
      <div className="royal-auth-particles" aria-hidden="true" />
      <div className="royal-auth-mist" aria-hidden="true" />
      <div className="royal-auth-content">
        <RoyalBrandMark variant="stacked" />
        {loadingText ? <p className="royal-auth-loading" role="status">{loadingText}</p> : children}
      </div>
    </main>
  );
}
