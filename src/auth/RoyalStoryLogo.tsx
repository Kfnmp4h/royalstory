interface RoyalStoryLogoProps {
  readonly compact?: boolean;
}

export function RoyalStoryLogo({ compact = false }: RoyalStoryLogoProps) {
  return (
    <div className={`royal-story-logo${compact ? ' is-compact' : ''}`} aria-label="RoyalStory">
      <span className="royal-story-logo-crown" aria-hidden="true">♛</span>
      <span className="royal-story-logo-text">RoyalStory</span>
      <span className="royal-story-logo-gem" aria-hidden="true" />
    </div>
  );
}
