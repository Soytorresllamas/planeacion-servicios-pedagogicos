import { describe, expect, it } from 'vitest';
import { DEFAULTS } from './model';
import {
  serviciosDeTier, nColegios, repartirColegios, generateColegios, defaultAsesores, defaultPlaneacion,
  asignar, resumen, cargaAsesor, asignarPorTipo, liberarPorTipo, contarPorTipo,
  setServicio, renombrarColegio, renombrarAsesor, avanceAsignado, patchColegio,
  hoyISO, sumarDias, urgencia, agendaAsesor, serviciosDeAsesor,
  agregarAlerta, atenderAlerta,
  nivelesDeColegio, agregarServicioExtra, quitarServicioExtra,
  genTokenDirector, datosDirector, normalizarDirector, colegiosDeEjecutivo, normNombre,
  marcarNecesidadViaje, filasViajes, estadoReserva, resumenViajes,
  detectarCambios, importarColegios,
} from './planeacion';
import type { Servicio, Colegio } from './planeacion';

const tierTop = { key: 'top' as const, label: 'Top', pct: 10, uso: 3, prof: 2, didac: 1 };

describe('serviciosDeTier', () => {
  it('crea una instancia por servicio requerido, todas pendientes', () => {
    const s = serviciosDeTier(tierTop);
    expect(s).toHaveLength(6); // 3 uso + 2 prof + 1 didac
    expect(s.filter((x) => x.tipo === 'uso')).toHaveLength(3);
    expect(s.filter((x) => x.tipo === 'prof')).toHaveLength(2);
    expect(s.filter((x) => x.tipo === 'didac')).toHaveLength(1);
    expect(s.every((x) => x.estatus === 'pendiente')).toBe(true);
  });

  it('un tipo con 0 didácticas no crea servicios de ese tipo', () => {
    const bajo = { key: 'bajo' as const, label: 'Bajo', pct: 25, uso: 1, prof: 1, didac: 0 };
    expect(serviciosDeTier(bajo).filter((x) => x.tipo === 'didac')).toHaveLength(0);
  });
});

describe('nColegios / repartirColegios', () => {
  it('reparte según la mezcla real de cada campaña', () => {
    expect(nColegios(413, DEFAULTS.tiersSmart[0], DEFAULTS.tiersSmart)).toBe(95);    // SMART Top 23%
    expect(nColegios(2069, DEFAULTS.tiersCore[1], DEFAULTS.tiersCore)).toBe(476);    // CORE Alto 23%
  });

  it('los conteos suman EXACTAMENTE el total (regresión: Math.round perdía/inventaba colegios)', () => {
    expect(repartirColegios(413, DEFAULTS.tiersSmart).reduce((a, b) => a + b, 0)).toBe(413);
    expect(repartirColegios(2069, DEFAULTS.tiersCore).reduce((a, b) => a + b, 0)).toBe(2069);
  });

  it('los sobrantes van a los restos mayores (SMART top 94.99 → 95; empates al primero)', () => {
    expect(repartirColegios(413, DEFAULTS.tiersSmart)).toEqual([95, 157, 132, 29]);
    // CORE: top y bajo empatan en resto (.73); el sobrante cae primero en top
    expect(repartirColegios(2069, DEFAULTS.tiersCore)).toEqual([352, 476, 889, 352]);
  });

  it('generateColegios genera exactamente vSmart + vCore cupos', () => {
    const cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore);
    expect(cols.filter((c) => c.campaign === 'SMART')).toHaveLength(413);
    expect(cols.filter((c) => c.campaign === 'CORE')).toHaveLength(2069);
    expect(cols).toHaveLength(2482);
  });
});

describe('generateColegios', () => {
  const cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore);

  it('genera ambas campañas con ids únicos y estables', () => {
    expect(cols.length).toBeGreaterThan(0);
    const ids = new Set(cols.map((c) => c.id));
    expect(ids.size).toBe(cols.length); // sin duplicados
    expect(cols.some((c) => c.campaign === 'SMART')).toBe(true);
    expect(cols.some((c) => c.campaign === 'CORE')).toBe(true);
  });

  it('todos arrancan sin asignar y con servicios pendientes', () => {
    expect(cols.every((c) => c.asesorId === null)).toBe(true);
    expect(cols.every((c) => c.servicios.every((s) => s.estatus === 'pendiente'))).toBe(true);
  });

  it('el # de cupos por tipo coincide con nColegios', () => {
    const smTop = cols.filter((c) => c.campaign === 'SMART' && c.tier === 'top');
    expect(smTop).toHaveLength(nColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart[0], DEFAULTS.tiersSmart));
    // cada cupo Top trae la matriz del tipo (3+2+1 = 6 servicios)
    expect(smTop[0].servicios).toHaveLength(6);
  });
});

