// Guardado por FILAS del tablero de planeación (V3.3).
//
// Mismo contrato que usePersistencia (local inmediato + remoto con debounce
// 700 ms + flush al desmontar + no reescribir el estado hidratado), pero en vez
// de subir el tablero completo detecta QUÉ cambió (detectarCambios, por
// identidad) y upserta SOLO esas filas. Cambios de estructura (import,
// regenerar, restaurar) hacen reemplazo total. Si un guardado falla, lo tocado
// se re-encola y se reintenta con el siguiente cambio (mientras, el espejo
// local ya tiene todo).
import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { detectarCambios } from '../data/planeacion';
import type { PlaneacionData, Colegio, Asesor, Alerta, CambiosPlaneacion } from '../data/planeacion';
import { saveLocal, guardarColegios, guardarAsesores, guardarAlertas, reemplazarTodoRemoto } from './planeacionStore';
import { isDemoMode } from './demoMode';

interface Pendiente {
  estructura: boolean;
  colegios: Map<string, Colegio>;
  asesores: Map<string, { asesor: Asesor; orden: number }>;
  alertas: Map<string, Alerta>;
}
const vacio = (): Pendiente => ({ estructura: false, colegios: new Map(), asesores: new Map(), alertas: new Map() });
const hayAlgo = (p: Pendiente): boolean => p.estructura || p.colegios.size > 0 || p.asesores.size > 0 || p.alertas.size > 0;

const acumular = (p: Pendiente, c: CambiosPlaneacion): void => {
  if (c.estructura) { p.estructura = true; return; } // el reemplazo total ya cubre todo
  for (const col of c.colegios) p.colegios.set(col.id, col);
  for (const a of c.asesores) p.asesores.set(a.asesor.id, a);
  for (const al of c.alertas) p.alertas.set(al.id, al);
};

/** Re-encola tras un fallo SIN pisar cambios más nuevos que hayan llegado. */
const reencolar = (destino: Pendiente, fallido: Pendiente): void => {
  destino.estructura = destino.estructura || fallido.estructura;
  for (const [k, v] of fallido.colegios) if (!destino.colegios.has(k)) destino.colegios.set(k, v);
  for (const [k, v] of fallido.asesores) if (!destino.asesores.has(k)) destino.asesores.set(k, v);
  for (const [k, v] of fallido.alertas) if (!destino.alertas.has(k)) destino.alertas.set(k, v);
};

/** Sube lo acumulado (se invoca desde timeout/cleanup, nunca durante render). */
async function flushPendiente(
  pend: MutableRefObject<Pendiente>,
  dataRef: MutableRefObject<PlaneacionData>,
  onStatus?: (s: string) => void,
): Promise<void> {
  const p = pend.current;
  if (!hayAlgo(p)) return;
  pend.current = vacio();
  if (isDemoMode()) {
    saveLocal(dataRef.current);
    onStatus?.('Demostración · guardado local');
    return;
  }
  onStatus?.('Guardando…');
  let ok: boolean;
  if (p.estructura) {
    ok = (await reemplazarTodoRemoto(dataRef.current)).ok;
  } else {
    const [rc, ra, ral] = await Promise.all([
      guardarColegios([...p.colegios.values()]),
      guardarAsesores([...p.asesores.values()]),
      guardarAlertas([...p.alertas.values()]),
    ]);
    ok = rc.ok && ra.ok && ral.ok;
  }
  if (!ok) reencolar(pend.current, p);
  onStatus?.(ok ? 'Sincronizado' : 'Sin conexión · local');
}

/** Pasa `onStatus` ESTABLE (setState o función de módulo), como en usePersistencia. */
export function usePersistenciaPlaneacion(
  data: PlaneacionData,
  ready: boolean,
  onStatus?: (s: string) => void,
): void {
  const ultimo = useRef<PlaneacionData | null>(null);
  const pend = useRef<Pendiente>(vacio());
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
    if (!ready) return;
    // El primer render tras la carga es el estado HIDRATADO (remoto o semilla),
    // no un cambio del usuario: solo se registra como línea base del diff.
    if (!ultimo.current) { ultimo.current = data; return; }
    const cambios = detectarCambios(ultimo.current, data);
    ultimo.current = data;
    saveLocal(data);
    acumular(pend.current, cambios);
    if (!hayAlgo(pend.current)) return;
    const t = window.setTimeout(() => { void flushPendiente(pend, dataRef, onStatus); }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStatus estable por contrato
  }, [data, ready]);

  // flush de lo pendiente al desmontar (no perder ediciones al navegar rápido)
  useEffect(() => () => { void flushPendiente(pend, dataRef, onStatus); },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desmontar
    []);
}
