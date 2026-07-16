import type { ButtonHTMLAttributes } from 'react';
import type { RoyalButtonVariant } from './types';

interface RoyalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: RoyalButtonVariant;
}

export function RoyalButton({ variant = 'primary', className = '', type, ...props }: RoyalButtonProps) {
  return <button type={type ?? 'button'} className={`royal-button royal-button--${variant}${className ? ` ${className}` : ''}`} {...props} />;
}
