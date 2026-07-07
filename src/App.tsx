import { lazy, Suspense } from 'react'
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ComponentType, ReactElement } from 'react'
import logoSM from './assets/logo-sm.svg'
import { Toaster } from './ui/toast'
import { RouteSkeleton } from './ui/Skeleton'
import { useAcceso } from './lib/accesoCtx'
import { tabsPorRol, rutaInicial, rutaPermitida } from './lib/sesion'
import { ROLES } from './data/usuarios'
import { recargarFresca } from './lib/recarga'

// Los chunks de rutas cambian de nombre en cada deploy y los viejos se borran.
// Si un navegador tiene el index.html cacheado (GitHub Pages: max-age=600) y pide
// un chunk ya borrado, el import da 404. Antes de rendirnos reintentamos con UNA
// recarga que ROMPE la caché (recargarFresca): así trae el index.html del deploy
// actual con los nombres de chunk correctos. Candado en sessionStorage para no
// ciclar; si tras la recarga fresca aún falla, lo atiende el ErrorBoundary.
const lazyConReintento = (importar: () => Promise<{ default: ComponentType }>, clave: string) =>
  lazy(() => {
    const candado = `psp-chunk-retry-${clave}`
    return importar()
      .then((m) => { try { sessionStorage.removeItem(candado) } catch { /* noop */ } return m })
      .catch((err) => {
        try {
          if (!sessionStorage.getItem(candado)) {
            sessionStorage.setItem(candado, '1')
            recargarFresca()
            return new Promise<never>(() => {}) // la recarga toma el control
          }
        } catch { /* noop */ }
        throw err // segundo fallo seguido → que lo atienda el ErrorBoundary
      })
  })

const Simulador = lazyConReintento(() => import('./pages/Simulador.tsx'), 'simulador')
const Planeacion = lazyConReintento(() => import('./pages/Planeacion.tsx'), 'planeacion')
const Rentabilidad = lazyConReintento(() => import('./pages/Rentabilidad.tsx'), 'rentabilidad')
const Administracion = lazyConReintento(() => import('./pages/Administracion.tsx'), 'administracion')
const Streamgraph = lazyConReintento(() => import('./pages/Streamgraph.tsx'), 'servicios')
const Documentos = lazyConReintento(() => import('./pages/Documentos.tsx'), 'documentos')
const HojaAsesor = lazyConReintento(() => import('./pages/HojaAsesor.tsx'), 'mi-hoja')

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