describe('defaultAsesores / defaultPlaneacion', () => {
  it('crea nAse asesores con ids únicos', () => {
    const a = defaultAsesores(DEFAULTS.nAse);
    expect(a).toHaveLength(DEFAULTS.nAse);
    expect(new Set(a.map((x) => x.id)).size).toBe(DEFAULTS.nAse);
  });

  it('el tablero por defecto trae asesores y cupos', () => {
    const d = defaultPlaneacion();
    expect(d.asesores.length).toBe(DEFAULTS.nAse);
    expect(d.colegios.length).toBeGreaterThan(0);
  });
});

describe('asignar / resumen / cargaAsesor', () => {
  it('asignar cambia solo los colegios seleccionados (inmutable)', () => {
    const cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore);
    const ids = new Set([cols[0].id, cols[1].id]);
    const next = asignar(cols, ids, 'ase-1');
    expect(next[0].asesorId).toBe('ase-1');
    expect(next[1].asesorId).toBe('ase-1');
    expect(next[2].asesorId).toBe(null);
    expect(cols[0].asesorId).toBe(null); // no muta el original
  });

  it('quitar asignación con asesorId=null', () => {
    // vSmart=10 con Top 23% → 2 cupos Top: existe 'SMART-top-001'
    const cols = asignar(generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore), new Set(['SMART-top-001']), 'ase-1');
    expect(cols.find((c) => c.id === 'SMART-top-001')?.asesorId).toBe('ase-1');
    const back = asignar(cols, new Set(['SMART-top-001']), null);
    expect(back.find((c) => c.id === 'SMART-top-001')?.asesorId).toBe(null);
  });

  it('resumen cuenta asignados y sin asignar', () => {
    const cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);
    const r0 = resumen(cols);
    expect(r0.asignados).toBe(0);
    expect(r0.sinAsignar).toBe(r0.total);
    const asignados = asignar(cols, new Set([cols[0].id, cols[1].id]), 'ase-1');
    const r1 = resumen(asignados);
    expect(r1.asignados).toBe(2);
    expect(r1.total).toBe(r0.total);
  });

  it('asignarPorTipo toma los primeros N sin asignar de ese tipo; liberarPorTipo los suelta', () => {
    let cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore);
    const disp0 = contarPorTipo(cols, 'SMART', 'alto');
    expect(disp0).toBeGreaterThan(5);
    cols = asignarPorTipo(cols, 'SMART', 'alto', 5, 'ase-1');
    expect(contarPorTipo(cols, 'SMART', 'alto', 'ase-1')).toBe(5);       // 5 al asesor
    expect(contarPorTipo(cols, 'SMART', 'alto')).toBe(disp0 - 5);        // 5 menos disponibles
    // no invade otros tipos ni campañas
    expect(contarPorTipo(cols, 'CORE', 'alto', 'ase-1')).toBe(0);
    cols = liberarPorTipo(cols, 'SMART', 'alto', 2, 'ase-1');
    expect(contarPorTipo(cols, 'SMART', 'alto', 'ase-1')).toBe(3);
    expect(contarPorTipo(cols, 'SMART', 'alto')).toBe(disp0 - 3);
  });

  it('asignarPorTipo nunca asigna más que los disponibles', () => {
    let cols = generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);
    const disp = contarPorTipo(cols, 'SMART', 'top');  // 1 disponible
    cols = asignarPorTipo(cols, 'SMART', 'top', 99, 'ase-1');
    expect(contarPorTipo(cols, 'SMART', 'top', 'ase-1')).toBe(disp);
    expect(contarPorTipo(cols, 'SMART', 'top')).toBe(0);
  });

  it('cargaAsesor suma colegios, servicios y realizados del asesor', () => {
    let cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);
    const top = cols.find((c) => c.tier === 'top')!;
    cols = asignar(cols, new Set([top.id]), 'ase-1');
    // marca un servicio como realizado
    cols = cols.map((c) => c.id === top.id ? { ...c, servicios: c.servicios.map((s, i) => i === 0 ? { ...s, estatus: 'realizado' as const } : s) } : c);
    const carga = cargaAsesor(cols, 'ase-1');
    expect(carga.colegios).toBe(1);
    expect(carga.servicios).toBe(6);   // Top = 6 servicios
    expect(carga.usoProf).toBe(5);     // 3 uso + 2 prof (didáctica no cuenta como empleado)
    expect(carga.realizados).toBe(1);
    // otro asesor no tiene nada
    expect(cargaAsesor(cols, 'ase-2').colegios).toBe(0);
  });
});

