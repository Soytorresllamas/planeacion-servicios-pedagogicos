export const MONTHS = ["Oct","Nov","Dic","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep"] as const;
export type MonthLabel = (typeof MONTHS)[number];

export type CurveKey = "uso" | "prof" | "adicS" | "adicC" | "smart" | "core";

export interface Stream {
  k: CurveKey;
  lbl: string;
  win: [number, number];
  focal: number;
  spread: number;
}

// Curvas de cierre del Simulador: una por campaña (SMART temprana, CORE tardía).
export const STREAMS: Stream[] = [
  { k: "smart", lbl: "SMART", win: [0,8],  focal: 3, spread: 2 },
  { k: "core",  lbl: "CORE",  win: [3,11], focal: 8, spread: 2.2 },
];

export type Curves = Record<CurveKey, number[]>;

export const DEF_CURVES: Curves = {
  // uso/prof/adicS/adicC: curvas por tipo que alimentan el STREAMGRAPH (perfiles distintos).
  uso:  [.30,.35,.07,.08,.20,0,0,0,0,0,0,0],
  prof: [0,0,.10,.20,.25,.25,.20,0,0,0,0,0],
  adicS:[0,0,0,0,0,.25,.30,.25,.20,0,0,0],
  adicC:[0,0,0,.05,.10,.28,.27,.15,.10,.05,0,0],
  // smart/core: una curva de cierre por campaña para el SIMULADOR (SMART temprana, CORE tardía).
  smart:[.30,.55,.80,1,.90,.65,.40,.20,0,0,0,0],
  core: [0,0,0,.20,.40,.65,.85,.98,1,.90,.70,.45],
};

export type Campaign = "SMART" | "CORE";

export interface ServiceProfile {
  k: string;
  camp: Campaign;
  name: string;
  vol: number;
  fill: string;
  /** Comparte curva mensual con el Simulador (DEF_CURVES) — única fuente de verdad. */
  src?: CurveKey;
  /** Curva propia de 14 meses cuando no hay `src` (adopción CORE aguas abajo). */
  curve?: number[];
}

// Perfiles de servicio canónicos — ÚNICA fuente de los volúmenes reales de colegios.
// Los 4 primeros (`src`) comparten curva mensual con el Simulador (DEF_CURVES) para que
// el streamgraph y el simulador no puedan divergir. Los 2 de CORE (uso/prof) son
// aguas abajo (adopción en verano 2027), fuera del alcance operativo del simulador.
// SMART = familia azul (variantes por tipo de servicio) · CORE = familia teal (variantes).
export const SERVICE_PROFILES: ServiceProfile[] = [
  { k: "Su", camp: "SMART", name: "Uso",                 vol: 458,  fill: "#1F5AA6", src: "uso" },
  { k: "Sp", camp: "SMART", name: "Profundización",      vol: 321,  fill: "#4A82C4", src: "prof" },
  { k: "Sd", camp: "SMART", name: "Didácticas específ.", vol: 160,  fill: "#9BBFE8", src: "adicS" },
  { k: "Cd", camp: "CORE",  name: "Didácticas específ.", vol: 1745, fill: "#2C8A7B", src: "adicC" },
  { k: "Cu", camp: "CORE",  name: "Uso",                 vol: 1047, fill: "#63AE9D", curve: [0,0,0,0,0,0,0,.02,.06,.14,.24,.26,.18,.10] },
  { k: "Cp", camp: "CORE",  name: "Profundización",      vol: 733,  fill: "#AAD0C8", curve: [0,0,0,0,0,0,0,0,.02,.06,.12,.22,.30,.28] },
];
// Capa de análisis: 4 tipos de colegio por campaña. Cada tipo tiene su mezcla (% de
// colegios de la campaña) y su propia matriz de servicios/colegio (uso, prof, didác).
export type TierKey = "top" | "alto" | "medio" | "bajo";
export interface Tier {
  key: TierKey;
  label: string;
  /** % de colegios de la campaña que son de este tipo (se normaliza si no suman 100). */
  pct: number;
  /** Servicios/colegio de este tipo. */
  uso: number; prof: number; didac: number;
}
// Semilla base (placeholder, editable): mezcla y matriz de ejemplo.
export const TIER_SEED: Tier[] = [
  { key: "top",   label: "Top",   pct: 10, uso: 3, prof: 2, didac: 1 },
  { key: "alto",  label: "Alto",  pct: 25, uso: 2, prof: 2, didac: 1 },
  { key: "medio", label: "Medio", pct: 40, uso: 1, prof: 1, didac: 1 },
  { key: "bajo",  label: "Bajo",  pct: 25, uso: 1, prof: 1, didac: 0 },
];
const cloneTiers = (ts: Tier[]): Tier[] => ts.map((t) => ({ ...t }));

