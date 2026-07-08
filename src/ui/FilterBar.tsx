import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  trailing?: ReactNode;
}

export function FilterBar({ children, trailing }: FilterBarProps) {
  return (
    <div className="ui-filter-bar">
      <div className="ui-filter-controls">{children}</div>
      {trailing && <div className="ui-filter-trailing">{trailing}</div>}
    </div>
  );
}

export function FilterCount({ children }: { children: ReactNode }) {
  return <span className="ui-filter-count">{children}</span>;
}
