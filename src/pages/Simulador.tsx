import { Fragment, useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { MONTHS, STREAMS, DEF_CURVES, DEFAULTS, genCurve, compute, R } from '../data/model'
import type { Curves, Defaults, ComputeKpis, Tier } from '../data/model'

const SMART = '#2563B0', CORE = '#2C8A7B', BLUEL = '#9BBFE8', GOLD = '#B5841C'
// Intensidad por tipo de servicio: uso (oscuro) → profundización (medio) → didácticas (claro).
const SMART_USO = '#1F5AA6', SMART_PROF = '#4A82C4', SMART_DIDAC = '#9BBFE8'
const CORE_USO = '#2C8A7B', CORE_PROF = '#63AE9D', CORE_DIDAC = '#AAD0C8'
// Reparto empleados vs externos (excepción deliberada a "nunca rojo"): rojo = uso/prof
// (sólido = interno · translúcido = sobrecupo), amarillo = didácticas externas.
const RED = '#D64542', REDL = 'rgba(214,69,66,.42)', YELLOW = '#F4C20D'
const money = (x: number) => x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

interface NumProps {
  label: string; unit?: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
}
function Num({ label, unit, value, onChange, step = 1, min = 0, max }: NumProps) {
  return (
    <div className="fld">
      <label>{label} {unit && <span className="u">{unit}</span>}</label>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  )
}

interface RetConqProps {
  label: string; value: number; retColor: string; conqColor: string; onChange: (v: number) => void;
}
function RetConq({ label, value, retColor, conqColor, onChange }: RetConqProps) {
  return (
    <div className="retconq">
      <div className="retconq-head">
        <span>{label}</span>
        <span className="retconq-nums">
          <b style={{ color: retColor }}>{R(value)}% ret.</b> · <b style={{ color: conqColor }}>{R(100 - value)}% conq.</b>
        </span>
      </div>
      <div className="retconq-bar">
        <span style={{ width: `${value}%`, background: retColor }} />
        <span style={{ width: `${100 - value}%`, background: conqColor }} />
      </div>
      <input type="range" min="0" max="100" step="1" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} aria-label={`Retención ${label}`} />
    </div>
  )
}

