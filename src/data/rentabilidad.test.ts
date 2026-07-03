// Pruebas de la carga masiva (mapeo de filas) y del módulo de Rentabilidad.
import { describe, expect, it } from 'vitest';
import {
  importarColegios, ejecutorDe, costoServicio, rentabilidadColegio, agruparRent,
  filasLogistica, defaultAsesores,
} from './planeacion';
import type { PlaneacionData, FilaColegio, Colegio, Servicio } from './planeacion';
import { mapearFilas, parseCSV, parseNum } from '../lib/importColegios';

const base = (): PlaneacionData => ({ asesores: defaultAsesores(2), colegios: [] });

const fila = (extra: Partial<FilaColegio> = {}): FilaColegio => ({
  nombre: 'Colegio X', campaign: 'SMART', tier: 'top', ...extra,
});

describe('mapearFilas (archivo de BI → FilaColegio)', () => {
  it('mapea una fila completa con los encabezados oficiales', () => {
    const { filas, errores } = mapearFilas([{
      'Nombre de Colegio': 'Instituto Cumbres', 'ID en CRM': 'CRM-1', 'Clave de Colegio': 'MX-1',
      'Campaña': 'SMART', 'Categoría de Colegio': 'Top', 'Valor Real de Colegio': '$985,000',
      'Gerencia Responsable': 'Centro', 'Ejecutivo Responsable': 'Mariana López',
      'Asesor Pedagógico': 'Laura Sánchez', 'Años de Antigüedad': '12',
      'Serie Primaria': 'Acierta', 'Inglés Secundaria': 'Winglish', 'Otra Serie': '',
    }]);
    expect(errores).toEqual([]);
    expect(filas[0]).toMatchObject({
      nombre: 'Instituto Cumbres', idCrm: 'CRM-1', clave: 'MX-1', campaign: 'SMART', tier: 'top',
      valorReal: 985000, gerencia: 'Centro', antiguedad: 12,
      ejecutivo: 'Mariana López',   // comercial: dato del colegio
      asesorPed: 'Laura Sánchez',   // pedagógico: asigna
      seriesNivel: { pri: 'Acierta' }, inglesNivel: { sec: 'Winglish' },
    });
  });

  it('acepta variantes: minúsculas, sin acentos y categoría numerada', () => {
    const { filas, errores } = mapearFilas([
      { 'nombre': 'A', 'campana': 'core', 'categoria': 'MEDIO' },
      { 'Nombre': 'B', 'Campaña': 'Smart', 'Categoría de Colegio': 'Tipo 1' },
    ]);
    expect(errores).toEqual([]);
    expect(filas[0]).toMatchObject({ campaign: 'CORE', tier: 'medio' });
    expect(filas[1]).toMatchObject({ campaign: 'SMART', tier: 'top' });
  });

  it('rechaza filas sin nombre, campaña o categoría válidas (con fila y motivo)', () => {
    const { filas, errores } = mapearFilas([
      { 'Nombre de Colegio': '', 'Campaña': 'SMART', 'Categoría de Colegio': 'Top' },
      { 'Nombre de Colegio': 'X', 'Campaña': 'OTRA', 'Categoría de Colegio': 'Top' },
      { 'Nombre de Colegio': 'Y', 'Campaña': 'CORE', 'Categoría de Colegio': 'Premium' },
      { 'Nombre de Colegio': 'Z', 'Campaña': 'CORE', 'Categoría de Colegio': 'Bajo' },
    ]);
    expect(filas).toHaveLength(1);
    expect(errores).toHaveLength(3);
    expect(errores[0]).toContain('Fila 2');
    expect(errores[1]).toContain('SMART o CORE');
    expect(errores[2]).toContain('Top/Alto/Medio/Bajo');
  });

  it('parseNum tolera $, comas, espacios y paréntesis contables', () => {
    expect(parseNum('$1,234,567.50')).toBe(1234567.5);
    expect(parseNum('1 234')).toBe(1234);
    expect(parseNum('(500)')).toBe(-500);
    expect(parseNum('')).toBeUndefined();
    expect(parseNum('n/a')).toBeUndefined();
  });
});

