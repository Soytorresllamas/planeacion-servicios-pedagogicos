import type { ReactNode } from 'react';

type KpiTone = 'default' | 'good' | 'warn' | 'danger';

interface KpiCardProps {
  value: ReactNode;
  label: ReactNode;
  tone?: KpiTone;
  detail?: ReactNode;
}

export function KpiCard({ value, label, tone = 'default', detail }: KpiCardProps) {
  const cls = ['ui-kpi', tone !== 'default' && `ui-kpi-${tone}`].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="ui-kpi-value">{value}</div>
      <div className="ui-kpi-label">{label}</div>
      {detail && <div className="ui-kpi-detail">{detail}</div>}
    </div>
  );
}
