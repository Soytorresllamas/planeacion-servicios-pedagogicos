import type { ReactNode } from 'react';

interface DataTableProps {
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
}

export function DataTable({ children, empty, isEmpty }: DataTableProps) {
  if (isEmpty && empty) return <>{empty}</>;
  return <div className="ui-data-table">{children}</div>;
}
