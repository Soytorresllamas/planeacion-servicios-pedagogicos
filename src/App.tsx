import { lazy, Suspense } from 'react'
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import logoSM from './assets/logo-sm.svg'
import { Toaster } from './ui/toast'
import { RouteSkeleton } from './ui/Skeleton'
import { useAcceso } from './lib/accesoCtx'
import { tabsPorRol, rutaInicial, rutaPermitida } from './lib/sesion'
import { ROLES } from './data/usuarios'

const Simulador = lazy(() => import('./pages/Simulador.tsx'))
const Planeacion = lazy(() => import('./pages/Planeacion.tsx'))
const Rentabilidad = lazy(() => import('./pages/Rentabilidad.tsx'))
const Administracion = lazy(() => import('./pages/Administracion.tsx'))
const Streamgraph = lazy(() => import('./pages/Streamgraph.tsx'))
const Documentos = lazy(() => import('./pages/Documentos.tsx'))
const HojaAsesor = lazy(() => import('./pages/HojaAsesor.tsx'))

export default function App() {
  const { sesion, salir } = useAcceso()
  const path = useLocation().pathname
  // El portal del asesor es un mundo aparte: sin el header/nav del equipo.
  const esPortal = path === '/mi-hoja'
  const inicio = rutaInicial(sesion.rol)
  const rolLabel = ROLES.find((r) => r.key === sesion.rol)?.label ?? sesion.rol

  // guarda por rol: si la ruta no le toca, lo mandamos a su inicio
  const g = (ruta: string, el: ReactElement) => rutaPermitida(sesion.rol, ruta) ? el : <Navigate to={inicio} replace />

  return (
    <>
      {!esPortal && (
      <header className="app-header">
        <div className="inner">
          <div className="brand">
            <img src={logoSM} alt="SM México" className="brand-logo" />
            <span className="brand-txt">Servicios Pedagógicos<small>Planeación 2026-2027 · SM México</small></span>
          </div>
          <nav className="nav">
            {tabsPorRol(sesion.rol).map((t) => <NavLink key={t.to} to={t.to}>{t.label}</NavLink>)}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: 'var(--mut)', textAlign: 'right', lineHeight: 1.3 }}>
              <b style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>{sesion.nombre}</b><br />{rolLabel}
            </span>
            <button className="sec" onClick={salir}>Salir</button>
          </div>
        </div>
      </header>
      )}
      <main className={esPortal ? undefined : 'page'}>
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route path="/" element={<Navigate to={inicio} replace />} />
            <Route path="/simulador" element={g('/simulador', <Simulador />)} />
            <Route path="/planeacion" element={g('/planeacion', <Planeacion />)} />
            <Route path="/rentabilidad" element={g('/rentabilidad', <Rentabilidad />)} />
            <Route path="/administracion" element={g('/administracion', <Administracion />)} />
            {/* rutas fuera del menú (solo admin) */}
            <Route path="/servicios" element={g('/servicios', <Streamgraph />)} />
            <Route path="/documentos" element={g('/documentos', <Documentos />)} />
            {/* portal del asesor; otros roles lo ven como vista previa */}
            <Route path="/mi-hoja" element={g('/mi-hoja', <HojaAsesor />)} />
            <Route path="*" element={<Navigate to={inicio} replace />} />
          </Routes>
        </Suspense>
      </main>
      <Toaster />
    </>
  )
}
