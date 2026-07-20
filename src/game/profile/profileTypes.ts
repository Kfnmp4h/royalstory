export interface PlayerProfile {
  readonly characterName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProfileLoadResult =
  | { readonly kind: 'loaded'; readonly profile: PlayerProfile }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'unavailable'; readonly message: string };

export type ProfileCreateResult =
  | { readonly kind: 'created'; readonly profile: PlayerProfile }
  | { readonly kind: 'name_taken' }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'unavailable'; readonly message: string };
