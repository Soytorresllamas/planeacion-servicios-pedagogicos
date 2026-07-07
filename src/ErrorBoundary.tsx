import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { resetLocalData } from './lib/localData'
import { recargarFresca, urlRecargaFresca } from './lib/recarga'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Red de seguridad: si algo revienta durante el render (una pieza de la app que
 * no se descargó tras un deploy, o datos locales viejos), mostramos una tarjeta
 * de recuperación. El caso común (chunk viejo cacheado) se resuelve con una
 * recarga que ROMPE la caché SIN perder nada; el botón secundario es la opción
 * nuclear que además limpia lo local y cierra la sesión.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // rastro en consola para diagnóstico; la UI de recuperación se muestra igual
    console.error('ErrorBoundary capturó un fallo de render:', error, info.componentStack)
  }

  // Caso común: recarga fresca (evita el index.html cacheado); conserva sesión y datos.
  private recargar = () => recargarFresca()

  // Opción nuclear: limpia lo local + sesión y recarga fresca desde el inicio.
  private reiniciar = () => {
    resetLocalData()
    try { sessionStorage.clear() } catch { /* noop */ }
    window.location.replace(urlRecargaFresca({ pathname: window.location.pathname, search: window.location.search, hash: '' }))
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box', background: 'var(--bg)' }}>
        <div className="gate-card">
          <h1 className="gate-title">Algo se atoró</h1>
          <p style={{ color: 'var(--mut)', fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
            Casi siempre es una pieza de la app que no se descargó tras una actualización.
            «Recargar» trae la versión más reciente sin que pierdas nada. Si aun así no carga,
            usa «Reiniciar» (limpia lo local y te pide entrar de nuevo).
          </p>
          <button className="gate-btn" onClick={this.recargar}>Recargar</button>
          <button className="sec" style={{ width: '100%', marginTop: 10 }} onClick={this.reiniciar}>Reiniciar y volver a entrar</button>
        </div>
      </div>
    )
  }
}
