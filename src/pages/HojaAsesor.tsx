import { useEffect, useRef, useState } from 'react'
import { DEFAULTS, TIER_SEED } from '../data/model'
import type { TierKey, Campaign } from '../data/model'
import {
  defaultPlaneacion, setServicio, patchColegio, cargaAsesor, agregarAlerta,
  hoyISO, urgencia, agendaAsesor, serviciosDeAsesor, SATISFACCION, PROBLEMAS,
} from '../data/planeacion'
import type { PlaneacionData, Servicio, Colegio, ProblemaKey } from '../data/planeacion'
import { loadLocal, loadRemote } from '../lib/planeacionStore'
import { usePersistenciaPlaneacion } from '../lib/persistenciaPlaneacion'
import { ColegioCard, ServLabel } from '../features/planeacion/ColegioCard'
import { EST_COLOR, URG_BG, SMART, CORE } from '../features/planeacion/colors'
import { NumberTicker } from '../ui/NumberTicker'
import { ProgressRing } from '../ui/ProgressRing'
import { useAcceso } from '../lib/accesoCtx'
import logoSM from '../assets/logo-sm.svg'

// ─── Portal del asesor (V3, móvil-first) ──────────────────────────────────────
// El acceso viene de la sesión global (login por usuario): un asesor entra
// directo a SU hoja (sesion.asesorId); admin/coordinación/logística lo ven como
// vista previa con un selector. Ver docs/07-administracion-usuarios.md.
// La tarjeta de colegio es compartida con el coordinador: features/planeacion/ColegioCard.
const ROJO = 'var(--red)'
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtF = (iso: string) => `${parseInt(iso.slice(8, 10), 10)} ${MESES_C[parseInt(iso.slice(5, 7), 10) - 1]}`

