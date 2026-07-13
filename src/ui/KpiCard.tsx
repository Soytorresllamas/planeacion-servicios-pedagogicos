import type { ReactNode } from 'react';

type KpiTone = 'default' | 'good' | 'warn' | 'danger';

interface KpiCardProps {
  value: ReactNode;
  label: ReactNode;
  tone?: KpiTone;
  detail?: ReactNode;
  icon?: ReactNode;
}

export function KpiCard({ value, label, tone = 'default', detail, icon }: KpiCardProps) {
  const cls = ['ui-kpi', icon && 'ui-kpi-rich', tone !== 'default' && `ui-kpi-${tone}`].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {icon ? <>
        <span className="ui-kpi-icon" aria-hidden>{icon}</span>
        <div className="ui-kpi-copy">
          <div className="ui-kpi-label">{label}</div>
          <div className="ui-kpi-value">{value}</div>
          {detail && <div className="ui-kpi-detail">{detail}</div>}
        </div>
      </> : <>
        <div className="ui-kpi-value">{value}</div>
        <div className="ui-kpi-label">{label}</div>
        {detail && <div className="ui-kpi-detail">{detail}</div>}
      </>}
    </div>
  );
}
