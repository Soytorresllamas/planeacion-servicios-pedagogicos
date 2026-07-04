import { useEffect, useRef } from 'react'

/**
 * Guardado con debounce (local inmediato + remoto a 700 ms) y FLUSH al desmontar.
 *
 * Antes, el debounce se cancelaba al desmontar el componente: si editabas algo y
 * navegabas a otra página antes de los 700 ms, el guardado remoto se cancelaba y
 * la página nueva recargaba la versión vieja de remoto, perdiendo la edición.
 * Aquí, si queda un cambio sin disparar al desmontar, se guarda igual.
 *
 * Pasa funciones ESTABLES (de módulo, o setState) — el efecto solo debe
 * re-ejecutarse cuando cambian `data` o `ready`.
 */
export function usePersistencia<T>(
  data: T,
  ready: boolean,
  saveLocal: (d: T) => void,
  saveRemote: (d: T) => Promise<{ ok: boolean; error?: unknown }>,
  onStatus?: (s: string) => void,
): void {
  const pendiente = useRef<T | null>(null)
  const hidratado = useRef(false)

  useEffect(() => {
    if (!ready) return
    // El primer render tras la carga es el estado HIDRATADO (remoto o semilla),
    // no un cambio del usuario. No reescribir remoto con él: así una página que
    // solo abres (sin editar) no pisa las ediciones de otra persona/pestaña, y
    // el flush de la página anterior no queda sobrescrito al navegar.
    if (!hidratado.current) { hidratado.current = true; return }
    saveLocal(data)
    pendiente.current = data
    const t = window.setTimeout(() => {
      onStatus?.('Guardando…')
      saveRemote(data).then((r) => {
        pendiente.current = null
        onStatus?.(r.ok ? 'Sincronizado' : 'Sin conexión · local')
      })
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- funciones estables por contrato
  }, [data, ready])

  // flush del cambio pendiente al desmontar (evita perder ediciones al navegar rápido)
  useEffect(() => () => { if (pendiente.current) void saveRemote(pendiente.current) },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desmontar
    [])
}
