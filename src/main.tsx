import React from 'react'
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

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      {esEnlaceDirector ? (
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
