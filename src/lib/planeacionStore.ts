import { supabase, PLANEACION_TABLE, PLANEACION_ROW } from './supabase';
import { LS_PLANEACION } from './localData';
import type { PlaneacionData, Colegio } from '../data/planeacion';

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
    const parsed = JSON.parse(raw) as { v?: number; data?: unknown };
    // Solo se acepta el formato versionado actual; lo demás se ignora.
    if (parsed && parsed.v === SCHEMA_V && valid(parsed.data)) return parsed.data;
  } catch { /* noop */ }
  return null;
};

export const saveLocal = (data: PlaneacionData): void => {
  try { localStorage.setItem(LS_PLANEACION, JSON.stringify({ v: SCHEMA_V, data })); } catch { /* noop */ }
};

export type LoadRemoteResult =
  | { data: PlaneacionData; source: 'remote'; error?: undefined }
  | { data: null; source: 'none'; error?: unknown };

export async function loadRemote(): Promise<LoadRemoteResult> {
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

export async function saveRemote(data: PlaneacionData): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const { error } = await supabase.from(PLANEACION_TABLE)
      .upsert({ id: PLANEACION_ROW, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    return { ok: !error, error };
  } catch (e) {
    return { ok: false, error: e };
  }
}
