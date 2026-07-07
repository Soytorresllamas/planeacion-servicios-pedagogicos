// Logística de viajes: consolidado de servicios agendados que requieren viaje
// y/u hospedaje (los marca la responsable logística en Planeación → agenda).
// El rol «viajes» (y admin) carga aquí los PDFs de reservas; el asesor los ve
// en su portal. Ver docs/08-logistica-viajes.md.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  defaultPlaneacion, filasViajes, resumenViajes, estadoReserva, setServicio,
  hoyISO, NIVEL_LABEL,
} from '../data/planeacion'
import type { PlaneacionData, Servicio, FilaViaje, EstadoReserva } from '../data/planeacion'
import { loadLocal, loadRemote } from '../lib/planeacionStore'
import { usePersistenciaPlaneacion } from '../lib/persistenciaPlaneacion'
import { subirReserva, urlReserva, borrarReserva } from '../lib/reservasStore'
import type { TipoReserva } from '../lib/reservasStore'
import { useAcceso } from '../lib/accesoCtx'
import { NumberTicker } from '../ui/NumberTicker'
import { toast } from '../ui/toastBus'
import { SMART, CORE, SERV_LABEL } from '../features/planeacion/colors'

const fmtCorta = (iso?: string) => iso ? iso.slice(5, 10).split('-').reverse().join('/') : '—'

const EST_RES: Record<EstadoReserva, { label: string; color: string; bg: string }> = {
  pendiente: { label: '⏳ Pendiente', color: '#8A6D1C', bg: 'var(--gold-wash)' },
  parcial: { label: '◐ Parcial', color: '#8A6D1C', bg: 'var(--gold-wash)' },
  completa: { label: '✓ Completa', color: 'var(--green)', bg: 'var(--green-wash)' },
}

