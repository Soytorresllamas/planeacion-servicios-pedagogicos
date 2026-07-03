import { urgencia } from '../../data/planeacion'
import type { Servicio, Estatus, Urgencia } from '../../data/planeacion'
import { TIER_SEED } from '../../data/model'
import type { TierKey } from '../../data/model'

// Tokens de color/estado compartidos por el portal del asesor y la hoja del coordinador.
// Todo desde variables de index.css (nada de hex sueltos).
export const SMART = 'var(--smart)', CORE = 'var(--core)'
export const EST_COLOR: Record<Estatus, string> = { pendiente: 'var(--faint)', agendado: 'var(--gold)', realizado: 'var(--core)' }
export const EST_LABEL: Record<Estatus, string> = { pendiente: 'Pendiente', agendado: 'Agendado', realizado: 'Realizado' }
export const SERV_LABEL: Record<string, string> = { uso: 'Uso', prof: 'Profundización', didac: 'Didáctica Específica' }
export const URG_BG: Record<Urgencia, string | undefined> = { vencido: 'var(--gold-wash)', proximo: undefined, realizado: undefined, agendado: undefined, sinfecha: undefined }
export const tierLabel = (k: TierKey) => TIER_SEED.find((t) => t.key === k)?.label ?? k

// color de cada tramo de la barra unificada según el estado del servicio
export const segColor = (s: Servicio, hoy: string) => {
  if (s.estatus === 'realizado') return 'var(--core)'
  if (urgencia(s, hoy) === 'vencido') return 'var(--gold)'
  if (s.estatus === 'agendado') return 'var(--gold-l)'
  return 'var(--line-2)'
}
