import type { ComputeKpis } from './model';

export const LS_SIM_ESCENARIOS = 'sm-sim-scen-v1';

export interface EscenariosSimulador {
  A: ComputeKpis | null;
  B: ComputeKpis | null;
}

export const ESCENARIOS_VACIOS: EscenariosSimulador = { A: null, B: null };

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null;

const tieneNumero = (obj: Record<string, unknown>, key: string): boolean =>
  typeof obj[key] === 'number' && Number.isFinite(obj[key]);

const esEscenarioActual = (x: unknown): x is ComputeKpis => {
  if (!esObjeto(x)) return false;
  if (!tieneNumero(x, 'totalT') || !tieneNumero(x, 'cabExtPico') || !tieneNumero(x, 'utilA')) return false;
  if (!tieneNumero(x, 'totConq') || !tieneNumero(x, 'pctConq')) return false;
  const extPeak = x.extPeak;
  const costs = x.costs;
  return esObjeto(extPeak) && typeof extPeak.m === 'string' && tieneNumero(extPeak, 'totExt')
    && esObjeto(costs) && tieneNumero(costs, 'total');
};

export function normalizarEscenariosGuardados(raw: string | null): EscenariosSimulador {
  if (!raw) return ESCENARIOS_VACIOS;
  try {
    const parsed = JSON.parse(raw) as { A?: unknown; B?: unknown };
    return {
      A: esEscenarioActual(parsed.A) ? parsed.A : null,
      B: esEscenarioActual(parsed.B) ? parsed.B : null,
    };
  } catch {
    return ESCENARIOS_VACIOS;
  }
}
