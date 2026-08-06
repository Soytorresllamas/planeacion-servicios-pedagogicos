// Arnés SOLO-DEV (#/dev-card): inspecciona ColegioCard con datos de muestra sin
// necesitar login. Vive fuera del build de producción (import dinámico gated por
// import.meta.env.DEV en main.tsx). Útil para iterar diseño móvil de la tarjeta.
import { useState } from 'react'
import { ColegioCard } from '../features/planeacion/ColegioCard'
import { MensajeThread } from '../features/mensajes/MensajeThread'
import { hoyISO } from '../data/planeacion'
import type { Colegio, RamaAsesor } from '../data/planeacion'
import type { Mensaje } from '../data/mensajes'

const mock: Colegio = {
  id: 'x', nombre: 'Frida K', campaign: 'SMART', tier: 'top', asesorId: 'ase-1', asesorInglesId: 'ase-eng-1',
  niveles: ['pre'], serie: 'Acierta', ingles: 'Bright Sparks', inglesNivel: { pre: 'Bright Sparks' }, satisfaccion: 4,
  contacto: { nombre: 'Gabriela R.', telefono: '55 1234 5678' },
  contactoIngles: { nombre: 'Laura M.', rol: 'Coordinadora de Inglés', correo: 'laura@fridak.demo' },
  servicios: [
    { tipo: 'uso', estatus: 'realizado', fechaReal: '2026-07-07', nivel: 'pre', nota: 'Faltan libros', reqViaje: true, pdfTransporte: 'demo/x.pdf' },
    { tipo: 'uso', estatus: 'pendiente', fechaPlan: '2026-07-28' },
    { tipo: 'uso', estatus: 'agendado', fechaPlan: '2026-07-07' },
    { tipo: 'prof', estatus: 'pendiente' },
    { tipo: 'prof', estatus: 'pendiente', extra: true },
    { tipo: 'didac', estatus: 'pendiente' },
    // Demo deliberadamente compacta: un servicio de cada rubro de Inglés.
    { tipo: 'uso', rama: 'ingles', estatus: 'pendiente', nivel: 'pre', fechaPlan: '2026-08-04' },
    { tipo: 'prof', rama: 'ingles', estatus: 'pendiente', nivel: 'pre' },
    { tipo: 'didac', rama: 'ingles', estatus: 'pendiente', nivel: 'pre' },
  ],
}

export default function DevColegioCard() {
  const [c, setC] = useState(mock)
  const [abierto, setAbierto] = useState(true)
  const [rama, setRama] = useState<RamaAsesor>('pedagogica')
  const [modo, setModo] = useState<'ejecutivo' | 'asesor'>('ejecutivo')
  const [conversacionOpen, setConversacionOpen] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { id: 'demo-msg-1', colegioId: 'x', autorId: 'demo-ej', autorNombre: 'Marcelo Torres', autorRol: 'ejecutivo', rama: 'pedagogica', servicioTipo: 'uso', servicioNivel: 'pre', texto: '¿Podemos confirmar la sesión de Uso para la próxima semana?', createdAt: '2026-08-05T16:42:00.000Z' },
    { id: 'demo-msg-2', colegioId: 'x', autorId: 'demo-ase', autorNombre: 'Laura Sánchez', autorRol: 'asesor', rama: 'pedagogica', texto: 'Sí, el colegio propuso el martes a las 10:00.', createdAt: '2026-08-05T17:05:00.000Z' },
    { id: 'demo-msg-3', colegioId: 'x', autorId: 'demo-ing', autorNombre: 'Laura M.', autorRol: 'asesor', rama: 'ingles', texto: 'Para Bright Sparks falta confirmar el contacto de Inglés.', createdAt: '2026-08-05T17:18:00.000Z' },
  ])
  const filtraRama = (s: Colegio['servicios'][number]) => rama === 'ingles' ? s.rama === 'ingles' : s.rama !== 'ingles'
  const enviarDemo = async (texto: string, ramaMensaje: 'pedagogica' | 'ingles') => {
    setMensajes((prev) => [...prev, {
      id: `demo-msg-${Date.now()}`, colegioId: 'x', autorId: `demo-${modo}`,
      autorNombre: modo === 'ejecutivo' ? 'Tú · Ejecutivo comercial' : (ramaMensaje === 'ingles' ? 'Tú · Asesor Inglés' : 'Tú · Asesor Pedagógico'),
      autorRol: modo, rama: ramaMensaje, texto, createdAt: new Date().toISOString(),
    }])
    return { ok: true }
  }
  return (
    <div style={{ maxWidth: 820, margin: '20px auto', padding: '0 12px', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
        <b style={{ marginRight: 6 }}>Frida K</b>
        <button className={rama === 'pedagogica' ? 'primary' : 'sec'} onClick={() => setRama('pedagogica')}>Pedagógico</button>
        <button className={rama === 'ingles' ? 'primary' : 'sec'} onClick={() => setRama('ingles')}>Inglés</button>
        <span style={{ color: 'var(--mut)', fontSize: 12 }}>dos asesores · dos contactos</span>
      </div>
      <ColegioCard c={c} hoy={hoyISO()} abierto={abierto}
        onToggle={() => setAbierto((v) => !v)}
        onServ={(i, p) => setC((d) => ({ ...d, servicios: d.servicios.map((s, j) => j === i ? { ...s, ...p } : s) }))}
        onPatch={(p) => setC((d) => ({ ...d, ...p }))}
        onReportar={() => {}} rama={rama} servFilter={filtraRama}
        conversacionOpen={conversacionOpen} onConversacionToggle={() => setConversacionOpen((v) => !v)} />
      {conversacionOpen && <section className="panel" style={{ margin: 0, padding: 14 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <b style={{ marginRight: 'auto' }}>Demo de conversación</b>
          <span style={{ color: 'var(--mut)', fontSize: 12 }}>Cambia de rol para probar ambos flujos</span>
          <button className={modo === 'ejecutivo' ? 'primary' : 'sec'} onClick={() => setModo('ejecutivo')}>Ejecutivo</button>
          <button className={modo === 'asesor' ? 'primary' : 'sec'} onClick={() => setModo('asesor')}>Asesor</button>
        </div>
        <MensajeThread mensajes={mensajes} rama={modo === 'asesor' ? rama : undefined}
          ramasDisponibles={modo === 'asesor' ? [rama] : ['pedagogica', 'ingles']} viewerRole={modo === 'asesor' ? 'asesor' : 'ejecutivo'}
          canSend onSend={enviarDemo} />
      </section>}
      {/* segunda tarjeta siempre colapsada, para comparar ambos estados */}
      <ColegioCard c={{ ...mock, id: 'y', nombre: 'Instituto México', campaign: 'CORE' }} hoy={hoyISO()} abierto={false}
        onToggle={() => {}} onServ={() => {}} onPatch={() => {}} />
    </div>
  )
}
