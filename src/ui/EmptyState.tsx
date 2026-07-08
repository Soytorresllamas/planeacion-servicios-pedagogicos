import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title = 'Sin resultados', detail, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <div className="ui-empty-title">{title}</div>
      {detail && <div className="ui-empty-detail">{detail}</div>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
