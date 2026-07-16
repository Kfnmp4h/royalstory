import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { App } from './App';
import { RoyalAuthForm } from './auth/RoyalAuthForm';
import { RoyalAuthScene } from './auth/RoyalAuthScene';
import type { AuthMode } from './auth/authTypes';
import { OfflineReturnDialog } from './components/OfflineReturnDialog';
import { ResetProgressDialog } from './components/ResetProgressDialog';
import { authApi } from './game/api/authApi';
import { playerApi } from './game/api/playerApi';
import type { OfflineRewardSummary, PlayerApiRecord } from './game/save/saveTypes';

const hasRecord = (value: Awaited<ReturnType<typeof playerApi.reset>>): value is Extract<typeof value, { record: PlayerApiRecord }> => (
  value.kind === 'loaded' || value.kind === 'saved' || value.kind === 'stale'
);

export function AuthRoot() {
  const [recoveringPassword, setRecoveringPassword] = useState(() => window.location.pathname === '/reset-password');
  const [record, setRecord] = useState<PlayerApiRecord | null>(null);
  const [checking, setChecking] = useState(() => window.location.pathname !== '/reset-password');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameNotice, setGameNotice] = useState<string | null>(null);
  const [offlineSummary, setOfflineSummary] = useState<OfflineRewardSummary | null>(null);
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
      setOfflineSummary(response.offline);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!recoveringPassword) void loadSession();
  }, [loadSession, recoveringPassword]);

  const requestAnotherReset = () => {
    window.history.replaceState({}, '', '/');
    setRecoveringPassword(false);
    setMode('forgot');
    setPassword('');
    setMessage(null);
  };

  const submitRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await authApi.updatePassword(password);
    if (result.ok) {
      await authApi.signOut();
      window.history.replaceState({}, '', '/');
      setPassword('');
      setRecoveringPassword(false);
      setMessage('Password updated. Sign in with your new password.');
    } else if (result.code === 'unauthorized') {
      setMessage('This reset link is no longer valid. Request a new one.');
    } else {
      setMessage('The password could not be updated. Request a new reset link and try again.');
    }
    setBusy(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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
    setOfflineSummary(null);
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

  if (recoveringPassword) {
    const recoveryStatus = new URLSearchParams(window.location.search).get('auth');
    const invalidRecovery = recoveryStatus === 'invalid-link' || recoveryStatus === 'recovery-failed';
    return (
      <RoyalAuthScene>
        <RoyalAuthForm
          mode="sign-in"
          email={email}
          password={password}
          busy={busy}
          message={message}
          recovery
          invalidRecovery={invalidRecovery}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={submitRecovery}
          onModeChange={setMode}
          onRequestAnotherReset={requestAnotherReset}
        />
      </RoyalAuthScene>
    );
  }

  if (checking) return <RoyalAuthScene loadingText="Checking account session…" />;

  if (!record) {
    return (
      <RoyalAuthScene>
        <RoyalAuthForm
          mode={mode}
          email={email}
          password={password}
          busy={busy}
          message={message}
          recovery={false}
          invalidRecovery={false}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={submit}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setMessage(null);
          }}
          onRequestAnotherReset={requestAnotherReset}
        />
      </RoyalAuthScene>
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
      {offlineSummary ? (
        <OfflineReturnDialog summary={offlineSummary} onClose={() => setOfflineSummary(null)} />
      ) : null}
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
