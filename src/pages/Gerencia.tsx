import { useEffect, useMemo, useState } from 'react'
import { useAcceso } from '../lib/accesoCtx'
import { loadLocal, loadRemote } from '../lib/planeacionStore'
import { defaultPlaneacion, normNombre, resumenEjecutivos, resumenGerencia, seguimientoColegio } from '../data/planeacion'
import type { PlaneacionData, PrioridadGerencia } from '../data/planeacion'
import { PageHeader } from '../ui/PageHeader'
import { KpiCard } from '../ui/KpiCard'
import { NumberTicker } from '../ui/NumberTicker'
import { FilterBar, FilterCount } from '../ui/FilterBar'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'
import { ProgressRing } from '../ui/ProgressRing'
import { SMART, CORE, SERV_LABEL } from '../features/planeacion/colors'

const PRIORIDAD: Record<PrioridadGerencia, { label: string; tone: 'danger' | 'warning' | 'smart' | 'neutral' | 'success' }> = {
  critico: { label: 'Crítico', tone: 'danger' }, atrasado: { label: 'Atrasado', tone: 'warning' },
  en_agenda: { label: 'En agenda', tone: 'smart' }, por_programar: { label: 'Por programar', tone: 'neutral' }, completo: { label: 'Completo', tone: 'success' },
}

