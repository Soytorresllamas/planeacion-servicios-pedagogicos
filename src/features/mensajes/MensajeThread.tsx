import { useMemo, useState } from 'react'
import { NIVEL_LABEL, SERV_LABEL } from '../../data/planeacion'
import type { RamaServicio } from '../../data/planeacion'
import type { Mensaje } from '../../data/mensajes'

interface Props {
  mensajes: Mensaje[]
  rama?: RamaServicio
  ramasDisponibles?: RamaServicio[]
  canSend: boolean
  onSend: (texto: string, rama: RamaServicio) => Promise<{ ok: boolean; error?: string }>
  onSeen?: () => void
}

const fecha = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export function MensajeThread({ mensajes, rama, ramasDisponibles = ['pedagogica'], canSend, onSend, onSeen }: Props) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ramaEnvio, setRamaEnvio] = useState<RamaServicio>(rama ?? ramasDisponibles[0] ?? 'pedagogica')
  const visibles = useMemo(() => rama ? mensajes.filter((m) => m.rama === rama) : mensajes, [mensajes, rama])
  const enviar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    const r = await onSend(texto, ramaEnvio)
    if (r.ok) { setTexto(''); onSeen?.() }
    setEnviando(false)
  }
  return (
    <section aria-label="Conversación del colegio" style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 7 }}>
        <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mut)' }}>💬 Mensajes</div>
        <span style={{ color: 'var(--mut)', fontSize: 'var(--fs-caption)' }}>{visibles.length} en la conversación</span>
      </div>
      {visibles.length === 0 ? <div className="hint" style={{ margin: 0 }}>Todavía no hay mensajes. Escribe el primero para coordinar la siguiente acción.</div> : (
        <div style={{ display: 'grid', gap: 7, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
          {visibles.map((m) => (
            <div key={m.id} style={{ borderLeft: `3px solid ${m.autorRol === 'ejecutivo' ? 'var(--smart)' : 'var(--core)'}`, padding: '5px 9px', background: 'var(--panel-bg)', borderRadius: '0 7px 7px 0' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 'var(--fs-caption)' }}>
                <b>{m.autorNombre}</b><span style={{ color: 'var(--mut)' }}>{m.autorRol === 'ejecutivo' ? 'Ejecutivo comercial' : 'Asesor'}</span>
                <span style={{ color: 'var(--mut)', marginLeft: 'auto' }}>{fecha(m.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '2px 0 3px' }}>
                <span style={{ fontSize: 'var(--fs-badge)', fontWeight: 700, color: m.rama === 'ingles' ? '#6D4C9B' : 'var(--smart)', background: m.rama === 'ingles' ? '#F1EAF4' : '#EAF1F9', borderRadius: 5, padding: '1px 5px' }}>{m.rama === 'ingles' ? 'INGLÉS' : 'PEDAGÓGICO'}</span>
                {m.servicioTipo && <span style={{ color: 'var(--mut)', fontSize: 'var(--fs-caption)' }}>{SERV_LABEL[m.servicioTipo]}{m.servicioNivel ? ` · ${NIVEL_LABEL[m.servicioNivel]}` : ''}</span>}
              </div>
              <div style={{ color: 'var(--ink-2)', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texto}</div>
            </div>
          ))}
        </div>
      )}
      {canSend ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 8 }}>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar() }} rows={2} placeholder="Escribe un mensaje… (⌘/Ctrl + Enter para enviar)" aria-label="Nuevo mensaje" style={{ flex: 1, minWidth: 0, resize: 'vertical', fontSize: 'var(--fs-body)', padding: '7px 9px' }} />
          <div style={{ display: 'grid', gap: 4, flex: '0 0 auto' }}>
            {ramasDisponibles.length > 1 && <select value={ramaEnvio} onChange={(e) => setRamaEnvio(e.target.value as RamaServicio)} aria-label="Rama del mensaje" style={{ width: 'auto', fontSize: 'var(--fs-caption)', padding: '5px 6px' }}>
              {ramasDisponibles.map((r) => <option key={r} value={r}>{r === 'ingles' ? 'Inglés' : 'Pedagógico'}</option>)}
            </select>}
            <button className="gate-btn" type="button" onClick={() => void enviar()} disabled={enviando || !texto.trim()} style={{ width: 'auto', minHeight: 36, padding: '7px 12px' }}>{enviando ? 'Enviando…' : 'Enviar'}</button>
          </div>
        </div>
      ) : <div className="hint" style={{ margin: '8px 0 0' }}>La vista previa es de lectura. El ejecutivo o asesor puede responder desde su cuenta.</div>}
    </section>
  )
}
