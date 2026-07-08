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
import { PageHeader } from '../ui/PageHeader'
import { KpiCard } from '../ui/KpiCard'
import { FilterBar, FilterCount } from '../ui/FilterBar'
import { DataTable } from '../ui/DataTable'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

const fmtCorta = (iso?: string) => iso ? iso.slice(5, 10).split('-').reverse().join('/') : '—'

const EST_RES: Record<EstadoReserva, { label: string; tone: 'warning' | 'success' }> = {
  pendiente: { label: 'Pendiente', tone: 'warning' },
  parcial: { label: 'Parcial', tone: 'warning' },
  completa: { label: 'Completa', tone: 'success' },
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

  const money = (v: number | undefined, on: (n: number | undefined) => void, ph = '$') => (
    <input type="number" min={0} step={50} value={v ?? ''} placeholder={ph} aria-label="Monto"
      onChange={(e) => on(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
      style={{ width: 78, fontSize: 11.5, padding: '4px 6px' }} />
  )

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
    const costo = tipo === 'hotel' ? f.servicio.costoHotel : (f.servicio.costoTransporte ?? f.servicio.costoTraslado)
    const setCosto = (n: number | undefined) => setServ(f.colegio.id, f.idx,
      tipo === 'hotel' ? { costoHotel: n } : { costoTransporte: n, traslado: n !== undefined || f.servicio.traslado || f.servicio.reqViaje })
    if (!requiere && !path) return <span style={{ color: 'var(--faint)' }}>—</span>
    const clave = `${f.colegio.id}:${f.idx}:${tipo}`
    const cargando = ocupado === clave
    return (
      <span style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {path ? (<>
          <Button type="button" size="sm" onClick={() => void verPdf(path)}>Ver</Button>
          {puedeCargar && (<>
            <Button type="button" size="sm" disabled={cargando}
              onClick={() => pedirArchivo(f.colegio.id, f.idx, tipo, path)}>{cargando ? '...' : 'Reemplazar'}</Button>
            <Button type="button" size="sm" variant="ghost" title="Quitar PDF" aria-label="Quitar PDF"
              onClick={() => quitarPdf(f.colegio.id, f.idx, tipo, path)}>x</Button>
          </>)}
        </>) : puedeCargar ? (
          <Button type="button" size="sm" variant="warning" disabled={cargando}
            onClick={() => pedirArchivo(f.colegio.id, f.idx, tipo)}>{cargando ? 'Subiendo...' : 'Cargar PDF'}</Button>
        ) : (
          <Badge tone="warning">Pendiente</Badge>
        )}
        {puedeCargar ? money(costo, setCosto) : costo ? <b>{costo.toLocaleString('es-MX')}</b> : null}
      </span>
    )
  }

  const celdaViaticos = (f: FilaViaje) => (
    puedeCargar
      ? money(f.servicio.costoViaticos, (n) => setServ(f.colegio.id, f.idx, { costoViaticos: n }))
      : f.servicio.costoViaticos ? <b>{f.servicio.costoViaticos.toLocaleString('es-MX')}</b> : <span style={{ color: 'var(--faint)' }}>—</span>
  )

  return (
    <div>
      <PageHeader
        title="Logística · viajes y hospedaje"
        status={status}
        description={<>Servicios agendados que requieren transporte u hospedaje (marcados en Planeación → agenda).
          {puedeCargar ? ' Carga aquí los PDFs de las reservas; el asesor los ve en su portal.' : ' La responsable de viajes carga las reservas; el asesor las ve en su portal.'}</>}
      />

      {/* input file oculto, compartido por todas las celdas */}
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onArchivo} style={{ display: 'none' }} aria-hidden />

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <KpiCard value={<NumberTicker value={res.filas} />} label="Servicios con necesidad" />
        <KpiCard tone={res.pendientes > 0 ? 'warn' : 'good'} value={<NumberTicker value={res.pendientes} />} label="Reservas pendientes" />
        <KpiCard value={<NumberTicker value={res.proximos7} />} label="Viajan en 7 días" />
        <KpiCard tone="good" value={<NumberTicker value={res.completas} />} label="Completas" />
      </div>

      <FilterBar trailing={filas.length > 0 && <FilterCount>{filas.length.toLocaleString('es-MX')} servicios</FilterCount>}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colegio…"
          aria-label="Buscar colegio" style={{ width: 170 }} />
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
        {filtrosActivos && <Button type="button" size="sm" variant="ghost" onClick={limpiar}>Limpiar</Button>}
      </FilterBar>

      {filas.length === 0 ? (
        <EmptyState
          title={todas.length === 0 ? 'Sin viajes marcados' : 'Sin resultados'}
          detail={todas.length === 0
            ? 'Aún no hay servicios marcados con viaje u hospedaje. Se marcan en Planeación → Hoja del asesor → Agenda.'
            : 'Ninguna fila coincide con los filtros actuales.'}
          action={filtrosActivos && <Button type="button" onClick={limpiar}>Limpiar filtros</Button>}
        />
      ) : (
        <DataTable>
          <table>
            <thead><tr>
              <th>Fecha</th><th>Colegio</th><th>Asesor</th><th>Servicio</th><th>Gerencia</th>
              <th>Necesita</th><th>Estado</th><th>Transporte</th><th>Hotel</th><th>Viáticos</th>
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
                    <td style={{ whiteSpace: 'nowrap' }}>{f.servicio.reqViaje && 'Viaje'}{f.servicio.reqViaje && f.servicio.reqHospedaje && ' · '}{f.servicio.reqHospedaje && 'Hotel'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><Badge tone={e.tone}>{e.label}</Badge></td>
                    <td>{celdaReserva(f, 'transporte')}</td>
                    <td>{celdaReserva(f, 'hotel')}</td>
                    <td>{celdaViaticos(f)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DataTable>
      )}
      <div className="hint" style={{ marginTop: 8 }}>
        Los PDF (máx 10 MB) viven en almacenamiento privado; el asesor ve los suyos en su portal al abrir el servicio.
        {puedeCargar && ' «Reemplazar» sube un PDF nuevo y elimina el anterior.'}
      </div>
    </div>
  )
}
