import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'smart' | 'core' | 'warning' | 'success' | 'danger' | 'purple';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  const cls = ['ui-badge', `ui-badge-${tone}`, className].filter(Boolean).join(' ');
  return <span className={cls} {...props}>{children}</span>;
}
