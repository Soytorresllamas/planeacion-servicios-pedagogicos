import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import Acceso from './Acceso.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No se encontró el elemento #root')

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Acceso>
        <HashRouter>
          <App />
        </HashRouter>
      </Acceso>
    </ErrorBoundary>
  </React.StrictMode>,
)