export interface CostInputs {
  /** Costo unitario por servicio (MXN). */
  costoUso: number; costoProf: number; costoDidac: number;
  /** Costo por traslado (MXN). */
  costoTraslado: number;
  /** % de servicios de cada tipo que requieren traslado (0-100). */
  propTrasUso: number; propTrasProf: number; propTrasDidac: number;
}

export interface Defaults extends CostInputs {
  nAse: number; tDay: number; dWeek: number; wMonth: number; prodExt: number;
  /** Volumen total de colegios por campaña. */
  vSmart: number; vCore: number;
  /** 4 tipos de colegio por campaña (mezcla % + matriz de servicios/colegio). */
  tiersSmart: Tier[]; tiersCore: Tier[];
  retS: number; retC: number;
}

export const DEFAULTS: Defaults = {
  nAse:10, tDay:2, dWeek:5, wMonth:4.33, prodExt:30,
  // volumen total por campaña; el detalle por tipo de colegio va en tiersSmart/tiersCore
  vSmart:321, vCore:1047,
  tiersSmart: cloneTiers(TIER_SEED), tiersCore: cloneTiers(TIER_SEED),
  retS:94, retC:89,
  // costos: didácticas $3,750 y traslados $1,500; uso/prof en 0. Solo didácticas viajan (40%).
  costoUso:0, costoProf:0, costoDidac:3750, costoTraslado:1500,
  propTrasUso:0, propTrasProf:0, propTrasDidac:40,
};

export const genCurve = (focal: number, spread: number, win: [number, number]): number[] => {
  const a = Array(12).fill(0);
  for (let i = win[0]; i <= win[1]; i++) a[i] = Math.exp(-0.5 * ((i - focal) / spread) ** 2);
  return a;
};
const norm = (a: number[]): number[] => { const s = a.reduce((x, y) => x + y, 0) || 1; return a.map((v) => v / s); };
export const R = (x: number): number => Math.round(x);

export interface ComputeInput extends CostInputs {
  curves: Curves;
  nAse: number; tDay: number; dWeek: number; wMonth: number; prodExt: number;
  vSmart: number; vCore: number;
  tiersSmart: Tier[]; tiersCore: Tier[];
  retS: number; retC: number;
}

/** Agrega los 4 tipos de colegio de una campaña a servicios anuales por tipo de servicio. */
export function aggregateTiers(vTotal: number, tiers: Tier[]): { uso: number; prof: number; didac: number } {
  const sumPct = tiers.reduce((s, t) => s + t.pct, 0) || 1;
  let uso = 0, prof = 0, didac = 0;
  for (const t of tiers) {
    const n = vTotal * (t.pct / sumPct);   // # colegios de este tipo
    uso += n * t.uso; prof += n * t.prof; didac += n * t.didac;
  }
  return { uso, prof, didac };
}

export interface MonthRow {
  m: MonthLabel;
  usoT: number; profT: number; adicST: number; adicCT: number;
  usoCT: number; profCT: number;
  smart: number; core: number; up: number; cap: number;
  cov: number; extUP: number; adicExt: number; totExt: number; util: number;
  ret: number; conq: number; retSmart: number; conqSmart: number; retCore: number; conqCore: number;
  /** Costo del mes: servicios, traslados y total. */
  costServ: number; costTras: number; costTot: number;
}

