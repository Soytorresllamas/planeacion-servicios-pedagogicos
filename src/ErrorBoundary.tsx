import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { resetLocalData } from './lib/localData'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Red de seguridad: si algo revienta durante el render (datos locales viejos,
 * o un chunk de la app que no se pudo descargar tras un deploy), mostramos una
 * tarjeta de recuperación. «Reiniciar» limpia TODO lo local (datos + sesión) y
 * recarga rompiendo caché, para salir incluso de un 404 cacheado por el CDN.
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

  private reiniciar = () => {
    resetLocalData()
    try { sessionStorage.clear() } catch { /* noop */ }
    // recarga con query única: evita el HTML/404 cacheados en el borde del CDN
    window.location.replace(`${window.location.pathname}?r=${Date.now()}`)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box', background: 'var(--bg)' }}>
        <div className="gate-card">
          <h1 className="gate-title">Algo se atoró</h1>
          <p style={{ color: 'var(--mut)', fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
            No se pudo mostrar esta pantalla: o hay datos locales de una versión anterior,
            o una pieza de la app no se descargó completa. «Reiniciar» limpia lo local y
            vuelve a entrar; no pierdes nada que ya esté sincronizado.
          </p>
          <button className="gate-btn" onClick={this.reiniciar}>Reiniciar y volver a entrar</button>
          <button className="sec" style={{ width: '100%', marginTop: 10 }} onClick={() => window.location.reload()}>Solo recargar</button>
        </div>
      </div>
    )
  }
}
