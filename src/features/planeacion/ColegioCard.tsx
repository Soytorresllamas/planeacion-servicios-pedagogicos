import { Fragment, useState } from 'react'
import { ESTATUS, SATISFACCION, SERIES, INGLES, NIVELES, NIVEL_LABEL, urgencia, nivelesDeColegio, genTokenDirector } from '../../data/planeacion'
import type { Colegio, Servicio, Estatus, Urgencia, ServTipo, NivelKey, ContactoColegio } from '../../data/planeacion'
import { SMART, CORE, EST_LABEL, SERV_LABEL, URG_BG, tierLabel, segColor } from './colors'
import { urlReserva } from '../../lib/reservasStore'
import { toast } from '../../ui/toastBus'

// ─── UI compartida de la planeación (portal del asesor + hoja del coordinador) ───

const nivelCorto = (k: NivelKey) => NIVELES.find((n) => n.key === k)?.corto ?? k

/** Etiqueta del servicio: tipo + nivel + EXT (externos) / EXTRA (coordinación) + urgencia. */
export function ServLabel({ s, u }: { s: Servicio; u: Urgencia }) {
  return (<>
    {SERV_LABEL[s.tipo]}
    {s.nivel && <span title={`Atiende ${NIVEL_LABEL[s.nivel]}`}
      style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: '#4A4F58', background: '#E9ECF0', borderRadius: 4, padding: '1px 4px', marginLeft: 4, verticalAlign: 'middle' }}>{nivelCorto(s.nivel)}</span>}
    {s.tipo === 'didac' && <span title="La ejecutan externos; el asesor coordina y da seguimiento"
      style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: '#8A6D1C', background: '#F6EBCB', borderRadius: 4, padding: '1px 4px', marginLeft: 4, verticalAlign: 'middle' }}>EXT</span>}
    {s.extra && <span title="Taller agregado por coordinación (caso de excepción)"
      style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: 'var(--pur)', background: '#F1EAF4', borderRadius: 4, padding: '1px 4px', marginLeft: 4, verticalAlign: 'middle' }}>EXTRA</span>}
    {u === 'vencido' && <span style={{ color: 'var(--gold)', fontSize: 'var(--fs-badge)', marginLeft: 3 }}>· Vencido</span>}
    {u === 'proximo' && <span style={{ color: SMART, fontSize: 'var(--fs-badge)', marginLeft: 3 }}>· Próximo</span>}
  </>)
}

interface Props {
  c: Colegio
  hoy: string
  abierto: boolean
  onToggle: () => void
  onServ: (idx: number, patch: Partial<Servicio>) => void
  onPatch: (patch: Partial<Colegio>) => void
  /** Coordinador: puede renombrar el colegio y editar serie/inglés/niveles + enlace del director. */
  editable?: boolean
  /** Portal del asesor: muestra el botón «Reportar caso». */
  onReportar?: () => void
  /** Filtra qué servicios mostrar (coordinador). Por defecto todos. */
  servFilter?: (s: Servicio) => boolean
  /** Coordinación: agrega un taller extra (caso de excepción). */
  onAgregar?: (tipo: ServTipo) => void
  /** Coordinación: quita un taller extra (solo servicios `extra`). */
  onQuitarExtra?: (idx: number) => void
}

