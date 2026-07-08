import { describe, expect, it } from 'vitest';
import { compute, DEFAULTS, DEF_CURVES } from './model';
import { normalizarEscenariosGuardados } from './simuladorEscenarios';

describe('normalizarEscenariosGuardados', () => {
  it('descarta escenarios viejos sin costos para no romper la tabla comparativa', () => {
    const viejo = JSON.stringify({
      A: { totalT: 100, peak: { m: 'Ene' }, extPeak: { m: 'Ene' } },
      B: null,
    });

    expect(normalizarEscenariosGuardados(viejo)).toEqual({ A: null, B: null });
  });

  it('conserva escenarios actuales que traen el bloque de costos', () => {
    const { k } = compute({ ...DEFAULTS, curves: DEF_CURVES });
    const actual = JSON.stringify({
      A: null,
      B: k,
    });

    expect(normalizarEscenariosGuardados(actual).B?.costs.total).toBe(k.costs.total);
  });
});
