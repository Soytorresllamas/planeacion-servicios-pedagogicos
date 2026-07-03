import { describe, expect, it } from 'vitest';
import {
  MONTHS, DEF_CURVES, DEFAULTS, SERVICE_PROFILES, TIER_SEED, aggregateTiers,
  genCurve, compute, R,
  type ComputeInput, type Curves,
} from './model';

const baseInput = (overrides: Partial<ComputeInput> = {}): ComputeInput => ({
  curves: DEF_CURVES,
  ...DEFAULTS,
  ...overrides,
});

describe('R', () => {
  it('redondea al entero más cercano', () => {
    expect(R(4.4)).toBe(4);
    expect(R(4.5)).toBe(5);
    expect(R(-1.5)).toBe(-1); // Math.round redondea hacia +Infinity en el punto medio
  });
});

describe('genCurve', () => {
  it('es cero fuera de la ventana [win0, win1]', () => {
    const c = genCurve(4, 1.4, [2, 6]);
    expect(c[0]).toBe(0); expect(c[1]).toBe(0);
    expect(c[7]).toBe(0); expect(c[11]).toBe(0);
  });

  it('alcanza su máximo (1) exactamente en el mes focal', () => {
    const c = genCurve(4, 1.4, [2, 6]);
    expect(c[4]).toBeCloseTo(1, 10);
    expect(c[3]).toBeLessThan(1);
    expect(c[5]).toBeLessThan(1);
  });

  it('devuelve un arreglo de 12 meses siempre', () => {
    expect(genCurve(0, 1, [0, 0])).toHaveLength(12);
  });
});

describe('compute — capacidad', () => {
  it('cap = nAse * tDay * dWeek * wMonth', () => {
    const { k } = compute(baseInput({ nAse: 10, tDay: 2, dWeek: 5, wMonth: 4 }));
    expect(k.cap).toBeCloseTo(10 * 2 * 5 * 4, 6);
  });

  it('con capacidad 0 (sin asesores), cov es 0 en todos los meses y no hay NaN', () => {
    const { rows, k } = compute(baseInput({ nAse: 0 }));
    expect(k.cap).toBe(0);
    rows.forEach((r) => { expect(r.cov).toBe(0); expect(r.util).toBe(0); });
    expect(k.utilA).toBe(0);
    expect(Number.isNaN(k.utilA)).toBe(false);
  });

  it('sin capacidad, todo lo de uso+profundización se vuelve cobertura externa (extUP = up)', () => {
    const { rows } = compute(baseInput({ nAse: 0 }));
    rows.forEach((r) => { expect(r.extUP).toBeCloseTo(r.up, 6); });
  });
});

describe('compute — volúmenes en cero', () => {
  it('con todos los volúmenes en 0, los totales son 0 y pctConq es 0 (no NaN)', () => {
    const { rows, k } = compute(baseInput({ vSmart: 0, vCore: 0 }));
    expect(k.totalT).toBe(0);
    expect(k.totSmart).toBe(0);
    expect(k.totCore).toBe(0);
    expect(k.pctConq).toBe(0);
    expect(k.pctConqSmart).toBe(0);
    expect(k.pctConqCore).toBe(0);
    rows.forEach((r) => { expect(r.smart).toBe(0); expect(r.core).toBe(0); });
  });
});

