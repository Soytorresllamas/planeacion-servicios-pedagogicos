// Pruebas del modelo de usuarios/roles y catálogos de administración.
import { describe, expect, it } from 'vitest';
import {
  crearUsuario, autenticar, cambiarPassword, resetPassword, registrarIngreso,
  usoResumen, agregarCatalogo, quitarCatalogo, renombrarCatalogo,
  genTempPassword, correoValido, defaultAdminData, patchUsuario, esUnicoAdminActivo,
} from './usuarios';
import type { AdminData, NuevoUsuario } from './usuarios';

const base = (): AdminData => ({ usuarios: [], gerencias: [], ejecutivos: [] });
const nuevo = (extra: Partial<NuevoUsuario> = {}): NuevoUsuario => ({
  nombre: 'Laura', apellido: 'Sánchez', correo: 'laura@sm.com.mx',
  fechaIngreso: '2026-08-01', rol: 'asesor', ...extra,
});
const rndFijo = () => 0.5; // temp password determinista para las pruebas

describe('crearUsuario / autenticar / contraseña temporal', () => {
  it('crea con contraseña temporal y autentica con ella', async () => {
    const r = await crearUsuario(base(), nuevo(), rndFijo);
    if (!r.ok) throw new Error(r.error);
    expect(r.tempPassword).toMatch(/^SM-[A-Z2-9]{6}$/);
    expect(r.usuario.tempPassword).toBe(true);
    expect(r.usuario.ingresos).toBe(0);
    const u = await autenticar(r.data, 'LAURA@sm.com.mx', r.tempPassword); // correo case-insensitive
    expect(u?.id).toBe(r.usuario.id);
    expect(await autenticar(r.data, 'laura@sm.com.mx', 'incorrecta')).toBeNull();
  });

  it('valida correo y rechaza duplicados', async () => {
    const r1 = await crearUsuario(base(), nuevo({ correo: 'malcorreo' }));
    expect(r1.ok).toBe(false);
    const r2 = await crearUsuario(base(), nuevo());
    if (!r2.ok) throw new Error(r2.error);
    const r3 = await crearUsuario(r2.data, nuevo({ nombre: 'Otra' }));
    expect(r3.ok).toBe(false);
    expect(correoValido('a@b.mx')).toBe(true);
    expect(correoValido('a b@c.mx')).toBe(false);
  });

  it('cambiarPassword apaga el flag temporal; la vieja deja de servir', async () => {
    const r = await crearUsuario(base(), nuevo(), rndFijo);
    if (!r.ok) throw new Error(r.error);
    const d2 = await cambiarPassword(r.data, r.usuario.id, 'MiClaveNueva7');
    const u2 = d2.usuarios[0];
    expect(u2.tempPassword).toBe(false);
    expect(await autenticar(d2, 'laura@sm.com.mx', 'MiClaveNueva7')).not.toBeNull();
    expect(await autenticar(d2, 'laura@sm.com.mx', r.tempPassword)).toBeNull();
  });

  it('resetPassword vuelve a poner temporal', async () => {
    const r = await crearUsuario(base(), nuevo(), rndFijo);
    if (!r.ok) throw new Error(r.error);
    const d2 = await cambiarPassword(r.data, r.usuario.id, 'Definitiva1');
    const { data: d3, tempPassword } = await resetPassword(d2, r.usuario.id, rndFijo);
    expect(d3.usuarios[0].tempPassword).toBe(true);
    expect(await autenticar(d3, 'laura@sm.com.mx', tempPassword)).not.toBeNull();
  });

  it('usuario desactivado no puede entrar', async () => {
    const r = await crearUsuario(base(), nuevo(), rndFijo);
    if (!r.ok) throw new Error(r.error);
    const d2 = patchUsuario(r.data, r.usuario.id, { activo: false });
    expect(await autenticar(d2, 'laura@sm.com.mx', r.tempPassword)).toBeNull();
  });
});

describe('id único y último admin (blindaje de lockouts)', () => {
  it('dos correos que normalizan al mismo slug reciben ids distintos', async () => {
    let d = base();
    const r1 = await crearUsuario(d, nuevo({ correo: 'a.b@sm.com.mx' }), rndFijo); if (!r1.ok) throw new Error(r1.error); d = r1.data;
    const r2 = await crearUsuario(d, nuevo({ correo: 'a-b@sm.com.mx' }), rndFijo); if (!r2.ok) throw new Error(r2.error);
    expect(r1.usuario.id).toBe('usr-a-b-sm-com-mx');
    expect(r2.usuario.id).toBe('usr-a-b-sm-com-mx-2');
    expect(r1.usuario.id).not.toBe(r2.usuario.id);
  });

  it('esUnicoAdminActivo detecta al único admin activo', async () => {
    const d = defaultAdminData(); // trae 1 admin (usr-admin)
    expect(esUnicoAdminActivo(d.usuarios, 'usr-admin')).toBe(true);
    // agregar un segundo admin → ya no es único
    const r = await crearUsuario(d, nuevo({ correo: 'admin2@sm.com.mx', rol: 'admin' })); if (!r.ok) throw new Error(r.error);
    expect(esUnicoAdminActivo(r.data.usuarios, 'usr-admin')).toBe(false);
    // si el segundo se desactiva, el primero vuelve a ser único
    const d2 = patchUsuario(r.data, r.usuario.id, { activo: false });
    expect(esUnicoAdminActivo(d2.usuarios, 'usr-admin')).toBe(true);
    // un asesor nunca es "único admin"
    expect(esUnicoAdminActivo(d.usuarios, 'no-existe')).toBe(false);
  });
});

describe('mapeo de uso', () => {
  it('registrarIngreso acumula y usoResumen clasifica', async () => {
    let d = base();
    const r1 = await crearUsuario(d, nuevo(), rndFijo); if (!r1.ok) throw new Error(r1.error); d = r1.data;
    const r2 = await crearUsuario(d, nuevo({ correo: 'pedro@sm.com.mx' }), rndFijo); if (!r2.ok) throw new Error(r2.error); d = r2.data;
    const ahora = new Date('2026-07-03T12:00:00Z');
    d = registrarIngreso(d, r1.usuario.id, '2026-07-02T09:00:00Z'); // ayer
    d = registrarIngreso(d, r1.usuario.id, '2026-07-03T08:00:00Z'); // hoy
    const uso = usoResumen(d.usuarios, ahora);
    expect(d.usuarios[0].ingresos).toBe(2);
    expect(d.usuarios[0].ultimoIngreso).toBe('2026-07-03T08:00:00Z');
    expect(uso).toEqual({ total: 2, activos: 2, nuncaEntraron: 1, activos7d: 1, ingresosTotales: 2 });
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
  });
});

describe('semilla', () => {
  it('trae un admin con contraseña temporal SM-2027', async () => {
    const d = defaultAdminData();
    const u = await autenticar(d, 'admin@sm.com.mx', 'SM-2027');
    expect(u?.rol).toBe('admin');
    expect(u?.tempPassword).toBe(true);
  });

  it('genTempPassword usa alfabeto sin ambigüedades', () => {
    for (let i = 0; i < 20; i++) expect(genTempPassword()).toMatch(/^SM-[A-HJ-NP-Z2-9]{6}$/);
  });
});
