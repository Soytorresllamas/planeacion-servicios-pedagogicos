import { Fragment, useEffect, useState } from 'react'
import { DEFAULTS, TIER_SEED } from '../data/model'
import type { TierKey, Campaign } from '../data/model'
import {
  defaultPlaneacion, generateColegios, asignarPorTipo, liberarPorTipo,
  contarPorTipo, cargaAsesor, resumen, setServicio, patchColegio, renombrarAsesor, avanceAsignado, ESTATUS,
  hoyISO, urgencia, agendaAsesor, serviciosDeAsesor, SERIES, INGLES, SATISFACCION, PROBLEMAS, atenderAlerta,
  agregarServicioExtra, quitarServicioExtra, marcarNecesidadViaje,
} from '../data/planeacion'
import type { PlaneacionData, Estatus, Servicio, Colegio, ServTipo } from '../data/planeacion'
import { loadLocal, saveLocal, loadRemote, saveRemote } from '../lib/planeacionStore'
import { usePersistencia } from '../lib/persistencia'
import { NumberTicker } from '../ui/NumberTicker'
import { Seg } from '../ui/Seg'
import { toast } from '../ui/toastBus'
import { ColegioCard, ServLabel } from '../features/planeacion/ColegioCard'
import { SMART, CORE, EST_COLOR, EST_LABEL, URG_BG, tierLabel } from '../features/planeacion/colors'

const CAMPS: Campaign[] = ['SMART', 'CORE']
const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
// clave de mes 'YYYY-MM' (o 'sin') → etiqueta para los encabezados de la agenda
const mesLabel = (k: string) => k === 'sin' ? 'Sin fecha planeada' : `${MESES_L[parseInt(k.slice(5, 7), 10) - 1]} ${k.slice(0, 4)}`

