// Pruebas de los helpers puros de respaldos (la parte con Supabase se verifica E2E).
import { describe, expect, it } from 'vitest';
import { idRespaldo, fechaCorte, respaldadoHoy, claveMarca, RETENCION_DIAS } from './respaldos';

function stubLocalStorage(inicial: Record<string, string> = {}) {
  const store = { ...inicial };
  // @ts-expect-error stub mínimo para el entorno node
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
  return store;
}

describe('respaldos · helpers puros', () => {
  it('idRespaldo combina tabla + fecha', () => {
    expect(idRespaldo('planeacion', '2026-07-04')).toBe('planeacion-2026-07-04');
    expect(idRespaldo('usuarios', '2026-12-31')).toBe('usuarios-2026-12-31');
  });

  it('fechaCorte resta días en UTC (incl. cruce de mes/año)', () => {
    expect(fechaCorte('2026-07-04', 30)).toBe('2026-06-04');
    expect(fechaCorte('2026-01-05', 30)).toBe('2025-12-06');
    expect(fechaCorte('2026-07-04', 0)).toBe('2026-07-04');
    expect(RETENCION_DIAS).toBe(30);
  });

  it('respaldadoHoy: true solo cuando la marca del día coincide', () => {
    stubLocalStorage();
    expect(respaldadoHoy('planeacion', '2026-07-04')).toBe(false);
    // sembrar la marca exacta del día
    localStorage.setItem(claveMarca('planeacion'), '2026-07-04');
    expect(respaldadoHoy('planeacion', '2026-07-04')).toBe(true);
    expect(respaldadoHoy('planeacion', '2026-07-05')).toBe(false); // otro día → false
    expect(respaldadoHoy('usuarios', '2026-07-04')).toBe(false);       // otra tabla → false
  });

  it('respaldadoHoy no revienta si no hay localStorage', () => {
    // @ts-expect-error forzar ausencia
    delete globalThis.localStorage;
    expect(respaldadoHoy('usuarios', '2026-07-04')).toBe(false);
  });
});