/** Tarjeta de colegio compartida: una sub-tarea por línea, barra segmentada, footer y notas. */
export function ColegioCard({ c, hoy, abierto, onToggle, onServ, onPatch, editable, onReportar, servFilter, onAgregar, onQuitarExtra }: Props) {
  const [notaKey, setNotaKey] = useState<number | null>(null)
  const [notasOpen, setNotasOpen] = useState(false)
  const [contactoOpen, setContactoOpen] = useState(false)
  const done = c.servicios.filter((s) => s.estatus === 'realizado').length
  const total = c.servicios.length
  const sat = c.satisfaccion ? SATISFACCION.find((s) => s.v === c.satisfaccion) : null
  const rows = c.servicios.map((s, i) => ({ s, i })).filter(({ s }) => !servFilter || servFilter(s))
  const niveles = nivelesDeColegio(c)

  // contacto: parche por campo; si todo queda vacío, el objeto desaparece
  const setCon = (campo: keyof ContactoColegio, valor: string) => {
    const con: ContactoColegio = { ...c.contacto, [campo]: valor || undefined }
    onPatch({ contacto: con.nombre || con.rol || con.telefono || con.correo ? con : undefined })
  }
  const conResumen = [c.contacto?.nombre, c.contacto?.rol, c.contacto?.telefono, c.contacto?.correo].filter(Boolean).join(' · ')

  // niveles del colegio: chips toggle (materializa la lista aunque venga derivada)
  const toggleNivel = (k: NivelKey) => {
    const next = niveles.includes(k) ? niveles.filter((x) => x !== k) : [...niveles, k]
    onPatch({ niveles: NIVELES.map((n) => n.key).filter((x) => next.includes(x)) })
  }

  // enlace público del director (#/director/<token>, sin login)
  const urlDirector = c.tokenDirector
    ? `${window.location.origin}${window.location.pathname}#/director/${c.tokenDirector}` : null
  const copiarEnlace = () => {
    if (!urlDirector) return
    void navigator.clipboard?.writeText(urlDirector)
    toast('Enlace del director copiado', 'ok')
  }

  // abre el PDF de una reserva (URL firmada de Storage)
  const abrirReserva = async (path: string) => {
    const url = await urlReserva(path)
    if (url) window.open(url, '_blank', 'noopener')
    else toast('No se pudo abrir la reserva; inténtalo de nuevo', 'err')
  }
  const meta = (<>
    {sat && <span title={sat.label} style={{ fontSize: 15, flex: '0 0 auto' }}>{sat.emoji}</span>}
    <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', flex: '0 0 auto' }}>{c.campaign} · {tierLabel(c.tier)}</span>
  </>)
  const chevron = (
    <span aria-hidden className={`card-chev${abierto ? ' abierto' : ''}`}>
      <svg viewBox="0 0 16 16" fill="none"><path d="M6 3.5 11 8l-5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  )
  const dot = <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9, flex: '0 0 auto', background: c.campaign === 'SMART' ? SMART : CORE }} />

  return (
    <div className="panel" style={{ margin: 0 }}>
      {/* header */}
      {editable ? (
        // nombre editable → el chevron es el botón que colapsa (input no puede ir dentro de <button>)
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={onToggle} aria-expanded={abierto} aria-label={abierto ? 'Contraer' : 'Expandir'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
            {chevron}{dot}
          </button>
          <input value={c.nombre} onChange={(e) => onPatch({ nombre: e.target.value })} title="Clic para renombrar"
            style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px dashed var(--line-2)', fontWeight: 600, fontSize: 'var(--fs-input)', background: 'transparent', padding: '0 0 1px' }} />
          {meta}
        </div>
      ) : (
        <button type="button" onClick={onToggle} aria-expanded={abierto} aria-label={`${c.nombre}, ${abierto ? 'contraer' : 'expandir'}`}
          style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', width: '100%', minHeight: 32, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }}>
          {chevron}{dot}
          <b style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</b>
          {meta}
        </button>
      )}

      {/* resumen unificado: barra segmentada por servicio + X/Y */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px' }}>
        <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 60 }}>
          {c.servicios.map((s, i) => (
            <span key={i} title={`${SERV_LABEL[s.tipo]} · ${EST_LABEL[s.estatus]}`} style={{ flex: 1, height: 7, borderRadius: 2, background: segColor(s, hoy) }} />
          ))}
        </div>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', flex: '0 0 auto', whiteSpace: 'nowrap', fontWeight: 600 }}>{done}/{total} hechos</span>
      </div>
      {(niveles.length > 0 || (!editable && (c.serie || c.ingles))) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: 'var(--fs-caption)', color: 'var(--mut)' }}>
          {niveles.map((k) => (
            <span key={k} title={NIVEL_LABEL[k]} style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: '#4A4F58', background: '#E9ECF0', borderRadius: 5, padding: '1px 6px' }}>{nivelCorto(k)}</span>
          ))}
          {!editable && (c.serie || c.ingles) && <span>{[c.serie, c.ingles].filter(Boolean).join(' · ')}</span>}
        </div>
      )}

      {abierto && (<>
        {/* sub-tareas: una línea cada una (check · nombre · fecha contextual · estatus · nota) */}
        <div style={{ marginTop: 7 }}>
          {rows.map(({ s, i }) => {
            const u = urgencia(s, hoy); const real = s.estatus === 'realizado'
            return (
              <Fragment key={i}>
                <div className="serv-row" style={{ background: URG_BG[u] }}>
                  <input className="c-chk" type="checkbox" checked={real} aria-label="Marcar realizado"
                    onChange={(e) => e.target.checked
                      ? onServ(i, { estatus: 'realizado', fechaReal: s.fechaReal ?? hoy })
                      : onServ(i, { estatus: s.fechaPlan ? 'agendado' : 'pendiente', fechaReal: undefined })} />
                  <span className="c-label" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, minWidth: 0, lineHeight: 1.2, overflowWrap: 'break-word' }}>
                    <ServLabel s={s} u={u} />
                    {s.extra && onQuitarExtra && (
                      <button title="Quitar este taller extra" aria-label="Quitar taller extra"
                        onClick={() => { if (window.confirm('¿Quitar este taller extra? Su avance y notas se pierden.')) onQuitarExtra(i) }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--fs-title)', color: 'var(--mut)', padding: '0 4px', verticalAlign: 'middle' }}>×</button>
                    )}
                  </span>
                  <div className="c-meta">
                    <span className="c-fecha" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 'var(--fs-caption)', color: 'var(--mut)' }} title={real ? 'Fecha real' : 'Fecha planeada'}>
                      {real ? 'R' : 'P'}
                      <input type="date" aria-label={real ? 'Fecha real' : 'Fecha planeada'} value={(real ? s.fechaReal : s.fechaPlan) ?? ''}
                        onChange={(e) => onServ(i, real ? { fechaReal: e.target.value || undefined } : { fechaPlan: e.target.value || undefined })} />
                    </span>
                    <select className={`c-nivel${s.nivel ? ' con-valor' : ''}`} value={s.nivel ?? ''} aria-label="Nivel escolar que atiende" title="Nivel escolar que atiende este servicio"
                      onChange={(e) => onServ(i, { nivel: (e.target.value || undefined) as NivelKey | undefined })}>
                      <option value="">Nivel</option>
                      {(niveles.length ? NIVELES.filter((n) => niveles.includes(n.key)) : NIVELES).map((n) => <option key={n.key} value={n.key}>{n.corto}</option>)}
                      {s.nivel && !niveles.includes(s.nivel) && niveles.length > 0 && <option value={s.nivel}>{nivelCorto(s.nivel)}</option>}
                    </select>
                    <select className="c-estado" value={s.estatus} aria-label="Estatus del servicio"
                      onChange={(e) => { const est = e.target.value as Estatus; onServ(i, est === 'realizado' && !s.fechaReal ? { estatus: est, fechaReal: hoy } : { estatus: est }) }}>
                      {ESTATUS.map((e) => <option key={e} value={e}>{EST_LABEL[e]}</option>)}
                    </select>
                  </div>
                  <button className={`c-nota${s.nota ? ' con-nota' : ''}`} title={s.nota ? 'Editar nota' : 'Agregar nota'} aria-label={s.nota ? 'Editar nota' : 'Agregar nota'}
                    onClick={() => setNotaKey((k) => k === i ? null : i)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                </div>
                {notaKey === i && (
                  <input value={s.nota ?? ''} autoFocus placeholder="Nota…"
                    onChange={(e) => onServ(i, { nota: e.target.value || undefined })}
                    onBlur={() => setNotaKey(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setNotaKey(null) }}
                    style={{ width: '100%', fontSize: 'var(--fs-input)', padding: '5px 6px', marginTop: 4, boxSizing: 'border-box' }} />
                )}
                {notaKey !== i && s.nota && (
                  <div onClick={() => setNotaKey(i)} title="Clic para editar" style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', fontStyle: 'italic', cursor: 'pointer', marginTop: 3, paddingLeft: 28 }}>“{s.nota}”</div>
                )}
                {/* reservas de viaje/hospedaje (módulo Logística): el asesor abre sus PDFs aquí */}
                {(s.reqViaje || s.reqHospedaje || s.pdfTransporte || s.pdfHotel) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 3, paddingLeft: 28 }}>
                    {(s.reqViaje || s.pdfTransporte) && (s.pdfTransporte ? (
                      <button className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '3px 9px' }} title="Abrir el PDF de tu reserva de transporte"
                        onClick={() => void abrirReserva(s.pdfTransporte!)}>🎫 Transporte</button>
                    ) : (
                      <span title="Requiere transporte; la reserva está en trámite"
                        style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: '#8A6D1C', background: 'var(--gold-wash)', borderRadius: 8, padding: '2px 8px' }}>✈️ Viaje en trámite</span>
                    ))}
                    {(s.reqHospedaje || s.pdfHotel) && (s.pdfHotel ? (
                      <button className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '3px 9px' }} title="Abrir el PDF de tu reserva de hotel"
                        onClick={() => void abrirReserva(s.pdfHotel!)}>🏨 Hotel</button>
                    ) : (
                      <span title="Requiere hospedaje; la reserva está en trámite"
                        style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: '#8A6D1C', background: 'var(--gold-wash)', borderRadius: 8, padding: '2px 8px' }}>🏨 Hospedaje en trámite</span>
                    ))}
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>

        {/* footer tintado: satisfacción (control único) · serie/inglés (coordinador) · reportar caso (portal) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, padding: '8px 10px', background: 'var(--panel-bg)', borderRadius: 8 }}>
          <label style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 5 }}>Satisfacción
            <select value={c.satisfaccion ?? ''} aria-label="Satisfacción general"
              onChange={(e) => onPatch({ satisfaccion: e.target.value ? Number(e.target.value) : undefined })} style={{ width: 'auto', fontSize: 'var(--fs-title)', padding: '4px 4px' }}>
              <option value="">Sin calificar</option>
              {SATISFACCION.map((s) => <option key={s.v} value={s.v}>{s.emoji} {s.label}</option>)}
            </select>
          </label>
          {editable && (<>
            <label style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 4 }}>Serie
              <select value={c.serie ?? ''} onChange={(e) => onPatch({ serie: e.target.value || undefined })} style={{ width: 'auto', fontSize: 'var(--fs-body)', padding: '4px 4px' }}>
                <option value="">—</option>{SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 4 }}>Inglés
              <select value={c.ingles ?? ''} onChange={(e) => onPatch({ ingles: e.target.value || undefined })} style={{ width: 'auto', fontSize: 'var(--fs-body)', padding: '4px 4px' }}>
                <option value="">—</option>{INGLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 4 }}>Niveles
              {NIVELES.map((n) => {
                const on = niveles.includes(n.key)
                return (
                  <button key={n.key} type="button" onClick={() => toggleNivel(n.key)} aria-pressed={on} title={n.label}
                    style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${on ? 'var(--smart)' : 'var(--line-2)'}`,
                      background: on ? '#EAF1F9' : 'var(--surface)', color: on ? 'var(--smart)' : 'var(--mut)' }}>{n.corto}</button>
                )
              })}
            </span>
          </>)}
          {onReportar && <button className="sec" onClick={onReportar} style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: '#E7C7C9', fontSize: 'var(--fs-body)' }}>🚨 Reportar caso</button>}
        </div>

        {/* coordinación: talleres extra (casos de excepción) */}
        {onAgregar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 'var(--fs-meta)', color: 'var(--mut)' }}>
            <span>➕ Taller extra:</span>
            {(['uso', 'prof', 'didac'] as ServTipo[]).map((t) => (
              <button key={t} className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '4px 9px' }} title={`Agregar un taller de ${SERV_LABEL[t].toLowerCase()} fuera de la matriz del tipo`}
                onClick={() => onAgregar(t)}>{SERV_LABEL[t]}</button>
            ))}
            <span className="hint" style={{ margin: 0 }}>para casos de excepción; queda marcado EXTRA</span>
          </div>
        )}

        {/* coordinación: enlace público del director */}
        {editable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 'var(--fs-meta)', color: 'var(--mut)' }}>
            <span>🔗 Enlace del director:</span>
            {urlDirector ? (<>
              <button className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '4px 9px' }} onClick={copiarEnlace}>Copiar</button>
              <a className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '4px 9px', textDecoration: 'none' }} href={`#/vista-director/${c.id}`} title="Cómo la ve el director (vista previa interna)">Vista previa ↗</a>
              <button className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '4px 9px' }}
                onClick={() => { if (window.confirm('El enlace anterior dejará de funcionar. ¿Generar uno nuevo?')) { onPatch({ tokenDirector: genTokenDirector() }); toast('Enlace regenerado; copia el nuevo', 'ok') } }}>Regenerar</button>
              <button className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '4px 9px' }}
                onClick={() => { if (window.confirm('El director ya no podrá abrir su pantalla de avance. ¿Desactivar el enlace?')) { onPatch({ tokenDirector: undefined }); toast('Enlace desactivado', 'ok') } }}>Desactivar</button>
            </>) : (
              <button className="sec" style={{ fontSize: 'var(--fs-meta)', padding: '4px 9px' }}
                onClick={() => { onPatch({ tokenDirector: genTokenDirector() }); toast('Enlace generado; usa «Copiar» para compartirlo', 'ok') }}>Generar enlace</button>
            )}
          </div>
        )}

        {/* contacto del colegio (agenda y coordinación de servicios) */}
        <button onClick={() => setContactoOpen((v) => !v)} aria-expanded={contactoOpen}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink-2)', padding: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', minWidth: 0 }}>
          <span aria-hidden style={{ fontSize: 'var(--fs-caption)', color: 'var(--mut)', flex: '0 0 auto' }}>{contactoOpen ? '▾' : '▸'}</span>
          <span aria-hidden style={{ flex: '0 0 auto' }}>📇</span>
          <span style={{ flex: '0 0 auto' }}>Contacto</span>
          {conResumen && !contactoOpen && (
            <span style={{ fontWeight: 400, color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>— {conResumen}</span>
          )}
        </button>
        {contactoOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6, marginTop: 6 }}>
            <input value={c.contacto?.nombre ?? ''} placeholder="Nombre" aria-label="Nombre del contacto"
              onChange={(e) => setCon('nombre', e.target.value)} style={{ fontSize: 'var(--fs-input)', padding: '6px 8px' }} />
            <input value={c.contacto?.rol ?? ''} placeholder="Rol (p.ej. Coordinadora académica)" aria-label="Rol del contacto"
              onChange={(e) => setCon('rol', e.target.value)} style={{ fontSize: 'var(--fs-input)', padding: '6px 8px' }} />
            <input type="tel" value={c.contacto?.telefono ?? ''} placeholder="Teléfono" aria-label="Teléfono del contacto"
              onChange={(e) => setCon('telefono', e.target.value)} style={{ fontSize: 'var(--fs-input)', padding: '6px 8px' }} />
            <input type="email" value={c.contacto?.correo ?? ''} placeholder="Correo" aria-label="Correo del contacto"
              onChange={(e) => setCon('correo', e.target.value)} style={{ fontSize: 'var(--fs-input)', padding: '6px 8px' }} />
          </div>
        )}

        {/* notas generales tras disclosure */}
        <button onClick={() => setNotasOpen((v) => !v)} aria-expanded={notasOpen}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink-2)', padding: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', minWidth: 0 }}>
          <span aria-hidden style={{ fontSize: 'var(--fs-caption)', color: 'var(--mut)', flex: '0 0 auto' }}>{notasOpen ? '▾' : '▸'}</span>
          <span aria-hidden style={{ flex: '0 0 auto' }}>📝</span>
          <span style={{ flex: '0 0 auto' }}>Notas generales</span>
          {c.notasGenerales && !notasOpen && (
            <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>— “{c.notasGenerales}”</span>
          )}
        </button>
        {notasOpen && (
          <textarea className="nota-box" value={c.notasGenerales ?? ''} autoFocus
            placeholder="Observaciones del colegio: contactos, acuerdos, contexto, pendientes…"
            onChange={(e) => onPatch({ notasGenerales: e.target.value || undefined })} />
        )}
      </>)}
    </div>
  )
}