describe('agenda / urgencia', () => {
  const hoy = '2026-10-15';
  const S = (o: Partial<Servicio>): Servicio => ({ tipo: 'uso', estatus: 'pendiente', ...o });

  it('hoyISO formatea la fecha local como YYYY-MM-DD', () => {
    expect(hoyISO(new Date(2026, 9, 5))).toBe('2026-10-05'); // mes 9 = octubre
  });

  it('sumarDias suma cruzando mes y año', () => {
    expect(sumarDias('2026-10-15', 7)).toBe('2026-10-22');
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('urgencia clasifica según fecha planeada y estatus', () => {
    expect(urgencia(S({ estatus: 'realizado', fechaPlan: '2026-01-01' }), hoy)).toBe('realizado');
    expect(urgencia(S({}), hoy)).toBe('sinfecha');
    expect(urgencia(S({ fechaPlan: '2026-10-10' }), hoy)).toBe('vencido');
    expect(urgencia(S({ fechaPlan: '2026-10-18' }), hoy)).toBe('proximo');
    expect(urgencia(S({ fechaPlan: '2026-12-01' }), hoy)).toBe('agendado');
  });

  it('agendaAsesor cuenta vencidos, esta semana y por hacer (ignora realizados)', () => {
    let cols = generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);
    const id = cols.find((c) => c.tier === 'top')!.id;
    cols = asignar(cols, new Set([id]), 'ase-1');
    cols = setServicio(cols, id, 0, { fechaPlan: '2026-10-10' }); // vencido
    cols = setServicio(cols, id, 1, { fechaPlan: '2026-10-18' }); // esta semana
    cols = setServicio(cols, id, 2, { estatus: 'realizado' });    // no cuenta
    const a = agendaAsesor(cols, 'ase-1', hoy);
    expect(a.vencidos).toBe(1);
    expect(a.estaSemana).toBe(1);
    expect(a.porHacer).toBe(5); // 6 servicios − 1 realizado
  });

  it('serviciosDeAsesor aplana solo los servicios del asesor', () => {
    let cols = generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);
    const id = cols.find((c) => c.tier === 'top')!.id;
    cols = asignar(cols, new Set([id]), 'ase-1');
    const refs = serviciosDeAsesor(cols, 'ase-1');
    expect(refs).toHaveLength(6);
    expect(refs.every((r) => r.colegioId === id)).toBe(true);
    expect(serviciosDeAsesor(cols, 'ase-2')).toHaveLength(0);
  });
});

describe('avanceAsignado', () => {
  it('solo cuenta colegios asignados y separa uso/prof de didácticas', () => {
    let cols = generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore);
    expect(avanceAsignado(cols).colegios).toBe(0); // nada asignado aún
    cols = asignarPorTipo(cols, 'SMART', 'top', 2, 'ase-1'); // 2 Top = 2×(3u+2p+1d)
    const av = avanceAsignado(cols);
    expect(av.colegios).toBe(2);
    expect(av.servicios).toBe(12);
    expect(av.usoProf).toBe(10);   // 2×5
    expect(av.didac).toBe(2);      // 2×1
    expect(av.realizados).toBe(0);
    // marcar un servicio realizado se refleja
    const top = cols.find((c) => c.asesorId === 'ase-1')!;
    cols = setServicio(cols, top.id, 0, { estatus: 'realizado' });
    expect(avanceAsignado(cols).realizados).toBe(1);
  });
});

