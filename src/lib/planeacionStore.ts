// Persistencia del tablero de planeación (V3.3 · guardado POR FILAS).
//
// Antes todo el tablero vivía en UNA fila (psp_planeacion) y cada guardado subía
// ~1.7 MB con el catálogo real; dos personas editando a la vez se pisaban entre
// sí (last-write-wins del blob completo). Ahora cada colegio/asesor/alerta es su
// PROPIA fila: un guardado sube solo lo editado (~2 KB) y los choques se reducen
// a editar exactamente la misma fila. Ver docs/04-infraestructura.md y
// supabase_actualizacion_v3_3.sql (tablas + RLS granular + migración).
//
// El espejo LOCAL sigue siendo el tablero ensamblado (mismo formato de siempre).
// Lectura: si las tablas nuevas aún no existen o están vacías (SQL v3.3 sin
// correr), se cae al blob legado en SOLO lectura.
import { supabase, PLANEACION_TABLE, PLANEACION_ROW, PROJECT_REF } from './supabase';
import { LS_PLANEACION } from './localData';
import { respaldarSiNuevoDia } from './respaldos';
import type { PlaneacionData, Colegio, Asesor, Alerta } from '../data/planeacion';

export const T_COLEGIOS = 'psp_colegios';
export const T_ASESORES = 'psp_asesores';
export const T_ALERTAS = 'psp_alertas';

// Versión del esquema local. Súbela cuando cambie la forma de PlaneacionData:
// cualquier blob guardado con otra versión (o el formato viejo sin versión) se
// descarta al cargar en vez de reventar el render.
const SCHEMA_V = 2;

// Validación estructural: no basta con que existan los arreglos; cada colegio
// debe traer su lista de servicios (que la UI recorre sin defensas).
const valid = (p: unknown): p is PlaneacionData => {
  const d = p as PlaneacionData;
  return !!d && Array.isArray(d.asesores) && Array.isArray(d.colegios)
    && d.colegios.every((c) => !!c && typeof c === 'object' && Array.isArray((c as Colegio).servicios));
};

export const loadLocal = (): PlaneacionData | null => {
  try {
    const raw = localStorage.getItem(LS_PLANEACION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; backend?: string; data?: unknown };
    // Solo se acepta el formato versionado actual y del backend actual.
    if (parsed && parsed.v === SCHEMA_V && parsed.backend === PROJECT_REF && valid(parsed.data)) return parsed.data;
  } catch { /* noop */ }
  return null;
};

export const saveLocal = (data: PlaneacionData): void => {
  try { localStorage.setItem(LS_PLANEACION, JSON.stringify({ v: SCHEMA_V, backend: PROJECT_REF, data })); } catch { /* noop */ }
};

// ── Lectura remota (paginada: PostgREST corta en 1000 filas por petición) ─────

const PAGINA = 1000;
async function todas<T>(tabla: string, columnas: string, orden: string): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase.from(tabla).select(columnas)
      .order(orden, { ascending: true }).range(desde, desde + PAGINA - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) break;
  }
  return out;
}

export type LoadRemoteResult =
  | { data: PlaneacionData; source: 'remote'; error?: undefined }
  | { data: null; source: 'none'; error?: unknown };

/** Blob legado (psp_planeacion): SOLO lectura, para el arranque previo al SQL v3.3. */
async function loadRemoteLegado(): Promise<LoadRemoteResult> {
  try {
    const { data, error } = await supabase.from(PLANEACION_TABLE).select('data').eq('id', PLANEACION_ROW).maybeSingle();
    if (error) return { data: null, source: 'none', error };
    const payload = data?.data as unknown;
    if (valid(payload) && payload.colegios.length) return { data: payload, source: 'remote' };
    return { data: null, source: 'none' };
  } catch (e) {
    return { data: null, source: 'none', error: e };
  }
}

