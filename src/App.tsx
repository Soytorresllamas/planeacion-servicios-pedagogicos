import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ComponentType, ReactElement } from 'react'
import { Toaster } from './ui/toast'
import { RouteSkeleton } from './ui/Skeleton'
import { useAcceso } from './lib/accesoCtx'
import { tabsPorRol, rutaInicial, rutaPermitida } from './lib/sesion'
import { ROLES } from './data/usuarios'
import { recargarFresca } from './lib/recarga'
import { AppShell } from './layout/AppShell'
import type { IconName } from './ui/Icon'

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
const Logistica = lazyConReintento(() => import('./pages/Logistica.tsx'), 'logistica')
const Administracion = lazyConReintento(() => import('./pages/Administracion.tsx'), 'administracion')
const Streamgraph = lazyConReintento(() => import('./pages/Streamgraph.tsx'), 'servicios')
const Documentos = lazyConReintento(() => import('./pages/Documentos.tsx'), 'documentos')
const HojaAsesor = lazyConReintento(() => import('./pages/HojaAsesor.tsx'), 'mi-hoja')
const MisColegios = lazyConReintento(() => import('./pages/MisColegios.tsx'), 'mis-colegios')
const VistaDirectorPreview = lazyConReintento(() => import('./pages/VistaDirectorPreview.tsx'), 'vista-director')

export default function App() {
  const { sesion, salir } = useAcceso()
  const path = useLocation().pathname
  // Los portales (asesor, ejecutivo) y la vista del director son mundos aparte:
  // sin el header/nav del equipo.
  const esPortal = path === '/mi-hoja' || path === '/mis-colegios' || path.startsWith('/vista-director')
  const inicio = rutaInicial(sesion.rol)
  const rolLabel = ROLES.find((r) => r.key === sesion.rol)?.label ?? sesion.rol
  const iconoPorRuta: Record<string, IconName> = {
    '/simulador': 'sliders',
    '/planeacion': 'calendar',
    '/rentabilidad': 'chart',
    '/logistica': 'truck',
    '/administracion': 'settings',
  }
  const nav = tabsPorRol(sesion.rol).map((item) => ({ ...item, icon: iconoPorRuta[item.to] ?? 'briefcase' }))

  // guarda por rol: si la ruta no le toca, lo mandamos a su inicio
  const g = (ruta: string, el: ReactElement) => rutaPermitida(sesion.rol, ruta) ? el : <Navigate to={inicio} replace />

  const contenido = (
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route path="/" element={<Navigate to={inicio} replace />} />
            <Route path="/simulador" element={g('/simulador', <Simulador />)} />
            <Route path="/planeacion" element={g('/planeacion', <Planeacion />)} />
            <Route path="/rentabilidad" element={g('/rentabilidad', <Rentabilidad />)} />
            <Route path="/logistica" element={g('/logistica', <Logistica />)} />
            <Route path="/administracion" element={g('/administracion', <Administracion />)} />
            {/* rutas fuera del menú (solo admin) */}
            <Route path="/servicios" element={g('/servicios', <Streamgraph />)} />
            <Route path="/documentos" element={g('/documentos', <Documentos />)} />
            {/* portales del asesor y del ejecutivo; otros roles los ven como vista previa */}
            <Route path="/mi-hoja" element={g('/mi-hoja', <HojaAsesor />)} />
            <Route path="/mis-colegios" element={g('/mis-colegios', <MisColegios />)} />
            {/* vista previa interna de la pantalla del director (la pública vive fuera del login) */}
            <Route path="/vista-director/:id" element={g('/vista-director', <VistaDirectorPreview />)} />
            <Route path="*" element={<Navigate to={inicio} replace />} />
          </Routes>
        </Suspense>
  )

  return (
    <>
      {esPortal
        ? <main>{contenido}</main>
        : <AppShell nav={nav} name={sesion.nombre} role={rolLabel} onLogout={salir}>{contenido}</AppShell>}
      <Toaster />
    </>
  )
}
