// Portal del ejecutivo comercial (#/mis-colegios): SOLO LECTURA.
// Ve el estatus de SUS colegios (los que lo traen como «Ejecutivo Responsable»),
// con énfasis en los comentarios y reportes que va dejando el asesor pedagógico.
// Nunca guarda: aquí no hay usePersistencia a propósito.
import { useEffect, useMemo, useState } from 'react'
import { defaultPlaneacion, colegiosDeEjecutivo, hoyISO, urgencia, SATISFACCION, PROBLEMAS, NIVEL_LABEL, nivelesDeColegio } from '../data/planeacion'
import type { PlaneacionData, Colegio, Alerta } from '../data/planeacion'
import { loadLocal, loadRemote } from '../lib/planeacionStore'
import { SMART, CORE, EST_COLOR, SERV_LABEL, segColor } from '../features/planeacion/colors'
import { NumberTicker } from '../ui/NumberTicker'
import { ProgressRing } from '../ui/ProgressRing'
import { useAcceso } from '../lib/accesoCtx'
import logoSM from '../assets/logo-sm.svg'

const fmtCorta = (iso: string) => iso.slice(5, 10).split('-').reverse().join('/')

/** Comentarios del asesor sobre un colegio: notas generales + notas por servicio. */
function comentariosDe(c: Colegio): { titulo: string; texto: string; fecha?: string }[] {
  const out: { titulo: string; texto: string; fecha?: string }[] = []
  if (c.notasGenerales) out.push({ titulo: 'Notas generales', texto: c.notasGenerales })
  c.servicios.forEach((s) => {
    if (s.nota) out.push({
      titulo: `${SERV_LABEL[s.tipo]}${s.nivel ? ` · ${NIVEL_LABEL[s.nivel]}` : ''}`,
      texto: s.nota,
      fecha: s.fechaReal ?? s.fechaPlan,
    })
  })
  return out
}

