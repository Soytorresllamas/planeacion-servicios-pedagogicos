import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import Acceso from './Acceso.tsx'
import DirectorPublico from './pages/Director.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No se encontró el elemento #root')

// La vista del director (#/director/<token>) es PÚBLICA: el director del colegio
// abre su enlace sin cuenta. Se resuelve ANTES del gate de acceso; el RPC del
// backend solo devuelve datos publicables del colegio cuyo token coincida.
const esEnlaceDirector = /^#\/director\//.test(window.location.hash)
// Solo en desarrollo (#/dev-card): arnés visual de ColegioCard sin login.
// El ternario sobre import.meta.env.DEV hace que producción ni siquiera emita
// el chunk (la rama muerta se elimina en el build).
const esDevCard = import.meta.env.DEV && window.location.hash === '#/dev-card'
// eslint-disable-next-line react-refresh/only-export-components -- main.tsx es el entry; no aplica fast refresh
const DevCard = import.meta.env.DEV ? lazy(() => import('./dev/DevColegioCard.tsx')) : () => null

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      {esDevCard ? (
        <Suspense fallback={null}><DevCard /></Suspense>
      ) : esEnlaceDirector ? (
        <DirectorPublico />
      ) : (
        <Acceso>
          <HashRouter>
            <App />
          </HashRouter>
        </Acceso>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
)
