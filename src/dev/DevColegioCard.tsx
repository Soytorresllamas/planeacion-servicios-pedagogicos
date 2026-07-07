// Arnés SOLO-DEV (#/dev-card): inspecciona ColegioCard con datos de muestra sin
// necesitar login. Vive fuera del build de producción (import dinámico gated por
// import.meta.env.DEV en main.tsx). Útil para iterar diseño móvil de la tarjeta.
import { useState } from 'react'
import { ColegioCard } from '../features/planeacion/ColegioCard'
import { hoyISO } from '../data/planeacion'
import type { Colegio } from '../data/planeacion'

const mock: Colegio = {
  id: 'x', nombre: 'Frida K', campaign: 'SMART', tier: 'top', asesorId: 'ase-1',
  niveles: ['pre'], serie: 'Acierta', ingles: 'Bright Sparks', satisfaccion: 4,
  contacto: { nombre: 'Gabriela R.', telefono: '55 1234 5678' },
  servicios: [
    { tipo: 'uso', estatus: 'realizado', fechaReal: '2026-07-07', nivel: 'pre', nota: 'Faltan libros', reqViaje: true, pdfTransporte: 'demo/x.pdf' },
    { tipo: 'uso', estatus: 'pendiente', fechaPlan: '2026-07-28' },
    { tipo: 'uso', estatus: 'agendado', fechaPlan: '2026-07-07' },
    { tipo: 'prof', estatus: 'pendiente' },
    { tipo: 'prof', estatus: 'pendiente', extra: true },
    { tipo: 'didac', estatus: 'pendiente' },
  ],
}

export default function DevColegioCard() {
  const [c, setC] = useState(mock)
  const [abierto, setAbierto] = useState(true)
  return (
    <div style={{ maxWidth: 820, margin: '20px auto', padding: '0 12px', display: 'grid', gap: 10 }}>
      <ColegioCard c={c} hoy={hoyISO()} abierto={abierto}
        onToggle={() => setAbierto((v) => !v)}
        onServ={(i, p) => setC((d) => ({ ...d, servicios: d.servicios.map((s, j) => j === i ? { ...s, ...p } : s) }))}
        onPatch={(p) => setC((d) => ({ ...d, ...p }))}
        onReportar={() => {}} />
      {/* segunda tarjeta siempre colapsada, para comparar ambos estados */}
      <ColegioCard c={{ ...mock, id: 'y', nombre: 'Instituto México', campaign: 'CORE' }} hoy={hoyISO()} abierto={false}
        onToggle={() => {}} onServ={() => {}} onPatch={() => {}} />
    </div>
  )
}