describe('alertas de caso crítico', () => {
  const base = (): ReturnType<typeof defaultPlaneacion> => ({ asesores: defaultAsesores(2), colegios: [], alertas: undefined });

  it('agregarAlerta anexa con id generado y preserva lo demás (tolera alertas undefined)', () => {
    const d0 = base();
    const d1 = agregarAlerta(d0, { fecha: '2026-07-03T10:00:00Z', asesorId: 'ase-1', colegioId: 'SMART-top-001', tipo: 'materiales', descripcion: 'Faltan libros de 3º' });
    expect(d1.alertas).toHaveLength(1);
    expect(d1.alertas![0].id).toBeTruthy();
    expect(d1.alertas![0].tipo).toBe('materiales');
    expect(d1.alertas![0].atendida).toBeUndefined();
    expect(d0.alertas).toBeUndefined();          // no muta el original
    const d2 = agregarAlerta(d1, { fecha: '2026-07-03T11:00:00Z', asesorId: 'ase-2', colegioId: 'X', tipo: 'otros', descripcion: 'Otro' });
    expect(d2.alertas).toHaveLength(2);
    expect(d2.alertas![0].id).not.toBe(d2.alertas![1].id);
  });

  it('atenderAlerta marca solo la indicada', () => {
    let d = agregarAlerta(base(), { fecha: '2026-07-03T10:00:00Z', asesorId: 'ase-1', colegioId: 'A', tipo: 'atencion', descripcion: 'x' });
    d = agregarAlerta(d, { fecha: '2026-07-03T11:00:00Z', asesorId: 'ase-1', colegioId: 'B', tipo: 'facturacion', descripcion: 'y' });
    const id0 = d.alertas![0].id;
    const d2 = atenderAlerta(d, id0);
    expect(d2.alertas![0].atendida).toBe(true);
    expect(d2.alertas![1].atendida).toBeUndefined();
  });
});

describe('setServicio / renombrarColegio', () => {
  const base = () => generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);

  it('setServicio cambia solo el servicio indicado, sin mutar el original', () => {
    const cols = base();
    const id = cols.find((c) => c.tier === 'top')!.id;
    const next = setServicio(cols, id, 0, { estatus: 'realizado', fechaReal: '2026-10-05' });
    const c = next.find((x) => x.id === id)!;
    expect(c.servicios[0].estatus).toBe('realizado');
    expect(c.servicios[0].fechaReal).toBe('2026-10-05');
    expect(c.servicios[1].estatus).toBe('pendiente');           // otros servicios intactos
    expect(cols.find((x) => x.id === id)!.servicios[0].estatus).toBe('pendiente'); // original sin mutar
  });

  it('renombrarColegio cambia el nombre del colegio indicado', () => {
    const cols = base();
    const id = cols[0].id;
    const next = renombrarColegio(cols, id, 'Colegio Real X');
    expect(next.find((c) => c.id === id)!.nombre).toBe('Colegio Real X');
    expect(cols[0].nombre).toBe(id);   // original sin mutar
  });

  it('renombrarAsesor cambia solo el asesor indicado, sin mutar el original', () => {
    const asesores = [{ id: 'ase-1', nombre: 'Asesor 1' }, { id: 'ase-2', nombre: 'Asesor 2' }];
    const next = renombrarAsesor(asesores, 'ase-2', 'Marcela Ruiz');
    expect(next.find((a) => a.id === 'ase-2')!.nombre).toBe('Marcela Ruiz');
    expect(next.find((a) => a.id === 'ase-1')!.nombre).toBe('Asesor 1'); // otros intactos
    expect(asesores[1].nombre).toBe('Asesor 2');                         // original sin mutar
  });

  it('patchColegio actualiza metadatos (serie/inglés/satisfacción/notas) sin mutar el original', () => {
    const cols = base();
    const id = cols[0].id;
    const next = patchColegio(cols, id, { serie: 'Acierta', ingles: 'Winglish', satisfaccion: 4, notasGenerales: 'Buen contacto' });
    const c = next.find((x) => x.id === id)!;
    expect(c.serie).toBe('Acierta');
    expect(c.ingles).toBe('Winglish');
    expect(c.satisfaccion).toBe(4);
    expect(c.notasGenerales).toBe('Buen contacto');
    expect(cols[0].serie).toBeUndefined(); // original sin mutar
  });
});

describe('niveles escolares', () => {
  it('nivelesDeColegio usa los declarados si existen', () => {
    expect(nivelesDeColegio({ niveles: ['pri', 'sec'] })).toEqual(['pri', 'sec']);
  });

  it('sin declarados, deriva de series/inglés por nivel (en orden pre→bach)', () => {
    expect(nivelesDeColegio({ seriesNivel: { sec: 'Acierta' }, inglesNivel: { pre: 'Winglish' } })).toEqual(['pre', 'sec']);
    expect(nivelesDeColegio({})).toEqual([]);
  });
});

