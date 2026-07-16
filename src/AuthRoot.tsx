import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { App } from './App';
import { ResetProgressDialog } from './components/ResetProgressDialog';
import { authApi } from './game/api/authApi';
import { playerApi } from './game/api/playerApi';
import type { PlayerApiRecord } from './game/save/saveTypes';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot';

const hasRecord = (value: Awaited<ReturnType<typeof playerApi.reset>>): value is Extract<typeof value, { record: PlayerApiRecord }> => (
  value.kind === 'loaded' || value.kind === 'saved' || value.kind === 'stale'
);

export function AuthRoot() {
  const [record, setRecord] = useState<PlayerApiRecord | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameNotice, setGameNotice] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const loadSession = useCallback(async () => {
    setChecking(true);
    const loaded = await playerApi.load();
    if (loaded.kind !== 'loaded' && loaded.kind !== 'saved' && loaded.kind !== 'stale') {
      setRecord(null);
      setChecking(false);
      return;
    }

    const synced = await playerApi.command({
      type: 'sync',
      expectedVersion: loaded.record.saveVersion,
    });
    const response = synced.kind === 'loaded' || synced.kind === 'saved' || synced.kind === 'stale'
      ? synced
      : loaded;
    setRecord(response.record);
    if ('offline' in response && response.offline && response.offline.kills > 0) {
      setGameNotice(
        `Offline rewards: ${response.offline.gold} gold, ${response.offline.xp} XP, ${response.offline.drops.length} drops.`,
      );
    }
    setChecking(false);
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === 'forgot') {
      const result = await authApi.requestPasswordReset(email);
      setMessage(result.ok ? 'If the account exists, a reset link has been sent.' : 'Could not request a reset link.');
      setBusy(false);
      return;
    }
    const result = mode === 'sign-up'
      ? await authApi.signUp({ email, password })
      : await authApi.signIn({ email, password });
    if (result.ok) {
      await loadSession();
    } else if (result.code === 'confirmation_required') {
      setMessage('Check your email and confirm the account before signing in.');
    } else {
      setMessage('The email or password could not be accepted.');
    }
    setBusy(false);
  };

  const signOut = async () => {
    setBusy(true);
    await authApi.signOut();
    setRecord(null);
    setGameNotice(null);
    setResetOpen(false);
    setBusy(false);
  };

  const resetProgress = async () => {
    if (!record) return;
    setBusy(true);
    const response = await playerApi.reset(record.saveVersion, 'RESET', true);
    if (hasRecord(response)) {
      setRecord(response.record);
      setGameNotice(response.kind === 'stale'
        ? 'Progress changed elsewhere. The latest server save was loaded instead of resetting.'
        : 'Progress reset complete. A new level 1 save is active.');
      setResetOpen(false);
    } else if (response.kind === 'unauthorized') {
      setRecord(null);
      setMessage('Your session expired. Sign in again.');
      setResetOpen(false);
    } else {
      setGameNotice(response.message);
    }
    setBusy(false);
  };

  if (checking) return <main className="auth-shell"><p>Checking account session…</p></main>;

  if (!record) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-label="RoyalStory account">
          <p className="eyebrow">Milestone 6 · Online save</p>
          <h1>RoyalStory</h1>
          <h2>{mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Reset password'}</h2>
          <form onSubmit={submit}>
            <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {mode !== 'forgot' ? (
              <label>Password<input type="password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            ) : null}
            <button className="primary-action" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}</button>
          </form>
          {message ? <p role="status">{message}</p> : null}
          <div className="auth-actions">
            <button type="button" onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>{mode === 'sign-up' ? 'Already have an account?' : 'Create account'}</button>
            <button type="button" onClick={() => setMode(mode === 'forgot' ? 'sign-in' : 'forgot')}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="account-bar">
        <span>Online save active</span>
        <div className="account-actions">
          <button type="button" disabled={busy} onClick={() => setResetOpen(true)}>Reset progress</button>
          <button type="button" disabled={busy} onClick={signOut}>Sign out</button>
        </div>
      </div>
      <App record={record} onRecordChange={setRecord} initialNotice={gameNotice} />
      {resetOpen ? (
        <ResetProgressDialog
          busy={busy}
          onCancel={() => setResetOpen(false)}
          onConfirm={resetProgress}
        />
      ) : null}
    </>
  );
}