const TIER_FIELDS: [keyof Pick<Tier, 'pct' | 'uso' | 'prof' | 'didac'>, string][] = [
  ['pct', '%'], ['uso', 'Uso'], ['prof', 'Prof'], ['didac', 'Didác'],
]
interface TierMatrixProps {
  title: string; color: string; total: number; tiers: Tier[];
  onTotal: (v: number) => void;
  onCell: (idx: number, field: 'pct' | 'uso' | 'prof' | 'didac', v: number) => void;
}
function TierMatrix({ title, color, total, tiers, onTotal, onCell }: TierMatrixProps) {
  const sumPct = tiers.reduce((s, t) => s + t.pct, 0)
  return (
    <div className="panel">
      <h3 style={{ color }}>{title}</h3>
      <Num label="Total de colegios" value={total} onChange={onTotal} />
      <div style={{ display: 'grid', gridTemplateColumns: '46px repeat(4, 1fr)', gap: 4, alignItems: 'center', fontSize: 11, marginTop: 6 }}>
        <span />
        {TIER_FIELDS.map(([f, lbl]) => <span key={f} style={{ textAlign: 'center', color: '#646A75' }}>{lbl}</span>)}
        {tiers.map((t, idx) => (
          <Fragment key={t.key}>
            <span style={{ fontWeight: 600 }}>{t.label}</span>
            {TIER_FIELDS.map(([f]) => (
              <input key={f} type="number" min={0} value={t[f]}
                onChange={(e) => onCell(idx, f, parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '3px 2px', fontSize: 11, textAlign: 'center' }} />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="hint" style={sumPct !== 100 ? { color: 'var(--pur)' } : undefined}>
        Mezcla = {R(sumPct)}%{sumPct !== 100 ? ' (se normaliza a 100%)' : ''}.
      </div>
    </div>
  )
}

interface Scenarios { A: ComputeKpis | null; B: ComputeKpis | null }

export default function Simulador() {
  const initN = (): Defaults => ({ ...DEFAULTS, tiersSmart: DEFAULTS.tiersSmart.map((t) => ({ ...t })), tiersCore: DEFAULTS.tiersCore.map((t) => ({ ...t })) })
  const [n, setN] = useState<Defaults>(initN)
  const [curves, setCurves] = useState<Curves>(() => JSON.parse(JSON.stringify(DEF_CURVES)))
  const [shapes, setShapes] = useState(() => STREAMS.map((s) => ({ focal: s.focal, spread: s.spread })))
  const [scen, setScen] = useState<Scenarios>(() => {
    try { const r = localStorage.getItem('sm-sim-scen-v1'); if (r) return JSON.parse(r) } catch { /* noop */ }
    return { A: null, B: null }
  })
  useEffect(() => { try { localStorage.setItem('sm-sim-scen-v1', JSON.stringify(scen)) } catch { /* noop */ } }, [scen])

  const set = (key: keyof Defaults, v: number) => setN((p) => ({ ...p, [key]: v }))
  const setTier = (which: 'tiersSmart' | 'tiersCore', idx: number, field: 'pct' | 'uso' | 'prof' | 'didac', v: number) =>
    setN((p) => ({ ...p, [which]: p[which].map((t, i) => i === idx ? { ...t, [field]: v } : t) }))
  const { rows, k } = useMemo(() => compute({ ...n, curves }), [n, curves])

  const setShape = (i: number, field: 'focal' | 'spread', v: number) => {
    const ns = shapes.map((s, j) => j === i ? { ...s, [field]: v } : s)
    setShapes(ns)
    const st = STREAMS[i]
    setCurves((p) => ({ ...p, [st.k]: genCurve(ns[i].focal, ns[i].spread, st.win) }))
  }
  const reset = () => {
    setN(initN()); setCurves(JSON.parse(JSON.stringify(DEF_CURVES)))
    setShapes(STREAMS.map((s) => ({ focal: s.focal, spread: s.spread })))
  }
  const saveScen = (slot: 'A' | 'B') => setScen((p) => ({ ...p, [slot]: { ...k } }))
  const exportCSV = () => {
    let csv = 'Mes,SMART,CORE,Total,Uso+Prof,Cubierto empl,Ext uso-prof,Didacticas ext,Total ext,Retencion,Conquista,Costo servicios,Costo traslados,Costo total\n'
    rows.forEach((x) => { csv += [x.m, R(x.smart), R(x.core), R(x.smart + x.core), R(x.up), R(x.cov), R(x.extUP), R(x.adicExt), R(x.totExt), R(x.ret), R(x.conq), R(x.costServ), R(x.costTras), R(x.costTot)].join(',') + '\n' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'coberturas_asesores.csv'; a.click()
  }

  const kpis: [string, string | number, string][] = [
    ['Servicios totales', R(k.totalT), ''],
    ['Mes pico (total)', `${k.peak.m} · ${R(k.peak.smart + k.peak.core)}`, ''],
    ['Externos · mes pico', `${k.extPeak.m} · ${R(k.extPeak.totExt)}`, 'warn'],
    ['Cabezas externas (pico)', k.cabExtPico, 'warn'],
    ['Meses con sobrecupo', k.meses, k.meses > 0 ? 'warn' : ''],
    ['Util. empleados (anual)', `${R(k.utilA * 100)}%`, ''],
    ['Conquista total', R(k.totConq), 'good'],
    ['% conquista', `${R(k.pctConq * 100)}%`, 'good'],
    ['Conquista · mes pico', `${k.conqPeak.m} · ${R(k.conqPeak.conq)}`, 'good'],
  ]
  const cmpRows: [string, (x: ComputeKpis) => string | number][] = [
    ['Servicios totales', (x) => R(x.totalT)],
    ['Externos · pico', (x) => `${R(x.extPeak.totExt)} (${x.extPeak.m})`],
    ['Cabezas externas pico', (x) => x.cabExtPico],
    ['Util. empleados anual', (x) => `${R(x.utilA * 100)}%`],
    ['Conquista total', (x) => R(x.totConq)],
    ['% conquista', (x) => `${R(x.pctConq * 100)}%`],
    ['Costo total', (x) => money(x.costs.total)],
  ]

  return (
    <div>
      <h1>Simulador de coberturas y asesores · 26-27</h1>
      <div className="sub">Empleados cubren uso/profundización; externos cubren el resto y todas las didácticas específicas.
        <b style={{ color: 'var(--pur)' }}> ◆ Convención Comercial (Kick-off) 8-10 sep 2026.</b></div>

      <div className="cols">
        <div>
          <div className="panel">
            <h3>Escenario</h3>
            <div className="hint" style={{ marginTop: 0 }}>Guarda A/B para comparar variantes de la matriz de colegios.</div>
            <div className="row-btn">
              <button className="sec" onClick={() => saveScen('A')}>Guardar A</button>
              <button className="sec" onClick={() => saveScen('B')}>Guardar B</button>
              {(scen.A || scen.B) && <button className="sec" onClick={() => setScen({ A: null, B: null })}>Limpiar A/B</button>}
              <button className="sec" onClick={reset}>Restablecer</button>
              <button className="sec" onClick={exportCSV}>CSV</button>
            </div>
          </div>

          <div className="panel">
            <h3>Capacidad empleados</h3>
            <Num label="Asesores empleados SM" value={n.nAse} onChange={(v) => set('nAse', v)} />
            <div className="three">
              <Num label="Servicios/día" step={0.5} value={n.tDay} onChange={(v) => set('tDay', v)} />
              <Num label="Días/sem" value={n.dWeek} onChange={(v) => set('dWeek', v)} />
              <Num label="Sem/mes" step={0.01} value={n.wMonth} onChange={(v) => set('wMonth', v)} />
            </div>
            <Num label="Servicios/mes por externo" value={n.prodExt} min={1} onChange={(v) => set('prodExt', v)} />
            <div className="capnote">Capacidad ≈ {R(k.cap)} servicios/mes ({n.nAse} asesores)</div>
          </div>

          <TierMatrix title="Colegios SMART por tipo" color={SMART}
            total={n.vSmart} tiers={n.tiersSmart}
            onTotal={(v) => set('vSmart', v)} onCell={(i, f, v) => setTier('tiersSmart', i, f, v)} />

          <TierMatrix title="Colegios CORE por tipo" color={CORE}
            total={n.vCore} tiers={n.tiersCore}
            onTotal={(v) => set('vCore', v)} onCell={(i, f, v) => setTier('tiersCore', i, f, v)} />

          <div className="panel">
            <h3>Retención vs conquista</h3>
            <RetConq label="SMART" retColor={BLUEL} conqColor={SMART} value={n.retS} onChange={(v) => set('retS', v)} />
            <RetConq label="CORE" retColor="#A0CAC4" conqColor={CORE} value={n.retC} onChange={(v) => set('retC', v)} />
            <div className="hint">Ajusta la proporción de cada campaña: la retención conserva la base actual y el resto es
              conquista (clientes nuevos), aplicado a los servicios mes a mes.</div>
          </div>

          <div className="panel">
            <h3>Costos <span className="u" style={{ fontWeight: 400 }}>(MXN)</span></h3>
            <div className="three">
              <Num label="Costo Uso" unit="$" step={50} value={n.costoUso} onChange={(v) => set('costoUso', v)} />
              <Num label="Costo Profund." unit="$" step={50} value={n.costoProf} onChange={(v) => set('costoProf', v)} />
              <Num label="Costo Didáctica" unit="$" step={50} value={n.costoDidac} onChange={(v) => set('costoDidac', v)} />
            </div>
            <Num label="Costo por traslado" unit="$" step={50} value={n.costoTraslado} onChange={(v) => set('costoTraslado', v)} />
            <div className="three">
              <Num label="% Uso c/traslado" unit="%" max={100} value={n.propTrasUso} onChange={(v) => set('propTrasUso', v)} />
              <Num label="% Profund. c/traslado" unit="%" max={100} value={n.propTrasProf} onChange={(v) => set('propTrasProf', v)} />
              <Num label="% Didáct. c/traslado" unit="%" max={100} value={n.propTrasDidac} onChange={(v) => set('propTrasDidac', v)} />
            </div>
            <div className="hint">El costo total = servicios (cantidad × costo unitario) + traslados (proporción de cada tipo × costo por traslado).</div>
          </div>

          <div className="panel">
            <h3>Curvas de cierre</h3>
            {STREAMS.map((s, i) => (
              <div key={s.k} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 62px', gap: 6, alignItems: 'center', marginBottom: 6, fontSize: 11 }}>
                <span>{s.lbl}</span>
                <input type="range" min="0.5" max="3" step="0.1" value={shapes[i].spread} onChange={(e) => setShape(i, 'spread', parseFloat(e.target.value))} />
                <select value={shapes[i].focal} onChange={(e) => setShape(i, 'focal', parseInt(e.target.value))}>
                  {Array.from({ length: s.win[1] - s.win[0] + 1 }, (_, j) => s.win[0] + j).map((mi) => (
                    <option key={mi} value={mi}>{MONTHS[mi]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="kpis">
            {kpis.map(([l, v, c]) => (
              <div key={l} className={`kpi ${c}`}><div className="v">{v}</div><div className="l">{l}</div></div>
            ))}
          </div>

          <h2>1 · Coberturas de servicios por mes (SMART vs CORE)</h2>
          <div className="chartbox">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v, n) => [R(Number(v)), n]} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="usoT" name="SMART · uso" stackId="a" fill={SMART_USO} />
                <Bar dataKey="profT" name="SMART · profundización" stackId="a" fill={SMART_PROF} />
                <Bar dataKey="adicST" name="SMART · didácticas" stackId="a" fill={SMART_DIDAC} />
                <Bar dataKey="usoCT" name="CORE · uso" stackId="a" fill={CORE_USO} />
                <Bar dataKey="profCT" name="CORE · profundización" stackId="a" fill={CORE_PROF} />
                <Bar dataKey="adicCT" name="CORE · didácticas" stackId="a" fill={CORE_DIDAC} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="hint">Intensidad por tipo de servicio: uso (oscuro) → profundización (medio) → didácticas específicas (claro). Azul = SMART, verde = CORE.</div>

          <h2>2 · Reparto empleados vs externos</h2>
          <div className="chartbox">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v) => R(Number(v))} /><Legend />
                <Bar dataKey="cov" name="Internos (uso/prof)" stackId="b" fill={RED} />
                <Bar dataKey="extUP" name="Externos uso/prof (sobrecupo)" stackId="b" fill={REDL} />
                <Bar dataKey="adicExt" name="Externos didácticas" stackId="b" fill={YELLOW} />
                <ReferenceLine y={R(k.cap)} stroke="#334155" strokeDasharray="5 4" label={{ value: 'capacidad', fontSize: 10, fill: '#334155', position: 'right' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2>3 · Retención vs conquista por campaña y mes</h2>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <div className="kpi"><div className="v">{R(k.pctConqSmart * 100)}%</div><div className="l">Conquista SMART · {R(k.totConqSmart)} servicios</div></div>
            <div className="kpi"><div className="v">{R((1 - k.pctConqSmart) * 100)}%</div><div className="l">Retención SMART · {R(k.totRetSmart)} servicios</div></div>
            <div className="kpi good"><div className="v">{R(k.pctConqCore * 100)}%</div><div className="l">Conquista CORE · {R(k.totConqCore)} servicios</div></div>
            <div className="kpi"><div className="v">{R((1 - k.pctConqCore) * 100)}%</div><div className="l">Retención CORE · {R(k.totRetCore)} servicios</div></div>
          </div>
          <div className="chartbox">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v, n) => [R(Number(v)), n]} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="retSmart" name="SMART · retención" stackId="c" fill={BLUEL} />
                <Bar dataKey="conqSmart" name="SMART · conquista" stackId="c" fill={SMART} />
                <Bar dataKey="retCore" name="CORE · retención" stackId="c" fill="#A0CAC4" />
                <Bar dataKey="conqCore" name="CORE · conquista" stackId="c" fill={CORE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="hint">Barras apiladas por mes: SMART (retención azul claro · conquista azul) y CORE (retención verde claro · conquista verde). Ajusta las proporciones en el panel «Retención vs conquista».</div>

          <h2>4 · Costos del ciclo</h2>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            <div className="kpi"><div className="v">{money(k.costs.total)}</div><div className="l">Costo total del ciclo</div></div>
            <div className="kpi"><div className="v">{money(k.costs.servicios)}</div><div className="l">Costo de servicios</div></div>
            <div className="kpi warn"><div className="v">{money(k.costs.traslados)}</div><div className="l">Costo de traslados · {R(k.costs.trasladosN)} viajes</div></div>
          </div>
          <div className="chartbox">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={rows} margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `$${R(Number(v) / 1000)}k`} width={44} />
                <Tooltip formatter={(v, n) => [money(Number(v)), n]} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="costServ" name="Servicios" stackId="e" fill={CORE} />
                <Bar dataKey="costTras" name="Traslados" stackId="e" fill={GOLD} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table>
            <thead><tr><th>Tipo de servicio</th><th>Servicios</th><th>Costo servicios</th><th>Traslados</th><th>Costo traslados</th><th>Total</th></tr></thead>
            <tbody>
              {k.costs.byType.map((r) => (
                <tr key={r.key}><td>{r.label}</td><td>{R(r.n)}</td><td>{money(r.costoServicio)}</td><td>{R(r.traslados)}</td><td>{money(r.costoTraslados)}</td><td>{money(r.total)}</td></tr>
              ))}
              <tr className="total"><td>Total</td><td>{R(k.totalT)}</td><td>{money(k.costs.servicios)}</td><td>{R(k.costs.trasladosN)}</td><td>{money(k.costs.traslados)}</td><td>{money(k.costs.total)}</td></tr>
            </tbody>
          </table>
          <div className="hint">Un traslado es un evento de costo fijo; su cantidad sale de la proporción de servicios de cada tipo que requieren desplazamiento. Ajusta costos y proporciones en el panel «Costos».</div>

          <h2>5 · Análisis por tipo de colegio</h2>
          <table>
            <thead><tr><th>Campaña</th><th>Tipo</th><th>Colegios</th><th>Uso</th><th>Profund.</th><th>Didácticas</th><th>Servicios</th></tr></thead>
            <tbody>
              {(['SMART', 'CORE'] as const).map((camp) => {
                const rowsC = k.tiers.filter((t) => t.campaign === camp)
                const tot = rowsC.reduce((a, t) => ({ n: a.n + t.n, uso: a.uso + t.uso, prof: a.prof + t.prof, didac: a.didac + t.didac, serv: a.serv + t.servicios }), { n: 0, uso: 0, prof: 0, didac: 0, serv: 0 })
                return (
                  <Fragment key={camp}>
                    {rowsC.map((t) => (
                      <tr key={camp + t.key}>
                        <td style={{ color: camp === 'SMART' ? SMART : CORE, fontWeight: 600 }}>{camp}</td>
                        <td>{t.label}</td><td>{R(t.n)}</td><td>{R(t.uso)}</td><td>{R(t.prof)}</td><td>{R(t.didac)}</td><td>{R(t.servicios)}</td>
                      </tr>
                    ))}
                    <tr className="total"><td>{camp}</td><td>Total</td><td>{R(tot.n)}</td><td>{R(tot.uso)}</td><td>{R(tot.prof)}</td><td>{R(tot.didac)}</td><td>{R(tot.serv)}</td></tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <div className="hint">Servicios anuales que aporta cada tipo de colegio (# colegios × servicios/colegio del tipo). La suma coincide con «Servicios totales» = {R(k.totalT)}.</div>

          {(scen.A || scen.B) && (
            <>
              <h2>Comparar escenarios</h2>
              <table>
                <thead><tr><th>Métrica</th><th>Actual</th><th>A</th><th>B</th></tr></thead>
                <tbody>
                  {cmpRows.map(([l, fn]) => (
                    <tr key={l}><td>{l}</td><td>{fn(k)}</td><td>{scen.A ? fn(scen.A) : '—'}</td><td>{scen.B ? fn(scen.B) : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="hint">Guarda A y B para fijar referencias.</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
