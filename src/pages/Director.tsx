// Vista del director de colegio: la pantalla de avance que abre el CLIENTE FINAL
// desde su enlace (#/director/<token>), sin cuenta ni login. Es nuestra cara ante
// el decisor: clara, cuidada y SOLO con datos publicables — la forma exacta la
// definen datosDirector() (cliente) y psp_vista_director() (SQL): nunca viajan
// tier, costos, notas internas, satisfacción ni valor del colegio.
import { useEffect, useState } from 'react'
import logoSM from '../assets/logo-sm.svg'
import { supabase } from '../lib/supabase'
import { NIVEL_LABEL, normalizarDirector } from '../data/planeacion'
import type { DirectorData, ServicioDirector, ServTipo, NivelKey, PorNivel, Estatus } from '../data/planeacion'
import { ProgressRing } from '../ui/ProgressRing'
import { Icon } from '../ui/Icon'

// Lenguaje para el director (sin jerga interna de la app)
const TIPO_DIR: Record<ServTipo, { nombre: string; desc: string }> = {
  uso: { nombre: 'Uso de la propuesta', desc: 'Acompañamiento para aprovechar los materiales SM en el aula' },
  prof: { nombre: 'Profundización', desc: 'Sesiones para profundizar la práctica docente con la propuesta' },
  didac: { nombre: 'Didáctica específica', desc: 'Talleres especializados impartidos por expertos por área' },
}
const EST_DIR: Record<Estatus, string> = { pendiente: 'Por programar', agendado: 'Programada', realizado: 'Realizada' }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fmtLarga = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${y}`
}
const mesDe = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number)
  const nombre = MESES[(m ?? 1) - 1]
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${y}`
}

/** Fecha visible de un servicio en la línea de tiempo (real si se realizó). */
const fechaDe = (s: ServicioDirector): string | undefined => s.estatus === 'realizado' ? (s.fechaReal ?? s.fechaPlan) : s.fechaPlan

