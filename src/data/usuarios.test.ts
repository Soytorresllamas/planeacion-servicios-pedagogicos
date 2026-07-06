// Pruebas de los helpers puros de usuarios/roles y catálogos.
// La autenticación real vive en Supabase Auth y la autorización en RLS
// (supabase_blindaje.sql); eso se verifica E2E, no aquí.
import { describe, expect, it } from 'vitest';
import {
  usoResumen, agregarCatalogo, quitarCatalogo, renombrarCatalogo,
  genTempPassword, correoValido, esUnicoAdminActivo, defaultCatalogos,
} from './usuarios';
import type { Usuario } from './usuarios';

const usuario = (extra: Partial<Usuario> = {}): Usuario => ({
  id: 'u1', correo: 'u1@sm.com.mx', nombre: 'Laura', apellido: 'Sánchez',
  rol: 'asesor', tempPassword: false, activo: true,
  creado: '2026-07-01T00:00:00Z', ingresos: 0, ...extra,
});

describe('helpers de cuenta', () => {
  it('correoValido acepta correos razonables y rechaza basura', () => {
    expect(correoValido('a@b.mx')).toBe(true);
    expect(correoValido('nombre.apellido@grupo-sm.com')).toBe(true);
    expect(correoValido('a b@c.mx')).toBe(false);
    expect(correoValido('sin-arroba')).toBe(false);
  });

  it('genTempPassword usa alfabeto sin ambigüedades y formato SM-XXXXXX', () => {
    for (let i = 0; i < 20; i++) expect(genTempPassword()).toMatch(/^SM-[A-HJ-NP-Z2-9]{6}$/);
    expect(genTempPassword(() => 0.5)).toBe(genTempPassword(() => 0.5)); // determinista con rand fijo
  });
});

describe('esUnicoAdminActivo (blindaje de lockouts)', () => {
  it('detecta al único admin activo y deja de serlo con un segundo admin', () => {
    const solo = [usuario({ id: 'a1', rol: 'admin' })];
    expect(esUnicoAdminActivo(solo, 'a1')).toBe(true);
    const dos = [...solo, usuario({ id: 'a2', correo: 'a2@sm.com.mx', rol: 'admin' })];
    expect(esUnicoAdminActivo(dos, 'a1')).toBe(false);
    // si el segundo está inactivo, el primero vuelve a ser único
    const unoInactivo = [solo[0], usuario({ id: 'a2', correo: 'a2@sm.com.mx', rol: 'admin', activo: false })];
    expect(esUnicoAdminActivo(unoInactivo, 'a1')).toBe(true);
    // un asesor nunca es «único admin»
    expect(esUnicoAdminActivo(solo, 'no-existe')).toBe(false);
  });
});

describe('mapeo de uso', () => {
  it('usoResumen clasifica nunca-entraron y activos de 7 días', () => {
    const ahora = new Date('2026-07-04T12:00:00Z');
    const lista = [
      usuario({ id: 'u1', ingresos: 2, ultimoIngreso: '2026-07-03T08:00:00Z' }), // ayer
      usuario({ id: 'u2', correo: 'u2@x.mx', ingresos: 5, ultimoIngreso: '2026-06-01T08:00:00Z' }), // viejo
      usuario({ id: 'u3', correo: 'u3@x.mx' }),                                   // nunca
      usuario({ id: 'u4', correo: 'u4@x.mx', activo: false }),                    // desactivado, nunca
    ];
    expect(usoResumen(lista, ahora)).toEqual({
      total: 4, activos: 3, nuncaEntraron: 2, activos7d: 1, ingresosTotales: 7,
    });
  });
});

describe('catálogos', () => {
  it('agrega ordenado, sin duplicados (case-insensitive), quita y renombra', () => {
    let g = agregarCatalogo([], 'Gerencia Norte');
    g = agregarCatalogo(g, 'Gerencia Centro');
    g = agregarCatalogo(g, 'gerencia norte'); // duplicado
    expect(g).toEqual(['Gerencia Centro', 'Gerencia Norte']);
    expect(quitarCatalogo(g, 'Gerencia Centro')).toEqual(['Gerencia Norte']);
    expect(renombrarCatalogo(g, 'Gerencia Norte', 'Gerencia Bajío')).toEqual(['Gerencia Bajío', 'Gerencia Centro']);
    expect(defaultCatalogos()).toEqual({ gerencias: [], ejecutivos: [] });
  });
});