export type CostTypeKey = "uso" | "prof" | "didac";
export interface CostBreakdownRow {
  key: CostTypeKey;
  label: string;
  n: number;               // # de servicios de este tipo (anual)
  costoServicio: number;   // Nₛ × costo unitario
  traslados: number;       // # de traslados (Nₛ × proporción)
  costoTraslados: number;  // traslados × costo por traslado
  total: number;           // costoServicio + costoTraslados
}
export interface Costs {
  byType: CostBreakdownRow[];
  servicios: number;   // costo total de servicios
  traslados: number;   // costo total de traslados
  trasladosN: number;  // # total de traslados
  total: number;       // servicios + traslados
}

// Capa de análisis: contribución de cada tipo de colegio (anual).
export interface TierBreakdownRow {
  campaign: Campaign;
  key: TierKey;
  label: string;
  n: number;          // # de colegios de este tipo
  uso: number; prof: number; didac: number;  // servicios anuales por tipo de servicio
  servicios: number;  // total de servicios del estrato
}

export interface ComputeKpis {
  cap: number; totalT: number; peak: MonthRow; extPeak: MonthRow; meses: number;
  utilA: number; utilP: number; cabExtPico: number;
  totExt: number; totRet: number; totConq: number; pctConq: number; conqPeak: MonthRow;
  totSmart: number; totCore: number;
  totRetSmart: number; totConqSmart: number; totRetCore: number; totConqCore: number;
  pctConqSmart: number; pctConqCore: number;
  costs: Costs;
  tiers: TierBreakdownRow[];   // 8 filas: 4 SMART + 4 CORE
}

export interface ComputeResult {
  rows: MonthRow[];
  k: ComputeKpis;
}

