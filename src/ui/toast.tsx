import { useEffect, useState } from 'react'
import { registrarToaster } from './toastBus'
import type { ToastKind } from './toastBus'

// Notificaciones tipo «toast/sonner» (21st.dev/Feedback) adaptadas al sistema
// propio: chip oscuro flotante, entrada deslizante, autodescarte y aria-live.
// Uso: import { toast } from '.../ui/toastBus';  toast('Listo', 'ok')
interface Item { id: number; msg: string; kind: ToastKind; out?: boolean }

const ICON: Record<ToastKind, { ch: string; color: string }> = {
  ok: { ch: '✓', color: 'var(--core-l)' },
  err: { ch: '⚠', color: 'var(--gold-l)' },
  info: { ch: 'ℹ', color: 'var(--smart-l)' },
}

/** Contenedor global (montado una vez en App). */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    registrarToaster((msg, kind) => {
      const id = Date.now() + Math.random()
      setItems((p) => [...p.slice(-2), { id, msg, kind }])
      window.setTimeout(() => setItems((p) => p.map((t) => (t.id === id ? { ...t, out: true } : t))), 3600)
      window.setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4000)
    })
    return () => registrarToaster(null)
  }, [])

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.out ? ' out' : ''}`}>
          <span aria-hidden style={{ color: ICON[t.kind].color, fontWeight: 700, flex: '0 0 auto' }}>{ICON[t.kind].ch}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
