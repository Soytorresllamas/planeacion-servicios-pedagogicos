import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AccesoContexto } from '../lib/accesoCtx'
import { defaultPlaneacion, hoyISO } from '../data/planeacion'
import { saveLocal } from '../lib/planeacionStore'

const seedLayoutPreview = () => {
  const data = defaultPlaneacion()
  const names = ['Colegio Los Altos', 'Institución Educativa del Valle', 'Colegio Nueva Era', 'Instituto Horizonte', 'Centro Educativo Integral', 'Colegio del Bosque']
  const today = new Date(`${hoyISO()}T12:00:00`)
  data.colegios = data.colegios.map((school, index) => {
    if (index >= names.length) return school
    const services = school.servicios.map((service, serviceIndex) => {
      const date = new Date(today)
      date.setDate(today.getDate() + serviceIndex * 2 + index)
      const fechaPlan = date.toISOString().slice(0, 10)
      const travel = serviceIndex === 1 && index < 5
      return serviceIndex === 0 && index < 2
        ? { ...service, estatus: 'realizado' as const, fechaPlan, fechaReal: fechaPlan, costoViaticos: 950 + index * 120 }
        : {
            ...service,
            estatus: 'agendado' as const,
            fechaPlan,
            reqViaje: travel,
            reqHospedaje: travel && index % 2 === 0,
            costoTransporte: travel ? 1800 + index * 250 : undefined,
            costoHotel: travel && index % 2 === 0 ? 2400 + index * 300 : undefined,
          }
    })
    return {
      ...school,
      nombre: names[index],
      asesorId: 'ase-1',
      ejecutivo: 'Mariana Torres',
      valorReal: 145000 + index * 28000,
      satisfaccion: index < 3 ? 5 - index : undefined,
      notasGenerales: index < 3 ? ['Dirección confirmó el calendario de acompañamiento.', 'Interés en ampliar la propuesta a secundaria.', 'Seguimiento comercial después de la próxima sesión.'][index] : undefined,
      servicios: services,
    }
  })
  data.alertas = [{
    id: 'alerta-demo',
    fecha: new Date(today).toISOString(),
    asesorId: 'ase-1',
    colegioId: data.colegios[1].id,
    tipo: 'materiales',
    descripcion: 'Validar entrega de materiales antes de la próxima sesión.',
  }]
  saveLocal(data)
}

export default function DevLayoutPreview({ initialPath = '/planeacion' }: { initialPath?: string }) {
  seedLayoutPreview()
  return (
    <AccesoContexto.Provider value={{
      sesion: { usuarioId: 'dev-admin', rol: 'admin', nombre: 'Administración SM' },
      salir: () => undefined,
    }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </AccesoContexto.Provider>
  )
}