describe('parseCSV', () => {
  it('maneja comillas con comas y saltos de línea internos', () => {
    const regs = parseCSV('Nombre,Nota\n"Colegio, El Grande","línea 1\nlínea 2"\n');
    expect(regs).toHaveLength(1);
    expect(regs[0]['Nombre']).toBe('Colegio, El Grande');
    expect(regs[0]['Nota']).toBe('línea 1\nlínea 2');
  });

  it('detecta delimitador ; y quita el BOM', () => {
    const regs = parseCSV('﻿Nombre;Valor\nCole A;100\n');
    expect(regs[0]).toEqual({ Nombre: 'Cole A', Valor: '100' });
  });
});

describe('importarColegios', () => {
  it('crea colegios con los servicios de su campaña+categoría', () => {
    const { data } = importarColegios(base(), [fila({ tier: 'top' }), fila({ nombre: 'Y', campaign: 'CORE', tier: 'bajo' })]);
    expect(data.colegios[0].servicios).toHaveLength(6);  // Top: 3+2+1
    expect(data.colegios[1].servicios).toHaveLength(2);  // Bajo: 1+1+0
  });

  it('casa asesores pedagógicos existentes (sin acentos/caja) y crea los nuevos', () => {
    const d = base();
    d.asesores[0].nombre = 'Laura Sánchez';
    const { data, resumen } = importarColegios(d, [
      fila({ asesorPed: 'laura sanchez' }),          // existente (normalizado)
      fila({ nombre: 'B', asesorPed: 'Pedro Gómez' }),
      fila({ nombre: 'C', asesorPed: 'Pedro Gómez' }), // repetido → mismo asesor
      fila({ nombre: 'D' }),                          // sin asesor pedagógico → sin asignar
    ]);
    expect(resumen.asesoresNuevos).toBe(1);
    expect(resumen.asignados).toBe(3);
    expect(data.colegios[0].asesorId).toBe(d.asesores[0].id);
    expect(data.colegios[1].asesorId).toBe(data.colegios[2].asesorId);
    expect(data.colegios[3].asesorId).toBeNull();
    expect(data.asesores).toHaveLength(3); // 2 default + Pedro
  });

  it('NO confunde al ejecutivo comercial con el asesor: no crea asesor ni asigna', () => {
    const { data, resumen } = importarColegios(base(), [
      fila({ ejecutivo: 'Mariana López' }),                              // solo comercial
      fila({ nombre: 'B', ejecutivo: 'Mariana López', asesorPed: 'Pedro Gómez' }), // ambas figuras
    ]);
    expect(resumen.asesoresNuevos).toBe(1);            // solo Pedro (pedagógico)
    expect(resumen.asignados).toBe(1);
    expect(data.colegios[0].asesorId).toBeNull();      // el comercial no asigna
    expect(data.colegios[0].ejecutivo).toBe('Mariana López'); // pero sí se guarda como dato
    expect(data.asesores.some((a) => a.nombre === 'Mariana López')).toBe(false);
    expect(data.asesores.some((a) => a.nombre === 'Pedro Gómez')).toBe(true);
  });

  it('usa el ID de CRM como clave estable y desambigua repetidos', () => {
    const { data } = importarColegios(base(), [
      fila({ idCrm: 'CRM-9' }), fila({ nombre: 'B', idCrm: 'CRM-9' }), fila({ nombre: 'C' }),
    ]);
    expect(data.colegios[0].id).toBe('crm-crm-9');
    expect(data.colegios[1].id).toBe('crm-crm-9~2');
    expect(data.colegios[2].id).toBe('imp-c'); // sin idCrm ni clave → nombre
  });

  it('reemplaza los cupos simulados y cuenta por campaña', () => {
    const d = base();
    d.colegios = [{ id: 'SMART-top-001', nombre: 'sim', campaign: 'SMART', tier: 'top', asesorId: null, servicios: [] }];
    const { data, resumen } = importarColegios(d, [fila(), fila({ nombre: 'Y', campaign: 'CORE', tier: 'medio' })]);
    expect(data.colegios).toHaveLength(2);
    expect(resumen.porCampaign).toEqual({ SMART: 1, CORE: 1 });
  });
});

