import { useId, type InputHTMLAttributes } from 'react';

interface RoyalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}

export function RoyalInput({ label, hint, error, className = '', ...props }: RoyalInputProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <label className={`royal-input${className ? ` ${className}` : ''}`} htmlFor={id}>
      <span className="royal-input__label">{label}</span>
      <input id={id} className="royal-input__control" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {hint ? <span id={hintId} className="royal-input__hint">{hint}</span> : null}
      {error ? <span id={errorId} className="royal-input__error" role="alert">{error}</span> : null}
    </label>
  );
}