/** Panel presentacional compartido por la página pública y la vista previa interna. */
export function PanelDirector({ d }: { d: DirectorData }) {
  const acc = d.campaign === 'SMART' ? 'var(--smart)' : 'var(--core)'
  const total = d.servicios.length
  const hechos = d.servicios.filter((s) => s.estatus === 'realizado').length
  const prog = d.servicios.filter((s) => s.estatus === 'agendado').length
  const pct = total ? Math.round((hechos / total) * 100) : 0

  // línea de tiempo: realizadas y programadas por fecha (agrupadas por mes); lo demás al final
  const conFecha = d.servicios.filter((s) => fechaDe(s))
    .sort((a, b) => fechaDe(a)!.localeCompare(fechaDe(b)!))
  const sinFecha = d.servicios.filter((s) => !fechaDe(s))
  const meses: { mes: string; items: ServicioDirector[] }[] = []
  for (const s of conFecha) {
    const mes = mesDe(fechaDe(s)!)
    const ult = meses[meses.length - 1]
    if (ult && ult.mes === mes) ult.items.push(s)
    else meses.push({ mes, items: [s] })
  }
  const porTipo = (['uso', 'prof', 'didac'] as ServTipo[])
    .map((t) => ({ t, tot: d.servicios.filter((s) => s.tipo === t).length, ok: d.servicios.filter((s) => s.tipo === t && s.estatus === 'realizado').length }))
    .filter((x) => x.tot > 0)
  const iniciales = (d.asesor ?? '').split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('')
  const filaSerie = (k: NivelKey, series?: PorNivel, ingles?: PorNivel): string =>
    [series?.[k], ingles?.[k]].filter(Boolean).join(' · ')
  const haySeries = d.niveles.some((k) => filaSerie(k, d.seriesNivel, d.inglesNivel))
  const proxima = conFecha.find((s) => s.estatus === 'agendado')

  return (
    <div className="dir-wrap" style={{ ['--dir-acc' as string]: acc }}>
      <div className="dir-band">
        <div className="inner">
          <img src={logoSM} alt="SM México" style={{ height: 26 }} />
          <span className="dir-product">Servicios Pedagógicos</span>
          <span className="ciclo">Ciclo escolar<br />2026-2027</span>
        </div>
      </div>

      <main className="dir-main">
        <header className="dir-hero card-in" style={{ ['--i' as string]: 0 }}>
          <div className="dir-hero-meta">
            <div className="prog"><span className="pt" aria-hidden />Programa de acompañamiento pedagógico SM</div>
            <span className="dir-current"><i /> Información al día</span>
          </div>
          <h1>{d.nombre}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--mut)', lineHeight: 1.6, margin: 0, maxWidth: '58ch' }}>
            Avance de la implementación del programa en su colegio. Esta página se
            actualiza en automático con el trabajo de su asesor pedagógico.
          </p>
          {d.niveles.length > 0 && (
            <div className="dir-niveles">
              {d.niveles.map((k) => <span key={k} className="dir-nivel">{NIVEL_LABEL[k]}</span>)}
            </div>
          )}
        </header>

        <section className="dir-panel card-in" style={{ ['--i' as string]: 1 }} aria-label="Resumen de avance">
          <div className="dir-resumen">
            <ProgressRing pct={pct} size={116} stroke={10} color={acc} />
            <div className="datos">
              <span className="dir-summary-label">Avance general del ciclo</span>
              <p className="frase">
                {total === 0 ? 'Su plan de sesiones se está preparando.'
                  : hechos === total ? <>¡Programa completado! Las <b>{total}</b> sesiones del ciclo se realizaron.</>
                  : <>Se han realizado <b>{hechos}</b> de <b>{total}</b> sesiones del ciclo{prog > 0 && <>; <b>{prog}</b> más ya {prog === 1 ? 'tiene' : 'tienen'} fecha</>}.</>}
              </p>
              {total > 0 && (<>
                <div className="dir-segbar" role="img" aria-label={`${hechos} realizadas, ${prog} programadas y ${total - hechos - prog} por programar`}>
                  {d.servicios.map((s, i) => <span key={i} className={s.estatus === 'realizado' ? 'done' : s.estatus === 'agendado' ? 'next' : ''} />)}
                </div>
                <div className="dir-leyenda">
                  <span><i style={{ background: acc }} />Realizadas ({hechos})</span>
                  <span><i style={{ background: 'var(--gold-l)' }} />Programadas ({prog})</span>
                  <span><i style={{ background: 'var(--line-2)' }} />Por programar ({total - hechos - prog})</span>
                </div>
              </>)}
            </div>
            <dl className="dir-summary-stats">
              <div><dt>Realizadas</dt><dd>{hechos}</dd></div>
              <div><dt>Programadas</dt><dd>{prog}</dd></div>
              <div><dt>Por coordinar</dt><dd>{total - hechos - prog}</dd></div>
            </dl>
          </div>
        </section>

        <div className="dir-content-grid">
          <div className="dir-content-main">

        {porTipo.length > 0 && (
          <section className="dir-panel card-in" style={{ ['--i' as string]: 2 }} aria-label="Avance por tipo de acompañamiento">
            <h2>Su programa, por tipo de acompañamiento</h2>
            {porTipo.map(({ t, tot, ok }) => (
              <div className="dir-tipo" key={t}>
                <b>{TIPO_DIR[t].nombre}</b>
                <span className="num">{ok}<small>de {tot}</small></span>
                <span className="desc">{TIPO_DIR[t].desc}</span>
                <span className="mini"><span style={{ width: `${tot ? (ok / tot) * 100 : 0}%` }} /></span>
              </div>
            ))}
          </section>
        )}

        {total > 0 && (
          <section className="dir-panel card-in" style={{ ['--i' as string]: 3 }} aria-label="Calendario de sesiones">
            <h2>Calendario de sesiones</h2>
            {meses.map((g) => (
              <div key={g.mes}>
                <div className="dir-mes">{g.mes}</div>
                {g.items.map((s, i) => (
                  <div className="dir-item" key={i}>
                    <span className={`dir-dot ${s.estatus === 'realizado' ? 'done' : s.estatus === 'agendado' ? 'next' : ''}`} aria-hidden />
                    <div className="tit">{TIPO_DIR[s.tipo].nombre}{s.nivel && <span style={{ fontWeight: 400, color: 'var(--mut)' }}> · {NIVEL_LABEL[s.nivel]}</span>}</div>
                    <div className="cua"><b>{EST_DIR[s.estatus]}</b> · {fmtLarga(fechaDe(s)!)}</div>
                  </div>
                ))}
              </div>
            ))}
            {sinFecha.length > 0 && (<>
              <div className="dir-mes">Por programar</div>
              {sinFecha.map((s, i) => (
                <div className="dir-item" key={`s-${i}`}>
                  <span className="dir-dot" aria-hidden />
                  <div className="tit">{TIPO_DIR[s.tipo].nombre}{s.nivel && <span style={{ fontWeight: 400, color: 'var(--mut)' }}> · {NIVEL_LABEL[s.nivel]}</span>}</div>
                  <div className="cua">Su asesor coordinará la fecha con el colegio</div>
                </div>
              ))}
            </>)}
          </section>
        )}

          </div>
          <aside className="dir-content-aside">
            <section className="dir-panel dir-next card-in" style={{ ['--i' as string]: 4 }} aria-label="Próxima sesión">
              <span className="dir-next-icon"><Icon name="calendar" size={20} /></span>
              <div>
                <h2>Próxima sesión</h2>
                {proxima ? <>
                  <strong>{TIPO_DIR[proxima.tipo].nombre}</strong>
                  <p>{proxima.nivel ? `${NIVEL_LABEL[proxima.nivel]} · ` : ''}{fmtLarga(fechaDe(proxima)!)}</p>
                  <span className="dir-next-status">Fecha confirmada</span>
                </> : <>
                  <strong>En coordinación</strong>
                  <p>Su asesor confirmará con el colegio la siguiente fecha disponible.</p>
                </>}
              </div>
            </section>

        {(d.asesor || haySeries) && (
          <section className="dir-panel card-in" style={{ ['--i' as string]: 5 }} aria-label="Su acompañamiento">
            {d.asesor && (
              <div className="dir-persona" style={{ marginBottom: haySeries ? 16 : 0 }}>
                <span className="dir-avatar" aria-hidden>{iniciales || 'SM'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{d.asesor}</div>
                  <div style={{ fontSize: 12, color: 'var(--mut)' }}>Asesor pedagógico SM asignado a su colegio</div>
                </div>
              </div>
            )}
            {haySeries && (<>
              <h2 style={{ marginBottom: 8 }}>Propuesta SM en su colegio</h2>
              <dl className="dir-series">
                {d.niveles.map((k) => {
                  const v = filaSerie(k, d.seriesNivel, d.inglesNivel)
                  return v ? (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{NIVEL_LABEL[k]}</dt><dd>{v}</dd>
                    </div>
                  ) : null
                })}
              </dl>
            </>)}
          </section>
        )}
          </aside>
        </div>

        <footer className="dir-foot">
          Preparado por SM México para {d.nombre}.<br />
          Este enlace es de uso exclusivo del colegio; muestra la información al momento de abrirlo.
        </footer>
      </main>
    </div>
  )
}

