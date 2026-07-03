// Rentabilidad: valor real del colegio vs costos reales de los servicios.
// Dos vistas: Análisis (agregados por gerencia/asesor/campaña/categoría y por
// colegio) y Hoja logística (la Responsable Logística captura traslados y
// costos de externos por servicio). Ver docs/06-rentabilidad.md.
import { useEffect, useMemo, useState } from 'react'
import { DEFAULTS } from '../data/model'
import {
  defaultPlaneacion, filasLogistica, agruparRent, rentabilidadColegio, setServicio,
} from '../data/planeacion'
import type { PlaneacionData, Servicio, Colegio } from '../data/planeacion'
import { loadLocal, saveLocal, loadRemote, saveRemote } from '../lib/planeacionStore'
import { SMART, CORE, EST_LABEL, SERV_LABEL, tierLabel } from '../features/planeacion/colors'
import { NumberTicker } from '../ui/NumberTicker'
import { Seg } from '../ui/Seg'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const fmt = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : mxn.format(n))
const PASO = 150 // filas de la hoja logística por tanda

type Grupo = 'gerencia' | 'asesor' | 'ejecutivo' | 'campaign' | 'tier'
const GRUPOS: { key: Grupo; label: string }[] = [
  { key: 'gerencia', label: 'Por gerencia' },
  { key: 'asesor', label: 'Por asesor' },
  { key: 'ejecutivo', label: 'Por ejecutivo' },   // ejecutivo comercial (dato de BI)
  { key: 'campaign', label: 'Por campaña' },
  { key: 'tier', label: 'Por categoría' },
]