export function compute(st: ComputeInput): ComputeResult {
  const cap = st.nAse * st.tDay * st.dWeek * st.wMonth;
  const cS = norm(st.curves.smart), cC = norm(st.curves.core);
  const rS = (st.retS || 0) / 100, rC = (st.retC || 0) / 100;
  // proporciones de traslado a fracción (0-1)
  const pTU = (st.propTrasUso || 0) / 100, pTP = (st.propTrasProf || 0) / 100, pTD = (st.propTrasDidac || 0) / 100;
  // servicios anuales por tipo de servicio, agregando los 4 tipos de colegio de cada campaña
  const smA = aggregateTiers(st.vSmart, st.tiersSmart), coA = aggregateTiers(st.vCore, st.tiersCore);
  const rows: MonthRow[] = [];
  for (let i = 0; i < 12; i++) {
    // la curva de la campaña reparte el total anual entre los meses (norm suma 1)
    const usoT = smA.uso * cS[i], profT = smA.prof * cS[i], adicST = smA.didac * cS[i];
    const usoCT = coA.uso * cC[i], profCT = coA.prof * cC[i], adicCT = coA.didac * cC[i];
    const smart = usoT + profT + adicST, core = adicCT + usoCT + profCT;
    // uso/prof (SMART + CORE): empleados mientras haya capacidad; el sobrecupo entra a externos.
    const up = usoT + profT + usoCT + profCT;
    const cov = Math.min(up, cap), extUP = Math.max(0, up - cap);
    // didácticas específicas (SMART + CORE): SIEMPRE externas
    const adicExt = adicST + adicCT;
    const retSmart = smart * rS, conqSmart = smart * (1 - rS);
    const retCore = core * rC, conqCore = core * (1 - rC);
    const ret = retSmart + retCore, conq = conqSmart + conqCore;
    // costos del mes: uso/prof incluyen CORE; didácticas SMART+CORE
    const didacT = adicST + adicCT;
    const usoAll = usoT + usoCT, profAll = profT + profCT;
    const costServ = usoAll * st.costoUso + profAll * st.costoProf + didacT * st.costoDidac;
    const trasN = usoAll * pTU + profAll * pTP + didacT * pTD;
    const costTras = trasN * st.costoTraslado;
    rows.push({ m: MONTHS[i], usoT, profT, adicST, adicCT, usoCT, profCT, smart, core, up, cap, cov, extUP, adicExt,
      totExt: extUP + adicExt, util: cap ? cov / cap : 0,
      ret, conq, retSmart, conqSmart, retCore, conqCore,
      costServ, costTras, costTot: costServ + costTras });
  }
  const sum = (f: (x: MonthRow) => number) => rows.reduce((s, x) => s + f(x), 0);
  const totalT = sum((x) => x.smart + x.core);
  const peak = rows.reduce((a, b) => (b.smart + b.core) > (a.smart + a.core) ? b : a);
  const extPeak = rows.reduce((a, b) => b.totExt > a.totExt ? b : a);
  const meses = rows.filter((x) => x.extUP > 0.5).length;
  const totRet = sum((x) => x.ret), totConq = sum((x) => x.conq);
  const totSmart = sum((x) => x.smart), totCore = sum((x) => x.core);
  const totRetSmart = sum((x) => x.retSmart), totConqSmart = sum((x) => x.conqSmart);
  const totRetCore = sum((x) => x.retCore), totConqCore = sum((x) => x.conqCore);
  const conqPeak = rows.reduce((a, b) => b.conq > a.conq ? b : a);
  // desglose de costos por tipo de servicio (anual)
  const nUso = sum((x) => x.usoT + x.usoCT), nProf = sum((x) => x.profT + x.profCT), nDidac = sum((x) => x.adicST + x.adicCT);
  const costRow = (key: CostTypeKey, label: string, n: number, costoUnit: number, prop: number): CostBreakdownRow => {
    const traslados = n * prop, costoServicio = n * costoUnit, costoTraslados = traslados * st.costoTraslado;
    return { key, label, n, costoServicio, traslados, costoTraslados, total: costoServicio + costoTraslados };
  };
  const byType: CostBreakdownRow[] = [
    costRow("uso", "Uso", nUso, st.costoUso, pTU),
    costRow("prof", "Profundización", nProf, st.costoProf, pTP),
    costRow("didac", "Didácticas específicas", nDidac, st.costoDidac, pTD),
  ];
  const costServicios = byType.reduce((s, r) => s + r.costoServicio, 0);
  const costTrasCost = byType.reduce((s, r) => s + r.costoTraslados, 0);
  const trasladosN = byType.reduce((s, r) => s + r.traslados, 0);
  const costs: Costs = { byType, servicios: costServicios, traslados: costTrasCost, trasladosN, total: costServicios + costTrasCost };
  // capa de análisis: contribución de cada tipo de colegio (4 SMART + 4 CORE)
  const tierRows = (camp: Campaign, vTotal: number, tiers: Tier[]): TierBreakdownRow[] => {
    const sumPct = tiers.reduce((s, t) => s + t.pct, 0) || 1;
    return tiers.map((t) => {
      const n = vTotal * (t.pct / sumPct);
      const uso = n * t.uso, prof = n * t.prof, didac = n * t.didac;
      return { campaign: camp, key: t.key, label: t.label, n, uso, prof, didac, servicios: uso + prof + didac };
    });
  };
  const tiers: TierBreakdownRow[] = [
    ...tierRows("SMART", st.vSmart, st.tiersSmart),
    ...tierRows("CORE", st.vCore, st.tiersCore),
  ];
  const k: ComputeKpis = {
    cap, totalT, peak, extPeak, meses,
    utilA: cap ? sum((x) => x.cov) / (cap * 12) : 0,
    utilP: Math.max(...rows.map((x) => x.util)),
    cabExtPico: Math.ceil(extPeak.totExt / (st.prodExt || 1)),
    totExt: sum((x) => x.totExt), totRet, totConq,
    pctConq: (totRet + totConq) ? totConq / (totRet + totConq) : 0, conqPeak,
    totSmart, totCore, totRetSmart, totConqSmart, totRetCore, totConqCore,
    pctConqSmart: totSmart ? totConqSmart / totSmart : 0,
    pctConqCore: totCore ? totConqCore / totCore : 0,
    costs,
    tiers,
  };
  return { rows, k };
}