export default function MisColegios() {
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [status, setStatus] = useState('Cargando…')
  const { sesion, salir } = useAcceso()
  const [previewNombre, setPreviewNombre] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  useEffect(() => {
    let vivo = true
    loadRemote().then((res) => {
      if (!vivo) return
      if (res.source === 'remote') setData(res.data)
      setStatus(res.source === 'remote' ? 'Actualizado' : 'Sin conexión · datos locales')
    })
    return () => { vivo = false }
  }, [])

  const hoy = hoyISO()
  const esPreview = sesion.rol !== 'ejecutivo'
  // vista previa: elegir entre los ejecutivos que aparecen en los colegios
  const ejecutivosConCartera = useMemo(() => {
    const set = new Set<string>()
    for (const c of data.colegios) if (c.ejecutivo) set.add(c.ejecutivo)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [data.colegios])
  const nombreEjecutivo = esPreview
    ? (previewNombre ?? ejecutivosConCartera[0] ?? null)
    : (sesion.ejecutivo ?? null)

  if (!nombreEjecutivo) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1 className="gate-title">{esPreview ? 'Aún no hay ejecutivos con cartera' : 'Tu portal aún no está listo'}</h1>
          <p className="gate-sub">{esPreview
            ? 'Ningún colegio del tablero tiene «Ejecutivo Responsable». Se llena con la carga masiva de BI o en Administración → Colegios.'
            : 'Tu cuenta no tiene el nombre de «Ejecutivo Responsable» vinculado. Pide al administrador que lo capture en Administración → Usuarios.'}</p>
          {esPreview
            ? <a className="gate-btn" style={{ display: 'block', textDecoration: 'none', boxSizing: 'border-box' }} href="#/planeacion">← Volver</a>
            : <button className="gate-btn" onClick={salir}>Salir</button>}
        </div>
      </div>
    )
  }

  const mios = colegiosDeEjecutivo(data.colegios, nombreEjecutivo)
  const idsMios = new Set(mios.map((c) => c.id))
  const totalServ = mios.reduce((s, c) => s + c.servicios.length, 0)
  const hechos = mios.reduce((s, c) => s + c.servicios.filter((x) => x.estatus === 'realizado').length, 0)
  const pct = totalServ ? Math.round((hechos / totalServ) * 100) : 0
  const conComentarios = mios.filter((c) => comentariosDe(c).length > 0).length
  const alertasMias: Alerta[] = (data.alertas ?? [])
    .filter((a) => idsMios.has(a.colegioId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const alertasAbiertas = alertasMias.filter((a) => !a.atendida)
  const nombreAsesor = (id: string | null) => id ? (data.asesores.find((a) => a.id === id)?.nombre ?? '—') : 'Cobertura con externos'
  const nombreColegio = (id: string) => data.colegios.find((c) => c.id === id)?.nombre ?? id

  const visibles = mios.filter((c) => !busca || c.nombre.toLowerCase().includes(busca.toLowerCase()))
  const toggle = (id: string) => setAbiertos((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--line)' }}>
      <header className="app-header">
        <div className="inner" style={{ maxWidth: 860, flexWrap: 'wrap', rowGap: 6 }}>
          <div className="brand">
            <img src={logoSM} alt="SM México" className="brand-logo" />
            <span className="brand-txt">Portal del ejecutivo comercial<small>Servicios pedagógicos 2026-2027</small></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-body)', color: 'var(--mut)', marginLeft: 'auto' }}>
            {esPreview && (<>
              <a className="sec" href="#/planeacion" style={{ textDecoration: 'none' }}>← Volver</a>
              <select value={nombreEjecutivo} aria-label="Vista previa: ejecutivo" title="Vista previa: elige el ejecutivo"
                onChange={(e) => setPreviewNombre(e.target.value)} style={{ width: 'auto', fontSize: 'var(--fs-body)' }}>
                {ejecutivosConCartera.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </>)}
            <span>{status}</span>
            <button className="sec" onClick={salir}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 14px 60px' }}>
        <h1 style={{ marginBottom: 2 }}>Hola, {esPreview ? nombreEjecutivo : sesion.nombre.split(' ')[0]}</h1>
        <div className="sub">El estatus de tus {mios.length} colegios y lo que va reportando el equipo pedagógico. Solo lectura: aquí no se edita nada.</div>

        {mios.length === 0 ? (
          <div className="panel"><div className="hint">Ningún colegio del tablero te tiene como «Ejecutivo Responsable» todavía.
            En cuanto se cargue el catálogo de BI con tu nombre, aparecerán aquí.</div></div>
        ) : (<>
          {/* KPIs */}
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
            <div className="kpi"><div className="v"><NumberTicker value={mios.length} /></div><div className="l">Colegios</div></div>
            <div className="kpi" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProgressRing pct={pct} />
              <div className="l" style={{ marginTop: 0 }}>Avance<br />({hechos}/{totalServ} sesiones)</div>
            </div>
            <div className="kpi"><div className="v"><NumberTicker value={conComentarios} /></div><div className="l">Con comentarios del asesor</div></div>
            <div className={`kpi ${alertasAbiertas.length > 0 ? 'warn' : 'good'}`}><div className="v"><NumberTicker value={alertasAbiertas.length} /></div><div className="l">Casos críticos abiertos</div></div>
          </div>

          {/* reportes recientes (alertas de asesores sobre SUS colegios) */}
          {alertasMias.length > 0 && (
            <div className="panel">
              <h3>🚨 Reportes de caso crítico</h3>
              {alertasMias.slice(0, 8).map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 'var(--fs-body)' }}>
                  <span style={{ color: 'var(--mut)', width: 44, flex: '0 0 auto', fontSize: 'var(--fs-meta)' }}>{fmtCorta(a.fecha.slice(0, 10))}</span>
                  <b style={{ flex: '0 0 auto' }}>{nombreColegio(a.colegioId)}</b>
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 8, padding: '1px 8px', flex: '0 0 auto' }}>
                    {PROBLEMAS.find((p) => p.key === a.tipo)?.label ?? a.tipo}</span>
                  <span style={{ flex: '1 1 200px', minWidth: 0, color: 'var(--ink-2)' }}>{a.descripcion}</span>
                  <span style={{ flex: '0 0 auto', fontSize: 'var(--fs-meta)', fontWeight: 700, color: a.atendida ? 'var(--green)' : 'var(--gold)' }}>
                    {a.atendida ? '✓ Atendido' : 'Abierto'}</span>
                </div>
              ))}
              <div className="hint" style={{ marginTop: 6 }}>Los levanta el asesor pedagógico desde su portal; coordinación los marca atendidos.</div>
            </div>
          )}

          {/* cartera */}
          <h2 style={{ marginTop: 18 }}>Tus colegios</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0 10px' }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar colegio…"
              aria-label="Buscar colegio" style={{ flex: '1 1 180px', minWidth: 150, fontSize: 'var(--fs-input)', padding: '7px 10px' }} />
            {busca && <button className="sec" onClick={() => setBusca('')}>× Limpiar</button>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            {visibles.map((c, idxV) => {
              const done = c.servicios.filter((s) => s.estatus === 'realizado').length
              const abierto = abiertos.has(c.id)
              const sat = c.satisfaccion ? SATISFACCION.find((s) => s.v === c.satisfaccion) : null
              const comentarios = comentariosDe(c)
              const alertasCol = alertasMias.filter((a) => a.colegioId === c.id)
              const vencidos = c.servicios.filter((s) => urgencia(s, hoy) === 'vencido').length
              const proxima = c.servicios
                .filter((s) => s.estatus !== 'realizado' && s.fechaPlan && s.fechaPlan >= hoy)
                .sort((a, b) => a.fechaPlan!.localeCompare(b.fechaPlan!))[0]
              const niveles = nivelesDeColegio(c)
              return (
                <div key={c.id} className="card-in panel" style={{ ['--i' as string]: Math.min(idxV, 8), margin: 0 }}>
                  <button type="button" onClick={() => toggle(c.id)} aria-expanded={abierto}
                    style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', width: '100%', minHeight: 32, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }}>
                    <span aria-hidden className={`card-chev${abierto ? ' abierto' : ''}`}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M6 3.5 11 8l-5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9, flex: '0 0 auto', background: c.campaign === 'SMART' ? SMART : CORE }} />
                    <b style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</b>
                    {sat && <span title={`Satisfacción: ${sat.label}`} style={{ fontSize: 15, flex: '0 0 auto' }}>{sat.emoji}</span>}
                    {comentarios.length > 0 && <span title={`${comentarios.length} comentarios del asesor`} style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--smart)', background: '#EAF1F9', borderRadius: 8, padding: '1px 7px', flex: '0 0 auto' }}>💬 {comentarios.length}</span>}
                    {vencidos > 0 && <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 8, padding: '1px 7px', flex: '0 0 auto' }}>{vencidos} vencido{vencidos > 1 ? 's' : ''}</span>}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0 2px' }}>
                    <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 60 }}>
                      {c.servicios.map((s, i) => (
                        <span key={i} title={`${SERV_LABEL[s.tipo]}`} style={{ flex: 1, height: 7, borderRadius: 2, background: segColor(s, hoy) }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', flex: '0 0 auto', whiteSpace: 'nowrap', fontWeight: 600 }}>{done}/{c.servicios.length} sesiones</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                    <span>Asesor: <b style={{ color: 'var(--ink-2)' }}>{nombreAsesor(c.asesorId)}</b></span>
                    {proxima && <span>Próxima sesión: <b style={{ color: 'var(--ink-2)' }}>{fmtCorta(proxima.fechaPlan!)}</b></span>}
                    {niveles.length > 0 && <span>{niveles.map((k) => NIVEL_LABEL[k]).join(' · ')}</span>}
                  </div>

                  {abierto && (<>
                    {/* contacto para coordinarse con el colegio */}
                    {c.contacto && (c.contacto.nombre || c.contacto.telefono || c.contacto.correo) && (
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', marginTop: 10, padding: '8px 10px', background: 'var(--panel-bg)', borderRadius: 8, fontSize: 'var(--fs-body)' }}>
                        <span aria-hidden>📇</span>
                        <b>{c.contacto.nombre ?? 'Contacto'}</b>
                        {c.contacto.rol && <span style={{ color: 'var(--mut)' }}>{c.contacto.rol}</span>}
                        {c.contacto.telefono && <a href={`tel:${c.contacto.telefono}`} style={{ color: 'var(--smart)', fontWeight: 600 }}>{c.contacto.telefono}</a>}
                        {c.contacto.correo && <a href={`mailto:${c.contacto.correo}`} style={{ color: 'var(--smart)', fontWeight: 600 }}>{c.contacto.correo}</a>}
                      </div>
                    )}

                    {/* énfasis: comentarios y reportes del asesor */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mut)', marginBottom: 6 }}>💬 Comentarios del asesor</div>
                      {comentarios.length === 0 && alertasCol.length === 0 && (
                        <div className="hint" style={{ margin: 0 }}>Sin comentarios todavía. Aparecerán conforme el asesor avance con el colegio.</div>
                      )}
                      {comentarios.map((n, i) => (
                        <div key={i} style={{ borderLeft: `2px solid var(--line-2)`, padding: '4px 10px', margin: '0 0 6px' }}>
                          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--mut)', fontWeight: 600 }}>{n.titulo}{n.fecha && ` · ${fmtCorta(n.fecha)}`}</div>
                          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.5 }}>“{n.texto}”</div>
                        </div>
                      ))}
                      {alertasCol.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 'var(--fs-body)', padding: '4px 0' }}>
                          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 8, padding: '1px 8px' }}>🚨 {PROBLEMAS.find((p) => p.key === a.tipo)?.label ?? a.tipo}</span>
                          <span style={{ color: 'var(--ink-2)', flex: '1 1 160px' }}>{a.descripcion}</span>
                          <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: a.atendida ? 'var(--green)' : 'var(--gold)' }}>{a.atendida ? '✓ Atendido' : 'Abierto'}</span>
                        </div>
                      ))}
                    </div>

                    {/* detalle de sesiones (lectura) */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mut)', marginBottom: 4 }}>Sesiones</div>
                      {c.servicios.map((s, i) => {
                        const real = s.estatus === 'realizado'
                        return (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 'var(--fs-body)', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 8, flex: '0 0 auto', alignSelf: 'center', background: real ? EST_COLOR.realizado : s.estatus === 'agendado' ? EST_COLOR.agendado : 'var(--line-2)' }} />
                            <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{SERV_LABEL[s.tipo]}{s.nivel && <span style={{ fontWeight: 400, color: 'var(--mut)' }}> · {NIVEL_LABEL[s.nivel]}</span>}{s.extra && <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: 'var(--pur)', background: '#F1EAF4', borderRadius: 4, padding: '1px 4px', marginLeft: 4 }}>EXTRA</span>}</span>
                            <span style={{ flex: '0 0 auto', color: 'var(--mut)', fontSize: 'var(--fs-meta)' }}>
                              {real ? `Realizada${s.fechaReal ? ` · ${fmtCorta(s.fechaReal)}` : ''}`
                                : s.fechaPlan ? `Programada · ${fmtCorta(s.fechaPlan)}` : 'Por programar'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>)}
                </div>
              )
            })}
          </div>
          {visibles.length === 0 && <div className="hint">Ningún colegio coincide con la búsqueda.</div>}
        </>)}
      </div>
    </div>
  )
}
