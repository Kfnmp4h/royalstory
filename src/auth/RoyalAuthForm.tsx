import type { RoyalAuthFormProps } from './authTypes';

export function RoyalAuthForm({
  mode,
  email,
  password,
  busy,
  message,
  recovery,
  invalidRecovery,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onModeChange,
  onRequestAnotherReset,
}: RoyalAuthFormProps) {
  const heading = recovery
    ? 'Choose a new password'
    : mode === 'sign-in'
      ? 'Sign in'
      : mode === 'sign-up'
        ? 'Create account'
        : 'Reset password';

  const submitLabel = recovery
    ? busy ? 'Updating…' : 'Update password'
    : busy
      ? 'Please wait…'
      : mode === 'sign-in'
        ? 'Sign in'
        : mode === 'sign-up'
          ? 'Create account'
          : 'Send reset link';

  return (
    <section className="royal-auth-card" aria-label={recovery ? 'Choose a new RoyalStory password' : 'RoyalStory account'}>
      <p className="royal-auth-kicker">Enter the kingdom</p>
      <h1 className="royal-auth-heading">{heading}</h1>

      {recovery && invalidRecovery ? (
        <div className="royal-auth-invalid">
          <p role="alert">This reset link is invalid or expired.</p>
          <button type="button" onClick={onRequestAnotherReset}>Request another reset link</button>
        </div>
      ) : (
        <form className="royal-auth-form" onSubmit={onSubmit}>
          {!recovery ? (
            <label className="royal-auth-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </label>
          ) : null}

          {mode !== 'forgot' || recovery ? (
            <label className="royal-auth-field">
              <span>{recovery ? 'New password' : 'Password'}</span>
              <input
                type="password"
                autoComplete={recovery || mode === 'sign-up' ? 'new-password' : 'current-password'}
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </label>
          ) : null}

          <button className="royal-auth-primary" type="submit" disabled={busy}>{submitLabel}</button>
        </form>
      )}

      {message ? <p className="royal-auth-message" role="status">{message}</p> : null}

      {!recovery ? (
        <div className="royal-auth-links">
          <button type="button" onClick={() => onModeChange(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>
            {mode === 'sign-up' ? 'Already have an account?' : 'Create account'}
          </button>
          <button type="button" onClick={() => onModeChange(mode === 'forgot' ? 'sign-in' : 'forgot')}>
            {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
