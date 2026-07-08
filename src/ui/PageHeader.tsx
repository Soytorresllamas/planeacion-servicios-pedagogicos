import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, status, actions }: PageHeaderProps) {
  return (
    <header className="ui-page-head">
      <div className="ui-page-copy">
        <h1>{title}</h1>
        {(description || status) && (
          <div className="ui-page-sub">
            {description}
            {status && <b> · {status}</b>}
          </div>
        )}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </header>
  );
}