export default function Rentabilidad() {
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Cargando…')
  const [view, setView] = useState<'analisis' | 'logistica'>('analisis')
  const [grupo, setGrupo] = useState<Grupo>('gerencia')
  const [buscaCol, setBuscaCol] = useState('')
  // filtros de la hoja logística (asesor / colegio / gerencia, como pidió la Responsable)
  const [fAse, setFAse] = useState('todos')
  const [fGer, setFGer] = useState('todos')
  const [fEst, setFEst] = useState<'todos' | 'realizado' | 'agendado' | 'pendiente'>('todos')
  const [busca, setBusca] = useState('')
  const [cap, setCap] = useState(PASO)

  // mismo tablero compartido que Planeación (lo remoto gana si existe)
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

  useEffect(() => {
    if (!ready) return
    saveLocal(data)
    const t = window.setTimeout(() => {
      setStatus('Guardando…')
      saveRemote(data).then((r) => setStatus(r.ok ? 'Sincronizado' : 'Sin conexión · local'))
    }, 700)
    return () => clearTimeout(t)
  }, [data, ready])

  const setServ = (colegioId: string, idx: number, patch: Partial<Servicio>) =>
    setData((d) => ({ ...d, colegios: setServicio(d.colegios, colegioId, idx, patch) }))

  const nombreAsesor = useMemo(() => {
    const m = new Map(data.asesores.map((a) => [a.id, a.nombre]))
    return (id: string | null) => (id ? m.get(id) ?? id : 'Sin asignar')
  }, [data.asesores])

  // ── agregados globales ──
  const global = useMemo(() => {
    let valor = 0, costo = 0, conValor = 0, servicios = 0, realizados = 0, conCosto = 0, externos = 0
    for (const c of data.colegios) {
      const r = rentabilidadColegio(c)
      costo += r.costo; servicios += r.servicios; realizados += r.realizados
      conCosto += r.conCosto; externos += r.externos
      if (r.valor !== null) { valor += r.valor; conValor++ }
    }
    return { valor, costo, margen: valor - costo, conValor, servicios, realizados, conCosto, externos }
  }, [data.colegios])
  const pctRent = global.valor ? ((global.valor - global.costo) / global.valor) * 100 : null

  const llaves: Record<Grupo, (c: Colegio) => string> = {
    gerencia: (c) => c.gerencia ?? '',
    asesor: (c) => nombreAsesor(c.asesorId),
    ejecutivo: (c) => c.ejecutivo ?? '',
    campaign: (c) => c.campaign,
    tier: (c) => tierLabel(c.tier),
  }
  const grupos = useMemo(() => agruparRent(data.colegios, llaves[grupo]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.colegios, grupo, nombreAsesor])

  // ── por colegio (análisis): solo los que tienen algo que contar ──
  const porColegio = useMemo(() => {
    const q = buscaCol.trim().toLowerCase()
    return data.colegios
      .filter((c) => !q || c.nombre.toLowerCase().includes(q))
      .map((c) => ({ c, r: rentabilidadColegio(c) }))
      .filter(({ r }) => r.valor !== null || r.costo > 0)
      .sort((a, b) => (b.r.costo - a.r.costo) || ((b.r.valor ?? 0) - (a.r.valor ?? 0)))
      .slice(0, 40)
  }, [data.colegios, buscaCol])

  // ── hoja logística ──
  const gerencias = useMemo(() =>
    [...new Set(data.colegios.map((c) => c.gerencia).filter((g): g is string => !!g))].sort(), [data.colegios])
  const filas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return filasLogistica(data.colegios).filter((f) =>
      (fEst === 'todos' || f.servicio.estatus === fEst) &&
      (fAse === 'todos' || (fAse === 'sin' ? !f.colegio.asesorId : f.colegio.asesorId === fAse)) &&
      (fGer === 'todos' || f.colegio.gerencia === fGer) &&
      (!q || f.colegio.nombre.toLowerCase().includes(q)))
  }, [data.colegios, fEst, fAse, fGer, busca])
  const totalFiltrado = useMemo(() => filas.reduce((s, f) =>
    s + (f.servicio.traslado ? (f.servicio.costoTraslado ?? 0) : 0) + (f.servicio.costoExterno ?? 0), 0), [filas])

  const money = (v: number | undefined, on: (n: number | undefined) => void, disabled = false, ph = '0') => (
    <input type="number" min={0} step={50} value={v ?? ''} placeholder={ph} disabled={disabled}
      onChange={(e) => on(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
      style={{ width: 84, fontSize: 11.5, padding: '3px 5px', opacity: disabled ? 0.35 : 1 }} />
  )

  const chipEjecutor = (e: 'interno' | 'externo') => (
    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap',
      background: e === 'interno' ? '#E8F0FA' : '#F6EBCB', color: e === 'interno' ? 'var(--smart)' : '#8A6D1C' }}>
      {e === 'interno' ? 'Interno' : 'Externo'}
    </span>
  )

  const margenStyle = (m: number | null) =>
    m === null ? { color: 'var(--faint)' } : m < 0 ? { color: 'var(--neg)', fontWeight: 700 } : { fontWeight: 600 }

  return (
    <div>
      <h1>Rentabilidad</h1>
      <div className="sub">Valor real de cada colegio contra el costo de sus servicios: traslados y ejecución por
        externos (didácticas siempre; uso/profundización cuando no hay capacidad interna). La captura la hace la
        Responsable Logística en su hoja. <b>· {status}</b></div>

      <div className="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
        <div className="kpi"><div className="v">{global.conValor ? <NumberTicker value={global.valor} format={(n) => mxn.format(n)} /> : '—'}</div><div className="l">Valor de cartera ({global.conValor} colegios con valor)</div></div>
        <div className="kpi"><div className="v"><NumberTicker value={global.costo} format={(n) => mxn.format(n)} /></div><div className="l">Costo capturado ({global.conCosto} servicios)</div></div>
        <div className="kpi good"><div className="v" style={margenStyle(global.conValor ? global.margen : null)}>{global.conValor ? <NumberTicker value={global.margen} format={(n) => mxn.format(n)} /> : '—'}</div><div className="l">Margen</div></div>
        <div className="kpi"><div className="v">{pctRent === null ? '—' : <NumberTicker value={pctRent} format={(n) => `${n.toFixed(1)}%`} />}</div><div className="l">Rentabilidad</div></div>
        <div className="kpi"><div className="v"><NumberTicker value={global.servicios ? (global.externos / global.servicios) * 100 : 0} format={(n) => `${Math.round(n)}%`} /></div><div className="l">Servicios de externos</div></div>
      </div>

      {global.conValor === 0 && (
        <div className="hint" style={{ marginBottom: 12 }}>
          Los colegios actuales son cupos simulados y no traen «Valor Real», así que el margen aún no se puede
          calcular. En <b>Planeación → Asignación → Carga masiva</b> importa el catálogo de BI para activar el
          análisis completo. Los costos que capture logística sí se van acumulando desde ya.
        </div>
      )}

      <Seg maxWidth={340} value={view} onChange={setView}
        options={[{ key: 'analisis', label: 'Análisis' }, { key: 'logistica', label: 'Hoja logística' }]} />

      {view === 'analisis' && (<>
        <div className="panel">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, flex: 1 }}>Agregado</h3>
            <Seg maxWidth={560} style={{ margin: 0, flex: '1 1 320px' }} value={grupo} onChange={setGrupo}
              options={GRUPOS.map((g) => ({ key: g.key, label: g.label }))} />
          </div>
          <table>
            <thead><tr><th>{GRUPOS.find((g) => g.key === grupo)?.label.replace('Por ', '')}</th><th>Colegios</th><th>Valor</th><th>Costo</th><th>Margen</th><th>Rent.</th><th>Realizados</th></tr></thead>
            <tbody>
              {grupos.map((g) => {
                const pct = g.valor ? (g.margen / g.valor) * 100 : null
                return (
                  <tr key={g.key}>
                    <td style={{ fontWeight: 600 }}>{g.label}{g.sinValor > 0 && <span title={`${g.sinValor} colegios sin Valor Real (fuera del margen)`} style={{ color: 'var(--faint)', fontWeight: 400 }}> · {g.sinValor} s/valor</span>}</td>
                    <td>{g.colegios}</td>
                    <td>{fmt(g.colegios > g.sinValor ? g.valor : null)}</td>
                    <td>{g.costo ? fmt(g.costo) : '—'}</td>
                    <td style={margenStyle(g.colegios > g.sinValor ? g.margen : null)}>{fmt(g.colegios > g.sinValor ? g.margen : null)}</td>
                    <td>{pct === null ? '—' : `${pct.toFixed(1)}%`}</td>
                    <td style={{ color: 'var(--mut)' }}>{g.realizados}/{g.servicios}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, flex: 1 }}>Por colegio</h3>
            <input value={buscaCol} onChange={(e) => setBuscaCol(e.target.value)} placeholder="🔍 Buscar colegio…"
              aria-label="Buscar colegio" style={{ width: 180, fontSize: 12, padding: '5px 8px' }} />
          </div>
          {porColegio.length === 0 ? (
            <div className="hint">Aún no hay colegios con Valor Real ni costos capturados{buscaCol && ' que coincidan con la búsqueda'}.</div>
          ) : (
            <table>
              <thead><tr><th>Colegio</th><th>Gerencia</th><th>Asesor</th><th>Valor</th><th>Costo</th><th>Margen</th><th>Rent.</th></tr></thead>
              <tbody>
                {porColegio.map(({ c, r }) => (
                  <tr key={c.id}>
                    <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, marginRight: 6, background: c.campaign === 'SMART' ? SMART : CORE }} />{c.nombre}</td>
                    <td style={{ color: 'var(--mut)' }}>{c.gerencia ?? '—'}</td>
                    <td style={{ color: 'var(--mut)' }}>{nombreAsesor(c.asesorId)}</td>
                    <td>{fmt(r.valor)}</td>
                    <td>{r.costo ? fmt(r.costo) : '—'}</td>
                    <td style={margenStyle(r.margen)}>{fmt(r.margen)}</td>
                    <td>{r.pct === null ? '—' : `${r.pct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="hint">Se muestran hasta 40 colegios (los de mayor costo primero). Usa la búsqueda para encontrar uno específico.</div>
        </div>
      </>)}

      {view === 'logistica' && (
        <div className="panel">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, flex: '1 0 100%' }}>Hoja logística · captura de costos</h3>
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setCap(PASO) }} placeholder="🔍 Colegio…"
              aria-label="Filtrar por colegio" style={{ width: 160, fontSize: 12, padding: '5px 8px' }} />
            <select value={fAse} onChange={(e) => { setFAse(e.target.value); setCap(PASO) }} aria-label="Filtrar por asesor" style={{ width: 'auto' }}>
              <option value="todos">Todos los asesores</option>
              <option value="sin">Sin asignar (externos)</option>
              {data.asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <select value={fGer} onChange={(e) => { setFGer(e.target.value); setCap(PASO) }} aria-label="Filtrar por gerencia" style={{ width: 'auto' }}>
              <option value="todos">Todas las gerencias</option>
              {gerencias.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={fEst} onChange={(e) => { setFEst(e.target.value as typeof fEst); setCap(PASO) }} aria-label="Filtrar por estatus" style={{ width: 'auto' }}>
              <option value="todos">Todos los estatus</option>
              <option value="realizado">Realizados</option>
              <option value="agendado">Agendados</option>
              <option value="pendiente">Pendientes</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--mut)', marginLeft: 'auto' }}>
              {filas.length.toLocaleString('es-MX')} servicios · costo filtrado <b>{fmt(totalFiltrado)}</b>
            </span>
          </div>

          <table>
            <thead><tr>
              <th>Colegio</th><th>Asesor</th><th>Servicio</th><th>Estatus</th><th>Fecha</th><th>Ejecutor</th>
              <th title="¿Hubo traslado/viáticos?">🚗</th><th>$ Traslado</th><th>$ Externo</th><th>Nota logística</th>
            </tr></thead>
            <tbody>
              {filas.slice(0, cap).map((f) => {
                const s = f.servicio
                return (
                  <tr key={f.colegio.id + ':' + f.idx}>
                    <td><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, marginRight: 5, background: f.colegio.campaign === 'SMART' ? SMART : CORE }} />
                      {f.colegio.nombre}{f.colegio.gerencia && <span style={{ display: 'block', fontSize: 9.5, color: 'var(--faint)' }}>{f.colegio.gerencia}</span>}</td>
                    <td style={{ color: 'var(--mut)' }}>{nombreAsesor(f.colegio.asesorId)}</td>
                    <td>{SERV_LABEL[s.tipo]}</td>
                    <td style={{ color: s.estatus === 'realizado' ? 'var(--core)' : 'var(--mut)' }}>{EST_LABEL[s.estatus]}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--mut)' }}>{s.fechaReal ?? s.fechaPlan ?? '—'}</td>
                    <td>{chipEjecutor(f.ejecutor)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={s.traslado ?? false} aria-label="Hubo traslado"
                        onChange={(e) => setServ(f.colegio.id, f.idx, e.target.checked
                          ? { traslado: true, costoTraslado: s.costoTraslado ?? DEFAULTS.costoTraslado }
                          : { traslado: false })} />
                    </td>
                    <td>{money(s.costoTraslado, (n) => setServ(f.colegio.id, f.idx, { costoTraslado: n }), !s.traslado, String(DEFAULTS.costoTraslado))}</td>
                    <td>{money(s.costoExterno, (n) => setServ(f.colegio.id, f.idx, { costoExterno: n }), f.ejecutor !== 'externo', String(DEFAULTS.costoDidac))}</td>
                    <td><input value={s.notaLog ?? ''} placeholder="Proveedor, folio…" aria-label="Nota logística"
                      onChange={(e) => setServ(f.colegio.id, f.idx, { notaLog: e.target.value || undefined })}
                      style={{ width: 130, fontSize: 11, padding: '3px 5px' }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filas.length > cap && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="sec" onClick={() => setCap((c) => c + PASO)}>Mostrar {Math.min(PASO, filas.length - cap)} más ({(filas.length - cap).toLocaleString('es-MX')} restantes)</button>
            </div>
          )}
          <div className="hint" style={{ marginTop: 8 }}>
            El costo de traslado solo cuenta si la casilla 🚗 está marcada (se sugiere {fmt(DEFAULTS.costoTraslado)}).
            «$ Externo» se habilita cuando el servicio lo ejecuta un externo: didácticas siempre, y uso/profundización
            de colegios sin asesor (sugerido {fmt(DEFAULTS.costoDidac)} por didáctica).
          </div>
        </div>
      )}
    </div>
  )
}
