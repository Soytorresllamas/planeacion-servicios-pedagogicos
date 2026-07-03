import { useEffect, useRef, useState } from 'react'

// Contador animado para KPIs (patrón «number ticker» de 21st.dev/Texts,
// adaptado al sistema propio). Anima al montar y en cada cambio de valor;
// con prefers-reduced-motion salta directo al valor final.
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  value: number
  /** Formateador del número mostrado (por defecto, es-MX sin decimales). */
  format?: (n: number) => string
  duration?: number // ms
}

export function NumberTicker({ value, format, duration = 750 }: Props) {
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('es-MX'))
  const [mostrado, setMostrado] = useState(() => (reduce() ? value : 0))
  const desde = useRef(mostrado)
  const raf = useRef(0)

  useEffect(() => {
    const ini = desde.current
    if (ini === value) return
    const dur = reduce() ? 0 : duration // sin movimiento: salta al valor en un frame
    const t0 = performance.now()
    const paso = (t: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 4) // ease-out-quart
      setMostrado(ini + (value - ini) * e)
      if (p < 1) raf.current = requestAnimationFrame(paso)
      else desde.current = value
    }
    raf.current = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <>{fmt(mostrado)}</>
}
