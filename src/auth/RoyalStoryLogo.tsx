interface RoyalStoryLogoProps {
  readonly compact?: boolean;
}

export function RoyalStoryLogo({ compact = false }: RoyalStoryLogoProps) {
  return (
    <div className={`royal-story-logo${compact ? ' is-compact' : ''}`} aria-label="RoyalStory">
      <span className="royal-story-logo-halo" aria-hidden="true" />
      <span className="royal-story-logo-crown" aria-hidden="true">
        <span className="royal-story-logo-crown-gem" />
      </span>
      <span className="royal-story-logo-flourish royal-story-logo-flourish-left" aria-hidden="true">⚜</span>
      <span className="royal-story-logo-text" data-text="RoyalStory">RoyalStory</span>
      <span className="royal-story-logo-flourish royal-story-logo-flourish-right" aria-hidden="true">⚜</span>
      <span className="royal-story-logo-ribbon" aria-hidden="true">Forge your legend</span>
      <span className="royal-story-logo-shine" aria-hidden="true" />
    </div>
  );
}
