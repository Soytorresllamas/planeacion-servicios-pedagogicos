import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { SERVICE_PROFILES, DEF_CURVES } from '../data/model'
import type { ServiceProfile, Campaign } from '../data/model'

// Eje del ciclo. Los meses del modelo (DEF_CURVES: Oct'26..Sep'27) se alinean a los
// índices 1..12; Sep'26 (0) y Oct'27 (13) quedan fuera de la ventana operativa.
const AX = ["Sep'26","Oct'26","Nov","Dic","Ene'27","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep'27","Oct'27"]
const fmt = (n: number) => n.toLocaleString('es-MX')

type Datum = { m: string } & Record<string, number | string>

// Distribución mensual (14 meses) de un perfil, normalizada a su volumen real.
// - perfil con `src`: usa la MISMA curva mensual del Simulador (una sola fuente de verdad).
// - perfil con `curve`: curva propia de 14 meses (adopción CORE aguas abajo).
const bandFor = (p: ServiceProfile): number[] => {
  const raw = AX.map((_, i) => {
    if (p.src) return (i >= 1 && i <= 12) ? (DEF_CURVES[p.src][i - 1] || 0) : 0
    return p.curve?.[i] || 0
  })
  const s = raw.reduce((a, b) => a + b, 0) || 1
  return raw.map((w) => Math.round((p.vol * w) / s))
}

type SeriesItem = ServiceProfile & { monthly: number[] }

interface LedgerProps {
  camp: Campaign
  subtotal: number
  grand: number
  maxVol: number
  items: SeriesItem[]
}
function Ledger({ camp, subtotal, grand, maxVol, items }: LedgerProps) {
  return (
    <div className="ledger">
      <div className="ledger-head">
        <span className={`camp-dot ${camp === 'SMART' ? 'sm' : 'co'}`} />
        Campaña {camp}
        <span className="ledger-sub">{fmt(subtotal)} colegios · {Math.round(subtotal / grand * 100)}%</span>
      </div>
      {items.filter((p) => p.camp === camp).map((p) => (
        <div key={p.k} className="ledger-row">
          <span className="sw" style={{ background: p.fill }} />
          <span className="ledger-name">{p.name}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${p.vol / maxVol * 100}%`, background: p.fill }} /></span>
          <span className="ledger-val">{fmt(p.vol)}</span>
        </div>
      ))}
    </div>
  )
}

interface MarkerLabelProps {
  viewBox?: { x: number; y: number }
  text: string
  color: string
  line?: number
}
// Marcador de convención posicionado a la derecha de la línea para que no se corte.
function MarkerLabel({ viewBox, text, color, line = 0 }: MarkerLabelProps) {
  const { x = 0, y = 0 } = viewBox ?? {}
  return (
    <text x={x + 6} y={y + 14 + line * 15} fill={color} fontSize={10} fontWeight={600} textAnchor="start">
      {text}
    </text>
  )
}

export default function Streamgraph() {
  const { series, data, totSmart, totCore } = useMemo(() => {
    const series = SERVICE_PROFILES.map((p) => ({ ...p, monthly: bandFor(p) }))
    const data: Datum[] = AX.map((m, i) => {
      const o: Datum = { m }
      series.forEach((p) => { o[p.k] = p.monthly[i] })
      return o
    })
    const totSmart = SERVICE_PROFILES.filter((p) => p.camp === 'SMART').reduce((a, b) => a + b.vol, 0)
    const totCore = SERVICE_PROFILES.filter((p) => p.camp === 'CORE').reduce((a, b) => a + b.vol, 0)
    return { series, data, totSmart, totCore }
  }, [])

  const maxVol = Math.max(...SERVICE_PROFILES.map((p) => p.vol))
  const grand = totSmart + totCore
  const byName = Object.fromEntries(series.map((p) => [p.k, p.name]))

  return (
    <div>
      <h1>Perfiles de servicio académico · 26-27</h1>
      <div className="sub">SMART fluye <b>uso → profundización → didácticas específicas</b> (oct-feb). CORE entra por
        <b> didácticas específicas</b> en primavera 2027 y pasa a uso y profundización en el verano. El total de cada
        banda es el volumen real de colegios; <b>azul = SMART</b>, <b>verde = CORE</b> (variantes por tipo de servicio).</div>

      <div className="ledger-wrap">
        <Ledger camp="SMART" subtotal={totSmart} grand={grand} maxVol={maxVol} items={series} />
        <Ledger camp="CORE" subtotal={totCore} grand={grand} maxVol={maxVol} items={series} />
      </div>

      <h2>Flujo de servicios por mes</h2>
      <div className="chartbox">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={data} margin={{ top: 24, right: 18, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFF1F4" vertical={false} />
            <XAxis dataKey="m" fontSize={10.5} tickLine={false} axisLine={{ stroke: '#D2D7DE' }} />
            <YAxis fontSize={10.5} tickLine={false} axisLine={false} width={46}
              label={{ value: 'servicios / mes', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#646A75', dy: 40 }} />
            <Tooltip
              formatter={(v, k) => [`${fmt(Number(v))} servicios`, byName[String(k)]]}
              labelFormatter={(l) => `Mes: ${l}`}
              contentStyle={{ borderRadius: 10, border: '1px solid #E3E6EB', fontSize: 12 }} />
            {series.map((p) => (
              <Area key={p.k} type="monotone" dataKey={p.k} name={p.name} stackId="1"
                stroke="#fff" strokeWidth={0.8} fill={p.fill} fillOpacity={1} isAnimationActive={false} />
            ))}
            <ReferenceLine x="Sep'26" stroke="#7A4A86" strokeDasharray="3 3" strokeWidth={1.4}
              label={<MarkerLabel text="Convención General SM · 7-9 sep" color="#7A4A86" />} />
            <ReferenceLine x="Feb" stroke="#B5841C" strokeDasharray="3 3" strokeWidth={1.4}
              label={<MarkerLabel text="Tope SMART · feb" color="#B5841C" line={1} />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="hint">Volúmenes reales por perfil de <b>SERVICE_PROFILES</b> (el mismo modelo del proyecto). Esta vista usa
        curvas por tipo de servicio; el Simulador usa una curva por campaña. Las curvas de uso y profundización de CORE
        modelan la adopción aguas abajo en el verano 2027.</div>
    </div>
  )
}
