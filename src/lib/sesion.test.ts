import { describe, expect, it } from 'vitest';
import { tabsPorRol, rutaInicial, rutaPermitida } from './sesion';
import { ROLES } from '../data/usuarios';
import type { Rol } from '../data/usuarios';

const RUTAS = [
  '/simulador', '/planeacion', '/rentabilidad', '/logistica', '/administracion',
  '/mi-hoja', '/mis-colegios', '/vista-director', '/servicios', '/documentos',
];

describe('rutaInicial', () => {
  it('cada rol aterriza en un lugar que él mismo tiene permitido', () => {
    for (const { key } of ROLES) expect(rutaPermitida(key, rutaInicial(key))).toBe(true);
  });
});

describe('simulador (invitado de un solo módulo)', () => {
  it('tabsPorRol: solo la pestaña Simulador', () => {
    expect(tabsPorRol('simulador')).toEqual([{ to: '/simulador', label: 'Simulador' }]);
  });

  it('rutaInicial: aterriza en /simulador', () => {
    expect(rutaInicial('simulador')).toBe('/simulador');
  });

  it('rutaPermitida: SOLO /simulador, nada más (ni vistas previas de otros roles)', () => {
    const permitidas = RUTAS.filter((r) => rutaPermitida('simulador', r));
    expect(permitidas).toEqual(['/simulador']);
  });
});

describe('roles de un solo módulo son mutuamente exclusivos (asesor/ejecutivo/viajes/simulador)', () => {
  const solos: { rol: Rol; ruta: string }[] = [
    { rol: 'asesor', ruta: '/mi-hoja' },
    { rol: 'ejecutivo', ruta: '/mis-colegios' },
    { rol: 'viajes', ruta: '/logistica' },
    { rol: 'simulador', ruta: '/simulador' },
  ];

  it('cada uno ve ÚNICAMENTE su propia ruta de las 4', () => {
    for (const { rol, ruta } of solos) {
      for (const { ruta: otra } of solos) {
        expect(rutaPermitida(rol, otra)).toBe(otra === ruta);
      }
    }
  });

  it('ninguno tiene acceso a Administración', () => {
    for (const { rol } of solos) expect(rutaPermitida(rol, '/administracion')).toBe(false);
  });
});

describe('admin conserva acceso total (no lo tapó el rol nuevo)', () => {
  it('rutaPermitida(admin, *) siempre true', () => {
    for (const r of [...RUTAS, '/cualquier-cosa']) expect(rutaPermitida('admin', r)).toBe(true);
  });
});