export default function Planeacion() {
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Cargando…')
  const [targetSel, setTargetSel] = useState('')
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [view, setView] = useState<'asignacion' | 'hoja' | 'resumen'>('asignacion')
  const [hojaView, setHojaView] = useState<'colegio' | 'agenda'>('colegio')
  const [fEstatus, setFEstatus] = useState<'todos' | 'pendiente' | 'agendado' | 'realizado' | 'vencidos'>('todos')
  const [fCamp, setFCamp] = useState<'todos' | Campaign>('todos')
  const [fTier, setFTier] = useState<'todos' | TierKey>('todos')
  const [fSerie, setFSerie] = useState<string>('todos')
  const [fIngles, setFIngles] = useState<string>('todos')
  const [fSat, setFSat] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null)
  const [editAse, setEditAse] = useState<string | null>(null)

  // carga remota inicial: lo remoto gana si existe
  useEffect(() => {
    let alive = true
    loadRemote().then((res) => {
      if (!alive) return
      if (res.source === 'remote') setData(res.data)
      setStatus(res.source === 'remote' ? 'Sincronizado' : 'Sin conexión · local')
      setReady(true)
    })
    return () => { alive = false }
  }, [])

  // guardado con debounce + flush al desmontar (ver lib/persistencia)
  usePersistencia(data, ready, saveLocal, saveRemote, setStatus)

  // asesor seleccionado válido (derivado, sin efecto): cae al primero si el actual no existe
  const target = data.asesores.some((a) => a.id === targetSel) ? targetSel : (data.asesores[0]?.id ?? '')

  const amt = (key: string) => amounts[key] ?? 1
  const setAmt = (key: string, v: number) => setAmounts((p) => ({ ...p, [key]: Math.max(0, v) }))

  const doAssign = (camp: Campaign, tier: TierKey) =>
    setData((d) => ({ ...d, colegios: asignarPorTipo(d.colegios, camp, tier, amt(camp + '-' + tier), target) }))
  const doRelease = (camp: Campaign, tier: TierKey) =>
    setData((d) => ({ ...d, colegios: liberarPorTipo(d.colegios, camp, tier, amt(camp + '-' + tier), target) }))
  const regenerar = () => {
    if (!window.confirm('Regenerar cupos desde el Simulador borra las asignaciones y el avance actuales. ¿Continuar?')) return
    setData((d) => ({ ...d, colegios: generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore) }))
  }
  const setServ = (colegioId: string, idx: number, patch: Partial<Servicio>) =>
    setData((d) => ({ ...d, colegios: setServicio(d.colegios, colegioId, idx, patch) }))
  const patchCol = (id: string, patch: Partial<Colegio>) =>
    setData((d) => ({ ...d, colegios: patchColegio(d.colegios, id, patch) }))
  const renombrarAse = (id: string, nombre: string) =>
    setData((d) => ({ ...d, asesores: renombrarAsesor(d.asesores, id, nombre) }))
  // talleres extra (casos de excepción): los agrega/quita coordinación desde la hoja
  const agregarExtra = (colegioId: string, tipo: ServTipo) => {
    setData((d) => ({ ...d, colegios: agregarServicioExtra(d.colegios, colegioId, tipo) }))
    toast('Taller extra agregado (marcado EXTRA)', 'ok')
  }
  const quitarExtra = (colegioId: string, idx: number) =>
    setData((d) => ({ ...d, colegios: quitarServicioExtra(d.colegios, colegioId, idx) }))
  // necesidad de viaje/hospedaje (módulo Logística); marcar viaje pre-marca traslado
  const marcarViaje = (colegioId: string, idx: number, patch: { reqViaje?: boolean; reqHospedaje?: boolean }) =>
    setData((d) => ({ ...d, colegios: marcarNecesidadViaje(d.colegios, colegioId, idx, patch) }))

  const res = resumen(data.colegios)
  const targetName = data.asesores.find((a) => a.id === target)?.nombre ?? '—'
  const misColegios = data.colegios.filter((c) => c.asesorId === target)
  const cargaT = cargaAsesor(data.colegios, target)
  const pctT = cargaT.servicios ? Math.round((cargaT.realizados / cargaT.servicios) * 100) : 0

  // agenda / filtros de la hoja
  const hoy = hoyISO()
  const ag = agendaAsesor(data.colegios, target, hoy)
  const filtroColegio = (nombre: string, campaign: Campaign, tier: TierKey, serie?: string, ingles?: string, satisfaccion?: number): boolean => {
    if (busca && !nombre.toLowerCase().includes(busca.toLowerCase())) return false
    if (fCamp !== 'todos' && campaign !== fCamp) return false
    if (fTier !== 'todos' && tier !== fTier) return false
    if (fSerie !== 'todos' && (serie ?? '') !== fSerie) return false
    if (fIngles !== 'todos' && (ingles ?? '') !== fIngles) return false
    if (fSat !== 'todos') {
      if (fSat === 'sin') { if (satisfaccion) return false }
      else if (String(satisfaccion ?? '') !== fSat) return false
    }
    return true
  }
  const pasaServicio = (s: Servicio): boolean => {
    if (fEstatus === 'todos') return true
    if (fEstatus === 'vencidos') return urgencia(s, hoy) === 'vencido'
    return s.estatus === fEstatus
  }
  const filtrosActivos = busca !== '' || fEstatus !== 'todos' || fCamp !== 'todos' || fTier !== 'todos' || fSerie !== 'todos' || fIngles !== 'todos' || fSat !== 'todos'
  const limpiarFiltros = () => { setBusca(''); setFEstatus('todos'); setFCamp('todos'); setFTier('todos'); setFSerie('todos'); setFIngles('todos'); setFSat('todos') }
  const toggleColapso = (id: string) => setColapsados((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const dateStyle = { fontSize: 10, padding: '2px 2px', width: 104, boxSizing: 'border-box' as const }

  // controles de un servicio (funciones que devuelven JSX; no son componentes con hooks)
  const chkHecho = (colId: string, idx: number, s: Servicio) => (
    <input type="checkbox" checked={s.estatus === 'realizado'} aria-label="Marcar realizado"
      title="Marcar realizado (pone la fecha de hoy)"
      onChange={(e) => e.target.checked
        ? setServ(colId, idx, { estatus: 'realizado', fechaReal: s.fechaReal ?? hoy })
        // al desmarcar conserva la intención: si tenía fecha planeada, vuelve a "agendado"
        : setServ(colId, idx, { estatus: s.fechaPlan ? 'agendado' : 'pendiente', fechaReal: undefined })} />
  )
  const selEstatus = (colId: string, idx: number, s: Servicio) => (
    <select value={s.estatus} aria-label="Estatus del servicio"
      onChange={(e) => { const est = e.target.value as Estatus; setServ(colId, idx, est === 'realizado' && !s.fechaReal ? { estatus: est, fechaReal: hoy } : { estatus: est }) }}
      style={{ fontSize: 11, padding: '2px 3px', minWidth: 96, width: '100%' }}>
      {ESTATUS.map((e) => <option key={e} value={e}>{EST_LABEL[e]}</option>)}
    </select>
  )
  const inpPlan = (colId: string, idx: number, s: Servicio) => (
    <input type="date" aria-label="Fecha planeada" value={s.fechaPlan ?? ''} onChange={(e) => setServ(colId, idx, { fechaPlan: e.target.value || undefined })} style={dateStyle} />
  )
  // la fecha real solo existe cuando el servicio está realizado
  const inpReal = (colId: string, idx: number, s: Servicio) => (
    s.estatus === 'realizado'
      ? <input type="date" aria-label="Fecha real" value={s.fechaReal ?? ''} onChange={(e) => setServ(colId, idx, { fechaReal: e.target.value || undefined })} style={dateStyle} />
      : <span style={{ color: '#B7BCC4' }}>—</span>
  )
  const btnNota = (colId: string, idx: number, s: Servicio) => {
    const key = colId + ':' + idx
    return <button title={s.nota ? 'Editar nota' : 'Agregar nota'} onClick={() => setNotaAbierta((k) => k === key ? null : key)}
      style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, opacity: s.nota ? 1 : 0.4 }}>✎</button>
  }
  // nota: editable al abrir con ✎; si existe, siempre visible en itálicas (clic para editar)
  const notaRow = (colId: string, idx: number, s: Servicio, cols: number) => {
    const key = colId + ':' + idx
    if (notaAbierta === key) return (
      <tr><td colSpan={cols} style={{ padding: '2px 4px' }}>
        <input value={s.nota ?? ''} autoFocus placeholder="Nota…"
          onChange={(e) => setServ(colId, idx, { nota: e.target.value || undefined })}
          onBlur={() => setNotaAbierta(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setNotaAbierta(null) }}
          style={{ width: '100%', fontSize: 11, padding: '3px 4px', boxSizing: 'border-box' }} />
      </td></tr>
    )
    if (s.nota) return (
      <tr><td /><td colSpan={cols - 1} onClick={() => setNotaAbierta(key)} title="Clic para editar"
        style={{ padding: '0 4px 3px', fontSize: 10, color: 'var(--mut)', fontStyle: 'italic', cursor: 'pointer' }}>“{s.nota}”</td></tr>
    )
    return null
  }
  // resumen / reconciliación (capacidad tomada de las semillas del Simulador, como los cupos)
  const av = avanceAsignado(data.colegios)
  const pctG = av.servicios ? Math.round((av.realizados / av.servicios) * 100) : 0
  const capAnual = Math.round(DEFAULTS.nAse * DEFAULTS.tDay * DEFAULTS.dWeek * DEFAULTS.wMonth * 12)
  const perAseCap = DEFAULTS.tDay * DEFAULTS.dWeek * DEFAULTS.wMonth * 12
  const capOk = av.usoProf <= capAnual
  const sinAsignarServ = data.colegios.reduce((s, c) => s + (c.asesorId ? 0 : c.servicios.length), 0)
  // alertas de caso crítico levantadas por los asesores desde su portal
  const alertasPend = (data.alertas ?? []).filter((a) => !a.atendida).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const atender = (id: string) => { setData((d) => atenderAlerta(d, id)); toast('Alerta marcada como atendida', 'ok') }
  const nombreAsesor = (id: string) => data.asesores.find((a) => a.id === id)?.nombre ?? id
  const nombreColegio = (id: string) => data.colegios.find((c) => c.id === id)?.nombre ?? id

  return (
    <div>
      <h1>Planeación de servicios · hojas de asesores</h1>
      <div className="sub">Asigna cupos de colegios a cada asesor empleado; los servicios de cada colegio salen de su tipo
        (matriz del Simulador). Lo que no asignes lo cubren externos. <b>· {status}</b></div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <div className="kpi"><div className="v"><NumberTicker value={res.total} /></div><div className="l">Cupos totales</div></div>
        <div className="kpi good"><div className="v"><NumberTicker value={res.asignados} /></div><div className="l">Asignados</div></div>
        <div className="kpi warn"><div className="v"><NumberTicker value={res.sinAsignar} /></div><div className="l">Sin asignar (externos)</div></div>
      </div>

      <div className="row-btn" style={{ margin: '10px 0' }}>
        <button className="sec" onClick={regenerar}>Regenerar cupos</button>
      </div>

      <Seg maxWidth={520} style={{ margin: '0 0 12px' }} value={view} onChange={setView}
        options={[
          { key: 'asignacion', label: 'Asignación' },
          { key: 'hoja', label: 'Hoja del asesor' },
          { key: 'resumen', label: 'Resumen' },
        ]} />

      {view === 'resumen' && (<>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
          <div className="kpi"><div className="v">{av.colegios}</div><div className="l">Colegios asignados</div></div>
          <div className="kpi good"><div className="v">{pctG}%</div><div className="l">Avance ({av.realizados}/{av.servicios} servicios)</div></div>
          <div className="kpi warn"><div className="v">{av.servicios - av.realizados}</div><div className="l">Servicios pendientes</div></div>
        </div>

        {alertasPend.length > 0 && (<>
          <h2>🚨 Alertas de asesores ({alertasPend.length})</h2>
          <div className="panel">
            {alertasPend.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid #F0F2F5', fontSize: 12 }}>
                <span style={{ color: 'var(--mut)', width: 52, flex: '0 0 auto' }}>{a.fecha.slice(5, 10).split('-').reverse().join('/')}</span>
                <b style={{ flex: '0 0 auto' }}>{nombreAsesor(a.asesorId)}</b>
                <span style={{ flex: '0 0 auto' }}>{nombreColegio(a.colegioId)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 8, padding: '1px 8px', flex: '0 0 auto' }}>
                  {PROBLEMAS.find((p) => p.key === a.tipo)?.label ?? a.tipo}</span>
                <span style={{ flex: '1 1 200px', minWidth: 0, color: 'var(--ink-2)' }}>{a.descripcion}</span>
                <button className="sec" onClick={() => atender(a.id)}>✓ Atendida</button>
              </div>
            ))}
            <div className="hint" style={{ marginTop: 6 }}>Casos críticos reportados por los asesores desde su portal. Al marcarlas atendidas salen de esta lista.</div>
          </div>
        </>)}

        <h2>Reconciliación con la capacidad de empleados</h2>
        <div className={`kpi ${capOk ? 'good' : 'warn'}`} style={{ marginBottom: 10 }}>
          <div className="v">{capOk ? '✓ Dentro de capacidad' : '⚠ Excede capacidad'}</div>
          <div className="l">Uso/prof asignado a empleados: <b>{av.usoProf}</b> de <b>{capAnual}</b> de capacidad anual
            ({DEFAULTS.nAse} asesores). {capOk ? 'Cabe en los empleados.' : 'El excedente tendría que irse a externos.'}</div>
        </div>
        <div className="hint">Los empleados solo cubren <b>uso/profundización</b>. Las <b>didácticas</b> de colegios asignados
          ({av.didac}) y los <b>{sinAsignarServ}</b> servicios sin asignar los cubren <b>externos</b>. La capacidad sale de
          las semillas del Simulador (asesores × servicios/día × días × semanas × 12 meses).</div>

        <h2>Avance por asesor</h2>
        <table>
          <thead><tr><th>Asesor</th><th>Colegios</th><th>Servicios</th><th>Realizados</th><th>Avance</th><th>Uso/prof</th><th>Carga</th></tr></thead>
          <tbody>
            {data.asesores.map((a) => {
              const c = cargaAsesor(data.colegios, a.id)
              const pct = c.servicios ? Math.round((c.realizados / c.servicios) * 100) : 0
              const over = c.usoProf > perAseCap
              return (
                <tr key={a.id}>
                  <td>{a.nombre}</td><td>{c.colegios}</td><td>{c.servicios}</td><td>{c.realizados}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'var(--track)', overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#2C8A7B' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--mut)' }}>{pct}%</span>
                    </div>
                  </td>
                  <td>{c.usoProf}</td>
                  <td style={{ color: over ? '#B5841C' : 'var(--mut)', fontWeight: over ? 600 : 400 }}>
                    {over ? `⚠ ${Math.round(perAseCap)} máx` : 'ok'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="hint">«Carga» avisa si el uso/prof asignado a un asesor supera su capacidad anual individual (≈ {Math.round(perAseCap)} servicios).</div>
      </>)}

      {view !== 'resumen' && (
      <div className="cols">
        <div className="panel">
          <h3>Asesores</h3>
          {data.asesores.map((a) => {
            const c = cargaAsesor(data.colegios, a.id)
            const on = a.id === target
            const pct = c.servicios ? Math.round((c.realizados / c.servicios) * 100) : 0
            const sobre = c.usoProf > perAseCap
            const editando = editAse === a.id
            return (
              <div key={a.id}
                style={{ padding: '6px 8px', marginBottom: 4, borderRadius: 8,
                  border: on ? `2px solid ${SMART}` : '1px solid var(--line)', background: on ? '#F3F7FC' : 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {editando ? (
                    <input value={a.nombre} autoFocus aria-label="Nombre del asesor"
                      onChange={(e) => renombrarAse(a.id, e.target.value)}
                      onBlur={() => setEditAse(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditAse(null) }}
                      style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, padding: '3px 6px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'inherit' }} />
                  ) : (
                    <button onClick={() => setTargetSel(a.id)} title="Seleccionar asesor"
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: on ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}{sobre && <span title={`Sobrecarga: ${c.usoProf} uso/prof > ${Math.round(perAseCap)} de capacidad anual`} style={{ marginLeft: 4 }}>⚠</span>}</span>
                      <span style={{ color: 'var(--mut)', fontSize: 12, whiteSpace: 'nowrap', flex: '0 0 auto' }}>{c.colegios} col · {c.servicios} serv</span>
                    </button>
                  )}
                  <button onClick={() => setEditAse(editando ? null : a.id)} title={editando ? 'Listo' : 'Renombrar asesor'} aria-label={editando ? 'Terminar de renombrar' : 'Renombrar asesor'}
                    style={{ flex: '0 0 auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: editando ? 'var(--core)' : 'var(--mut)', padding: '2px 4px' }}>{editando ? '✓' : '✎'}</button>
                </div>
                {c.servicios > 0 && !editando && (
                  <span style={{ display: 'block', height: 3, borderRadius: 3, background: 'var(--track)', marginTop: 5, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: EST_COLOR.realizado }} />
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div>
          {view === 'asignacion' && (<>
            <h2>Asignar a {targetName}</h2>
            <table>
              <thead><tr><th>Campaña</th><th>Tipo</th><th>Sin asignar</th><th>De este asesor</th><th>Cantidad</th><th></th></tr></thead>
              <tbody>
                {CAMPS.flatMap((camp) => TIER_SEED.map((t) => {
                  const key = camp + '-' + t.key
                  const disp = contarPorTipo(data.colegios, camp, t.key)
                  const mine = contarPorTipo(data.colegios, camp, t.key, target)
                  return (
                    <tr key={key}>
                      <td style={{ color: camp === 'SMART' ? SMART : CORE, fontWeight: 600 }}>{camp}</td>
                      <td>{tierLabel(t.key)}</td>
                      <td>{disp}</td>
                      <td>{mine}</td>
                      <td><input type="number" min={0} value={amt(key)} onChange={(e) => setAmt(key, parseInt(e.target.value) || 0)} style={{ width: 64 }} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="sec" disabled={!target || disp === 0} onClick={() => doAssign(camp, t.key)}>Asignar</button>{' '}
                        <button className="sec" disabled={!target || mine === 0} onClick={() => doRelease(camp, t.key)}>Quitar</button>
                      </td>
                    </tr>
                  )
                }))}
                <tr className="total">
                  <td>Total</td><td></td>
                  <td>{res.sinAsignar}</td>
                  <td>{cargaT.colegios}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
            <div className="hint">Asigna en tandas: escribe la cantidad y pulsa «Asignar». Lo que no asignes lo cubren externos.</div>

            <div className="hint" style={{ marginTop: 10 }}>La carga masiva del catálogo de colegios (archivo de BI) vive en <b>Administración → Colegios</b>.</div>
          </>)}

          {view === 'hoja' && (<>
            <h2 style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>Hoja de {targetName}
              <a href="#/mi-hoja" style={{ fontSize: 11, fontWeight: 400 }} title="Cómo la vería el asesor (con su propio login)">Ver portal del asesor ↗</a>
              <a href="#/mis-colegios" style={{ fontSize: 11, fontWeight: 400 }} title="Cómo lo vería un ejecutivo comercial (con su propio login)">Ver portal del ejecutivo ↗</a></h2>
            {misColegios.length === 0 ? (
              <div className="hint">Este asesor no tiene colegios asignados. Ve a «Asignación» para darle cupos.</div>
            ) : (<>
              <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', marginBottom: 8 }}>
                <div className={`kpi ${ag.vencidos > 0 ? 'warn' : ''}`}><div className="v">{ag.vencidos}</div><div className="l">Vencidos</div></div>
                <div className="kpi"><div className="v">{ag.estaSemana}</div><div className="l">Próx. 7 días</div></div>
                <div className="kpi"><div className="v">{ag.porHacer}</div><div className="l">Por hacer</div></div>
                <div className="kpi good"><div className="v">{pctT}%</div><div className="l">Avance ({cargaT.realizados}/{cargaT.servicios})</div></div>
              </div>
              <div style={{ height: 8, borderRadius: 8, background: 'var(--track)', overflow: 'hidden', margin: '0 0 12px' }}>
                <div style={{ height: '100%', width: `${pctT}%`, background: EST_COLOR.realizado }} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <Seg maxWidth={260} style={{ margin: 0 }} value={hojaView} onChange={setHojaView}
                  options={[{ key: 'colegio', label: 'Por colegio' }, { key: 'agenda', label: 'Agenda' }]} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colegio…"
                  aria-label="Buscar colegio por nombre" style={{ width: 160, fontSize: 12, padding: '5px 8px' }} />
                <select value={fEstatus} onChange={(e) => setFEstatus(e.target.value as typeof fEstatus)} style={{ width: 'auto' }}>
                  <option value="todos">Todos los estatus</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="agendado">Agendados</option>
                  <option value="realizado">Realizados</option>
                  <option value="vencidos">Vencidos</option>
                </select>
                <select value={fCamp} onChange={(e) => setFCamp(e.target.value as typeof fCamp)} style={{ width: 'auto' }}>
                  <option value="todos">Ambas campañas</option>
                  <option value="SMART">SMART</option>
                  <option value="CORE">CORE</option>
                </select>
                <select value={fTier} onChange={(e) => setFTier(e.target.value as typeof fTier)} style={{ width: 'auto' }}>
                  <option value="todos">Todos los tipos</option>
                  {TIER_SEED.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <select value={fSerie} onChange={(e) => setFSerie(e.target.value)} style={{ width: 'auto' }}>
                  <option value="todos">Toda serie</option>
                  {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={fIngles} onChange={(e) => setFIngles(e.target.value)} style={{ width: 'auto' }}>
                  <option value="todos">Todo inglés</option>
                  {INGLES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={fSat} onChange={(e) => setFSat(e.target.value)} style={{ width: 'auto' }}>
                  <option value="todos">Toda satisfacción</option>
                  {SATISFACCION.map((s) => <option key={s.v} value={String(s.v)}>{s.emoji} {s.label}</option>)}
                  <option value="sin">Sin calificar</option>
                </select>
                {filtrosActivos && (
                  <button className="sec" onClick={limpiarFiltros} title="Quitar búsqueda y filtros">× Limpiar</button>
                )}
                {hojaView === 'colegio' && (
                  <button className="sec" onClick={() => setColapsados((p) => p.size ? new Set() : new Set(misColegios.map((c) => c.id)))}>
                    {colapsados.size ? 'Expandir todo' : 'Colapsar todo'}
                  </button>
                )}
              </div>

              {hojaView === 'colegio' ? (() => {
                const cards = misColegios
                  .filter((c) => filtroColegio(c.nombre, c.campaign, c.tier, c.serie, c.ingles, c.satisfaccion))
                  .map((c) => ({ c, visibles: c.servicios.map((s, i) => ({ s, i })).filter(({ s }) => pasaServicio(s)) }))
                  .filter((x) => x.visibles.length > 0)
                if (cards.length === 0) return (
                  <div className="hint">Ningún colegio coincide con la búsqueda o los filtros.{filtrosActivos && <> <button className="sec" onClick={limpiarFiltros}>Limpiar filtros</button></>}</div>
                )
                return (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 820px)', gap: 10 }}>
                  {cards.map(({ c }) => (
                    <ColegioCard key={c.id} editable c={c} hoy={hoy}
                      abierto={!colapsados.has(c.id)}
                      onToggle={() => toggleColapso(c.id)}
                      onServ={(i, p) => setServ(c.id, i, p)}
                      onPatch={(p) => patchCol(c.id, p)}
                      onAgregar={(t) => agregarExtra(c.id, t)}
                      onQuitarExtra={(i) => quitarExtra(c.id, i)}
                      servFilter={pasaServicio} />
                  ))}
                </div>
                )
              })() : (
                (() => {
                  const lista = serviciosDeAsesor(data.colegios, target)
                    .filter((r) => filtroColegio(r.colegioNombre, r.campaign, r.tier, r.serie, r.ingles, r.satisfaccion) && pasaServicio(r.servicio))
                    .sort((a, b) => (a.servicio.fechaPlan ?? '9999').localeCompare(b.servicio.fechaPlan ?? '9999'))
                  if (lista.length === 0) return (
                    <div className="hint">Ningún servicio coincide con la búsqueda o los filtros.{filtrosActivos && <> <button className="sec" onClick={limpiarFiltros}>Limpiar filtros</button></>}</div>
                  )
                  let mesPrevio = ''
                  return (<>
                    <table>
                      <thead><tr><th style={{ width: 24 }}></th><th>Colegio</th><th>Campaña</th><th>Servicio</th><th>Estatus</th><th>Planeada</th><th>Real</th>
                        <th title="Requiere transporte (avión o camión)" style={{ width: 40 }}>✈️ Viaje</th>
                        <th title="Requiere hospedaje" style={{ width: 40 }}>🏨 Hosp.</th>
                        <th style={{ width: 24 }}></th></tr></thead>
                      <tbody>
                        {lista.map((r) => {
                          const u = urgencia(r.servicio, hoy)
                          const mesKey = r.servicio.fechaPlan ? r.servicio.fechaPlan.slice(0, 7) : 'sin'
                          const header = mesKey !== mesPrevio
                            ? <tr key={'mes-' + mesKey}><td colSpan={10} style={{ background: 'var(--line)', fontWeight: 700, fontSize: 10.5, color: 'var(--ink-2)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{mesLabel(mesKey)}</td></tr>
                            : null
                          mesPrevio = mesKey
                          const real = r.servicio.estatus === 'realizado'
                          return (
                            <Fragment key={r.colegioId + ':' + r.idx}>
                              {header}
                              <tr style={{ background: URG_BG[u] }}>
                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>{chkHecho(r.colegioId, r.idx, r.servicio)}</td>
                                <td style={{ padding: '2px 4px' }}>{r.colegioNombre}</td>
                                <td style={{ padding: '2px 4px', color: r.campaign === 'SMART' ? SMART : CORE, whiteSpace: 'nowrap' }}>{r.campaign} · {tierLabel(r.tier)}</td>
                                <td style={{ padding: '2px 4px' }}><ServLabel s={r.servicio} u={u} /></td>
                                <td style={{ padding: '2px 4px', minWidth: 110 }}>{selEstatus(r.colegioId, r.idx, r.servicio)}</td>
                                <td style={{ padding: '2px 4px' }}>{inpPlan(r.colegioId, r.idx, r.servicio)}</td>
                                <td style={{ padding: '2px 4px' }}>{inpReal(r.colegioId, r.idx, r.servicio)}</td>
                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                  <input type="checkbox" checked={!!r.servicio.reqViaje} disabled={real} aria-label="Requiere viaje"
                                    title={real ? 'Servicio ya realizado' : 'Requiere transporte: aparece en Logística (pre-marca traslado en Rentabilidad)'}
                                    onChange={(e) => marcarViaje(r.colegioId, r.idx, { reqViaje: e.target.checked })} />
                                </td>
                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                  <input type="checkbox" checked={!!r.servicio.reqHospedaje} disabled={real} aria-label="Requiere hospedaje"
                                    title={real ? 'Servicio ya realizado' : 'Requiere hospedaje: aparece en Logística'}
                                    onChange={(e) => marcarViaje(r.colegioId, r.idx, { reqHospedaje: e.target.checked })} />
                                </td>
                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>{btnNota(r.colegioId, r.idx, r.servicio)}</td>
                              </tr>
                              {notaRow(r.colegioId, r.idx, r.servicio, 10)}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="hint">✈️/🏨: la responsable logística marca qué servicios agendados necesitan transporte u hospedaje;
                      aparecen en <b>Logística</b> para que la responsable de viajes cargue las reservas. Marcar viaje pre-marca «traslado» en Rentabilidad.</div>
                  </>)
                })()
              )}
            </>)}
          </>)}
        </div>
      </div>
      )}
    </div>
  )
}