describe('talleres extra (coordinación)', () => {
  const base = () => generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);

  it('agregarServicioExtra anexa un servicio marcado extra, pendiente y con nivel opcional', () => {
    const cols = base();
    const id = cols.find((c) => c.tier === 'top')!.id;
    const next = agregarServicioExtra(cols, id, 'prof', 'sec');
    const c = next.find((x) => x.id === id)!;
    expect(c.servicios).toHaveLength(7); // Top trae 6
    const nuevo = c.servicios[6];
    expect(nuevo).toMatchObject({ tipo: 'prof', estatus: 'pendiente', extra: true, nivel: 'sec' });
    expect(cols.find((x) => x.id === id)!.servicios).toHaveLength(6); // original sin mutar
  });

  it('quitarServicioExtra borra SOLO servicios extra; la matriz congelada no se toca', () => {
    let cols = agregarServicioExtra(base(), 'SMART-top-001', 'uso');
    const antes = cols.find((c) => c.id === 'SMART-top-001')!.servicios.length;
    // intentar quitar un servicio de la matriz (idx 0, no extra) → intacto
    cols = quitarServicioExtra(cols, 'SMART-top-001', 0);
    expect(cols.find((c) => c.id === 'SMART-top-001')!.servicios).toHaveLength(antes);
    // quitar el extra (último índice) sí lo borra
    cols = quitarServicioExtra(cols, 'SMART-top-001', antes - 1);
    expect(cols.find((c) => c.id === 'SMART-top-001')!.servicios).toHaveLength(antes - 1);
    expect(cols.find((c) => c.id === 'SMART-top-001')!.servicios.every((s) => !s.extra)).toBe(true);
  });

  it('los extras cuentan en la carga del asesor (capacidad real)', () => {
    let cols = asignar(base(), new Set(['SMART-top-001']), 'ase-1');
    cols = agregarServicioExtra(cols, 'SMART-top-001', 'uso');
    expect(cargaAsesor(cols, 'ase-1').servicios).toBe(7);
    expect(cargaAsesor(cols, 'ase-1').usoProf).toBe(6);
  });
});

describe('enlace y vista del director', () => {
  it('genTokenDirector produce 32 hex distintos cada vez', () => {
    const t1 = genTokenDirector(), t2 = genTokenDirector();
    expect(t1).toMatch(/^[0-9a-f]{32}$/);
    expect(t1).not.toBe(t2);
  });

  it('datosDirector expone SOLO lo público: nada de tier, costos, notas, satisfacción ni valor', () => {
    const c: Colegio = {
      id: 'x', nombre: 'Colegio Cumbres', campaign: 'SMART', tier: 'bajo', asesorId: 'ase-1',
      servicios: [{ tipo: 'uso', estatus: 'realizado', fechaReal: '2026-09-01', nota: 'interna', costoExterno: 999, traslado: true, costoTraslado: 500 }],
      satisfaccion: 2, notasGenerales: 'cliente difícil', valorReal: 123456, gerencia: 'Norte',
      niveles: ['pri'], contacto: { nombre: 'Ana', telefono: '555' }, tokenDirector: 'abc',
    };
    const d = datosDirector(c, 'Laura Peña');
    expect(d.nombre).toBe('Colegio Cumbres');
    expect(d.asesor).toBe('Laura Peña');
    expect(d.niveles).toEqual(['pri']);
    expect(d.servicios[0]).toEqual({ tipo: 'uso', estatus: 'realizado', fechaPlan: undefined, fechaReal: '2026-09-01', nivel: undefined, extra: undefined });
    const json = JSON.stringify(d);
    for (const prohibido of ['bajo', 'interna', '999', '500', 'difícil', '123456', 'Norte', 'Ana', '555', 'abc', 'satisfaccion', 'tier', 'costo', 'valor'])
      expect(json).not.toContain(prohibido);
  });

  it('normalizarDirector acepta el jsonb del RPC (null → undefined) y rechaza formas inválidas', () => {
    const raw = {
      nombre: 'Colegio X', campaign: 'CORE', niveles: [], seriesNivel: { pri: 'Acierta' }, inglesNivel: null,
      asesor: null,
      servicios: [{ tipo: 'prof', estatus: 'agendado', fechaPlan: '2026-09-10', fechaReal: null, nivel: null, extra: null }],
    };
    const d = normalizarDirector(raw)!;
    expect(d.campaign).toBe('CORE');
    expect(d.asesor).toBeNull();
    expect(d.niveles).toEqual(['pri']);                 // derivados de seriesNivel
    expect(d.servicios[0]).toEqual({ tipo: 'prof', estatus: 'agendado', fechaPlan: '2026-09-10', fechaReal: undefined, nivel: undefined, extra: undefined });
    expect(normalizarDirector(null)).toBeNull();        // token inválido → RPC devuelve null
    expect(normalizarDirector({ nombre: 'x' })).toBeNull();
  });
});

