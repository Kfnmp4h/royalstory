import { RoyalButton } from '../ui/RoyalButton';
import { RoyalDivider } from '../ui/RoyalDivider';
import { RoyalInput } from '../ui/RoyalInput';
import { RoyalPanel } from '../ui/RoyalPanel';
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
  const heading = recovery ? 'Choose a new password' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Reset password';
  const submitLabel = recovery ? busy ? 'Updating…' : 'Update password' : busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link';

  return (
    <RoyalPanel className="royal-auth-card" variant="modal">
      <p className="royal-auth-kicker">Enter the kingdom</p>
      <h1 className="royal-auth-heading">{heading}</h1>
      <RoyalDivider />

      {recovery && invalidRecovery ? (
        <div className="royal-auth-invalid">
          <p role="alert">This reset link is invalid or expired.</p>
          <RoyalButton variant="text" onClick={onRequestAnotherReset}>Request another reset link</RoyalButton>
        </div>
      ) : (
        <form className="royal-auth-form" onSubmit={onSubmit}>
          {!recovery ? <RoyalInput label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => onEmailChange(event.target.value)} /> : null}
          {mode !== 'forgot' || recovery ? <RoyalInput label={recovery ? 'New password' : 'Password'} type="password" autoComplete={recovery || mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={(event) => onPasswordChange(event.target.value)} /> : null}
          <RoyalButton type="submit" disabled={busy}>{submitLabel}</RoyalButton>
        </form>
      )}

      {message ? <p className="royal-auth-message" role="status">{message}</p> : null}
      {!recovery ? (
        <div className="royal-auth-links">
          <RoyalButton variant="text" onClick={() => onModeChange(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>{mode === 'sign-up' ? 'Already have an account?' : 'Create account'}</RoyalButton>
          <RoyalButton variant="text" onClick={() => onModeChange(mode === 'forgot' ? 'sign-in' : 'forgot')}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</RoyalButton>
        </div>
      ) : null}
    </RoyalPanel>
  );
}
