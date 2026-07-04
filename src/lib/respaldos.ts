// Respaldos diarios de los tableros (psp_planeacion, psp_admin) en la tabla
// psp_respaldos. Un snapshot por día por tabla: se toma en el PRIMER load del
// día (captura el estado con que empieza la jornada = cierre del día anterior),
// se podan los más viejos que la retención, y se pueden restaurar desde
// Administración. Ver docs/07-administracion-usuarios.md.
import { supabase, PROJECT_REF } from './supabase';

export const RESPALDOS_TABLE = 'psp_respaldos';
export const RETENCION_DIAS = 30;

export type TablaRespaldo = 'planeacion' | 'admin';
export const ETIQUETA: Record<TablaRespaldo, string> = { planeacion: 'Planeación', admin: 'Usuarios y catálogos' };

export interface RespaldoMeta { id: string; tabla: TablaRespaldo; fecha: string; created_at: string }

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

// ── helpers puros (testeables) ──
/** Clave de la marca «ya respaldé hoy» en localStorage (por tabla y backend). */
export const claveMarca = (tabla: TablaRespaldo): string => `psp-respaldo-${tabla}-${PROJECT_REF}`;
export const idRespaldo = (tabla: TablaRespaldo, fecha: string): string => `${tabla}-${fecha}`;

/** Fecha ISO 'YYYY-MM-DD', `dias` antes de `hoy` (aritmética en UTC). */
export function fechaCorte(hoy: string, dias: number): string {
  const d = new Date(hoy + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** ¿Ya se respaldó hoy esta tabla en este navegador? (dedup barato entre loads/páginas) */
export function respaldadoHoy(tabla: TablaRespaldo, hoy: string = hoyISO()): boolean {
  try { return localStorage.getItem(claveMarca(tabla)) === hoy; } catch { return false; }
}

// ── operaciones con Supabase ──

/** Escribe el snapshot del día (upsert) y poda los anteriores a la retención. */
async function escribirSnapshot(tabla: TablaRespaldo, data: unknown, hoy: string): Promise<boolean> {
  const { error } = await supabase.from(RESPALDOS_TABLE).upsert(
    { id: idRespaldo(tabla, hoy), tabla, fecha: hoy, data, created_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) return false;
  try { localStorage.setItem(claveMarca(tabla), hoy); } catch { /* noop */ }
  // poda: borra lo más viejo que la retención (solo de esta tabla)
  await supabase.from(RESPALDOS_TABLE).delete().eq('tabla', tabla).lt('fecha', fechaCorte(hoy, RETENCION_DIAS));
  return true;
}

/** Respaldo automático: solo si hoy aún no se hizo (se llama en cada load remoto). */
export async function respaldarSiNuevoDia(tabla: TablaRespaldo, data: unknown, hoy: string = hoyISO()): Promise<void> {
  if (respaldadoHoy(tabla, hoy)) return;
  try { await escribirSnapshot(tabla, data, hoy); } catch { /* sin conexión / tabla no creada → reintenta otro día */ }
}

/** Respaldo manual «ahora» (ignora el dedup del día; sobrescribe el snapshot de hoy). */
export async function respaldarAhora(tabla: TablaRespaldo, data: unknown, hoy: string = hoyISO()): Promise<boolean> {
  try { return await escribirSnapshot(tabla, data, hoy); } catch { return false; }
}

/** Lista los snapshots (sin traer el `data`, para que la lista sea liviana). */
export async function listarRespaldos(): Promise<RespaldoMeta[]> {
  try {
    const { data, error } = await supabase.from(RESPALDOS_TABLE)
      .select('id, tabla, fecha, created_at').order('fecha', { ascending: false });
    if (error || !data) return [];
    return data as RespaldoMeta[];
  } catch { return []; }
}

/** Trae el contenido de un snapshot para restaurarlo. */
export async function obtenerRespaldo<T = unknown>(id: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.from(RESPALDOS_TABLE).select('data').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return (data.data ?? null) as T | null;
  } catch { return null; }
}