export default function HojaAsesor() {
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Cargando…')
  const { sesion, salir } = useAcceso()
  // roles no-asesor: eligen a qué asesor mirar (vista previa)
  const [previewId, setPreviewId] = useState<string | null>(null)
  // null = colapso por defecto (solo la primera tarjeta abierta); al tocar se materializa el set
  const [expandidos, setExpandidos] = useState<Set<string> | null>(null)
  // filtros de la cartera
  const [busca, setBusca] = useState('')
  const [fCamp, setFCamp] = useState<'todos' | Campaign>('todos')
  const [fTier, setFTier] = useState<'todos' | TierKey>('todos')
  const [fEstado, setFEstado] = useState<'todos' | 'vencidos' | 'pendientes' | 'completos'>('todos')
  // alerta de caso crítico (FAB)
  const [alertaOpen, setAlertaOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [alCol, setAlCol] = useState('')
  const [alTipo, setAlTipo] = useState<ProblemaKey>('materiales')
  const [alDesc, setAlDesc] = useState('')
  const [alSent, setAlSent] = useState(false)

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
  usePersistenciaPlaneacion(data, ready, setStatus)

  // modal de alerta: Escape cierra + focus-trap con Tab dentro del diálogo
  useEffect(() => {
    if (!alertaOpen) return
    const foco = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
    ).filter((el) => el.offsetParent !== null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAlertaOpen(false); return }
      if (e.key !== 'Tab') return
      const els = foco()
      if (els.length === 0) return
      const first = els[0], last = els[els.length - 1]
      const activo = document.activeElement as HTMLElement | null
      if (e.shiftKey && (activo === first || !dialogRef.current?.contains(activo))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && activo === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alertaOpen])

  const hoy = hoyISO()
  const esPreview = sesion.rol !== 'asesor'
  const asesorId = esPreview ? (previewId ?? data.asesores[0]?.id ?? null) : (sesion.asesorId ?? null)
  const asesor = data.asesores.find((a) => a.id === asesorId) ?? null

  // Asesor sin hoja ligada (falta vincularlo en Administración) o tablero vacío
  if (!asesor) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1 className="gate-title">Tu hoja aún no está lista</h1>
          <p className="gate-sub">Tu cuenta no tiene una hoja de asesor ligada. Pide al administrador
            que la vincule en Administración → Usuarios.</p>
          <button className="gate-btn" onClick={salir}>Salir</button>
        </div>
      </div>
    )
  }

  // ── Datos del asesor ─────────────────────────────────────────────────────────
  const misColegios = data.colegios.filter((c) => c.asesorId === asesor.id)
  const carga = cargaAsesor(data.colegios, asesor.id)
  const pct = carga.servicios ? Math.round((carga.realizados / carga.servicios) * 100) : 0
  const ag = agendaAsesor(data.colegios, asesor.id, hoy)
  const refs = serviciosDeAsesor(data.colegios, asesor.id)
  const perAseCap = Math.round(DEFAULTS.tDay * DEFAULTS.dWeek * DEFAULTS.wMonth * 12)
  const pctCap = Math.min(100, Math.round((carga.usoProf / perAseCap) * 100))

  const proximos = refs
    .filter((r) => r.servicio.estatus !== 'realizado' && r.servicio.fechaPlan)
    .sort((a, b) => a.servicio.fechaPlan!.localeCompare(b.servicio.fechaPlan!))
    .slice(0, 6)

  const atencion = misColegios.map((c) => {
    const venc = c.servicios.filter((s) => urgencia(s, hoy) === 'vencido').length
    const sinFecha = c.servicios.filter((s) => s.estatus === 'pendiente' && !s.fechaPlan).length
    const satBaja = (c.satisfaccion ?? 0) > 0 && (c.satisfaccion ?? 0) <= 2
    return { c, venc, sinFecha, satBaja, score: venc * 100 + (satBaja ? 50 : 0) + sinFecha }
  }).filter((x) => x.venc > 0 || x.satBaja || x.sinFecha > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const satDist = SATISFACCION.map((s) => ({ ...s, n: misColegios.filter((c) => c.satisfaccion === s.v).length }))
  const sinCalif = misColegios.filter((c) => !c.satisfaccion).length
  const nSmart = misColegios.filter((c) => c.campaign === 'SMART').length
  const nCore = misColegios.length - nSmart

  // cartera filtrada (búsqueda + filtros)
  const visibles = misColegios.filter((c) => {
    if (busca && !c.nombre.toLowerCase().includes(busca.toLowerCase())) return false
    if (fCamp !== 'todos' && c.campaign !== fCamp) return false
    if (fTier !== 'todos' && c.tier !== fTier) return false
    if (fEstado === 'vencidos' && !c.servicios.some((s) => urgencia(s, hoy) === 'vencido')) return false
    if (fEstado === 'pendientes' && !c.servicios.some((s) => s.estatus !== 'realizado')) return false
    if (fEstado === 'completos' && c.servicios.some((s) => s.estatus !== 'realizado')) return false
    return true
  })
  const filtrosActivos = busca !== '' || fCamp !== 'todos' || fTier !== 'todos' || fEstado !== 'todos'
  const limpiar = () => { setBusca(''); setFCamp('todos'); setFTier('todos'); setFEstado('todos') }

  // colapso: por defecto solo la primera visible abierta (o la única, si el filtro deja una)
  const abiertoCard = (id: string, idx: number) =>
    expandidos ? expandidos.has(id) : (idx === 0 || visibles.length === 1)
  const toggleCard = (id: string) => setExpandidos((p) => {
    const base = p ?? new Set(visibles.length ? [visibles[0].id] : [])
    const n = new Set(base)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const setServ = (colegioId: string, idx: number, patch: Partial<Servicio>) =>
    setData((d) => ({ ...d, colegios: setServicio(d.colegios, colegioId, idx, patch) }))
  const patchCol = (id: string, patch: Partial<Colegio>) =>
    setData((d) => ({ ...d, colegios: patchColegio(d.colegios, id, patch) }))

  const abrirAlerta = (colegioId?: string) => {
    setAlCol(colegioId ?? misColegios[0]?.id ?? ''); setAlTipo('materiales'); setAlDesc(''); setAlSent(false); setAlertaOpen(true)
  }
  const enviarAlerta = () => {
    if (!alCol || !alDesc.trim()) return
    setData((d) => agregarAlerta(d, { fecha: new Date().toISOString(), asesorId: asesor.id, colegioId: alCol, tipo: alTipo, descripcion: alDesc.trim() }))
    setAlSent(true)
  }

  // ── Dashboard del asesor ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--line)' }}>
      <header className="app-header">
        <div className="inner" style={{ maxWidth: 820, flexWrap: 'wrap', rowGap: 6 }}>
          <div className="brand">
            <img src={logoSM} alt="SM México" className="brand-logo" />
            <span className="brand-txt">Portal del asesor<small>Servicios pedagógicos 2026-2027</small></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--mut)' }}>
            {esPreview && (<>
              <a className="sec" href="#/planeacion" style={{ textDecoration: 'none' }}>← Volver</a>
              <select value={asesor.id} aria-label="Vista previa: asesor" title="Vista previa: elige el asesor"
                onChange={(e) => setPreviewId(e.target.value)} style={{ width: 'auto', fontSize: 12 }}>
                {data.asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </>)}
            <span>{status}</span>
            <button className="sec" onClick={salir}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 14px 110px' }}>
        <h1 style={{ marginBottom: 2 }}>Hola, {asesor.nombre}</h1>
        <div className="sub">Tu hoja de servicios pedagógicos · {misColegios.length} colegios asignados.</div>

        {misColegios.length === 0 ? (
          <div className="panel"><div className="hint">Aún no tienes colegios asignados. Tu coordinador te los asignará pronto.</div></div>
        ) : (<>
          {/* KPIs */}
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))' }}>
            <div className={`kpi ${ag.vencidos > 0 ? 'warn' : ''}`}><div className="v"><NumberTicker value={ag.vencidos} /></div><div className="l">Vencidos</div></div>
            <div className="kpi"><div className="v"><NumberTicker value={ag.estaSemana} /></div><div className="l">Próx. 7 días</div></div>
            <div className="kpi"><div className="v"><NumberTicker value={ag.porHacer} /></div><div className="l">Por hacer</div></div>
            <div className="kpi" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProgressRing pct={pct} />
              <div className="l" style={{ marginTop: 0 }}>Avance<br />({carga.realizados}/{carga.servicios})</div>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 8, background: 'var(--track)', overflow: 'hidden', margin: '2px 0 14px' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: EST_COLOR.realizado }} />
          </div>

          {/* Agenda próxima */}
          <div className="panel">
            <h3>📅 Tu agenda próxima</h3>
            {proximos.length === 0
              ? <div className="hint" style={{ margin: 0 }}>No tienes servicios agendados con fecha. Ponles fecha planeada a tus pendientes para organizarte.</div>
              : proximos.map((r) => {
                const u = urgencia(r.servicio, hoy)
                return (
                  <div key={r.colegioId + ':' + r.idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '1px solid #F0F2F5', background: URG_BG[u], borderRadius: 6 }}>
                    <div style={{ width: 46, flex: '0 0 auto', fontWeight: 700, fontSize: 12, color: u === 'vencido' ? 'var(--gold)' : '#2C2F36' }}>{fmtF(r.servicio.fechaPlan!)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.colegioNombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}><ServLabel s={r.servicio} u={u} /></div>
                    </div>
                    <button className="sec" style={{ flex: '0 0 auto', minHeight: 34 }} title="Marcar realizado hoy"
                      onClick={() => setServ(r.colegioId, r.idx, { estatus: 'realizado', fechaReal: hoy })}>✓ Hecho</button>
                  </div>
                )
              })}
          </div>

          {/* Requieren atención */}
          {atencion.length > 0 && (
            <div className="panel">
              <h3>⚠️ Requieren tu atención</h3>
              {atencion.map(({ c, venc, sinFecha, satBaja }) => (
                <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: c.campaign === 'SMART' ? SMART : CORE, flex: '0 0 auto' }} />
                  <b style={{ marginRight: 2 }}>{c.nombre}</b>
                  {venc > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 8, padding: '1px 7px' }}>{venc} vencido{venc > 1 ? 's' : ''}</span>}
                  {sinFecha > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#4A4F58', background: '#E9ECF0', borderRadius: 8, padding: '1px 7px' }}>{sinFecha} sin agendar</span>}
                  {satBaja && <span style={{ fontSize: 10, fontWeight: 600, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 8, padding: '1px 7px' }}>satisfacción baja {SATISFACCION.find((s) => s.v === c.satisfaccion)?.emoji}</span>}
                </div>
              ))}
              <div className="hint" style={{ marginTop: 6 }}>Prioriza estos colegios: agenda sus servicios, atiende los vencidos y da seguimiento a la satisfacción.</div>
            </div>
          )}

          {/* Mi cartera */}
          <div className="panel">
            <h3>📊 Tu cartera</h3>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--mut)', fontSize: 11, marginBottom: 4 }}>Colegios</div>
                <span style={{ color: SMART, fontWeight: 700 }}>{nSmart} SMART</span> · <span style={{ color: CORE, fontWeight: 700 }}>{nCore} CORE</span>
              </div>
              <div style={{ minWidth: 200, flex: 1 }}>
                <div style={{ color: 'var(--mut)', fontSize: 11, marginBottom: 4 }}>Tu carga uso/prof vs tu capacidad anual (~{perAseCap})</div>
                <div style={{ height: 8, borderRadius: 8, background: 'var(--track)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctCap}%`, background: carga.usoProf > perAseCap ? 'var(--gold)' : SMART }} />
                </div>
                <div style={{ fontSize: 10, color: carga.usoProf > perAseCap ? 'var(--gold)' : 'var(--mut)', marginTop: 3 }}>
                  {carga.usoProf} de {perAseCap} ({pctCap}%){carga.usoProf > perAseCap ? ' · sobrecarga: habla con tu coordinador' : ''}</div>
              </div>
              <div>
                <div style={{ color: 'var(--mut)', fontSize: 11, marginBottom: 4 }}>Satisfacción de tu cartera</div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  {satDist.map((s) => (
                    <span key={s.v} title={s.label} style={{ fontSize: 13, opacity: s.n ? 1 : 0.35 }}>{s.emoji}<b style={{ fontSize: 11, marginLeft: 2 }}>{s.n}</b></span>
                  ))}
                  <span style={{ fontSize: 10, color: 'var(--mut)' }}>· {sinCalif} sin calificar</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mis colegios: búsqueda + filtros */}
          <h2 style={{ marginTop: 18 }}>Mis colegios</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0 10px' }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colegio…"
              aria-label="Buscar colegio" style={{ flex: '1 1 150px', minWidth: 140, fontSize: 14, padding: '7px 10px' }} />
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value as typeof fEstado)} style={{ width: 'auto', fontSize: 12, padding: '7px 6px' }}>
              <option value="todos">Todos</option>
              <option value="vencidos">Con vencidos</option>
              <option value="pendientes">Con pendientes</option>
              <option value="completos">Completados</option>
            </select>
            <select value={fCamp} onChange={(e) => setFCamp(e.target.value as typeof fCamp)} style={{ width: 'auto', fontSize: 12, padding: '7px 6px' }}>
              <option value="todos">Ambas</option>
              <option value="SMART">SMART</option>
              <option value="CORE">CORE</option>
            </select>
            <select value={fTier} onChange={(e) => setFTier(e.target.value as typeof fTier)} style={{ width: 'auto', fontSize: 12, padding: '7px 6px' }}>
              <option value="todos">Todo tipo</option>
              {TIER_SEED.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {filtrosActivos && <button className="sec" onClick={limpiar}>× Limpiar</button>}
          </div>
          {filtrosActivos && <div className="hint" style={{ margin: '0 0 8px' }}>Mostrando {visibles.length} de {misColegios.length} colegios.</div>}

          {visibles.length === 0 ? (
            <div className="hint">Ningún colegio coincide. <button className="sec" onClick={limpiar}>Limpiar filtros</button></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
              {visibles.map((c, idxV) => (
                <div key={c.id} className="card-in" style={{ ['--i' as string]: Math.min(idxV, 8) }}>
                  <ColegioCard c={c} hoy={hoy} abierto={abiertoCard(c.id, idxV)}
                    onToggle={() => toggleCard(c.id)}
                    onServ={(i, p) => setServ(c.id, i, p)}
                    onPatch={(p) => patchCol(c.id, p)}
                    onReportar={() => abrirAlerta(c.id)} />
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>

      {/* FAB: caso crítico */}
      {misColegios.length > 0 && (
        <button onClick={() => abrirAlerta()} aria-label="Reportar caso crítico"
          style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, background: ROJO, color: '#fff', border: 'none',
            borderRadius: 999, padding: '13px 18px', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(0,0,0,.28)', cursor: 'pointer' }}>🚨 Caso crítico</button>
      )}

      {/* Modal de alerta (bottom sheet) */}
      {alertaOpen && (
        <div className="sheet-backdrop" onClick={() => setAlertaOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,.45)', zIndex: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div ref={dialogRef} className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reportar caso crítico"
            style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '16px 16px 24px', width: '100%', maxWidth: 560, boxSizing: 'border-box', boxShadow: '0 -6px 24px rgba(0,0,0,.18)' }}>
            {alSent ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 34 }}>✅</div>
                <h3 style={{ margin: '6px 0 4px' }}>Alerta enviada</h3>
                <p style={{ fontSize: 13, color: 'var(--mut)', margin: '0 0 14px' }}>Tu coordinador la verá en su tablero de planeación y te contactará.</p>
                <button className="gate-btn" style={{ maxWidth: 200, margin: '0 auto' }} onClick={() => setAlertaOpen(false)}>Cerrar</button>
              </div>
            ) : (<>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>🚨 Reportar caso crítico</h3>
                <button onClick={() => setAlertaOpen(false)} aria-label="Cerrar"
                  style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--mut)', padding: 4 }}>×</button>
              </div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>Colegio
                <select value={alCol} onChange={(e) => setAlCol(e.target.value)} style={{ marginTop: 3, fontSize: 15, padding: '8px 8px' }}>
                  {misColegios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>Tipo de problema
                <select value={alTipo} onChange={(e) => setAlTipo(e.target.value as ProblemaKey)} style={{ marginTop: 3, fontSize: 15, padding: '8px 8px' }}>
                  {PROBLEMAS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--mut)', marginBottom: 12 }}>Describe el caso
                <textarea value={alDesc} autoFocus onChange={(e) => setAlDesc(e.target.value)} placeholder="¿Qué está pasando y qué necesitas?"
                  style={{ width: '100%', marginTop: 3, fontSize: 15, padding: '8px 10px', minHeight: 84, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="sec" style={{ flex: 1, minHeight: 42 }} onClick={() => setAlertaOpen(false)}>Cancelar</button>
                <button disabled={!alCol || !alDesc.trim()} onClick={enviarAlerta}
                  style={{ flex: 2, minHeight: 42, background: ROJO, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', opacity: (!alCol || !alDesc.trim()) ? 0.5 : 1 }}>
                  Enviar alerta</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}
