// Control segmentado con indicador deslizante (patrón «animated tabs» de
// 21st.dev/Tabs, adaptado a los tokens propios). Los botones son flex:1
// (mismo ancho), así que el indicador se mueve por CSS puro con --seg-i/--seg-n.
interface SegOption<T extends string> { key: T; label: string }

interface Props<T extends string> {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  maxWidth?: number | string
  style?: React.CSSProperties
}

export function Seg<T extends string>({ options, value, onChange, maxWidth, style }: Props<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value))
  return (
    <div className="seg seg-anim" role="tablist"
      style={{ maxWidth, ...style, ['--seg-n' as string]: options.length, ['--seg-i' as string]: idx }}>
      <span className="seg-ind" aria-hidden />
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={o.key === value}
          className={o.key === value ? 'on' : ''} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