export default function Logistica() {
  const { sesion } = useAcceso()
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Cargando…')
  // filtros
  const [busca, setBusca] = useState('')
  const [fAsesor, setFAsesor] = useState('todos')
  const [fGerencia, setFGerencia] = useState('todos')
  const [fEstado, setFEstado] = useState<'todos' | EstadoReserva>('todos')
  const [verRealizados, setVerRealizados] = useState(false)
  // carga de PDFs: celda ocupada + input file oculto reutilizable
  const [ocupado, setOcupado] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendienteRef = useRef<{ colegioId: string; idx: number; tipo: TipoReserva; anterior?: string } | null>(null)

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
  usePersistenciaPlaneacion(data, ready, setStatus)

  const hoy = hoyISO()
  const puedeCargar = sesion.rol === 'viajes' || sesion.rol === 'admin'
  const res = resumenViajes(data.colegios, hoy)
  const nombreAsesor = (id: string | null) => id ? (data.asesores.find((a) => a.id === id)?.nombre ?? id) : '— (externos)'

  const todas = filasViajes(data.colegios)
  const gerencias = useMemo(() => [...new Set(todas.map((f) => f.colegio.gerencia).filter(Boolean))].sort() as string[], [todas])
  const asesoresConViaje = useMemo(() => {
    const ids = new Set(todas.map((f) => f.colegio.asesorId).filter(Boolean))
    return data.asesores.filter((a) => ids.has(a.id))
  }, [todas, data.asesores])

  const filas = todas.filter(({ colegio: c, servicio: s }) => {
    if (!verRealizados && s.estatus === 'realizado') return false
    if (busca && !c.nombre.toLowerCase().includes(busca.toLowerCase())) return false
    if (fAsesor !== 'todos' && c.asesorId !== fAsesor) return false
    if (fGerencia !== 'todos' && (c.gerencia ?? '') !== fGerencia) return false
    if (fEstado !== 'todos' && estadoReserva(s) !== fEstado) return false
    return true
  })
  const filtrosActivos = busca !== '' || fAsesor !== 'todos' || fGerencia !== 'todos' || fEstado !== 'todos' || verRealizados
  const limpiar = () => { setBusca(''); setFAsesor('todos'); setFGerencia('todos'); setFEstado('todos'); setVerRealizados(false) }

  const setServ = (colegioId: string, idx: number, patch: Partial<Servicio>) =>
    setData((d) => ({ ...d, colegios: setServicio(d.colegios, colegioId, idx, patch) }))

  // ── carga / reemplazo / quitar / ver PDFs ──
  const pedirArchivo = (colegioId: string, idx: number, tipo: TipoReserva, anterior?: string) => {
    pendienteRef.current = { colegioId, idx, tipo, anterior }
    fileRef.current?.click()
  }
  const onArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const destino = pendienteRef.current
    pendienteRef.current = null
    if (!file || !destino) return
    const clave = `${destino.colegioId}:${destino.idx}:${destino.tipo}`
    setOcupado(clave)
    const r = await subirReserva(file, destino.tipo)
    if (!r.ok) { setOcupado(null); toast(r.error, 'err'); return }
    if (destino.anterior) void borrarReserva(destino.anterior)  // reemplazo: limpia el PDF previo
    setServ(destino.colegioId, destino.idx, destino.tipo === 'hotel' ? { pdfHotel: r.path } : { pdfTransporte: r.path })
    setOcupado(null)
    toast(`Reserva de ${destino.tipo} cargada («${file.name}»)`, 'ok')
  }
  const quitarPdf = (colegioId: string, idx: number, tipo: TipoReserva, path: string) => {
    if (!window.confirm(`¿Quitar el PDF de ${tipo}? El asesor dejará de verlo.`)) return
    void borrarReserva(path)
    setServ(colegioId, idx, tipo === 'hotel' ? { pdfHotel: undefined } : { pdfTransporte: undefined })
    toast(`Reserva de ${tipo} eliminada`, 'ok')
  }
  const verPdf = async (path: string) => {
    const url = await urlReserva(path)
    if (url) window.open(url, '_blank', 'noopener')
    else toast('No se pudo abrir el PDF (¿ya corriste el SQL v3.2 en Supabase?)', 'err')
  }

  /** Celda de reserva: estado + acciones según necesidad, PDF y permisos. */
  const celdaReserva = (f: FilaViaje, tipo: TipoReserva) => {
    const requiere = tipo === 'hotel' ? f.servicio.reqHospedaje : f.servicio.reqViaje
    const path = tipo === 'hotel' ? f.servicio.pdfHotel : f.servicio.pdfTransporte
    if (!requiere && !path) return <span style={{ color: 'var(--faint)' }}>—</span>
    const clave = `${f.colegio.id}:${f.idx}:${tipo}`
    const cargando = ocupado === clave
    return (
      <span style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {path ? (<>
          <button className="sec" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => void verPdf(path)}>📄 Ver</button>
          {puedeCargar && (<>
            <button className="sec" style={{ fontSize: 11, padding: '3px 8px' }} disabled={cargando}
              onClick={() => pedirArchivo(f.colegio.id, f.idx, tipo, path)}>{cargando ? '…' : 'Reemplazar'}</button>
            <button className="sec" style={{ fontSize: 11, padding: '3px 8px' }} title="Quitar PDF"
              onClick={() => quitarPdf(f.colegio.id, f.idx, tipo, path)}>×</button>
          </>)}
        </>) : puedeCargar ? (
          <button className="sec" style={{ fontSize: 11, padding: '3px 8px', borderColor: 'var(--gold-l)', color: '#8A6D1C' }} disabled={cargando}
            onClick={() => pedirArchivo(f.colegio.id, f.idx, tipo)}>{cargando ? 'Subiendo…' : '📎 Cargar PDF'}</button>
        ) : (
          <span style={{ fontSize: 11, color: '#8A6D1C', fontWeight: 600 }}>⏳ Pendiente</span>
        )}
      </span>
    )
  }

  return (
    <div>
      <h1>Logística · viajes y hospedaje</h1>
      <div className="sub">Servicios agendados que requieren transporte u hospedaje (marcados en Planeación → agenda).
        {puedeCargar ? ' Carga aquí los PDFs de las reservas; el asesor los ve en su portal.' : ' La responsable de viajes carga las reservas; el asesor las ve en su portal.'}
        <b> · {status}</b></div>

      {/* input file oculto, compartido por todas las celdas */}
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onArchivo} style={{ display: 'none' }} aria-hidden />

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <div className="kpi"><div className="v"><NumberTicker value={res.filas} /></div><div className="l">Servicios con necesidad</div></div>
        <div className={`kpi ${res.pendientes > 0 ? 'warn' : 'good'}`}><div className="v"><NumberTicker value={res.pendientes} /></div><div className="l">Reservas pendientes</div></div>
        <div className="kpi"><div className="v"><NumberTicker value={res.proximos7} /></div><div className="l">Viajan en 7 días</div></div>
        <div className="kpi good"><div className="v"><NumberTicker value={res.completas} /></div><div className="l">Completas</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 10px' }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colegio…"
          aria-label="Buscar colegio" style={{ width: 170, fontSize: 12, padding: '5px 8px' }} />
        <select value={fAsesor} onChange={(e) => setFAsesor(e.target.value)} aria-label="Filtrar por asesor" style={{ width: 'auto' }}>
          <option value="todos">Todos los asesores</option>
          {asesoresConViaje.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select value={fGerencia} onChange={(e) => setFGerencia(e.target.value)} aria-label="Filtrar por gerencia" style={{ width: 'auto' }}>
          <option value="todos">Todas las gerencias</option>
          {gerencias.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value as typeof fEstado)} aria-label="Filtrar por estado de reserva" style={{ width: 'auto' }}>
          <option value="todos">Todo estado</option>
          <option value="pendiente">⏳ Pendientes</option>
          <option value="parcial">◐ Parciales</option>
          <option value="completa">✓ Completas</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, margin: 0, color: 'var(--mut)' }}>
          <input type="checkbox" checked={verRealizados} onChange={(e) => setVerRealizados(e.target.checked)} />
          Incluir realizados
        </label>
        {filtrosActivos && <button className="sec" onClick={limpiar}>× Limpiar</button>}
      </div>

      {filas.length === 0 ? (
        <div className="panel"><div className="hint">
          {todas.length === 0
            ? 'Aún no hay servicios marcados con viaje u hospedaje. Se marcan en Planeación → Hoja del asesor → Agenda (columnas ✈️/🏨).'
            : 'Ninguna fila coincide con los filtros.'}
          {filtrosActivos && <> <button className="sec" onClick={limpiar}>Limpiar filtros</button></>}
        </div></div>
      ) : (
        <table>
          <thead><tr>
            <th>Fecha</th><th>Colegio</th><th>Asesor</th><th>Servicio</th><th>Gerencia</th>
            <th>Necesita</th><th>Estado</th><th>🎫 Transporte</th><th>🏨 Hotel</th>
          </tr></thead>
          <tbody>
            {filas.map((f) => {
              const est = estadoReserva(f.servicio)
              const e = EST_RES[est]
              const vencida = f.servicio.estatus !== 'realizado' && f.servicio.fechaPlan && f.servicio.fechaPlan < hoy
              return (
                <tr key={`${f.colegio.id}:${f.idx}`} style={{ opacity: f.servicio.estatus === 'realizado' ? 0.55 : 1 }}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: vencida ? 'var(--gold)' : undefined }}
                    title={vencida ? 'La fecha planeada ya pasó' : undefined}>{fmtCorta(f.servicio.fechaPlan)}{vencida ? ' ⚠' : ''}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, marginRight: 5, background: f.colegio.campaign === 'SMART' ? SMART : CORE }} />
                    {f.colegio.nombre}
                  </td>
                  <td style={{ textAlign: 'left' }}>{nombreAsesor(f.colegio.asesorId)}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{SERV_LABEL[f.servicio.tipo]}{f.servicio.nivel ? ` · ${NIVEL_LABEL[f.servicio.nivel]}` : ''}</td>
                  <td style={{ textAlign: 'left', color: 'var(--mut)' }}>{f.colegio.gerencia ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{f.servicio.reqViaje && '✈️'}{f.servicio.reqViaje && f.servicio.reqHospedaje && ' '}{f.servicio.reqHospedaje && '🏨'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: e.color, background: e.bg, borderRadius: 8, padding: '2px 8px' }}>{e.label}</span>
                  </td>
                  <td>{celdaReserva(f, 'transporte')}</td>
                  <td>{celdaReserva(f, 'hotel')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="hint" style={{ marginTop: 8 }}>
        Los PDF (máx 10 MB) viven en almacenamiento privado; el asesor ve los suyos en su portal al abrir el servicio.
        {puedeCargar && ' «Reemplazar» sube un PDF nuevo y elimina el anterior.'}
      </div>
    </div>
  )
}