describe('compute — retención vs conquista por campaña', () => {
  it('con retención 100%, toda la campaña SMART es retención y 0% conquista', () => {
    const { k } = compute(baseInput({ retS: 100 }));
    expect(k.totConqSmart).toBeCloseTo(0, 6);
    expect(k.totRetSmart).toBeCloseTo(k.totSmart, 6);
    expect(k.pctConqSmart).toBeCloseTo(0, 6);
  });

  it('con retención 0%, toda la campaña CORE es conquista y 0% retención', () => {
    const { k } = compute(baseInput({ retC: 0 }));
    expect(k.totRetCore).toBeCloseTo(0, 6);
    expect(k.totConqCore).toBeCloseTo(k.totCore, 6);
    expect(k.pctConqCore).toBeCloseTo(1, 6);
  });

  it('retención y conquista de cada campaña suman el total de esa campaña', () => {
    const { k } = compute(baseInput());
    expect(k.totRetSmart + k.totConqSmart).toBeCloseTo(k.totSmart, 6);
    expect(k.totRetCore + k.totConqCore).toBeCloseTo(k.totCore, 6);
    // y el agregado (ret/conq global) es la suma de ambas campañas
    expect(k.totRet).toBeCloseTo(k.totRetSmart + k.totRetCore, 6);
    expect(k.totConq).toBeCloseTo(k.totConqSmart + k.totConqCore, 6);
  });
});

describe('compute — selección de mes pico', () => {
  it('identifica el mes con mayor smart+core como "peak"', () => {
    // curva SMART 100% concentrada en un solo mes (índice 3 => "Ene"), sin CORE
    const curves: Curves = { ...DEF_CURVES, smart: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], core: [0,0,0,0,0,0,0,0,0,0,0,0] };
    const { k } = compute(baseInput({ curves, vCore: 0 }));
    expect(k.peak.m).toBe(MONTHS[3]);
  });
});

describe('compute — con los DEFAULTS reales del proyecto', () => {
  it('produce 12 filas, una por mes, sin NaN en ninguna métrica clave', () => {
    const { rows } = compute(baseInput());
    expect(rows).toHaveLength(12);
    rows.forEach((r) => {
      expect(Number.isNaN(r.smart)).toBe(false);
      expect(Number.isNaN(r.core)).toBe(false);
      expect(Number.isNaN(r.util)).toBe(false);
    });
  });

  it('el % de conquista global queda entre 0 y 1', () => {
    const { k } = compute(baseInput());
    expect(k.pctConq).toBeGreaterThanOrEqual(0);
    expect(k.pctConq).toBeLessThanOrEqual(1);
  });
});

describe('regresión: SERVICE_PROFILES alimenta el streamgraph', () => {
  // Bug real ya corregido una vez: CORE·didácticas aparecía como 1500 en el streamgraph
  // y 1745 en el simulador porque los volúmenes estaban duplicados a mano.
  it('el volumen de CORE · didácticas específicas es 1745 (no 1500)', () => {
    const cd = SERVICE_PROFILES.find((p) => p.k === 'Cd');
    expect(cd?.vol).toBe(1745);
  });
});

