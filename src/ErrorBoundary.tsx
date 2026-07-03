import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { resetLocalData } from './lib/localData'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Red de seguridad: si algo revienta durante el render (típicamente datos
 * locales de una versión anterior), en vez de pantalla en blanco mostramos
 * una tarjeta de recuperación con un botón para reiniciar los datos locales.
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
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box', background: 'var(--bg)' }}>
        <div className="gate-card">
          <h1 className="gate-title">Algo se atoró</h1>
          <p style={{ color: 'var(--mut)', fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
            No se pudo mostrar esta pantalla. Suele deberse a datos guardados de una versión
            anterior en este navegador. Reinícialos para volver a cargar desde el servidor;
            no pierdes lo que ya está sincronizado.
          </p>
          <button className="gate-btn" onClick={this.reiniciar}>Reiniciar datos locales</button>
          <button className="sec" style={{ width: '100%', marginTop: 10 }} onClick={() => window.location.reload()}>Solo recargar</button>
        </div>
      </div>
    )
  }
}
