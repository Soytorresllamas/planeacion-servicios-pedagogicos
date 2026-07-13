import { Icon } from '../../ui/Icon'
import type { IconName } from '../../ui/Icon'

const items: { href: string; label: string; icon: IconName }[] = [
  { href: '#asesor-inicio', label: 'Inicio', icon: 'home' },
  { href: '#asesor-agenda', label: 'Agenda', icon: 'calendar' },
  { href: '#asesor-colegios', label: 'Colegios', icon: 'school' },
  { href: '#asesor-cartera', label: 'Cartera', icon: 'briefcase' },
]

export function AdvisorBottomNav() {
  return (
    <nav className="advisor-bottom-nav" aria-label="Navegación del portal">
      {items.map((item, index) => (
        <a key={item.href} href={item.href} className={index === 0 ? 'active' : undefined}>
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  )
}