describe('compute — costos', () => {
  it('semillas por defecto: didácticas $3,750, uso/prof $0, traslado $1,500, didác 40%', () => {
    expect(DEFAULTS.costoDidac).toBe(3750);
    expect(DEFAULTS.costoUso).toBe(0);
    expect(DEFAULTS.costoProf).toBe(0);
    expect(DEFAULTS.costoTraslado).toBe(1500);
    expect(DEFAULTS.propTrasUso).toBe(0);
    expect(DEFAULTS.propTrasProf).toBe(0);
    expect(DEFAULTS.propTrasDidac).toBe(40);
  });

  it('el # de servicios por tipo = agregado de los estratos de ambas campañas', () => {
    const { k } = compute(baseInput());
    const byKey = Object.fromEntries(k.costs.byType.map((r) => [r.key, r]));
    const sm = aggregateTiers(DEFAULTS.vSmart, DEFAULTS.tiersSmart);
    const co = aggregateTiers(DEFAULTS.vCore, DEFAULTS.tiersCore);
    expect(byKey.uso.n).toBeCloseTo(sm.uso + co.uso, 4);
    expect(byKey.prof.n).toBeCloseTo(sm.prof + co.prof, 4);
    expect(byKey.didac.n).toBeCloseTo(sm.didac + co.didac, 4);
  });

  it('costo de servicios = Σ (Nₛ × costo unitario); con las semillas solo didácticas cuestan', () => {
    const { k } = compute(baseInput());
    const nDidac = aggregateTiers(DEFAULTS.vSmart, DEFAULTS.tiersSmart).didac + aggregateTiers(DEFAULTS.vCore, DEFAULTS.tiersCore).didac;
    expect(k.costs.servicios).toBeCloseTo(nDidac * 3750, 3);
  });

  it('costo de traslados = Σ (Nₛ × proporción) × costo por traslado; solo didácticas al 40%', () => {
    const { k } = compute(baseInput());
    const nDidac = aggregateTiers(DEFAULTS.vSmart, DEFAULTS.tiersSmart).didac + aggregateTiers(DEFAULTS.vCore, DEFAULTS.tiersCore).didac;
    expect(k.costs.trasladosN).toBeCloseTo(nDidac * 0.4, 6);
    expect(k.costs.traslados).toBeCloseTo(nDidac * 0.4 * 1500, 3);
  });

  it('costo total = servicios + traslados, y coincide con la suma mensual', () => {
    const { rows, k } = compute(baseInput());
    expect(k.costs.total).toBeCloseTo(k.costs.servicios + k.costs.traslados, 4);
    const monthlyServ = rows.reduce((s, r) => s + r.costServ, 0);
    const monthlyTras = rows.reduce((s, r) => s + r.costTras, 0);
    const monthlyTot = rows.reduce((s, r) => s + r.costTot, 0);
    expect(monthlyServ).toBeCloseTo(k.costs.servicios, 4);
    expect(monthlyTras).toBeCloseTo(k.costs.traslados, 4);
    expect(monthlyTot).toBeCloseTo(k.costs.total, 4);
  });

  it('con todos los costos y proporciones en 0, el costo total es 0', () => {
    const { k } = compute(baseInput({
      costoUso: 0, costoProf: 0, costoDidac: 0, costoTraslado: 0,
      propTrasUso: 0, propTrasProf: 0, propTrasDidac: 0,
    }));
    expect(k.costs.total).toBe(0);
    expect(k.costs.trasladosN).toBe(0);
  });

  it('las proporciones de traslado no alteran el costo de servicios', () => {
    const a = compute(baseInput({ propTrasUso: 0, propTrasProf: 0, propTrasDidac: 0 }));
    const b = compute(baseInput({ propTrasUso: 100, propTrasProf: 100, propTrasDidac: 100 }));
    expect(a.k.costs.servicios).toBeCloseTo(b.k.costs.servicios, 4);
    expect(b.k.costs.traslados).toBeGreaterThan(a.k.costs.traslados);
  });
});