export async function loadRemote(): Promise<LoadRemoteResult> {
  try {
    const [cols, ases, ales] = await Promise.all([
      todas<{ data: Colegio }>(T_COLEGIOS, 'data', 'orden'),
      todas<{ id: string; nombre: string }>(T_ASESORES, 'id,nombre', 'orden'),
      todas<{ data: Alerta }>(T_ALERTAS, 'data', 'updated_at'),
    ]);
    if (cols.length) {
      const data: PlaneacionData = {
        colegios: cols.map((r) => r.data),
        asesores: ases.map((r) => ({ id: r.id, nombre: r.nombre })),
        alertas: ales.map((r) => r.data),
      };
      if (valid(data)) {
        void respaldarSiNuevoDia('planeacion', data); // snapshot diario (no bloquea la carga)
        return { data, source: 'remote' };
      }
    }
    // tablas vacías: aún no corre la migración → blob legado (solo lectura)
    return await loadRemoteLegado();
  } catch (e) {
    // tablas inexistentes u otro fallo → blob legado; si tampoco, offline local
    const legado = await loadRemoteLegado();
    return legado.source === 'remote' ? legado : { data: null, source: 'none', error: e };
  }
}

// ── Escrituras por filas (~2 KB por colegio editado) ──────────────────────────

const ahora = () => new Date().toISOString();
type R = { ok: boolean; error?: unknown };
const CHUNK = 400;

export async function guardarColegios(colegios: Colegio[]): Promise<R> {
  if (!colegios.length) return { ok: true };
  try {
    // por bloques: lo normal es 1 fila, pero una restauración puede tocar todas
    for (let i = 0; i < colegios.length; i += CHUNK) {
      const filas = colegios.slice(i, i + CHUNK).map((c) => ({ id: c.id, data: c, updated_at: ahora() }));
      const { error } = await supabase.from(T_COLEGIOS).upsert(filas, { onConflict: 'id' });
      if (error) return { ok: false, error };
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e }; }
}

export async function guardarAsesores(items: { asesor: Asesor; orden: number }[]): Promise<R> {
  if (!items.length) return { ok: true };
  try {
    const filas = items.map(({ asesor, orden }) => ({ id: asesor.id, nombre: asesor.nombre, orden, updated_at: ahora() }));
    const { error } = await supabase.from(T_ASESORES).upsert(filas, { onConflict: 'id' });
    return { ok: !error, error };
  } catch (e) { return { ok: false, error: e }; }
}

export async function guardarAlertas(alertas: Alerta[]): Promise<R> {
  if (!alertas.length) return { ok: true };
  try {
    const filas = alertas.map((a) => ({ id: a.id, data: a, updated_at: ahora() }));
    const { error } = await supabase.from(T_ALERTAS).upsert(filas, { onConflict: 'id' });
    return { ok: !error, error };
  } catch (e) { return { ok: false, error: e }; }
}

/** Reemplazo TOTAL (import de BI, regenerar cupos, restaurar respaldo; roles altos).
 *  Primero upserta lo nuevo (sin hueco destructivo) y al final borra las filas
 *  sobrantes; si ese borrado fallara, quedan filas de más (benigno y reintentable),
 *  nunca filas de menos. */
export async function reemplazarTodoRemoto(data: PlaneacionData): Promise<R> {
  try {
    // 1 · upsert de todo lo nuevo, por bloques
    for (let i = 0; i < data.colegios.length; i += CHUNK) {
      const filas = data.colegios.slice(i, i + CHUNK).map((c, j) => ({ id: c.id, data: c, orden: i + j, updated_at: ahora() }));
      const { error } = await supabase.from(T_COLEGIOS).upsert(filas, { onConflict: 'id' });
      if (error) return { ok: false, error };
    }
    const rAse = await guardarAsesores(data.asesores.map((asesor, orden) => ({ asesor, orden })));
    if (!rAse.ok) return rAse;
    const rAle = await guardarAlertas(data.alertas ?? []);
    if (!rAle.ok) return rAle;

    // 2 · borrar sobrantes (ids que ya no existen en el tablero nuevo)
    const borrar = async (tabla: string, vigentes: Set<string>, orden: string) => {
      const existentes = await todas<{ id: string }>(tabla, 'id', orden);
      const extras = existentes.map((r) => r.id).filter((id) => !vigentes.has(id));
      for (let i = 0; i < extras.length; i += CHUNK) {
        const { error } = await supabase.from(tabla).delete().in('id', extras.slice(i, i + CHUNK));
        if (error) throw error;
      }
    };
    await borrar(T_COLEGIOS, new Set(data.colegios.map((c) => c.id)), 'orden');
    await borrar(T_ASESORES, new Set(data.asesores.map((a) => a.id)), 'orden');
    await borrar(T_ALERTAS, new Set((data.alertas ?? []).map((a) => a.id)), 'updated_at');
    return { ok: true };
  } catch (e) { return { ok: false, error: e }; }
}
