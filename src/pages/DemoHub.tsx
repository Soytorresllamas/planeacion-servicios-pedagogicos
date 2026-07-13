import logoSM from '../assets/logo-sm.svg'

const vistas = [
  { href: '#/demo/planeacion', kicker: 'Coordinación', title: 'Planeación', copy: 'Campañas, avance, pendientes y responsables.' },
  { href: '#/demo/asesor', kicker: 'Campo', title: 'Hoja del asesor', copy: 'Agenda, servicios y casos críticos de la cartera.' },
  { href: '#/demo/ejecutivo', kicker: 'Comercial', title: 'Hoja del ejecutivo', copy: 'Prioridades, alertas y próximos compromisos.' },
  { href: '#/demo/director', kicker: 'Colegio', title: 'Vista del director', copy: 'Avance del ciclo, sesiones y asesor asignado.' },
  { href: '#/demo/rentabilidad', kicker: 'Dirección', title: 'Rentabilidad', copy: 'Valor de cartera, costos y margen por campaña.' },
  { href: '#/demo/logistica', kicker: 'Operación', title: 'Logística', copy: 'Viajes, reservas y servicios externos.' },
]

export default function DemoHub() {
  return (
    <main className="demo-hub">
      <header className="demo-hub__header">
        <img src={logoSM} alt="SM México" />
        <span>Demostración del modelo 2026–2027</span>
      </header>
      <section className="demo-hub__intro">
        <p className="demo-hub__eyebrow">VISTAS PRINCIPALES</p>
        <h1>Planeación de servicios pedagógicos</h1>
        <p>Recorra la experiencia de cada rol con información simulada y aislada de la operación real.</p>
      </section>
      <section className="demo-hub__grid" aria-label="Vistas disponibles">
        {vistas.map((vista) => (
          <a key={vista.href} href={vista.href} target="_blank" rel="noreferrer" className="demo-hub__card">
            <span>{vista.kicker}</span>
            <h2>{vista.title}</h2>
            <p>{vista.copy}</p>
            <strong>Abrir vista ↗</strong>
          </a>
        ))}
      </section>
      <p className="demo-hub__note">Datos simulados · Los cambios realizados aquí no se sincronizan con la plataforma.</p>
    </main>
  )
}