describe('compute — modelo por campaña (SMART/CORE)', () => {
  it('semillas: totales 321/1047 y 4 tipos de colegio (mezcla + matriz) por campaña', () => {
    expect(DEFAULTS.vSmart).toBe(321);
    expect(DEFAULTS.vCore).toBe(1047);
    expect(DEFAULTS.tiersSmart).toHaveLength(4);
    expect(DEFAULTS.tiersCore).toHaveLength(4);
    expect(DEFAULTS.tiersSmart.map((t) => t.key)).toEqual(['top', 'alto', 'medio', 'bajo']);
    expect(DEFAULTS.tiersSmart[0]).toMatchObject({ uso: 3, prof: 2, didac: 1 }); // matriz de ejemplo
    expect(TIER_SEED.reduce((s, t) => s + t.pct, 0)).toBe(100);
  });

  it('cada campaña agrega sus 4 tipos de colegio; el total es la suma de ambas', () => {
    const { k } = compute(baseInput());
    const sm = aggregateTiers(DEFAULTS.vSmart, DEFAULTS.tiersSmart);
    const co = aggregateTiers(DEFAULTS.vCore, DEFAULTS.tiersCore);
    expect(k.totSmart).toBeCloseTo(sm.uso + sm.prof + sm.didac, 4);
    expect(k.totCore).toBeCloseTo(co.uso + co.prof + co.didac, 4);
    expect(k.totalT).toBeCloseTo(k.totSmart + k.totCore, 4);
  });

  it('con vCore=0 no hay CORE y SMART queda intacto', () => {
    const base = compute(baseInput());
    const soloSmart = compute(baseInput({ vCore: 0 }));
    expect(soloSmart.k.totCore).toBe(0);
    expect(base.k.totSmart).toBeCloseTo(soloSmart.k.totSmart, 6);
  });

  it('uso/prof (SMART+CORE) van a empleados primero; el sobrecupo entra a externos', () => {
    const { rows } = compute(baseInput());
    rows.forEach((r) => {
      // toda la demanda de empleados es uso+prof de ambas campañas
      expect(r.up).toBeCloseTo(r.usoT + r.profT + r.usoCT + r.profCT, 6);
      // cada servicio de uso/prof está cubierto por empleados o es externo
      expect(r.cov + r.extUP).toBeCloseTo(r.up, 6);
      // empleados nunca exceden la capacidad
      expect(r.cov).toBeLessThanOrEqual(r.cap + 1e-6);
    });
  });

  it('con capacidad amplia, uso/prof es 100% interno (extUP = 0) y cov = uso+prof', () => {
    const { rows } = compute(baseInput({ nAse: 10000 }));
    rows.forEach((r) => {
      expect(r.extUP).toBeCloseTo(0, 6);
      // cov es solo uso/prof (las didácticas NUNCA entran a empleados)
      expect(r.cov).toBeCloseTo(r.usoT + r.profT + r.usoCT + r.profCT, 6);
    });
  });

  it('las didácticas específicas siempre son externas (adicExt = adicST + adicCT)', () => {
    const { rows } = compute(baseInput({ nAse: 10000 })); // aun con muchísima capacidad
    rows.forEach((r) => expect(r.adicExt).toBeCloseTo(r.adicST + r.adicCT, 6));
  });

  it('totExt = extUP + adicExt en cada mes', () => {
    const { rows } = compute(baseInput());
    rows.forEach((r) => expect(r.totExt).toBeCloseTo(r.extUP + r.adicExt, 6));
  });
});

describe('compute — capa de análisis por tipo de colegio', () => {
  it('devuelve 8 filas (4 SMART + 4 CORE) y los colegios de cada campaña suman su total', () => {
    const { k } = compute(baseInput());
    expect(k.tiers).toHaveLength(8);
    const smart = k.tiers.filter((t) => t.campaign === 'SMART');
    const core = k.tiers.filter((t) => t.campaign === 'CORE');
    expect(smart).toHaveLength(4);
    expect(core).toHaveLength(4);
    expect(smart.reduce((s, t) => s + t.n, 0)).toBeCloseTo(DEFAULTS.vSmart, 4);
    expect(core.reduce((s, t) => s + t.n, 0)).toBeCloseTo(DEFAULTS.vCore, 4);
  });

  it('la suma de servicios de los estratos coincide con totalT', () => {
    const { k } = compute(baseInput());
    const servTiers = k.tiers.reduce((s, t) => s + t.servicios, 0);
    expect(servTiers).toBeCloseTo(k.totalT, 3);
  });

  it('la mezcla se normaliza: duplicar todos los % no cambia los resultados', () => {
    const base = compute(baseInput());
    const doubled = compute(baseInput({
      tiersSmart: DEFAULTS.tiersSmart.map((t) => ({ ...t, pct: t.pct * 2 })),
      tiersCore: DEFAULTS.tiersCore.map((t) => ({ ...t, pct: t.pct * 2 })),
    }));
    expect(doubled.k.totalT).toBeCloseTo(base.k.totalT, 4);
  });

  it('un colegio tipo top aporta más servicios que uno bajo (misma campaña)', () => {
    const { k } = compute(baseInput());
    const top = k.tiers.find((t) => t.campaign === 'SMART' && t.key === 'top')!;
    const bajo = k.tiers.find((t) => t.campaign === 'SMART' && t.key === 'bajo')!;
    expect(top.servicios / top.n).toBeGreaterThan(bajo.servicios / bajo.n);
  });
});
