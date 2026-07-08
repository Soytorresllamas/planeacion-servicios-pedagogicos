import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const cls = ['ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? <span className="ui-btn-spinner" aria-hidden /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
}
