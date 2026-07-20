export type CharacterNameValidation =
  | { readonly kind: 'valid'; readonly characterName: string }
  | { readonly kind: 'invalid_length' }
  | { readonly kind: 'invalid_characters' };

export const validateCharacterName = (input: string): CharacterNameValidation => {
  const characterName = input.trim();
  if (characterName.length < 3 || characterName.length > 16) return { kind: 'invalid_length' };
  if (!/^[A-Za-z0-9]+$/.test(characterName)) return { kind: 'invalid_characters' };
  return { kind: 'valid', characterName };
};
