import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateCharacterName } from '../game/profile/profileValidation';

type CharacterCreationProps = {
  readonly busy: boolean;
  readonly serverMessage: string | null;
  readonly onCreate: (characterName: string) => Promise<void>;
  readonly onSignOut: () => Promise<void>;
};

export function CharacterCreation({ busy, serverMessage, onCreate, onSignOut }: CharacterCreationProps) {
  const [name, setName] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateCharacterName(name);
    if (validation.kind === 'invalid_length') {
      setValidationMessage('Character names must be 3–16 characters.');
      return;
    }
    if (validation.kind === 'invalid_characters') {
      setValidationMessage('Use letters and numbers only.');
      return;
    }
    setValidationMessage(null);
    await onCreate(validation.characterName);
  };

  return (
    <section className="auth-panel character-creation-panel" aria-label="Create your RoyalStory character">
      <h1>Create Your Character</h1>
      <p className="character-creation-copy">Choose a unique name before entering the kingdom.</p>
      <form onSubmit={submit}>
        <label>
          Character name
          <input
            autoComplete="off"
            autoFocus
            maxLength={16}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby="character-name-help"
          />
        </label>
        <p id="character-name-help" className="character-name-help">3–16 letters or numbers.</p>
        <button className="primary-action" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create Character'}
        </button>
      </form>
      {validationMessage ? <p role="alert">{validationMessage}</p> : null}
      {serverMessage ? <p role="status">{serverMessage}</p> : null}
      <div className="auth-actions">
        <button type="button" disabled={busy} onClick={() => void onSignOut()}>Sign out</button>
      </div>
    </section>
  );
}