describe('detectarCambios (guardado por filas)', () => {
  const base = (): ReturnType<typeof defaultPlaneacion> => defaultPlaneacion();

  it('sin cambios (misma referencia o mismo contenido intacto) no reporta nada', () => {
    const d = base();
    expect(detectarCambios(d, d)).toEqual({ estructura: false, colegios: [], asesores: [], alertas: [] });
    // un map que no toca nada conserva referencias → tampoco reporta
    const igual = { ...d, colegios: d.colegios.map((c) => c) };
    expect(detectarCambios(d, igual).colegios).toEqual([]);
  });

  it('editar UN servicio reporta SOLO ese colegio', () => {
    const d = base();
    const next = { ...d, colegios: setServicio(d.colegios, 'SMART-top-001', 0, { estatus: 'realizado' }) };
    const c = detectarCambios(d, next);
    expect(c.estructura).toBe(false);
    expect(c.colegios.map((x) => x.id)).toEqual(['SMART-top-001']);
    expect(c.asesores).toEqual([]);
  });

  it('renombrar un asesor reporta solo ese asesor con su orden', () => {
    const d = base();
    const next = { ...d, asesores: renombrarAsesor(d.asesores, d.asesores[2].id, 'Marcela Ruiz') };
    const c = detectarCambios(d, next);
    expect(c.asesores).toEqual([{ asesor: { id: d.asesores[2].id, nombre: 'Marcela Ruiz' }, orden: 2 }]);
    expect(c.colegios).toEqual([]);
  });

  it('agregar un asesor (alta de usuario) lo reporta al final', () => {
    const d = base();
    const nuevo = { id: 'ase-u-x', nombre: 'Nueva Asesora' };
    const c = detectarCambios(d, { ...d, asesores: [...d.asesores, nuevo] });
    expect(c.asesores).toEqual([{ asesor: nuevo, orden: d.asesores.length }]);
  });

  it('agregar y atender alertas reporta solo las tocadas', () => {
    const d0 = base();
    const d1 = agregarAlerta(d0, { fecha: '2026-10-01T10:00:00Z', asesorId: 'ase-1', colegioId: 'X', tipo: 'otros', descripcion: 'a' });
    expect(detectarCambios(d0, d1).alertas).toHaveLength(1);
    const d2 = atenderAlerta(d1, d1.alertas![0].id);
    const c = detectarCambios(d1, d2);
    expect(c.alertas).toHaveLength(1);
    expect(c.alertas[0].atendida).toBe(true);
  });

  it('import/regenerar (cambia el número o la identidad de colegios) → estructura', () => {
    const d = base();
    const { data: importado } = importarColegios(d, [{ nombre: 'Real 1', campaign: 'SMART', tier: 'top' }]);
    expect(detectarCambios(d, importado).estructura).toBe(true);
    // mismo número pero identidades distintas también es estructura
    const permutado = { ...d, colegios: [...d.colegios.slice(1), d.colegios[0]] };
    expect(detectarCambios(d, permutado).estructura).toBe(true);
  });
});

