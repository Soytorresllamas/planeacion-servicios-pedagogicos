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
  viewerRole?: Mensaje['autorRol']
}

const fecha = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export function MensajeThread({ mensajes, rama, ramasDisponibles = ['pedagogica'], canSend, onSend, onSeen, viewerRole }: Props) {
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
    <section className="wa-thread" aria-label="Conversación del colegio">
      {visibles.length === 0 ? <div className="wa-empty">Todavía no hay mensajes. Escribe el primero para coordinar la siguiente acción.</div> : (
        <div className="wa-messages">
          {visibles.map((m) => (
            <div key={m.id} className={`wa-message ${viewerRole && m.autorRol === viewerRole ? 'wa-outgoing' : 'wa-incoming'}`}>
              <div className="wa-bubble">
                <div className="wa-author"><b>{m.autorNombre}</b><span>{m.autorRol === 'ejecutivo' ? 'Ejecutivo comercial' : 'Asesor'}</span></div>
                <div className="wa-text">{m.texto}</div>
                <div className="wa-meta"><span>{fecha(m.createdAt)}</span>{viewerRole && m.autorRol === viewerRole && <span className="wa-checks" aria-label="Entregado y leído">✓✓</span>}</div>
              </div>
              <div className="wa-context"><span className={m.rama === 'ingles' ? 'wa-branch wa-branch-english' : 'wa-branch'}>{m.rama === 'ingles' ? 'Inglés' : 'Pedagógico'}</span>{m.servicioTipo && <span>{SERV_LABEL[m.servicioTipo]}{m.servicioNivel ? ` · ${NIVEL_LABEL[m.servicioNivel]}` : ''}</span>}</div>
            </div>
          ))}
        </div>
      )}
      {canSend ? (
        <div className="wa-composer">
          {ramasDisponibles.length > 1 && <select className="wa-branch-select" value={ramaEnvio} onChange={(e) => setRamaEnvio(e.target.value as RamaServicio)} aria-label="Rama del mensaje">
              {ramasDisponibles.map((r) => <option key={r} value={r}>{r === 'ingles' ? 'Inglés' : 'Pedagógico'}</option>)}
          </select>}
          <textarea className="wa-input" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar() }} rows={1} placeholder="Escribe un mensaje" aria-label="Nuevo mensaje" />
          <button className="wa-send" type="button" onClick={() => void enviar()} disabled={enviando || !texto.trim()} aria-label={enviando ? 'Enviando mensaje' : 'Enviar mensaje'}>{enviando ? '…' : '➤'}</button>
        </div>
      ) : <div className="wa-readonly">La vista previa es de lectura. El ejecutivo o asesor puede responder desde su cuenta.</div>}
    </section>
  )
}
