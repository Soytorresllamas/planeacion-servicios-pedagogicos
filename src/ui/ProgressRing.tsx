// Anillo de progreso (21st.dev/Progress) para el avance del asesor.
// SVG puro con transición CSS del arco; el % vive en el centro.
interface Props {
  pct: number            // 0-100
  size?: number
  stroke?: number
  color?: string
}

export function ProgressRing({ pct, size = 46, stroke = 5, color = 'var(--core)' }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct)}% de avance`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)' }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        style={{ fontSize: size * 0.28, fontWeight: 800, fill: 'var(--ink)', fontFamily: 'Newsreader, serif' }}>
        {Math.round(pct)}%
      </text>
    </svg>
  )
}
