import type { FormEvent } from 'react';

export type AuthMode = 'sign-in' | 'sign-up' | 'forgot';

export interface RoyalAuthFormProps {
  readonly mode: AuthMode;
  readonly email: string;
  readonly password: string;
  readonly busy: boolean;
  readonly message: string | null;
  readonly recovery: boolean;
  readonly invalidRecovery: boolean;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onModeChange: (mode: AuthMode) => void;
  readonly onRequestAnotherReset: () => void;
}
