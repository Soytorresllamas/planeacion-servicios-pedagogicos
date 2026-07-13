import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import logoSM from '../assets/logo-sm.svg'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

export interface ShellNavItem {
  to: string
  label: string
  icon: IconName
}

interface AppShellProps {
  children: React.ReactNode
  nav: ShellNavItem[]
  name: string
  role: string
  onLogout: () => void
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export function AppShell({ children, nav, name, role, onLogout }: AppShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`app-shell${open ? ' nav-open' : ''}`}>
      <aside className="app-sidebar" id="app-navigation" aria-label="Navegación principal">
        <div className="app-sidebar-brand">
          <span className="app-sidebar-logo"><img src={logoSM} alt="SM México" /></span>
          <span><b>Servicios</b><small>Pedagógicos</small></span>
        </div>

        <nav className="app-sidebar-nav">
          <span className="app-sidebar-caption">Operación</span>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-user">
          <span className="app-user-avatar">{initials(name)}</span>
          <span className="app-user-copy"><b>{name}</b><small>{role}</small></span>
          <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <button className="app-shell-backdrop" type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)} />

      <section className="app-stage">
        <header className="app-topbar">
          <button className="app-menu-button" type="button" aria-controls="app-navigation" aria-expanded={open}
            onClick={() => setOpen((value) => !value)}>
            <Icon name={open ? 'close' : 'menu'} />
            <span className="sr-only">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
          </button>
          <div className="app-topbar-title">
            <b>Planeación de servicios</b>
            <span>Modelo SMART + CORE · ciclo 2026–2027</span>
          </div>
          <div className="app-topbar-actions">
            <span className="app-live-status"><i /> Datos sincronizados</span>
            <button type="button" className="app-icon-button" aria-label="Notificaciones">
              <Icon name="bell" size={19} />
            </button>
            <span className="app-topbar-avatar">{initials(name)}</span>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </section>
    </div>
  )
}