const fmtFecha = (iso?: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha'

export default function Gerencia() {
  const { sesion } = useAcceso()
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [status, setStatus] = useState('Cargando…')
  const [gerenciaPreview, setGerenciaPreview] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState<'todos' | PrioridadGerencia>('todos')
  const [filtroCamp, setFiltroCamp] = useState<'todos' | 'SMART' | 'CORE'>('todos')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  useEffect(() => {
    let vivo = true
    loadRemote().then((res) => {
      if (!vivo) return
      if (res.source === 'remote') setData(res.data)
      setStatus(res.source === 'remote' ? 'Sincronizado' : 'Sin conexión · local')
    })
    return () => { vivo = false }
  }, [])

  const gerencias = useMemo(() => [...new Set(data.colegios.map((c) => c.gerencia).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [data.colegios])
  const esGerente = sesion.rol === 'gerente'
  const gerencia = esGerente ? (sesion.gerencia ?? '') : gerenciaPreview
  const asesores = useMemo(() => new Map(data.asesores.map((a) => [a.id, a.nombre])), [data.asesores])
  const resumen = useMemo(() => resumenGerencia(data.colegios, gerencia, data.alertas ?? []), [data.colegios, data.alertas, gerencia])
  const ejecutivos = useMemo(() => resumenEjecutivos(data.colegios, gerencia, data.alertas ?? []), [data.colegios, data.alertas, gerencia])

  const colegios = useMemo(() => data.colegios
    .filter((c) => !gerencia || normNombre(c.gerencia ?? '') === normNombre(gerencia))
    .map((c) => seguimientoColegio(c, data.alertas ?? []))
    .filter((r) => (filtroPrioridad === 'todos' || r.prioridad === filtroPrioridad)
      && (filtroCamp === 'todos' || r.colegio.campaign === filtroCamp)
      && (!busca || `${r.colegio.nombre} ${r.colegio.ejecutivo ?? ''}`.toLowerCase().includes(busca.toLowerCase())))
  , [data.colegios, data.alertas, gerencia, filtroPrioridad, filtroCamp, busca])
  const colegiosPorEjecutivo = useMemo(() => {
    const m = new Map<string, typeof colegios>()
    for (const row of colegios) { const k = row.colegio.ejecutivo?.trim() || '(sin ejecutivo)'; m.set(k, [...(m.get(k) ?? []), row]) }
    return m
  }, [colegios])
  const prioridades = useMemo(() => colegios.filter((r) => r.prioridad === 'critico' || r.prioridad === 'atrasado').sort((a, b) => b.alertasAbiertas - a.alertasAbiertas || b.vencidos - a.vencidos).slice(0, 6), [colegios])
  const porCamp = (camp: 'SMART' | 'CORE') => {
    const rows = data.colegios.filter((c) => (!gerencia || normNombre(c.gerencia ?? '') === normNombre(gerencia)) && c.campaign === camp).map((c) => seguimientoColegio(c, data.alertas ?? []))
    const total = rows.reduce((n, r) => n + r.total, 0); const done = rows.reduce((n, r) => n + r.realizados, 0)
    return { colegios: rows.length, total, done, pct: total ? Math.round(done / total * 100) : 0 }
  }
  const smart = porCamp('SMART'); const core = porCamp('CORE')
  const toggle = (key: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  if (esGerente && !sesion.gerencia) return <div className="gate"><div className="gate-card"><h1 className="gate-title">Gerencia sin asignar</h1><p className="gate-sub">Tu cuenta todavía no tiene una gerencia regional vinculada. Solicita al administrador que la configure.</p></div></div>

  return <div className="gerencia-page">
    <PageHeader title={esGerente ? `Gerencia ${gerencia}` : 'Seguimiento regional'} status={status}
      description="Avance de servicios por ejecutivo comercial y colegio. Los asesores pedagógicos aparecen como responsables operativos, sin pertenecer a una gerencia."
      actions={!esGerente ? <select value={gerencia} onChange={(e) => { setGerenciaPreview(e.target.value); setAbiertos(new Set()) }} aria-label="Gerencia de vista previa"><option value="">Todas las gerencias</option>{gerencias.map((g) => <option key={g} value={g}>{g}</option>)}</select> : undefined} />

    <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))' }}>
      <KpiCard icon={<Icon name="users" />} value={<NumberTicker value={resumen.ejecutivos} />} label="Ejecutivos" detail={`${resumen.colegios} colegios`} />
      <KpiCard icon={<Icon name="chart" />} value={`${resumen.porcentaje}%`} label="Avance regional" detail={`${resumen.realizados} de ${resumen.servicios} servicios`} />
      <KpiCard icon={<Icon name="calendar" />} value={<NumberTicker value={resumen.pendientes} />} label="Por programar" detail={`${resumen.agendados} en agenda`} />
      <KpiCard icon={<Icon name="alert" />} tone={resumen.alertasAbiertas ? 'danger' : 'good'} value={<NumberTicker value={resumen.alertasAbiertas} />} label="Casos críticos" detail={resumen.vencidos ? `${resumen.vencidos} vencidos` : 'Sin alertas abiertas'} />
      <KpiCard icon={<Icon name="school" />} tone={resumen.colegiosSinAsesor ? 'warn' : 'good'} value={<NumberTicker value={resumen.colegiosSinAsesor} />} label="Sin asesor" detail="Requieren cobertura" />
    </div>
    {!data.colegios.some((c) => c.gerencia || c.ejecutivo) && <div className="hint" style={{ marginBottom: 14, border: '1px solid var(--gold-l)', background: 'var(--gold-wash)', borderRadius: 10, padding: '10px 12px' }}><b>Falta el mapeo comercial.</b> Los colegios actuales todavía no tienen gerencia ni ejecutivo comercial. Importa el catálogo de BI desde Administración → Colegios para activar el seguimiento regional.</div>}

    <div className="gerencia-camp-grid">
      {([{ key: 'SMART', label: 'SMART', color: SMART, x: smart }, { key: 'CORE', label: 'CORE', color: CORE, x: core }] as const).map(({ key, label, color, x }) => <div className="panel gerencia-camp" key={key}>
        <div><span className="gerencia-camp-dot" style={{ background: color }} /><b>{label}</b><span className="hint">{x.colegios} colegios</span></div><ProgressRing pct={x.pct} size={62} stroke={7} color={color} /><small>{x.done}/{x.total} servicios realizados</small>
      </div>)}
    </div>

    <div className="panel gerencia-priority"><div className="section-head"><div><h2>Prioridades de atención</h2><p>Primero aparecen casos críticos y servicios vencidos.</p></div><Badge tone={resumen.colegiosConAlerta ? 'danger' : 'success'}>{resumen.colegiosConAlerta} colegios con alerta</Badge></div>
      {prioridades.length ? prioridades.map((r) => <button className="gerencia-priority-row" key={r.colegio.id} onClick={() => { const k = r.colegio.ejecutivo ?? '(sin ejecutivo)'; toggle(k); document.getElementById(`ger-ej-${k}`)?.scrollIntoView({ behavior: 'smooth' }) }}><span className="gerencia-school-dot" style={{ background: r.colegio.campaign === 'SMART' ? SMART : CORE }} /><span><b>{r.colegio.nombre}</b><small>{r.colegio.ejecutivo ?? 'Sin ejecutivo'} · {r.colegio.asesorId ? (asesores.get(r.colegio.asesorId) ?? 'Asesor') : 'Sin asesor'}</small></span><Badge tone={PRIORIDAD[r.prioridad].tone}>{r.alertasAbiertas ? `${r.alertasAbiertas} alerta${r.alertasAbiertas > 1 ? 's' : ''}` : `${r.vencidos} vencido${r.vencidos > 1 ? 's' : ''}`}</Badge></button>) : <div className="hint">No hay casos críticos ni servicios vencidos con los filtros actuales.</div>}
    </div>

    <div className="panel"><FilterBar trailing={<FilterCount>{colegios.length} colegios</FilterCount>}><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar colegio o ejecutivo…" aria-label="Buscar colegio o ejecutivo" /><select value={filtroCamp} onChange={(e) => setFiltroCamp(e.target.value as typeof filtroCamp)} aria-label="Campaña"><option value="todos">Todas las campañas</option><option value="SMART">SMART</option><option value="CORE">CORE</option></select><select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value as typeof filtroPrioridad)} aria-label="Prioridad"><option value="todos">Todas las prioridades</option>{Object.entries(PRIORIDAD).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></FilterBar></div>

    <div className="panel gerencia-table-wrap"><div className="section-head"><div><h2>Seguimiento por ejecutivo</h2><p>El avance se calcula sobre el total de servicios, no como promedio de porcentajes.</p></div></div><table className="gerencia-table"><thead><tr><th>Ejecutivo</th><th>Colegios</th><th>Avance</th><th>Servicios</th><th>Vencidos</th><th>Alertas</th><th>Sin asesor</th></tr></thead><tbody>{ejecutivos.map((e) => { const rows = colegiosPorEjecutivo.get(e.ejecutivo) ?? []; if (!rows.length && (busca || filtroCamp !== 'todos' || filtroPrioridad !== 'todos')) return null; const abierto = abiertos.has(e.ejecutivo); return <tr key={e.ejecutivo} id={`ger-ej-${e.ejecutivo}`}><td colSpan={7} style={{ padding: 0 }}><button className="gerencia-exec-row" onClick={() => toggle(e.ejecutivo)} aria-expanded={abierto}><span className="gerencia-chevron">{abierto ? '⌄' : '›'}</span><b>{e.ejecutivo}</b><span>{e.colegios}</span><span><b>{e.porcentaje}%</b><i className="gerencia-mini-bar"><i style={{ width: `${e.porcentaje}%` }} /></i></span><span>{e.realizados}/{e.servicios}</span><span className={e.vencidos ? 'gerencia-danger' : ''}>{e.vencidos}</span><span className={e.alertasAbiertas ? 'gerencia-danger' : ''}>{e.alertasAbiertas}</span><span>{e.colegiosSinAsesor || '—'}</span></button>{abierto && <div className="gerencia-college-list">{rows.map((r) => <div className="gerencia-college-row" key={r.colegio.id}><span className="gerencia-school-dot" style={{ background: r.colegio.campaign === 'SMART' ? SMART : CORE }} /><span className="gerencia-college-name"><b>{r.colegio.nombre}</b><small>{r.colegio.asesorId ? `Asesor: ${asesores.get(r.colegio.asesorId) ?? '—'}` : 'Sin asesor'} · {r.colegio.servicios.map((s) => SERV_LABEL[s.tipo]).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}</small></span><span>{r.realizados}/{r.total}</span><span>{r.proximaFecha ? `Próx. ${fmtFecha(r.proximaFecha)}` : 'Sin próxima fecha'}</span><Badge tone={PRIORIDAD[r.prioridad].tone}>{PRIORIDAD[r.prioridad].label}</Badge></div>)}</div>}</td></tr> })}</tbody></table>{!ejecutivos.length && <div className="hint">No hay colegios que coincidan con los filtros.</div>}</div>
  </div>
}