describe('logística de viajes', () => {
  const base = () => generateColegios(10, DEFAULTS.tiersSmart, 0, DEFAULTS.tiersCore);
  const ID = 'SMART-top-001';

  it('marcarNecesidadViaje: marcar viaje pre-marca traslado (Rentabilidad); hospedaje no', () => {
    let cols = marcarNecesidadViaje(base(), ID, 0, { reqViaje: true });
    let s = cols.find((c) => c.id === ID)!.servicios[0];
    expect(s.reqViaje).toBe(true);
    expect(s.traslado).toBe(true);           // un dato, dos usos
    cols = marcarNecesidadViaje(cols, ID, 1, { reqHospedaje: true });
    s = cols.find((c) => c.id === ID)!.servicios[1];
    expect(s.reqHospedaje).toBe(true);
    expect(s.traslado).toBeUndefined();      // hospedaje no implica traslado
    // desmarcar viaje NO quita traslado (el costo real puede existir igual)
    cols = marcarNecesidadViaje(cols, ID, 0, { reqViaje: false });
    s = cols.find((c) => c.id === ID)!.servicios[0];
    expect(s.reqViaje).toBe(false);
    expect(s.traslado).toBe(true);
  });

  it('filasViajes junta solo servicios con necesidad, ordenados por fecha (sin fecha al final)', () => {
    let cols = marcarNecesidadViaje(base(), ID, 0, { reqViaje: true });
    cols = marcarNecesidadViaje(cols, ID, 1, { reqHospedaje: true });
    cols = setServicio(cols, ID, 1, { fechaPlan: '2026-09-01' });
    const filas = filasViajes(cols);
    expect(filas).toHaveLength(2);
    expect(filas[0].idx).toBe(1);            // con fecha primero
    expect(filas[1].idx).toBe(0);            // sin fecha al final
    expect(filasViajes(base())).toHaveLength(0);
  });

  it('estadoReserva exige un PDF por cada necesidad marcada', () => {
    expect(estadoReserva({ tipo: 'uso', estatus: 'agendado' })).toBe('completa'); // sin necesidades
    expect(estadoReserva({ tipo: 'uso', estatus: 'agendado', reqViaje: true })).toBe('pendiente');
    expect(estadoReserva({ tipo: 'uso', estatus: 'agendado', reqViaje: true, pdfTransporte: 'r/t.pdf' })).toBe('completa');
    expect(estadoReserva({ tipo: 'uso', estatus: 'agendado', reqViaje: true, reqHospedaje: true, pdfTransporte: 'r/t.pdf' })).toBe('parcial');
    expect(estadoReserva({ tipo: 'uso', estatus: 'agendado', reqViaje: true, reqHospedaje: true, pdfTransporte: 'r/t.pdf', pdfHotel: 'r/h.pdf' })).toBe('completa');
  });

  it('resumenViajes cuenta pendientes, próximos 7 días y completas (ignora realizados)', () => {
    const hoy = '2026-10-15';
    let cols = marcarNecesidadViaje(base(), ID, 0, { reqViaje: true });          // pendiente, próx (2026-10-18)
    cols = setServicio(cols, ID, 0, { estatus: 'agendado', fechaPlan: '2026-10-18' });
    cols = marcarNecesidadViaje(cols, ID, 1, { reqHospedaje: true });            // completa (con PDF), lejana
    cols = setServicio(cols, ID, 1, { estatus: 'agendado', fechaPlan: '2026-12-01', pdfHotel: 'r/h.pdf' });
    cols = marcarNecesidadViaje(cols, ID, 2, { reqViaje: true });                // realizado → fuera
    cols = setServicio(cols, ID, 2, { estatus: 'realizado' });
    const r = resumenViajes(cols, hoy);
    expect(r).toEqual({ filas: 2, pendientes: 1, proximos7: 1, completas: 1 });
  });

  it('los campos de viaje NUNCA llegan a la vista del director', () => {
    const cols = marcarNecesidadViaje(base(), ID, 0, { reqViaje: true, reqHospedaje: true });
    const conPdf = setServicio(cols, ID, 0, { pdfTransporte: 'reservas/t.pdf', pdfHotel: 'reservas/h.pdf' });
    const d = datosDirector(conPdf.find((c) => c.id === ID)!, null);
    expect(JSON.stringify(d)).not.toMatch(/reqViaje|reqHospedaje|pdf|reservas/);
  });
});

describe('colegiosDeEjecutivo', () => {
  const col = (id: string, ejecutivo?: string): Colegio =>
    ({ id, nombre: id, campaign: 'SMART', tier: 'top', asesorId: null, servicios: [], ejecutivo });

  it('casa por nombre normalizado (acentos, caja, espacios)', () => {
    const cols = [col('a', 'María  LÓPEZ'), col('b', 'maria lopez'), col('c', 'Otro'), col('d')];
    expect(colegiosDeEjecutivo(cols, 'Maria Lopez').map((c) => c.id)).toEqual(['a', 'b']);
    expect(colegiosDeEjecutivo(cols, '')).toEqual([]);
    expect(normNombre('  JOSÉ  Pérez ')).toBe('jose perez');
  });
});
