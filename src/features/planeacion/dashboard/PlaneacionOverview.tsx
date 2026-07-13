import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Icon } from '../../../ui/Icon'

export interface CampaignOverviewStat {
  campaign: 'SMART' | 'CORE'
  schools: number
  planned: number
  inProgress: number
  pending: number
  progress: number
}

export interface AttentionSchool {
  id: string
  name: string
  detail: string
  campaign: 'SMART' | 'CORE'
  state: 'Sin asignar' | 'Pendiente' | 'En progreso'
  progress: number
  responsible: string
}

interface PlaneacionOverviewProps {
  alerts: number
  campaigns: CampaignOverviewStat[]
  schools: AttentionSchool[]
  onOpenAssignments: () => void
  onOpenSchool: () => void
}

const toneByState = {
  'Sin asignar': 'danger',
  Pendiente: 'warning',
  'En progreso': 'neutral',
} as const

export function PlaneacionOverview({ alerts, campaigns, schools, onOpenAssignments, onOpenSchool }: PlaneacionOverviewProps) {
  return (
    <div className="planning-overview">
      {alerts > 0 && (
        <section className="planning-alert" aria-label="Atención requerida">
          <span className="planning-alert-icon"><Icon name="alert" size={23} /></span>
          <div>
            <b>Atención requerida</b>
            <p>{alerts} {alerts === 1 ? 'caso crítico requiere' : 'casos críticos requieren'} seguimiento de coordinación.</p>
          </div>
          <a href="#alertas-planeacion" className="planning-alert-link">Ver detalles</a>
        </section>
      )}

      <div className="planning-campaign-grid">
        {campaigns.map((item) => (
          <article key={item.campaign} className={`planning-campaign planning-campaign-${item.campaign.toLowerCase()}`}>
            <header>
              <div>
                <span className="planning-campaign-label">Campaña</span>
                <h2>{item.campaign}</h2>
              </div>
              <Badge tone={item.campaign === 'SMART' ? 'smart' : 'core'}>Activa</Badge>
            </header>
            <dl className="planning-campaign-metrics">
              <div><dt>Colegios</dt><dd>{item.schools.toLocaleString('es-MX')}</dd></div>
              <div><dt>Planeados</dt><dd>{item.planned.toLocaleString('es-MX')}</dd></div>
              <div><dt>En progreso</dt><dd>{item.inProgress.toLocaleString('es-MX')}</dd></div>
              <div><dt>Pendientes</dt><dd>{item.pending.toLocaleString('es-MX')}</dd></div>
            </dl>
            <div className="planning-campaign-progress-copy">
              <span>Avance de servicios</span><b>{item.progress}%</b>
            </div>
            <div className="planning-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
              <span style={{ width: `${item.progress}%` }} />
            </div>
            <button type="button" className="planning-campaign-link" onClick={onOpenAssignments}>
              Ver asignación <Icon name="arrow-right" size={16} />
            </button>
          </article>
        ))}
      </div>

      <section className="planning-attention">
        <header className="planning-section-head">
          <div>
            <h2>Colegios por atender</h2>
            <p>Prioridad calculada por asignación y avance pendiente.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpenSchool}>Ver todos los colegios</Button>
        </header>
        <div className="planning-attention-table">
          <table>
            <thead><tr><th>Colegio</th><th>Campaña</th><th>Estado</th><th>Avance</th><th>Responsable</th></tr></thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id}>
                  <td><span className="planning-school"><i><Icon name="school" size={17} /></i><span><b>{school.name}</b><small>{school.detail}</small></span></span></td>
                  <td><Badge tone={school.campaign === 'SMART' ? 'smart' : 'core'}>{school.campaign}</Badge></td>
                  <td><Badge tone={toneByState[school.state]}>{school.state}</Badge></td>
                  <td>
                    <span className="planning-table-progress">
                      <span><i style={{ width: `${school.progress}%` }} /></span><b>{school.progress}%</b>
                    </span>
                  </td>
                  <td>{school.responsible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