describe('rentabilidad', () => {
  const serv = (extra: Partial<Servicio> = {}): Servicio => ({ tipo: 'uso', estatus: 'pendiente', ...extra });
  const col = (extra: Partial<Colegio> = {}): Colegio => ({
    id: 'c1', nombre: 'C1', campaign: 'SMART', tier: 'top', asesorId: 'ase-1', servicios: [], ...extra,
  });

  it('ejecutorDe: didácticas siempre externas; uso/prof según asignación', () => {
    const c = col();
    expect(ejecutorDe(serv({ tipo: 'didac' }), c)).toBe('externo');
    expect(ejecutorDe(serv(), c)).toBe('interno');
    expect(ejecutorDe(serv(), col({ asesorId: null }))).toBe('externo');
  });

  it('costoServicio: el traslado solo cuenta si está marcado', () => {
    expect(costoServicio(serv({ traslado: true, costoTraslado: 1500 }))).toBe(1500);
    expect(costoServicio(serv({ traslado: false, costoTraslado: 1500 }))).toBe(0);
    expect(costoServicio(serv({ traslado: true, costoTraslado: 1500, costoExterno: 3750 }))).toBe(5250);
    expect(costoServicio(serv())).toBe(0);
  });

  it('rentabilidadColegio: margen y % contra el valor real', () => {
    const c = col({
      valorReal: 100000,
      servicios: [
        serv({ estatus: 'realizado', traslado: true, costoTraslado: 1500 }),
        serv({ tipo: 'didac', estatus: 'realizado', costoExterno: 3750 }),
        serv(),
      ],
    });
    const r = rentabilidadColegio(c);
    expect(r.costo).toBe(5250);
    expect(r.margen).toBe(94750);
    expect(r.pct).toBeCloseTo(94.75);
    expect(r.realizados).toBe(2);
    expect(r.conCosto).toBe(2);
    expect(r.externos).toBe(1); // solo la didáctica (el colegio está asignado)
  });

  it('sin Valor Real: margen/pct nulos pero el costo sí se acumula', () => {
    const r = rentabilidadColegio(col({ servicios: [serv({ costoExterno: 100 })] }));
    expect(r.valor).toBeNull();
    expect(r.margen).toBeNull();
    expect(r.costo).toBe(100);
  });

  it('agruparRent por gerencia: suma valor solo de colegios con Valor Real', () => {
    const cols = [
      col({ id: 'a', gerencia: 'Centro', valorReal: 100, servicios: [serv({ costoExterno: 10 })] }),
      col({ id: 'b', gerencia: 'Centro', servicios: [serv({ costoExterno: 5 })] }), // sin valor
      col({ id: 'c', gerencia: 'Norte', valorReal: 50, servicios: [] }),
    ];
    const g = agruparRent(cols, (c) => c.gerencia ?? '');
    const centro = g.find((x) => x.key === 'Centro')!;
    expect(centro.colegios).toBe(2);
    expect(centro.sinValor).toBe(1);
    expect(centro.valor).toBe(100);
    expect(centro.costo).toBe(15);     // el costo sí suma todos
    expect(centro.margen).toBe(90);    // solo colegios con valor: 100−10
    expect(g[0].key).toBe('Centro');   // ordenado por valor desc
  });

  it('filasLogistica aplana todos los servicios con su ejecutor', () => {
    const cols = [col({ servicios: [serv(), serv({ tipo: 'didac' })] })];
    const f = filasLogistica(cols);
    expect(f).toHaveLength(2);
    expect(f[0].ejecutor).toBe('interno');
    expect(f[1].ejecutor).toBe('externo');
    expect(f[1].idx).toBe(1);
  });
});
