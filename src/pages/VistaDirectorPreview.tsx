// Vista previa INTERNA de la pantalla del director (#/vista-director/:id):
// coordinación/admin/logística ven exactamente lo que verá el director del
// colegio, construido con los mismos datos sanitizados (datosDirector). No
// necesita el RPC: usa el tablero ya cargado. Solo lectura.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { defaultPlaneacion, datosDirector } from '../data/planeacion'
import type { PlaneacionData } from '../data/planeacion'
import { loadLocal, loadRemote } from '../lib/planeacionStore'
import { PanelDirector } from './Director'

export default function VistaDirectorPreview() {
  const { id } = useParams()
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())

  useEffect(() => {
    let vivo = true
    loadRemote().then((res) => { if (vivo && res.source === 'remote') setData(res.data) })
    return () => { vivo = false }
  }, [])

  const c = data.colegios.find((x) => x.id === id)

  return (
    <div>
      <div style={{ background: 'var(--ink)', color: '#fff', fontSize: 12.5, padding: '9px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>👁 Vista previa · así ve el director {c ? <b>{c.nombre}</b> : 'su colegio'}</span>
        <a href="#/planeacion" style={{ marginLeft: 'auto', color: '#fff', textDecoration: 'underline', fontWeight: 600 }}>← Volver a Planeación</a>
      </div>
      {c ? (
        <PanelDirector d={datosDirector(c, data.asesores.find((a) => a.id === c.asesorId)?.nombre ?? null)} />
      ) : (
        <div className="gate" style={{ minHeight: '60vh' }}>
          <div className="gate-card">
            <h1 className="gate-title">Colegio no encontrado</h1>
            <p className="gate-sub">Ese colegio no existe en el tablero actual. Regresa a Planeación y abre la vista previa desde su tarjeta.</p>
            <a className="gate-btn" style={{ display: 'block', textDecoration: 'none', boxSizing: 'border-box' }} href="#/planeacion">Ir a Planeación</a>
          </div>
        </div>
      )}
    </div>
  )
}