// Solo en desarrollo (#/director/demo): datos de muestra para iterar el diseño
// sin backend. La rama se elimina del build de producción (import.meta.env.DEV).
const demoDirector = (): DirectorData => ({
  nombre: 'Instituto Cumbres del Valle',
  campaign: 'SMART',
  niveles: ['pre', 'pri', 'sec'],
  seriesNivel: { pre: 'Acierta', pri: 'Acierta', sec: 'Acierta' },
  inglesNivel: { pri: 'Bright Sparks', sec: 'Winglish' },
  asesor: 'Laura Sánchez',
  servicios: [
    { tipo: 'uso', estatus: 'realizado', fechaReal: '2026-09-08', nivel: 'pri' },
    { tipo: 'uso', estatus: 'realizado', fechaReal: '2026-09-22', nivel: 'sec' },
    { tipo: 'uso', estatus: 'agendado', fechaPlan: '2026-10-13', nivel: 'pre' },
    { tipo: 'prof', estatus: 'realizado', fechaReal: '2026-10-01', nivel: 'pri' },
    { tipo: 'prof', estatus: 'agendado', fechaPlan: '2026-11-05' },
    { tipo: 'didac', estatus: 'pendiente' },
    { tipo: 'prof', estatus: 'pendiente', extra: true, nivel: 'sec' },
  ],
})

/** Página pública: lee el token del hash y consulta el RPC (sin sesión). */
export default function DirectorPublico() {
  // el token viene fijo en la URL con la que se abrió el enlace
  const [token] = useState(() => (window.location.hash.match(/^#\/director\/([0-9a-f]{20,})/i)?.[1] ?? '').toLowerCase())
  const demo = import.meta.env.DEV && window.location.hash === '#/director/demo'
  const [estado, setEstado] = useState<'cargando' | 'error' | 'ok'>(demo ? 'ok' : token ? 'cargando' : 'error')
  const [data, setData] = useState<DirectorData | null>(() => demo ? demoDirector() : null)

  useEffect(() => {
    if (!token) return
    let vivo = true
    supabase.rpc('psp_vista_director', { p_token: token }).then(({ data: raw, error }) => {
      if (!vivo) return
      const d = error ? null : normalizarDirector(raw)
      setData(d)
      setEstado(d ? 'ok' : 'error')
    })
    return () => { vivo = false }
  }, [token])

  if (estado === 'cargando') {
    return <div className="gate"><div className="gate-card"><img src={logoSM} alt="SM México" className="gate-logo" /><p className="gate-sub">Preparando el avance de su colegio…</p></div></div>
  }
  if (estado === 'error' || !data) {
    return (
      <div className="gate">
        <div className="gate-card">
          <img src={logoSM} alt="SM México" className="gate-logo" />
          <h1 className="gate-title">Este enlace no está activo</h1>
          <p className="gate-sub">El enlace pudo haberse renovado por seguridad. Pida a su asesor
            pedagógico SM el enlace vigente de su colegio.</p>
        </div>
      </div>
    )
  }
  return <PanelDirector d={data} />
}
